import test from 'node:test';
import assert from 'node:assert/strict';
import { climbLevel, xpLevel, climbGeom, climbSvg, FLIGHT_LEVELS } from '../js/rank-climb.js';

const SKY_RANKS = [[0, 'Spotter'], [480, 'Plane Spotter'], [2000, 'Tracker'], [4000, 'Navigator'], [10000, 'Air Traffic Controller'], [25000, 'Chief Pilot'], [50000, 'Ace'], [90000, 'Sky Legend']];
const AT = SKY_RANKS.map((r) => r[0]);

test('the plane sits between its rank level and the next, by XP', () => {
  const G = climbGeom(8);
  assert.equal(climbLevel(1, 0, 8), 1);
  assert.equal(climbLevel(1, 0.5, 8), 1.5);
  assert.equal(climbLevel(7, 0.3, 8), 7); // top rank: at the top
  assert.equal(climbLevel(2, 4, 8), 3); // clamped
  // the plane's height is its level's height, halfway between two levels at halfway
  assert.ok(Math.abs(G.plane(1.5).y - (G.y(1) + G.y(2)) / 2) < 1e-9);
  assert.ok(Math.abs(G.plane(3).y - G.y(3)) < 1e-9);
  assert.ok(G.plane(2).y < G.plane(1).y && G.plane(2).x > G.plane(1).x); // climbing up and to the right
  assert.ok(Math.abs(G.plane(7).y - G.y(7)) < 1); // the top: within a pixel (it stops short of the edge)
});

test('XP to levels, with Sky thresholds', () => {
  assert.equal(xpLevel(0, AT), 0);
  assert.equal(xpLevel(480, AT), 1);
  assert.ok(Math.abs(xpLevel(1240, AT) - 1.5) < 1e-9);
  assert.equal(xpLevel(200000, AT), 7);
});

test('the picture labels every rank from the real list, current highlighted, next tagged with XP to go', () => {
  const svg = climbSvg({ ranks: SKY_RANKS, index: 1, into: (510 - 480) / 1520, xp: 510 });
  for (const f of FLIGHT_LEVELS) assert.ok(svg.includes(`>${f}<`), f);
  assert.ok(svg.includes('AIR TRAFFIC CTRL') && svg.includes('SKY LEGEND'));
  assert.match(svg, /lbc-cur"><line[^]*?PLANE SPOTTER/);
  assert.equal((svg.match(/lbc-past/g) || []).length, 1);
  assert.equal((svg.match(/lbc-fut/g) || []).length, 5);
  assert.ok(svg.includes('NEXT · 1,490 XP TO GO'));
  assert.ok(climbSvg({ ranks: SKY_RANKS, index: 7, into: 1, xp: 95000 }).includes('TOP RANK'));
});
