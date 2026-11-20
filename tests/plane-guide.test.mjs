// Show me lets go of a plane once it's caught (2026-11-20, Sevaan: "caught the plane but the plane is still selected"),
// Space Collector's letGoOf rule, and of a plane gone from the feed or below the horizon after 5 s (js/plane-guide.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { letGoAfterCatch, keepWhileUp, LOST_MS } from '../js/plane-guide.js';

const G = (hex) => ({ hex, name: 'To Deer Lake', lostAt: null, wait: null });

test('catching the Show me plane lets go of it; catching another plane keeps the guide', () => {
  assert.equal(letGoAfterCatch(G('c0ffee'), 'c0ffee'), null);
  const g = G('c0ffee');
  assert.equal(letGoAfterCatch(g, 'abc123'), g);
  assert.equal(letGoAfterCatch(null, 'c0ffee'), null);
  assert.equal(letGoAfterCatch(g, undefined), g);
});

test('a plane missing from the positions is let go after 5 s; back in time, the clock restarts', () => {
  const g = G('c0ffee');
  assert.equal(keepWhileUp(g, false, 1000), g);
  assert.equal(keepWhileUp(g, false, 1000 + LOST_MS), g);
  assert.equal(keepWhileUp(g, true, 1000 + LOST_MS + 10), g); assert.equal(g.lostAt, null);
  assert.equal(keepWhileUp(g, false, 20000), g);
  assert.equal(keepWhileUp(g, false, 20000 + LOST_MS + 1), null);
  assert.equal(keepWhileUp(null, true, 0), null);
});

test('main.js: the capture lets go once both cards are saved, and the circle check reads planeHit.hex', () => {
  const src = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const cap = src.slice(src.indexOf('async function capturePlane('), src.indexOf('function planeKind('));
  const save = cap.indexOf('await withTimeout(addSighting(x)'), letGo = cap.lastIndexOf('letGoAfterCatch(state.planeGuide');
  assert.ok(save > 0 && letGo > save, 'the guide is let go after the save loop (the flight and plane cards both), not before');
  assert.ok(cap.indexOf("prep.out.kind === 'none'") < cap.indexOf('letGoAfterCatch'), 'View card (already caught today) lets go too');
  assert.doesNotMatch(src, /state\.planeHit\s*[!=]==\s*(g|pb\.plane)\.hex/, 'planeHit is { hex, at }, never a bare hex');
  const tick = src.slice(src.indexOf('function planeGuideTick('), src.indexOf('function renderPlane('));
  assert.match(tick, /keepWhileUp\(g, false, t\)/);
});
