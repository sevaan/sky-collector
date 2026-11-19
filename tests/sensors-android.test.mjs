// Android pointing through the real js/sensors.js (2026-11-18): both orientation streams, as Chrome sends them.
// relative: deviceorientation (absolute false), its own zero; absolute: deviceorientationabsolute (north + the magnetometer).
// Simulated sensors only: the testers' phones decide whether this reaches everyone.
import test from 'node:test';
import assert from 'node:assert/strict';

const handlers = {}, store = {};
globalThis.screen = { orientation: { angle: 0 } };
globalThis.window = { addEventListener: (name, fn) => { handlers[name] = fn; } };
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.DeviceOrientationEvent = function DeviceOrientationEvent() {};
let clock = 1000; globalThis.performance = { now: () => clock };

const sensors = await import('../js/sensors.js');
await sensors.startSensors();
const { pointing } = sensors;

const azOf = (v) => (Math.atan2(v[0], v[1]) * 180 / Math.PI + 360) % 360;
const wrap = (d) => ((d % 360) + 540) % 360 - 180;
const ALPHA0 = 37; // the relative stream's arbitrary zero
/* one tick: the phone upright (beta 90), camera at true azimuth `az`; the magnetometer adds `mag`. W3C alpha turns
   counter-clockwise, so azimuth = −alpha. */
function tick(az, { mag = 0, rel = true, abs = true, beta = 90 } = {}) {
  clock += 1000 / 60;
  if (abs) handlers.deviceorientationabsolute({ alpha: (360 - az - mag + 720) % 360, beta, gamma: 0, absolute: true });
  if (rel) handlers.deviceorientation({ alpha: (360 - az + ALPHA0 + 720) % 360, beta, gamma: 0, absolute: false });
}
const viewAz = () => azOf(sensors.trueBasis().back);

test('both streams: the view comes from the relative one, north from the absolute one', () => {
  for (let i = 0; i < 600; i++) tick(180); /* 10 s */
  assert.equal(pointing.source, 'fused');
  assert.ok(Math.abs(wrap(viewAz() - 180)) < 0.5, `faces south, got ${viewAz()}`);
});

test('a steady phone, the magnetometer jumps 90° for 2 s: the sky stays put, and the refusal is noted', () => {
  let worst = 0;
  for (let i = 0; i < 300; i++) { tick(180, { mag: i > 60 && i < 180 ? 90 : 0 }); worst = Math.max(worst, Math.abs(wrap(viewAz() - 180))); }
  console.log('  steady + 2 s glitch through sensors.js: worst error', Math.round(worst * 10) / 10, '° (the old way: 90°)');
  assert.ok(worst < 1); assert.ok(pointing.compassRefusedAt > 0);
});

test('a slow real turn follows the turn', () => {
  let worst = 0;
  for (let i = 0; i < 1200; i++) { const az = 180 + i * 0.2; tick(az); worst = Math.max(worst, Math.abs(wrap(viewAz() - az))); }
  assert.ok(worst < 1, `worst ${worst}`);
});

test('the relative stream stops: back to the old direct compass', () => {
  for (let i = 0; i < 120; i++) tick(90, { rel: false });
  assert.equal(pointing.source, 'absolute');
  assert.ok(Math.abs(wrap(viewAz() - 90)) < 0.5);
  for (let i = 0; i < 120; i++) tick(90); /* and it comes back */
  assert.equal(pointing.source, 'fused');
});

test('switched off (dial or Testing tools): the old way, the magnetometer drives the sky', () => {
  sensors.fuseSwitch('off');
  for (let i = 0; i < 60; i++) tick(180, { mag: 90 });
  assert.equal(pointing.source, 'absolute');
  assert.ok(Math.abs(wrap(viewAz() - 270)) < 0.5); /* 180 + 90: the glitch shows, as before */
  sensors.fuseSwitch(''); sensors.setFuseDial(false);
  for (let i = 0; i < 60; i++) tick(180);
  assert.equal(pointing.source, 'absolute');
  sensors.setFuseDial(true);
  for (let i = 0; i < 600; i++) tick(180);
  assert.equal(pointing.source, 'fused');
  assert.ok(Math.abs(wrap(viewAz() - 180)) < 0.5);
});
