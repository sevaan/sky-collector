// Plane alerts (js/sky-alerts.js): only worth-it planes, 2 minutes ahead, at most 3 a day, 30 minutes apart, never in quiet hours.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickAlert, pickRegular, allowed } from '../js/sky-alerts.js';
const now = new Date(2026, 10, 19, 12, 0).getTime(), m = 60e3;
const c = (min, o = {}) => ({ arrive: now + min * m, name: 'Air Canada 856 to London', dir: 'west', isNew: true, rare: false, ...o });
test('a new card coming over in 8 minutes: told 2 minutes before; nothing for planes you have', () => {
  const a = pickAlert([c(8)], [], now); assert.equal(a.at, now + 6 * m); assert.match(a.body, /over you about 12:08\sPM, to the west\. A new card/);
  assert.equal(pickAlert([c(8, { isNew: false })], [], now), null);
  assert.equal(pickAlert([c(20)], [], now), null, 'too far ahead to know');
  assert.equal(pickAlert([c(2)], [], now), null, 'too soon to be worth a notification');
});
test('a rare visitor first; its words', () => {
  const a = pickAlert([c(5), c(9, { rare: true, isNew: false, name: 'Emirates 241 to Toronto', typeName: 'Airbus A380' })], [], now);
  assert.match(a.title, /Rare visitor: an Airbus A380/); assert.match(a.body, /^An Airbus A380 \(Emirates 241 to Toronto\) will be over you/);
});
test('at most 3 a day, 30 minutes apart, never in quiet hours', () => {
  assert.equal(allowed([now - 10 * m], now), false); assert.equal(allowed([now - 40 * m], now), true);
  assert.equal(allowed([now - 300 * m, now - 200 * m, now - 100 * m], now), false);
  assert.equal(pickAlert([c(8)], [], now, () => true), null);
});
test('a regular you do not have yet: 5 minutes before its usual time', () => {
  const r = pickRegular([{ callsign: 'UAL582', next: now + 60 * m, name: 'United 582 to San Francisco', clock: '1:00 PM' }], [], now);
  assert.equal(r.at, now + 55 * m); assert.match(r.body, /isn't in your collection yet/);
});
