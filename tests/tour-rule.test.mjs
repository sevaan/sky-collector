import test from 'node:test';
import assert from 'node:assert/strict';
import { tourOnLaunch } from '../js/tour-rule.js';
test('seen to the last card (done), skipped (done) or caught: never again', () => {
  assert.equal(tourOnLaunch({ started: true, tourDone: true, tourResumed: false, hasCatch: false }), 'none');
  assert.equal(tourOnLaunch({ started: true, tourDone: false, tourResumed: false, hasCatch: true }), 'none');
});
test('quit before the last card: resumed once, then counted as done', () => {
  assert.equal(tourOnLaunch({ started: true, tourDone: false, tourResumed: false, hasCatch: false }), 'resume');
  assert.equal(tourOnLaunch({ started: true, tourDone: false, tourResumed: true, hasCatch: false }), 'done');
});
test('a brand-new player is left to the welcome flow', () => {
  assert.equal(tourOnLaunch({ started: false, tourDone: false, tourResumed: false, hasCatch: false }), 'none');
});
