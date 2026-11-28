// Sky Build playtest v0.1.1809 (iPhone 17e simulator): Find's names readable by day, the first catch's "No planes over you"
// withdrawn once a plane is up, the reveal's patch chip opens the patch, no EVENTS foot on Sky's rank card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstUp, UP_MIN_EL } from '../js/sky-up.js';
import { TIER_INFO } from '../js/rarity.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));
const DAY_BG = hex('#eef5fb'), NIGHT_BG = hex('#0b1626');

test('Find by day: names, times, the empty line and tier words in Sky ink, 4.5:1 or better on the light page', () => {
  const css = read('css/sky-theme.css');
  const rule = (sel) => { const i = css.indexOf(sel); assert.ok(i >= 0, `missing ${sel}`); return css.slice(i, css.indexOf('}', i)); };
  const name = rule('html.sky-cards:not(.sky-night) .fd-main b, html.sky-cards:not(.sky-night) .fd-pass b {').match(/color:(#[0-9a-f]{6})/)[1];
  const muted = rule('html.sky-cards:not(.sky-night) :is(.find-none, .fd-main small, .fd-wait) {').match(/color:(#[0-9a-f]{6})/)[1];
  for (const c of [name, muted]) assert.ok(contrast(hex(c), DAY_BG) >= 4.5, `${c} on the day page`);
  assert.match(rule('html.sky-cards:not(.sky-night) :is(.fd-pass .fd-w em, .fd-main small em) {'), /color-mix\(in srgb, var\(--c\) 45%, #0d2238\)/);
  for (const [k, t] of Object.entries(TIER_INFO)) if (t.color) assert.ok(contrast(mix(hex(t.color), hex('#0d2238'), 0.45), DAY_BG) >= 4.5, `${k} tier word by day`);
  // the old cream was close to 1:1 here: what the playtest saw
  assert.ok(contrast(hex('#fff2b3'), DAY_BG) < 1.5);
});

test('Find at night: the New card pill is the night red, not day red on navy', () => {
  const css = read('css/sky-theme.css');
  const c = css.match(/html\.sky-cards\.sky-night \.fd-pill\.new \{ color:(#[0-9a-f]{6}); \}/)[1];
  assert.ok(contrast(hex(c), NIGHT_BG) >= 4.5);
  assert.ok(contrast(hex('#b42a20'), NIGHT_BG) < 4.5);
});

const P = (hex, el, rangeKm = 20) => ({ plane: { hex }, az: 90, el, rangeKm });
test('the first catch waits only while nothing is up by the shared rule (js/sky-up.js)', () => {
  assert.equal(firstUp([]), null); assert.equal(firstUp(null), null);
  assert.equal(firstUp([P('low', UP_MIN_EL - 1)]), null); // under the trees: still nothing up
  assert.equal(firstUp([P('a', 6, 5)])?.plane.hex, 'a'); // up, though under 8°: the toast goes (the playtest's case)
  assert.equal(firstUp([P('near-low', 6, 5), P('good', 30, 40), P('better', 40, 20)])?.plane.hex, 'better'); // room to line up first, nearest
  assert.equal(firstUp([P('top', 80, 3), P('edge', 6, 9)])?.plane.hex, 'top');
});

test('skyFirstWait withdraws its toast with dropToast once firstUp finds a plane', () => {
  const main = read('js/main.js'), f = main.slice(main.indexOf('function skyFirstWait()'), main.indexOf('/* Rare visitors'));
  assert.match(f, /firstUp\(state\.planes\.positions\(state\.observer\), isNight\(state\.frame\?\.sunEl\)\)/);
  assert.match(f, /toast\(state\.planes\?\.status === 'failing' \? 'Can’t reach the plane feed[^;]*'No planes over you right now\.[^;]*\{ id: W \}\)/); // the feed-down words when it's down (playtest 2026-11-27)
  assert.match(f, /if \(a\) \{ clearInterval\(iv\); dropToast\(W\);/);
  assert.match(f, /\}, 1000\);/);
  assert.doesNotMatch(f, /a\.el >= 8 && a\.el <= 75/); // its own threshold is gone
});

test('the reveal\'s patch chip opens that patch in the Collection', () => {
  const main = read('js/main.js'), cards = read('js/cards-page.js');
  assert.match(main, /kind: 'patch', text: a\.name, act: `patch:\$\{a\.id\}`/);
  assert.match(main, /String\(e\.detail\)\.startsWith\('patch:'\)\) \{ closePanel\('reveal'\); duckMusic\(false\); setTimeout\(\(\) => openCollection\(e\.detail\), 450\)/);
  assert.match(cards, /if \(String\(key\)\.startsWith\('patch:'\)\) \{ const id = key\.slice\(6\); setView\('patches'\);[^\n]*openPatch\(id/);
});

test('Sky\'s rank card has no EVENTS foot (sky events are off)', () => {
  const cards = read('js/cards-page.js');
  assert.match(cards, /\$\{SKY \? '' \/\*[^*]*\*\/ : `<div class="lb-foot"><div class="lb-head">EVENTS/);
});
