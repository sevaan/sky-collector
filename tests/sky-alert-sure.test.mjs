// Sky Tester 2026-11-20 (Sevaan): "there was a notification saying there was a rare Airbus in the air. But as soon as I
// tapped [...] show me, it said the plane had gone out of range." Plane alerts only for forecasts likely to hold
// (js/sky-alerts.js sure), Today doesn't project old fixes (js/sky-today.js upcoming), and Show me waits for a fresh feed
// answer before saying a plane is gone (js/sky-find.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sure, pickAlert } from '../js/sky-alerts.js';
import { showMeVerdict, goneWords } from '../js/sky-find.js';
import { upcoming } from '../js/sky-today.js';

const now = new Date(2026, 10, 20, 12, 0).getTime(), m = 60e3;
const obs = { lat: 43.68, lon: -79.63 };
// a plane `km` east of you flying west at you
const plane = (o = {}) => ({ hex: 'abc123', lat: obs.lat, lon: obs.lon + (o.km ?? 60) / (111.195 * Math.cos(obs.lat * Math.PI / 180)), hKm: (o.ft ?? 12000) * 0.0003048, altFt: o.ft ?? 12000,
  gs: o.gs ?? 300, track: 270, climb: o.climb ?? 0, climbKnown: o.climbKnown ?? true, turn: 'turn' in o ? o.turn : 0, at: o.at ?? now, type: 'A388', ...(o.heli ? { heli: true } : {}) });
const row = (p) => upcoming([p], obs, now, new Set())[0];

test('a level, steady plane coming well over you is sure; its row says how long it stays up', () => {
  const n = row(plane()); assert.ok(n, 'forecast'); assert.ok(n.inS >= 180 && n.inS <= 600, `in ${n.inS} s`);
  assert.ok(n.upS >= 60, `up ${n.upS} s`); assert.equal(sure(n, now), true);
});
test('climbing out, coming down, turning, slow, low, a helicopter, an old fix, or seen once: not sure', () => {
  for (const [why, o] of [['climbing out', { climb: 2500 }], ['coming down to land', { climb: -1500 }], ['turning', { turn: 2 }],
    ['seen only once', { turn: undefined }], ['no climb rate', { climbKnown: false }], ['slow', { gs: 90, km: 25 }], ['low', { ft: 3000, km: 30 }], ['helicopter', { heli: true }]]) {
    const n = row(plane(o)); if (n) assert.equal(sure(n, now), false, why);
  }
  const old = { ...row(plane()), p: plane({ at: now - 100e3 }) }; assert.equal(sure(old, now), false, 'a fix from before you left');
});
test('a plane only grazing your sky (peak under 25°) is not sure', () => {
  const p = plane(); p.lat += 0.25; /* 28 km to one side */ const n = row(p);
  if (n) { assert.ok(n.peakEl < 25); assert.equal(sure(n, now), false); }
});
test('the alert words say "should", with a clock time and "if it keeps its course"', () => {
  const a = pickAlert([{ arrive: now + 6 * m, name: 'Emirates 242 to Dubai', typeName: 'Airbus A380', dir: 'east', rare: true, isNew: false, sure: true }], [], now);
  assert.match(a.body, /^An Airbus A380 \(Emirates 242 to Dubai\) should be over you about 12:06\sPM, to the east, if it keeps its course\.$/);
  assert.equal(pickAlert([{ arrive: now + 6 * m, name: 'x', dir: 'east', rare: true, isNew: true, sure: false }], [], now), null, 'never an unsure one');
});
test('Today does not project a fix older than 2 minutes (the planes from before you left)', () => {
  assert.ok(row(plane({ at: now - 60e3 })), 'a minute old: still projected');
  assert.equal(row(plane({ at: now - 10 * m })), undefined, 'ten minutes old: not listed as coming over');
});

const up = { plane: { hex: 'abc123' }, az: 90, el: 30, rangeKm: 20 };
const base = { obs, now, lastOk: now - 5e3, maxAgeMs: 70e3 };
test('Show me: up is shown; a plane still coming over is waited for', () => {
  assert.equal(showMeVerdict({ ...base, a: up }), 'show');
  assert.equal(showMeVerdict({ ...base, wait: { az: 90, el: 15, at: now + 2 * m } }), 'wait');
  assert.equal(showMeVerdict({ ...base, a: { ...up, el: 3 }, wait: { az: 90, el: 15, at: now + m } }), 'wait');
});
test('Show me with no fresh feed answer finds first instead of saying "gone"', () => {
  assert.equal(showMeVerdict({ ...base, lastOk: now - 10 * m }), 'find', 'back from the background: answer from before you left');
  assert.equal(showMeVerdict({ ...base, lastOk: now - 20e3, since: now - 2e3 }), 'find', 'answer from before the app came back');
  assert.equal(showMeVerdict({ ...base, lastOk: 0 }), 'find', 'cold start: no answer yet');
  assert.equal(showMeVerdict({ ...base, obs: null }), 'find', 'place not known yet');
  assert.equal(showMeVerdict({ ...base, lastOk: now - 10 * m, final: true }), 'nofeed', 'waited and still no answer: say so');
});
test('Show me says gone only with a fresh answer that does not have it up', () => {
  assert.equal(showMeVerdict({ ...base }), 'gone');
  assert.equal(showMeVerdict({ ...base, a: { ...up, el: 4 } }), 'gone', 'down behind the trees');
  assert.equal(showMeVerdict({ ...base, lastOk: now - 1e3, since: now - 2e3, final: true }), 'gone');
  assert.equal(showMeVerdict({ ...base, wait: { az: 90, el: 15, at: now - 5 * m } }), 'gone', 'a wait long past');
});
test('gone words are honest and point at what is up now', () => {
  assert.match(goneWords({ name: 'Airbus A380', upNow: 3 }), /^Airbus A380 has left your sky: .* 3 other planes are up right now\.$/);
  assert.match(goneWords({ last: { el: 2 }, upNow: 1 }), /^That plane is down near the horizon .* One other plane is up/);
  assert.match(goneWords({}), /Today shows the next ones coming/);
  assert.doesNotMatch(goneWords({ name: 'x' }), /out of range/);
});
