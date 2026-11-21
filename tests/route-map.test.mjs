// The Collection's route map (js/route-map.js, 2026-11-21): an arc for each boarding pass, the longest one picked out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeMap, mappable, kmBetween, greatCircle } from '../js/route-map.js';

const ap = (iata, city, lat, lon) => ({ iata, icao: `X${iata}`, city, lat, lon });
const YYZ = ap('YYZ', 'Toronto', 43.68, -79.63), LHR = ap('LHR', 'London', 51.47, -0.45), ICN = ap('ICN', 'Seoul', 37.46, 126.44), YYC = ap('YYC', 'Calgary', 51.13, -114.01);
const pass = (from, to, tier = 'common') => ({ key: `F:${from.iata}-${to.iata}`, from, to, tier, airline: 'Air Canada', callsign: 'ACA1' });

test('distances and great circles', () => {
  assert.ok(Math.abs(kmBetween(YYZ, LHR) - 5710) < 40);
  const gc = greatCircle(YYZ, ICN, 10);
  assert.equal(gc.length, 11);
  assert.ok(Math.max(...gc.map(([, lat]) => lat)) > 60, 'Toronto to Seoul goes over the Arctic');
});

test('passes without both airports placed are left out', () => {
  assert.equal(mappable([pass(YYZ, LHR), { key: 'F:x', from: { iata: 'ABC', lat: null, lon: null }, to: LHR }, null]).length, 1);
  assert.equal(routeMap([]), null);
  assert.equal(routeMap([{ key: 'F:y', from: YYZ, to: YYZ }]), null);
});

test('the map: counts, the longest route, and no location of the player', () => {
  const m = routeMap([pass(YYZ, LHR, 'rare'), pass(YYZ, YYC), pass(YYZ, ICN)]);
  assert.equal(m.count, 3);
  assert.equal(m.airports, 4);
  assert.equal(m.longest.pass.to.iata, 'ICN');
  assert.match(m.svg, /class="rm-arc rm-top"/);
  assert.match(m.svg, /class="rm-arc gold"/, 'a rare pass (not the longest) is drawn in gold');
  assert.equal((m.svg.match(/class="rm-arc/g) || []).length, 3);
  assert.doesNotMatch(m.svg, /NaN|Infinity/);
});

test('one domestic pass still fits the card', () => {
  const m = routeMap([pass(YYZ, YYC)], { W: 335, H: 196 });
  const nums = [...m.svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)"/g)].map((x) => [+x[1], +x[2]]);
  for (const [x, y] of nums) assert.ok(x > 0 && x < 335 && y > 0 && y < 196, `${x},${y} on the card`);
});

test('the same two airports are one arc, whichever way and airline; only the first 30 arcs draw in', () => {
  const m = routeMap([pass(YYZ, YYC), { ...pass(YYC, YYZ), key: 'F:WJA:YYC-YYZ', airline: 'WestJet' }, pass(YYZ, LHR)]); /* the repeat isn't the longest, which is drawn as the top arc */
  assert.equal(m.count, 3);
  assert.equal(m.routes, 2);
  assert.match(m.svg, /rm-rep/);
  const many = [];
  for (let i = 0; i < 80; i++) many.push(pass(YYZ, ap(`A${i}`, `City ${i}`, 20 + (i % 40), -120 + i * 2)));
  const big = routeMap(many);
  assert.equal(big.routes, 80);
  assert.equal((big.svg.match(/rm-still/g) || []).length, 80 - 1 - 30);
  assert.match(big.svg, /rm-busy/);
});
