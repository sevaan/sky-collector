// More plane patches (js/sky-patches.js) read off sightings through js/progress.js.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { progress, setSkyProgress } = await import('../js/progress.js'); setSkyProgress(true);
const YYZ = { icao: 'CYYZ', city: 'Toronto', cc: 'CA', lat: 43.68, lon: -79.63 }, YVR = { icao: 'CYVR', city: 'Vancouver', cc: 'CA', lat: 49.19, lon: -123.18 };
const LHR = { icao: 'EGLL', city: 'London', cc: 'GB', lat: 51.47, lon: -0.45 }, SYD = { icao: 'YSSY', city: 'Sydney', cc: 'AU', lat: -33.95, lon: 151.18 }, LAX = { icao: 'KLAX', city: 'Los Angeles', cc: 'US', lat: 33.94, lon: -118.41 };
const HKG = { icao: 'VHHH', city: 'Hong Kong', cc: 'HK', lat: 22.31, lon: 113.92 }, JFK = { icao: 'KJFK', city: 'New York', cc: 'US', lat: 40.64, lon: -73.78 };
let T = new Date(2026, 5, 10, 14, 0).getTime();
const fl = (from, to, cs, o = {}) => { const t = o.time ?? (T += 3600e3); return { cardKey: `F:${cs.slice(0, 3)}:${from.icao}-${to.icao}`, objectId: cs, callsign: cs, typeCode: o.type ?? 'B789', time: t, lat: o.lat ?? 43.66, lon: o.lon ?? -79.58, sunEl: o.sunEl, wx: o.wx, cardSnapshot: { sky: 'flight', from, to, km: o.km } }; };
const pl = (type, o = {}) => { const t = o.time ?? (T += 3600e3); return { cardKey: `P:${type}`, objectId: type, callsign: o.cs ?? '', typeCode: type, time: t, lat: 43.66, lon: -79.58, sunEl: o.sunEl, wx: o.wx, cardSnapshot: { sky: 'plane', glyph: o.heli ? 'heli' : 'jet' } }; };
const done = (list) => new Set(progress(list, () => ({ tier: 'common' }), { keep: false }).achievements.filter((x) => x.done).map((x) => x.id));

test('home run and outbound: a flight landing at, or leaving, an airport near you', () => {
  const d = done([fl(YVR, YYZ, 'ACA101'), fl(YYZ, LHR, 'ACA856', { km: 5700 })]);
  assert.ok(d.has('sky-homerun') && d.has('sky-outbound'));
});
test('red-eye, coast to coast, equator, date line, pole hopper', () => {
  const d = done([fl(YYZ, LHR, 'ACA856', { km: 5700, time: new Date(2026, 5, 11, 2).getTime() }), fl(YYZ, YVR, 'ACA115', { km: 3340 }), fl(LAX, SYD, 'QFA12', { km: 12000 }), fl(JFK, HKG, 'CPA831', { km: 12980 })]);
  assert.ok(d.has('sky-redeye')); assert.ok(!d.has('sky-coast'), 'Toronto–Vancouver is 3,340 km');
  assert.ok(d.has('sky-equator') && d.has('sky-dateline') && d.has('sky-pole'));
});
test('streaks and rush hour', () => {
  const day = (n) => new Date(2026, 6, 1 + n, 12).getTime();
  assert.ok(done([0, 1, 2, 3, 4, 5, 6].map((n) => pl('A320', { time: day(n) }))).has('sky-seven'));
  assert.ok(!done([0, 1, 2, 4, 5, 6, 7].map((n) => pl('A320', { time: day(n) }))).has('sky-seven'), 'a gap breaks it');
  const t0 = day(20); assert.ok(done([0, 1, 2, 3, 4].map((m) => pl('A320', { time: t0 + m * 120e3 }))).has('sky-rush'));
});
test('golden hour, overcast, snow, four seasons', () => {
  const d = done([pl('A320', { sunEl: 3, time: new Date(2026, 5, 1, 20).getTime() }), pl('B738', { wx: { cloud: 100, code: 3 } }), pl('E75L', { wx: { cloud: 100, code: 73 } })]);
  assert.ok(d.has('sky-golden') && d.has('sky-clouds') && d.has('sky-snow'));
  assert.ok(!done([pl('A320', { sunEl: 3, time: new Date(2026, 5, 1, 7).getTime() })]).has('sky-golden'), 'sunrise is not golden hour here');
  assert.ok(done([0, 3, 6, 9].map((m) => pl('A320', { time: new Date(2026, m, 15, 12).getTime() }))).has('sky-seasons'));
});
test('alliances, four engines, turboprops, rotors, distance', () => {
  const d = done(['ACA1', 'UAL2', 'DLH3', 'SWR4', 'ANA5'].map((cs) => pl('A320', { cs })).concat([pl('B744'), pl('A388')]));
  assert.ok(d.has('sky-star') && d.has('sky-quad')); assert.ok(!d.has('sky-oneworld'));
  assert.ok(done(['DH8D', 'AT76', 'AT45', 'SF34', 'B190', 'PC12', 'C208', 'BE20', 'E120', 'JS41'].map((t) => pl(t))).has('sky-turboprop10'));
  assert.ok(!done(['C172', 'PA28', 'SR22', 'DH8D', 'AT76', 'AT45', 'SF34', 'B190', 'PC12', 'C208'].map((t) => pl(t))).has('sky-turboprop10'), 'pistons are not turboprops');
  assert.ok(done(['EC35', 'B407', 'R44'].map((t) => pl(t, { heli: true }))).has('sky-rotors3'));
  assert.ok(done(Array.from({ length: 4 }, () => fl(JFK, HKG, 'CPA831', { km: 12980 }))).has('sky-world'));
});
