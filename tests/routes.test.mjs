import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routePlausible, routeForPlane, lookupRoute, setRouteLoader, routeKm } from '../js/routes.js';

const ap = (icao, city, lat, lon) => ({ icao, city, lat, lon });
const SEA = ap('KSEA', 'Seattle', 47.449, -122.309), SFO = ap('KSFO', 'San Francisco', 37.619, -122.375), DTW = ap('KDTW', 'Detroit', 42.212, -83.353),
  JFK = ap('KJFK', 'New York', 40.639, -73.779), LAX = ap('KLAX', 'Los Angeles', 33.942, -118.408), YYZ = ap('CYYZ', 'Toronto', 43.677, -79.631),
  HKG = ap('VHHH', 'Hong Kong', 22.308, 113.915), ORD = ap('KORD', 'Chicago', 41.978, -87.905), DEN = ap('KDEN', 'Denver', 39.856, -104.674),
  LHR = ap('EGLL', 'London', 51.47, -0.454);
const rt = (from, to, airports) => ({ from, to, airports: airports ?? [from, to] });

test('same airport at both ends is rejected', () => {
  assert.equal(routePlausible(rt(DTW, DTW), { lat: 42.3, lon: -83.3, track: 90, altFt: 5000 }), false);
  assert.equal(routePlausible(rt(DTW, ap('KDTW', 'x', 42.2, -83.3)), {}), false);
});
test('UAL1372 Seattle to San Francisco with a plane nowhere near is rejected', () => {
  // over the Great Lakes heading east
  assert.equal(routePlausible(rt(SEA, SFO), { lat: 43, lon: -85, track: 90, altFt: 36000 }), false);
});
test('plane on the corridor in cruise is accepted', () => {
  assert.ok(routePlausible(rt(SEA, SFO), { lat: 42.5, lon: -122.5, track: 180, altFt: 35000 }));
  assert.ok(routePlausible(rt(JFK, LAX), { lat: 39, lon: -98, track: 255, altFt: 37000 }));
});
test('cruise heading away from the destination is rejected', () => {
  assert.equal(routePlausible(rt(SEA, SFO), { lat: 42.5, lon: -122.5, track: 0, altFt: 35000 }), false);
});
test('plane on climb-out is accepted even when its heading differs (below 10,000 ft)', () => {
  assert.ok(routePlausible(rt(SEA, SFO), { lat: 47.6, lon: -122.2, track: 20, altFt: 4000 }));
  assert.ok(routePlausible(rt(JFK, LAX), { lat: 40.55, lon: -73.9, track: 200, altFt: 2500 }));
});
test('long-haul over the pole (Hong Kong to New York) is accepted on the polar track, rejected on a flat-map line', () => {
  assert.ok(routePlausible(rt(HKG, JFK), { lat: 79, lon: 144, track: 5, altFt: 37000 })); // midpoint of the great circle, near the pole
  assert.equal(routePlausible(rt(HKG, JFK), { lat: 25, lon: -150, track: 90, altFt: 37000 }), false); // Pacific, flat-map line
  assert.ok(routePlausible(rt(LHR, JFK), { lat: 56, lon: -30, track: 275, altFt: 38000 }));
});
test('multi-leg route picks the leg the plane is on', () => {
  const r = rt(SEA, JFK, [SEA, DEN, ORD, JFK]);
  const x = routeForPlane(r, { lat: 41, lon: -97, track: 85, altFt: 36000 }); // between Denver and Chicago
  assert.equal(x.from.icao, 'KDEN'); assert.equal(x.to.icao, 'KORD');
  const y = routeForPlane(r, { lat: 47.5, lon: -121, track: 100, altFt: 6000 });
  assert.equal(y.from.icao, 'KSEA'); assert.equal(y.to.icao, 'KDEN');
  assert.equal(routeForPlane(r, { lat: -30, lon: 20, track: 0, altFt: 36000 }), null);
});
test('no position or no airport coordinates: only the from/to check applies', () => {
  assert.ok(routePlausible(rt(SEA, SFO), {}));
  assert.ok(routePlausible(rt(ap('XXXX', 'x', null, null), SFO), { lat: 0, lon: 0, track: 0, altFt: 30000 }));
});
test('routeKm unchanged', () => assert.ok(Math.abs(routeKm(rt(SEA, SFO)) - 1093) < 15));

test('lookupRoute reads the bundled shards (no network) and filters with a plane', async () => {
  const seen = [];
  setRouteLoader(async (rel) => { seen.push(rel); try { return await readFile(new URL('../data/routes/' + rel, import.meta.url), 'utf8'); } catch { return null; } });
  const r = await lookupRoute('ACA1');
  assert.ok(r && r.from.icao && r.to.icao && r.stops >= 2);
  assert.deepEqual(seen.sort(), ['airports.json', 'r/ACA.json']);
  assert.equal(await lookupRoute('ACA1', { lat: -40, lon: 150, track: 0, altFt: 36000 }), null);
  assert.equal(await lookupRoute('XXX1'), null);
  setRouteLoader(null);
});
