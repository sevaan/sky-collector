// Send cards (js/gift.js): the link round trip, and the rules for receiving and moving.
import test from 'node:test';
import assert from 'node:assert/strict';
import { packGift, unpackGift, giftCode, readGiftCode, codeFrom, giftLink, packLink, packIdFrom, planImport, summarizeImport, giftTags, pickHighlights, backupId, SAME_MOMENT_MS } from '../js/gift.js';

const N = (d, h = 20) => Date.UTC(2026, 10, d, h + 5, 10); // evening in Toronto
const sight = (key, t, extra = {}) => ({ objectId: key, cardKey: key, time: t, lat: 44.3123, lon: -78.3456, az: 120.4, el: 41.6, mag: 1.23, rangeKm: 612.7, name: key.toUpperCase(), type: 'satellite', sim: false, key: Math.random(), ...extra });
const levelOf = (list, card) => { if (card?.natural) return list.length ? 'bronze' : 'none'; const n = new Set(list.map((s) => Math.floor(s.time / 86400e3))).size; return n >= 10 ? 'gold' : n >= 3 ? 'silver' : n ? 'bronze' : 'none'; };

test('a pack survives the link: same ids, places to ~10 km, nothing local leaks', async () => {
  const list = [sight('25544', N(1), { shiny: 'eclipse' }), sight('moon', N(2), { stampKey: 'MOON:4', phase: 'Full Moon' }), sight('STARLINK', N(3), { objectId: '61001', stampKey: 'STARLINK:2026-166' })];
  const code = await giftCode(packGift(list, { from: 'Dad', bid: 'abc', deals: { [String(Math.floor((N(1) - 78.3456 / 15 * 3600e3 - 12 * 3600e3) / 86400e3))]: ['m1'] } }));
  assert.match(code, /^g1[A-Za-z0-9~-]+$/); // no underscores: chats eat them
  assert.equal(codeFrom(giftLink(code)), code);
  assert.equal(codeFrom(`spacecollector://c#${code}`), code);
  const g = await readGiftCode(code);
  assert.equal(g.from, 'Dad'); assert.equal(g.bid, 'abc');
  assert.deepEqual(g.sightings.map(backupId), list.slice().sort((a, b) => a.time - b.time).map(backupId)); // the same sightings everywhere
  const iss = g.sightings.find((s) => s.cardKey === '25544');
  assert.equal(iss.lat, 44.3); assert.equal(iss.lon, -78.3); assert.equal(iss.shiny, 'eclipse'); assert.equal(iss.from, 'Dad'); assert.equal(iss.key, undefined);
  assert.equal(g.sightings.find((s) => s.cardKey === 'moon').stampKey, 'MOON:4');
  assert.equal(g.sightings.find((s) => s.cardKey === 'STARLINK').objectId, '61001');
  assert.equal(Object.keys(g.deals).length, 1);
});

test('a code whose data starts with a digit still reads', async () => {
  for (let i = 0; i < 40; i++) { const code = await giftCode(packGift([sight(String(25000 + i), N(1) + i)])); assert.equal((await readGiftCode(code)).sightings.length, 1); }
});

test('a cut-off or newer link says so', async () => {
  const code = await giftCode(packGift([sight('25544', N(1))]));
  await assert.rejects(readGiftCode(code.slice(0, code.length - 12)), /cut/);
  await assert.rejects(readGiftCode(`g2${code.slice(2)}`), /newer/);
  assert.throws(() => unpackGift({ v: 2 }), /newer/);
});

test('a big collection still fits in a link', async () => {
  const list = []; for (let i = 0; i < 1700; i++) list.push(sight(String(10000 + (i * 37) % 4000), N(1) + i * 61000 + Math.floor(i / 40) * 86400e3));
  const code = await giftCode(packGift(list));
  assert.ok(code.length < 30000, `1,700 sightings: ${code.length} characters`);
});

test('receiving: duplicates and the same moment are skipped, the rest added', () => {
  const mine = [sight('25544', N(1)), sight('20580', N(2))];
  const incoming = [
    { ...mine[0] },                                  // the very same sighting (opened twice)
    sight('20580', N(2) + SAME_MOMENT_MS - 60000),  // caught together, 9 min apart
    sight('20580', N(3)),                            // a different night
    sight('48274', N(3)),                            // new card
    sight('48274', N(3)),                            // twice in the link
  ];
  const p = planImport(mine, incoming);
  assert.equal(p.dup, 2); assert.equal(p.same, 1); assert.equal(p.add.length, 2);
});

test('receiving: what each card gains, and its tags', () => {
  const mine = [sight('jup', N(1)), sight('jup', N(2)), sight('moon', N(1), { stampKey: 'MOON:1' }), sight('hst', N(1))];
  const add = [sight('jup', N(3)), sight('moon', N(3), { stampKey: 'MOON:3' }), sight('moon', N(4), { stampKey: 'MOON:4' }), sight('new', N(3)), sight('hst', N(3), { shiny: 'eclipse' })];
  const sum = summarizeImport(mine, add, { cardOf: (k) => ({ key: k, tier: k === 'new' ? 'rare' : 'common', natural: k === 'moon' ? 'moon' : undefined }), levelOf });
  const by = Object.fromEntries(sum.map((x) => [x.key, x]));
  assert.deepEqual(giftTags(by.jup), [['up', '+1 night'], ['up', 'Now Silver']]);
  assert.deepEqual(giftTags(by.moon), [['up', '+2 phases']]);
  assert.deepEqual(giftTags(by.new), [['new', 'New']]);
  assert.deepEqual(giftTags(by.hst), [['up', '+1 night'], ['shiny', 'Shiny']]);
  assert.equal(pickHighlights(sum).at(-1).key, 'new'); // the best card comes last
});

test('a fleet card never turns shiny, and gains launches', () => {
  const sum = summarizeImport([sight('STARLINK', N(1), { stampKey: 'S:1' })], [sight('STARLINK', N(2), { stampKey: 'S:2', shiny: 'eclipse' })], { cardOf: () => ({ launches: [1] }), levelOf });
  assert.equal(sum[0].shinyGain, false); assert.deepEqual(giftTags(sum[0]), [['up', '+1 launch']]);
});

test('short links: the pack id from any form of the link', () => {
  assert.equal(packIdFrom(packLink('HWqmCPZ')), 'HWqmCPZ');
  assert.equal(packIdFrom('https://spacecollector.app/c/HWqmCPZ?app=tester'), 'HWqmCPZ');
  assert.equal(packIdFrom('sctester://c/HWqmCPZ'), 'HWqmCPZ');
  assert.equal(packIdFrom('spacecollector://c?p=HWqmCPZ'), 'HWqmCPZ');
  assert.equal(packIdFrom('https://spacecollector.app/c/#g1abc'), null);
  assert.equal(packIdFrom('https://spacecollector.app/c/HWqmCPZx'), null);
});
