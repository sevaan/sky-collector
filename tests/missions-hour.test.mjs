// Playtest 2026-11-20 #11: Sky's missions fit the hour. "Catch a helicopter" and low-plane goals aren't dealt at 1 AM.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { skyPossible, setSkyProgress, missionsFor } = await import('../js/progress.js');
const { noteLocal, localStats, _resetLocal } = await import('../js/sky-local.js');
setSkyProgress(true);
const at = (h) => { const d = new Date(); d.setHours(h, 5, 0, 0); return d.getTime(); };
const st7 = { sky: 'steady', total: 300, flags7: { heli: 2, low: 9, prop: 4, high: 30, wide: 5, airline: 80 }, flagsSoon: {}, soonOpen: 0 };

test('with nothing known about this hour: no helicopter, propeller or low-plane missions at night', () => {
  const night = skyPossible(st7, { owned: true, hour: 1 });
  for (const id of ['heli', 'prop', 'low', 'bands']) assert.equal(night.has(id), false, id);
  assert.ok(night.has('high') && night.has('airlines3') && night.has('again'));
  const day = skyPossible(st7, { owned: true, hour: 13 });
  for (const id of ['heli', 'prop', 'low', 'bands']) assert.equal(day.has(id), true, id);
});

test('once the app has been open at these hours, what flew then decides (day or night)', () => {
  const quietNight = { ...st7, soonOpen: 3, flagsSoon: { high: 4, airline: 6 } };
  const c = skyPossible(quietNight, { hour: 1 });
  assert.equal(c.has('heli'), false); assert.equal(c.has('low'), false); assert.ok(c.has('high'));
  const heliNight = { ...st7, soonOpen: 3, flagsSoon: { heli: 1, airline: 6 } }; // a hospital helicopter that flies at night
  assert.ok(skyPossible(heliNight, { hour: 1 }).has('heli'));
  const morning = { ...st7, soonOpen: 3, flagsSoon: { airline: 6 } }; // no helicopter at these hours lately, though one at others
  assert.equal(skyPossible(morning, { hour: 9 }).has('heli'), false);
});

test('a 1 AM deal never asks for a helicopter or a low plane', () => {
  const can = skyPossible(st7, { owned: true, hour: 1 });
  for (let n = 20000; n < 20200; n++) for (const m of missionsFor(String(n), can)) assert.ok(!['heli', 'low', 'bands', 'prop'].includes(m.id), `${n}: ${m.id}`);
});

test('localStats knows which flags flew in the coming hours on past days', () => {
  _resetLocal(null); store.clear();
  const realNow = Date.now;
  try {
    Date.now = () => at(14);
    noteLocal([{ type: 'EC35', flags: ['heli', 'low'] }], true, 14);
    noteLocal([{ type: 'B77W', flags: ['wide', 'high', 'airline'] }], true, 1);
    const night = localStats(at(1)), day = localStats(at(13));
    assert.equal(night.flagsSoon.heli, undefined); assert.equal(night.flagsSoon.wide, 1); assert.equal(night.soonOpen, 1);
    assert.equal(day.flagsSoon.heli, 1); assert.equal(day.soonOpen, 1);
    assert.equal(night.flags7.heli, 1); // the whole week's flags are still there
  } finally { Date.now = realNow; }
});
