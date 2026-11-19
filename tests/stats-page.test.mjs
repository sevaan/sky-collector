// Sky's stats page (server/stats-page.js, Space Collector's ported 2026-11-19): renders from made-up rows, leaves out the
// website, test-marked installs (every row of an install that ever sent one) and shows the plane kinds and feed numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statsHtml, isTest } from '../server/stats-page.js';

const NOW = Date.parse('2026-11-25T18:00:00Z');
const row = (iid, name, ts, d = {}, extra = {}) => ({ iid, name, ts, rt: ts, v: '0.1.1760', p: 'ios', x: 0, d: JSON.stringify(d), ...extra });
const H = 3600e3;
function sample() {
  const rows = [];
  const real = 'aa'.repeat(12), real2 = 'bb'.repeat(12), sim = 'cc'.repeat(12), web = 'dd'.repeat(12);
  rows.push(row(real, 'install', NOW - 30 * H), row(real, 'open', NOW - 30 * H + 1000), row(real, 'catch', NOW - 29 * H, { k: 'airliner', t: 'rare', n: 1 }), row(real, 'night', NOW - 29 * H, { n: 1, f: 1 }));
  rows.push(row(real, 'catch', NOW - 2 * H, { k: 'heli', t: 'uncommon', n: 1 }), row(real, 'catch', NOW - H, { k: 'balloon', t: 'legendary', n: 1 }), row(real, 'secret', NOW - H, { id: 'balloon' }));
  rows.push(row(real, 'feed', NOW - H, { ph: 200, phOk: 190, rl: 30, rlOk: 30, q: 2, low: 0, sw: '429' }), row(real, 'end', NOW - H + 5000, { c: 3, s: 900 }));
  rows.push(row(real2, 'install', NOW - 3 * H, {}, { p: 'android' }), row(real2, 'catch', NOW - 2.5 * H, { k: 'private', t: 'common', n: 1 }, { p: 'android' }), row(real2, 'feed', NOW - 2 * H, { ph: 40, phOk: 40, rl: 0, rlOk: 0, q: 0, low: 410 }, { p: 'android' }), row(real2, 'end', NOW - 2 * H, { c: 1, s: 700 }, { p: 'android' }));
  /* a simulator: its first rows went out before the app knew (x 0), then marked (x 1): all of it is left out */
  rows.push(row(sim, 'install', NOW - 5 * H), row(sim, 'catch', NOW - 4.9 * H, { k: 'glider', t: 'epic', n: 1 }), row(sim, 'open', NOW - 4.8 * H, {}, { x: 1 }));
  rows.push(row(web, 'install', NOW - 6 * H, {}, { p: 'web', x: 1 }), row(web, 'catch', NOW - 5.9 * H, { k: 'airship', t: 'epic', n: 1 }, { p: 'web', x: 1 }));
  return rows;
}

test('the website and test-marked rows are tests', () => {
  assert.equal(isTest({ p: 'web', x: 0, v: '0.1.1' }), true);
  assert.equal(isTest({ p: 'ios', x: 1, v: '0.1.1' }), true);
  assert.equal(isTest({ p: 'android', x: 0, v: '0.1.1' }), false);
});

test('real players only: no simulator or website catches, plane kinds and the feed shown', () => {
  const html = statsHtml(sample(), { now: NOW, relay: { budget: { used: 1200, quota: 50000 } } });
  assert.match(html, /Sky Collector/);
  assert.match(html, /helicopters 1/); assert.match(html, /balloons 1/); assert.match(html, /private planes 1/);
  assert.doesNotMatch(html, /gliders/); /* the simulator's catch */
  assert.doesNotMatch(html, /airships/); /* the website's catch */
  assert.match(html, /Up, Up and Away 1/);
  assert.match(html, /Plane feed/); assert.match(html, /Asks from phones to adsb.lol<\/th><td>240/); assert.match(html, /429 too many” answers: 2/);
  assert.match(html, /1,200 of 50,000/);
  assert.doesNotMatch(html, /Satellite data|Cards that need art/);
});

test('include tests brings them back', () => {
  const html = statsHtml(sample(), { now: NOW, all: true });
  assert.match(html, /gliders 1/); assert.match(html, /airships 1/);
});
