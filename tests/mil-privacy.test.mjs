// Military aircraft never show a callsign, registration or real hex, whatever callsign they fly under (QA 2026-11-19),
// but keep their type (Sevaan 2026-11-19: a real C-17 or B-2 plane card, never a flight card).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanes as parse, isAnonymous } from '../js/planes.js';
import { cardsFor } from '../js/flights.js';
const feed = (ac) => ({ now: Date.now() / 1000, ac: [{ hex: 'ae1234', lat: 45, lon: -75, alt_baro: 20000, alt_geom: 20100, gs: 300, track: 90, dbFlags: 0, ...ac }] });
for (const [flight, t] of [['AFR123', 'C130'], ['XYZ123', 'KC10'], ['ACA856', 'C17']]) {
  test(`a ${t} flying as ${flight} is anonymous but keeps its type: no callsign, registration or real hex`, () => {
    assert.equal(isAnonymous({ flight, t, dbFlags: 0 }), true);
    const [p] = parse(feed({ flight, t, r: '12-3456' }));
    assert.equal(p.anon, true); assert.equal(p.callsign, ''); assert.equal(p.reg, ''); assert.notEqual(p.hex, 'ae1234'); assert.equal(p.type, t); assert.equal(p.cls, 'mil'); assert.equal(p.clsOp, undefined);
  });
}
test('an airliner type under an airline callsign still shows its callsign', () => {
  const [p] = parse(feed({ flight: 'ACA856', t: 'A333', r: 'C-GHKR' }));
  assert.equal(p.anon, false); assert.equal(p.callsign, 'ACA856');
});
test('a military or government catch is a plane card with its type and no flight card, even with a route', () => {
  const route = { callsign: 'RCH123', from: { icao: 'KDOV', city: 'Dover', cc: 'US', lat: 39.1, lon: -75.5 }, to: { icao: 'ETAR', city: 'Ramstein', cc: 'DE', lat: 49.4, lon: 7.6 }, airline: 'US Air Force' };
  for (const [flight, t, cls, db] of [['RCH123', 'C17', 'mil', 0], ['XYZ1', 'B2', 'mil', 1], ['UKP12', 'EC35', 'gov', 0], ['POL1', 'AS50', 'gov', 0]]) {
    const [p] = parse(feed({ flight, t, r: 'X-1', dbFlags: db, category: 'A5' }));
    assert.equal(p.type, t); assert.equal(p.callsign, ''); assert.equal(p.cls, cls, flight);
    const { flight: f, plane } = cardsFor(p, route, 'US Air Force');
    assert.equal(f, null, `${flight}: no flight card`);
    assert.equal(plane.key, `P:${t}`); assert.equal(plane.type, t); assert.equal(plane.stamp, ''); assert.equal(plane.reg, ''); assert.equal(plane.caught.op, undefined);
  }
  const [c17] = parse(feed({ flight: 'RCH123', t: 'C17' })), [b2] = parse(feed({ flight: '', t: 'B2', dbFlags: 1 }));
  assert.equal(cardsFor(c17, null, '').plane.setId, 'military'); assert.equal(cardsFor(b2, null, '').plane.tier, 'epic');
  assert.equal(cardsFor(b2, null, '').plane.name, 'Northrop B-2 Spirit');
});
