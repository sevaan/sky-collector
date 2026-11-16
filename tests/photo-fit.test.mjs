import test from 'node:test';
import assert from 'node:assert/strict';
import { fitStyle } from '../js/photo-fit.js';

test('wide frame, plane fits the vertical slice: cover, y centred on the box', () => {
  // 4:3 photo in a 2.3:1 strip shows 58% of the height
  const r = fitStyle([0.1, 0.4, 0.9, 0.7], 1280, 960, 460, 200);
  assert.equal(r.mode, 'cover');
  const [x, y] = r.objectPosition.split(' ').map(parseFloat);
  assert.equal(x, 50);
  const v = (1280 / 960) / (460 / 200), start = y / 100 * (1 - v);
  assert.ok(start <= 0.4 && start + v >= 0.7); // visible band holds the box
});

test('box too tall for the strip: contain', () => {
  assert.deepEqual(fitStyle([0, 0.1, 1, 0.9], 1280, 960, 460, 200), { mode: 'contain' });
});

test('box wider than a tall frame shows: contain', () => {
  assert.deepEqual(fitStyle([0.05, 0.3, 0.95, 0.7], 1280, 853, 300, 400), { mode: 'contain' });
});

test('box near an edge is clamped to the photo', () => {
  const r = fitStyle([0, 0, 0.3, 0.2], 1200, 800, 400, 400);
  assert.equal(r.mode, 'cover');
  assert.equal(r.objectPosition, '0% 50%');
  const r2 = fitStyle([0.8, 0.1, 1, 0.3], 1200, 800, 400, 400);
  assert.equal(r2.objectPosition, '100% 50%');
});

test('same aspect with full box: cover at centre', () => {
  assert.deepEqual(fitStyle([0, 0, 1, 1], 800, 600, 400, 300), { mode: 'cover', objectPosition: '50% 50%' });
});

test('missing box or bad sizes degrade safely', () => {
  assert.equal(fitStyle(null, 800, 600, 400, 300).mode, 'cover');
  assert.equal(fitStyle(null, 800, 600, 460, 200).mode, 'contain');
  assert.equal(fitStyle([0, 0, 1, 1], 0, 600, 400, 300).mode, 'contain');
});
