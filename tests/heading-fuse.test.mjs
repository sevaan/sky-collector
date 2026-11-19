// js/heading-fuse.js on synthetic sensor traces (60 readings a second). "Today" = Android's current behaviour: the
// sky follows the absolute stream directly, so its error is whatever the magnetometer says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshFuse, fuseStep } from '../js/heading-fuse.js';

const wrap = (d) => ((d % 360) + 540) % 360 - 180;
/* run: truth(t) = where the camera really points; rel(t) = the gyro's azimuth (its own zero, may drift); mag(t) = what the
   magnetometer adds to the truth (the glitch); upright(t). Returns the worst error of the fused view and of today's. */
function run({ ms, truth, rel = (t, a) => a + 37, mag = () => 0, upright = () => true }) {
  let s = freshFuse(), worst = 0, worstToday = 0, prevA = truth(0);
  for (let t = 0; t <= ms; t += 1000 / 60) {
    const a = truth(t), dps = Math.abs(wrap(a - prevA)) * 60; prevA = a;
    const relAz = (rel(t, a) + 360) % 360, absAz = (a + mag(t) + 360) % 360;
    s = fuseStep(s, { t, relAz, absAz, upright: upright(t), dps });
    if (t > 9000 && s.offset != null) { /* after the early seconds */
      const view = relAz + s.offset;
      worst = Math.max(worst, Math.abs(wrap(view - a))); worstToday = Math.max(worstToday, Math.abs(wrap(absAz - a)));
    }
  }
  return { worst: Math.round(worst * 10) / 10, today: Math.round(worstToday * 10) / 10, s };
}

test('a steady phone, the magnetometer jumps 90° for 2 s: the sky stays put', () => {
  const r = run({ ms: 30000, truth: () => 180, mag: (t) => (t > 15000 && t < 17000 ? 90 : 0) });
  console.log('  steady + 2 s glitch: worst error fused', r.worst, '°, today', r.today, '°');
  assert.ok(r.worst < 1); assert.equal(r.today, 90);
});

test('the glitch lasts 5 s while the phone is held still: still not taken (no movement to hide it in)', () => {
  const r = run({ ms: 30000, truth: () => 180, mag: (t) => (t > 15000 && t < 20000 ? 90 : 0) });
  assert.ok(r.worst < 1);
});

test('a slow real turn with a noisy compass: the view follows the turn', () => {
  let seed = 1; const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 6; };
  const r = run({ ms: 40000, truth: (t) => (t / 1000) * 12, mag: () => noise() });
  console.log('  slow turn, ±3° compass noise: worst error fused', r.worst, '°, today', r.today, '°');
  assert.ok(r.worst < 4);
});

test('tipped overhead: the compass is ignored while the phone points high', () => {
  let seed = 7; const junk = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 360; };
  const r = run({ ms: 30000, truth: () => 90, upright: (t) => !(t > 12000 && t < 22000), mag: (t) => (t > 12000 && t < 22000 ? junk() : 0) });
  console.log('  overhead with a wild compass: worst error fused', r.worst, '°, today', r.today, '°');
  assert.ok(r.worst < 1);
});

test('a real correction (the magnet is gone, 40° off for good) is taken once the phone moves', () => {
  /* the first 20 s the magnetometer reads 40° off (a case magnet); then it reads true. The phone sways ±20° slowly. */
  const r = run({ ms: 40000, truth: (t) => 180 + 20 * Math.sin(t / 1500), mag: (t) => (t < 20000 ? 40 : 0) });
  assert.ok(Math.abs(wrap(r.s.offset - 323)) < 3); /* rel = truth + 37, so the right offset is −37, i.e. 323 */
});

test('gyro drift (0.05°/s) is followed while the phone moves', () => {
  const r = run({ ms: 120000, truth: (t) => 180 + 30 * Math.sin(t / 2000), rel: (t, a) => a + 37 + (t / 1000) * 0.05 });
  console.log('  gyro drift 6° over 2 min: worst error fused', r.worst, '°');
  assert.ok(r.worst < 4);
});
