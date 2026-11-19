// Sky Collector's secrets (js/sky-secrets.js): detection on real readsb records (adsb.lol, 2026-11-19) and edge cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { secretsForCatch, lighterThanAir, isGlider, isVintage, sixContinents, continentOf, tagOf, SKY_SECRET_PATCHES } from '../js/sky-secrets.js';
const live = JSON.parse(readFileSync(new URL('../scripts/perf/fixtures/secrets-live.json', import.meta.url), 'utf8')).ac;
const yyz = JSON.parse(readFileSync(new URL('../scripts/perf/fixtures/planes-yyz.json', import.meta.url), 'utf8'));
const find = (t, pred = () => true) => live.find((a) => a.t === t && pred(a));
const as = (a) => ({ ...a, callsign: String(a.flight ?? '').trim(), type: a.t, altFt: a.alt_geom ?? a.alt_baro });

test('real records: the BelugaXL is the Whale, the balloon is a balloon, the DC-3 is vintage', () => {
  assert.ok(secretsForCatch(as(find('A337'))).includes('whale'));
  const ball = find('BALL'); assert.equal(ball.category, 'A7', 'the live balloon claims to be a rotorcraft'); assert.equal(lighterThanAir(ball), 'balloon');
  assert.ok(secretsForCatch(as(ball)).includes('balloon'));
  assert.ok(isVintage(as(find('DC3'))));
});
test('real records: GLID on an airliner at 35,000 ft is not a glider; a slow, low one is', () => {
  for (const g of live.filter((a) => a.t === 'GLID')) { const air = /^[A-Z]{3}\d/.test(String(g.flight ?? '').trim()); if (air) assert.equal(isGlider(g), false, g.flight); }
  assert.equal(isGlider({ t: 'GLID', category: 'B1', gs: 55, alt_baro: 4500, flight: 'DGLID' }), true);
  assert.equal(isGlider({ category: 'B1', gs: 0, alt_baro: 0 }), false, 'not moving');
});
test('the recorded Toronto feed has no secrets but the everyday ones', () => {
  const found = new Set((yyz.ac ?? yyz.aircraft).flatMap((a) => secretsForCatch(as(a), { el: 30 })));
  for (const id of ['whale', 'heavylift', 'firebird', 'hurricane', 'balloon', 'airship', 'glider', 'vintage', 'overhead']) assert.ok(!found.has(id), id);
});
test('each rule', () => {
  assert.ok(secretsForCatch({ type: 'B738', callsign: 'ACA1' }, { el: 88.5 }).includes('overhead'));
  assert.ok(!secretsForCatch({ type: 'B738', callsign: 'ACA1' }, { el: 87 }).includes('overhead'));
  assert.ok(secretsForCatch({ type: 'A124' }).includes('heavylift')); assert.ok(secretsForCatch({ type: 'BLCF' }).includes('heavylift'));
  assert.ok(secretsForCatch({ type: 'CL2T' }).includes('firebird'));
  assert.equal(tagOf({ flight: 'NOAA43 ' }), 'hurricane'); assert.equal(tagOf({ flight: 'TEAL71' }), '', 'the Air Force hurricane hunters are military');
  assert.ok(secretsForCatch({ type: 'P3', tag: 'hurricane' }).includes('hurricane'));
  assert.ok(secretsForCatch({ type: 'B77W', callsign: 'UAE1', gs: 560 }).includes('jetstream'));
  assert.ok(!secretsForCatch({ type: 'C25B', callsign: '', gs: 560 }).includes('jetstream'), 'airliners only');
  assert.ok(secretsForCatch({ type: 'GLF6', altFt: 51000 }).includes('ceiling'));
  assert.ok(secretsForCatch({ type: 'A320', callsign: 'ACA12' }, { others: [{ callsign: 'ACA899' }] }).includes('formation'));
  assert.ok(!secretsForCatch({ type: 'A320', callsign: 'ACA12' }, { others: [{ callsign: 'WJA899' }] }).includes('formation'));
  assert.equal(lighterThanAir({ t: 'SHIP', gs: 30 }), 'airship'); assert.equal(lighterThanAir({ category: 'B2', gs: 35 }), 'balloon');
  assert.ok(isVintage({ type: 'C172', year: 1968 }, new Date(2026, 10, 19).getTime())); assert.ok(!isVintage({ type: 'C172', year: 1990 }));
});
test('Six Continents', () => {
  const f = (cc) => ({ to: { cc } });
  assert.equal(sixContinents(['GB', 'US', 'BR', 'ZA', 'JP'].map(f)), false);
  assert.equal(sixContinents(['GB', 'US', 'BR', 'ZA', 'JP', 'AU'].map(f)), true);
  assert.equal(continentOf('XK'), 'EU');
});
test('every secret has a name and a sentence', () => { for (const p of Object.values(SKY_SECRET_PATCHES)) { assert.ok(p.name && /\.$/.test(p.text), p.id); } });
test('a type the aircraft cannot be is dropped (the H125 typed BALL stays a helicopter; GLID on an airliner)', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem() {} };
  const { parsePlanes, isHelicopter } = await import('../js/planes.js');
  const now = Date.now(), base = { lat: 43.6, lon: -79.5, seen_pos: 0 };
  const [h, g, b] = parsePlanes({ now, ac: [{ ...base, hex: 'a1', flight: 'H125P', t: 'BALL', category: 'A7', alt_baro: 1500, gs: 63 }, { ...base, hex: 'a2', flight: 'ACA1228', t: 'GLID', category: 'A3', alt_baro: 35000, gs: 483 }, { ...base, hex: 'a3', flight: 'N801XR', t: 'BALL', category: 'A7', alt_baro: 11200, gs: 0.7 }] });
  assert.equal(h.type, ''); assert.equal(isHelicopter(h), true);
  assert.equal(g.type, '');
  assert.equal(b.type, 'BALL'); assert.equal(isHelicopter(b), false);
});
test('the local helicopter or a private plane: a new day is a small stamp, the same day nothing', async () => {
  const { assess, planeLine, planeStampInfo } = await import('../js/sky-stamps.js');
  const d1 = new Date(2026, 10, 1, 12).getTime(), d2 = d1 + 86400e3;
  const list = [{ time: d1, hex: '~abc', callsign: '', plane: { key: 'P:EC35' } }];
  assert.equal(assess(list, { time: d1 + 3600e3, hex: '~abc', plane: { key: 'P:EC35', daily: true } }).kind, 'none', 'same day');
  const o = assess(list, { time: d2, hex: '~abc', plane: { key: 'P:EC35', daily: true } });
  assert.equal(o.kind, 'stamp'); assert.equal(o.planeStamps.day, true); assert.equal(o.planeStamps.count, 1, 'still one aircraft');
  assert.equal(assess(list, { time: d2, hex: 'c0ffee', callsign: 'ACA1', plane: { key: 'P:EC35' } }).planeStamps.day, false, 'airline aircraft: aircraft stamps only');
  assert.match(planeLine(planeStampInfo([...list, { time: d2, hex: '~abc', plane: { key: 'P:EC35' } }], 'P:EC35'), 'EC135'), /seen on 2 days/);
});
