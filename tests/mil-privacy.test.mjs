// Military aircraft never show a callsign, registration or real hex, whatever callsign they fly under (QA 2026-11-19).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanes as parse, isAnonymous } from '../js/planes.js';
const feed = (ac) => ({ now: Date.now() / 1000, ac: [{ hex: 'ae1234', lat: 45, lon: -75, alt_baro: 20000, alt_geom: 20100, gs: 300, track: 90, dbFlags: 0, ...ac }] });
for (const [flight, t] of [['AFR123', 'C130'], ['XYZ123', 'KC10'], ['ACA856', 'C17']]) {
  test(`a ${t} flying as ${flight} is anonymous: no callsign, registration, real hex or type`, () => {
    assert.equal(isAnonymous({ flight, t, dbFlags: 0 }), true);
    const [p] = parse(feed({ flight, t, r: '12-3456' }));
    assert.equal(p.anon, true); assert.equal(p.callsign, ''); assert.equal(p.reg, ''); assert.notEqual(p.hex, 'ae1234'); assert.equal(p.type, '');
  });
}
test('an airliner type under an airline callsign still shows its callsign', () => {
  const [p] = parse(feed({ flight: 'ACA856', t: 'A333', r: 'C-GHKR' }));
  assert.equal(p.anon, false); assert.equal(p.callsign, 'ACA856');
});
