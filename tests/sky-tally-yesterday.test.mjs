// Yesterday's tally and the best-ever farthest (js/sky-today.js; content/sky-today-note-copy-2026-11-24.md F): kept on the
// phone when the day rolls over, one day for yesterday, until beaten for the best; places only, never a callsign.
import test from 'node:test';
import assert from 'node:assert/strict';
const store = {}; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const T = await import('../js/sky-today.js');
const key = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const yday = key(new Date(new Date().setHours(12, 0, 0, 0)).getTime() - 86400e3), older = key(Date.now() - 3 * 86400e3);

test('the day that rolls over becomes yesterday\'s tally, with no callsign', () => {
  T._rollTally({ day: yday, planes: 212, airlines: ['Air Canada', 'WestJet'], countries: ['CA', 'US', 'TR'], far: { km: 8170, city: 'Istanbul', callsign: 'THY18', type: 'B77W' } });
  const y = T.yesterdayTally();
  assert.deepEqual(y, { day: yday, planes: 212, airlines: 2, countries: 3, far: { km: 8170, city: 'Istanbul' } });
  assert.doesNotMatch(store.skyTallyY, /THY18/);
});
test('the best-ever farthest is kept until beaten; an older day is not yesterday', () => {
  assert.equal(T.bestFar().city, 'Istanbul');
  T._rollTally({ day: older, planes: 5, far: { km: 600, city: 'Montréal' } });
  assert.equal(T.bestFar().city, 'Istanbul', 'a shorter one does not replace it');
  assert.equal(T.yesterdayTally().planes, 212, 'an older day does not become yesterday');
  T._rollTally({ day: older, far: { km: 12000, city: 'Hong Kong' } });
  assert.equal(T.bestFar().km, 12000);
});
