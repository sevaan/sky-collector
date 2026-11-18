// The approved loop rules (docs/DESIGN-LOOP.md, 2026-11-17): tiers, sets, "Rare here", sized missions, Sky's XP and ranks.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, String(v)); }, removeItem(k) { this.m.delete(k); } };
const { typeTier } = await import('../js/sky-tiers.js');
const { planeSet, flightSet, setLevel, PLANE_SETS } = await import('../js/sky-sets.js');
const { flightTier, retier, cardsFor } = await import('../js/flights.js');
const { noteLocal, localStats, rareHere, _resetLocal } = await import('../js/sky-local.js');
const { SKY_MISSIONS, setSkySize, setSkyProgress, RANKS } = await import('../js/progress.js');

test('plane tiers: one tier everywhere, icons lifted by hand', () => {
  assert.equal(typeTier('B738'), 'common'); assert.equal(typeTier('B789'), 'common'); // long-haul twins are in the world's top 15
  assert.equal(typeTier('DH8D'), 'uncommon'); assert.equal(typeTier('L410'), 'rare');
  assert.equal(typeTier('B744'), 'epic'); assert.equal(typeTier('A388'), 'epic'); assert.equal(typeTier('A124'), 'legendary');
  assert.equal(typeTier('EC35', true), 'rare'); assert.equal(typeTier(''), 'common');
});
test('flight tiers: distance bands, cargo is Rare not Epic, ultra-long is Legendary', () => {
  assert.equal(flightTier(400, 'ACA'), 'common'); assert.equal(flightTier(3000, 'ACA'), 'uncommon'); assert.equal(flightTier(6000, 'ACA'), 'rare');
  assert.equal(flightTier(11000, 'ACA'), 'epic'); assert.equal(flightTier(15300, 'SIA'), 'legendary');
  assert.equal(flightTier(900, 'FDX'), 'rare'); assert.equal(flightTier(11000, 'FDX'), 'epic'); assert.equal(flightTier(null, 'ACA'), 'common');
});
test('plane sets: families, and the Cessna 172 is not a C-17', () => {
  assert.equal(planeSet('C172').id, 'light'); assert.equal(planeSet('C17').id, 'military'); assert.equal(planeSet('A124').id, 'rarebirds'); assert.equal(planeSet('B744').id, 'giants');
  assert.equal(planeSet('B38M').id, 'b737'); assert.equal(planeSet('A21N').id, 'a320'); assert.equal(planeSet('B77W').id, 'twinaisle');
  assert.equal(planeSet('E75L').id, 'regional'); assert.equal(planeSet('DH8D').id, 'props'); assert.equal(planeSet('C56X').id, 'bizjets');
  assert.equal(planeSet('EC35', true).id, 'helicopters'); assert.equal(planeSet('ZZZZ').id, 'others');
  for (const s of PLANE_SETS) assert.ok(s.goals[0] <= s.goals[1] && s.goals[1] <= s.goals[2]);
});
test('flight sets: measured from the flight, the same in any country', () => {
  const ap = (cc) => ({ cc });
  assert.equal(flightSet(300, ap('FR'), ap('FR'), 'AFR').id, 'hops'); assert.equal(flightSet(900, ap('JP'), ap('JP'), 'ANA').id, 'home');
  assert.equal(flightSet(800, ap('FR'), ap('DE'), 'DLH').id, 'nextdoor'); assert.equal(flightSet(6000, ap('GB'), ap('US'), 'BAW').id, 'crossings');
  assert.equal(flightSet(11000, ap('AE'), ap('US'), 'UAE').id, 'longway'); assert.equal(flightSet(700, ap('US'), ap('US'), 'FDX').id, 'cargo');
  assert.equal(flightSet(3000, ap('CA'), ap('MX'), 'ACA').id, 'world'); assert.equal(setLevel({ goals: [2, 3, 5] }, 3), 2);
});
test('a card saved under old rules takes today\'s tier and set', () => {
  const old = { sky: 'flight', key: 'F:FDX:KMEM-CYYZ', km: 1500, tier: 'epic', set: 'Cargo', from: { cc: 'US' }, to: { cc: 'CA' }, airlineIcao: 'FDX' };
  retier(old); assert.equal(old.tier, 'rare'); assert.equal(old.setId, 'cargo');
  const pl = retier({ sky: 'plane', key: 'P:B789', tier: 'common' }); assert.equal(pl.tier, 'common'); assert.equal(pl.setId, 'twinaisle');
  const made = cardsFor({ type: 'B744', callsign: 'BAW93', reg: 'G-CIVB' }, null, 'British Airways').plane; assert.equal(made.tier, 'epic'); assert.equal(made.setId, 'giants');
});
test('"Rare here": under 1% of 200+ aircraft seen at this place', () => {
  _resetLocal({ d: {} });
  noteLocal(Array.from({ length: 150 }, () => ({ type: 'B738', flags: ['airline'] })), true);
  assert.equal(rareHere('A359'), false); // not enough seen yet
  noteLocal([...Array.from({ length: 60 }, () => ({ type: 'A320' })), { type: 'A359', flags: ['wide', 'high'] }], true);
  const st = localStats(); assert.equal(st.total, 211); assert.equal(st.hours, 2);
  assert.equal(rareHere('A359'), true); assert.equal(rareHere('B738'), false); assert.equal(rareHere(''), false); assert.equal(rareHere('B748'), true); // never seen here
  assert.equal(st.flags7.wide, 1); assert.equal(st.sky, 'new'); // under 3 open hours: no size yet
});
test('missions sized to the sky', () => {
  const m = SKY_MISSIONS.find((x) => x.id === 'airlines3'), cs = (a) => ({ callsign: `${a}123` });
  setSkySize('quiet'); assert.match(m.text, /an airline flight/); assert.equal(m.done([cs('ACA')]), true);
  setSkySize('busy'); assert.match(m.text, /five different airlines/); assert.equal(m.done([cs('ACA'), cs('WJA'), cs('DAL')]), false);
  setSkySize('steady'); assert.equal(m.done([cs('ACA'), cs('WJA'), cs('DAL')]), true);
  assert.equal(SKY_MISSIONS.find((x) => x.id === 'rarehere').done([{ rareHere: true }]), true);
});
test('Sky ranks: the first two stretched, Space Collector\'s restored when off', () => {
  setSkyProgress(true); assert.deepEqual(RANKS.slice(0, 4).map((r) => r[0]), [0, 700, 2000, 4000]); assert.equal(RANKS[1][1], 'Plane Spotter');
  setSkyProgress(false); assert.deepEqual(RANKS.slice(0, 3).map((r) => r[0]), [0, 500, 1500]); assert.equal(RANKS[1][1], 'Spotter');
});
test('distances follow the Units setting; missions say them in the player\'s units', async () => {
  globalThis.navigator ??= { language: 'en-CA' };
  const { dist, distText, speed } = await import('../js/units.js');
  localStorage.setItem('units', 'metric'); assert.deepEqual(dist(1234), { v: '1,234', u: 'km' }); assert.match(SKY_MISSIONS.find((x) => x.id === 'far').text, /3,000 km/);
  localStorage.setItem('units', 'imperial'); assert.deepEqual(dist(1000), { v: '621', u: 'mi' }); assert.equal(speed(800).u, 'mph'); assert.match(SKY_MISSIONS.find((x) => x.id === 'far').text, /1,900 mi/);
  assert.equal(distText(null), '— mi'); localStorage.setItem('units', 'metric');
});
test('no coverage: sixty good answers from the feed and never a plane', async () => {
  const { noteFeed, noCoverage } = await import('../js/sky-local.js');
  _resetLocal({ d: {} }); for (let i = 0; i < 59; i++) noteFeed(0); assert.equal(noCoverage(), false);
  noteFeed(0); assert.equal(noCoverage(), true); noteFeed(3); assert.equal(noCoverage(), false);
});
test('plane patches count what they say', async () => {
  const { progress, activeAchievements } = await import('../js/progress.js');
  setSkyProgress(true);
  const ids = activeAchievements().map((x) => x.id); for (const id of ['sky-jumbo', 'sky-rotor', 'sky-airlines5', 'sky-fullhangar', 'first']) assert.ok(ids.includes(id), id);
  const t0 = new Date(2026, 10, 10, 14).getTime(), S = (i, o) => ({ time: t0 + i * 60000, cardKey: o.cardKey ?? `K${i}`, objectId: `K${i}`, lat: 44, lon: -78, ...o });
  const list = [S(0, { typeCode: 'B744', callsign: 'BAW93', cardSnapshot: { sky: 'plane', setId: 'giants' } }), S(1, { typeCode: 'A388', callsign: 'UAE241', cardSnapshot: { sky: 'plane' } }),
    S(2, { typeCode: 'DH8D', hex: 'a1', callsign: 'JZA1', cardSnapshot: { sky: 'plane' } }), S(3, { typeCode: 'DH8D', hex: 'a2', callsign: 'POE2', cardSnapshot: { sky: 'plane' } }), S(4, { typeCode: 'AT76', hex: 'a3', callsign: 'WJA3', cardSnapshot: { sky: 'plane' } }),
    S(5, { typeCode: 'B77W', callsign: 'ACA7', cardSnapshot: { sky: 'flight', km: 11000 } }), S(6, { typeCode: 'DH8D', callsign: 'JZA8', cardSnapshot: { sky: 'flight', km: 250 } }), S(7, { typeCode: 'EC35', cardSnapshot: { sky: 'plane', glyph: 'heli' }, rareHere: true })];
  const p = progress(list, () => null, { now: t0 + 3600e3 }), done = new Set(p.achievements.filter((x) => x.done).map((x) => x.id));
  for (const id of ['sky-heavy', 'sky-jumbo', 'sky-superjumbo', 'sky-rotor', 'sky-propday', 'sky-hopper', 'sky-globetrotter', 'sky-airlines5']) assert.ok(done.has(id), `${id} should be earned`);
  for (const id of ['sky-airlines25', 'sky-regular', 'sky-rarehere', 'sky-freightnight', 'sky-fullhangar']) assert.ok(!done.has(id), `${id} should not be earned`);
  setSkyProgress(false);
});

// ---- aircraft the feed has no type for (2026-11-18) ----
import { planeKey, unlisted, glyphFor, cardsFor as cardsFor2, retier as retier2 } from '../js/flights.js';
import { planeSet as planeSet2 } from '../js/sky-sets.js';
test('an aircraft with no type is a card named for its size category', () => {
  const p = { hex: 'c0819f', callsign: 'ACA909', type: '', category: 'A3' };
  assert.equal(planeKey(p), 'P:UNKNOWN-A3');
  const { plane } = cardsFor2(p, null, 'Air Canada');
  assert.equal(plane.name, 'Large Aircraft'); assert.equal(plane.type, ''); assert.equal(plane.stamp, 'Air Canada'); assert.equal(plane.tier, 'common');
  assert.match(unlisted(plane.key).fact, /34 to 136 tonnes/);
  assert.equal(planeKey({ type: '', category: '' }), 'P:UNKNOWN'); assert.equal(unlisted('P:UNKNOWN').name, 'Unidentified Aircraft');
  assert.equal(planeKey({ type: '', category: 'A7' }), 'P:HELI'); assert.equal(unlisted('P:B738'), null);
  assert.equal(planeSet2('UNKNOWN-A1').id, 'light'); assert.equal(planeSet2('UNKNOWN-A3').id, 'others');
});
test('a card saved as plain "Aircraft" is renamed, and a Citation is drawn as a jet', () => {
  const old = retier2({ kind: 'plane', key: 'P:UNKNOWN', name: 'Aircraft', type: 'UNKNOWN', glyph: 'jet' });
  assert.equal(old.name, 'Unidentified Aircraft'); assert.equal(old.type, ''); assert.equal(old.tier, 'common');
  assert.equal(glyphFor('C25B'), 'jet'); assert.equal(glyphFor('C172'), 'prop'); assert.equal(glyphFor('DH8D'), 'prop'); assert.equal(glyphFor('PC24'), 'jet'); assert.equal(glyphFor('B738'), 'jet');
  assert.equal(retier2({ kind: 'plane', key: 'P:C25B', name: 'x', glyph: 'prop' }).glyph, 'jet');
});
