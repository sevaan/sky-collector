// Facts on flight cards (js/flight-facts.js): the order a card turns through them, and the facts worked out from the route.
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeFacts, flightFacts, flightFact, countryName, greatCircle } from '../js/flight-facts.js';
import { AIRLINE_FACTS } from '../js/airline-facts.js';
import { AIRPORT_FACTS } from '../js/airport-facts.js';

const ap = (icao, city, cc, lat, lon) => ({ icao, city, cc, lat, lon });
const YYZ = ap('CYYZ', 'Toronto', 'CA', 43.68, -79.63), YYC = ap('CYYC', 'Calgary', 'CA', 51.13, -114.01), HKG = ap('VHHH', 'Hong Kong', 'HK', 22.31, 113.91);
const SFO = ap('KSFO', 'San Francisco', 'US', 37.62, -122.38), SYD = ap('YSSY', 'Sydney', 'AU', -33.95, 151.18), LHR = ap('EGLL', 'London', 'GB', 51.47, -0.45);
const one = (t) => (t.match(/\*\*[^*]+\*\*/g) ?? []).length === 1 && t.split('**').length === 3;

test('every fact worked out from a route has one bold phrase and is short', () => {
  for (const [a, b] of [[YYZ, YYC], [YYZ, HKG], [SFO, SYD], [LHR, YYZ], [SYD, SFO]]) for (const f of routeFacts({ from: a, to: b })) {
    assert.ok(one(f), f); assert.ok(f.length <= 170, f); assert.doesNotMatch(f, /undefined|NaN|SAR China/, f);
  }
});
test('domestic or international from the two airports, with everyday country names', () => {
  assert.match(routeFacts({ from: YYZ, to: YYC })[0], /both in Canada.*domestic/);
  assert.match(routeFacts({ from: LHR, to: YYZ })[0], /takes off in the United Kingdom and lands in Canada/);
  assert.match(routeFacts({ from: YYZ, to: HKG })[0], /lands in Hong Kong\./);
  assert.equal(countryName('US'), 'the United States'); assert.equal(countryName('CA'), 'Canada'); assert.equal(countryName('ZZ'), ''); assert.equal(countryName(''), '');
});
test('the equator, the date line and the Arctic only when the route really does it', () => {
  const t = (a, b) => routeFacts({ from: a, to: b }).join(' ');
  assert.match(t(SFO, SYD), /equator/); assert.match(t(SFO, SYD), /Date Line/); assert.doesNotMatch(t(SFO, SYD), /Arctic/);
  assert.match(t(YYZ, HKG), /Arctic Circle/); assert.match(t(YYZ, HKG), /Date Line/); assert.doesNotMatch(t(YYZ, HKG), /equator/);
  assert.doesNotMatch(t(YYZ, YYC), /equator|Date Line|Arctic/);
  assert.doesNotMatch(t(LHR, YYZ), /Date Line/);
  const g = greatCircle(YYZ, HKG); assert.ok(g.maxLat > 66.56 && g.dateLine);
  assert.deepEqual(routeFacts({ from: YYZ }), []); assert.deepEqual(routeFacts(null), []);
});
test('a card starts with the distance fact and turns to the next each day, round again, never the same twice running', () => {
  const f = { fact: 'Toronto to Calgary is **2,700 km**, about 4 h in the air.', airlineIcao: 'ACA', from: YYZ, to: YYC };
  const l = flightFacts(f);
  assert.equal(flightFact(f, 1), f.fact); assert.equal(flightFact(f, 0), f.fact);
  assert.equal(flightFact(f, l.length + 1), f.fact);
  for (let n = 1; n < l.length * 2; n++) assert.notEqual(flightFact(f, n), flightFact(f, n + 1));
  assert.equal(new Set(l).size, l.length);
  assert.equal(flightFact({}, 3), '');
});
test('researched airline and airport facts follow the style rules', () => {
  for (const [k, v] of [...Object.entries(AIRLINE_FACTS), ...Object.entries(AIRPORT_FACTS)]) for (const t of [].concat(v)) {
    assert.ok(one(t), `${k}: one bold phrase: ${t}`); assert.ok(t.length >= 60 && t.length <= 200, `${k}: length ${t.length}`);
    assert.doesNotMatch(t, /!|did you know|\b(crash(es|ed)?|accidents?|hijack\w*|wars?|killed)\b/i, `${k}: ${t}`);
  }
});
