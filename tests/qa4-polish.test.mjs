// QA round 4 polish (2026-11-20): patch title padding, patch rims at toast size, model names kept whole in the daily note,
// the evening mission rule from 5 PM, and the reveal's tappable chips marked with a ›. (Locked captions:
// tests/sky-patch-colours.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = {}; globalThis.localStorage ??= { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('a long patch name wraps inside the detail card\'s padding', () => {
  assert.match(read('css/collection.css'), /\.pv-card h2 \{ box-sizing: border-box; max-width: 100%; padding-inline: 20px; text-align: center; text-wrap: balance;/);
});

test('Sky patches carry an edge outline, shown only at toast size', () => {
  assert.match(read('js/patches.js'), /class="patch-rim" r="\$\{R - 0\.6\}"[^>]*stroke="\$\{SKY_THREAD\}"/);
  const ui = read('css/ui.css');
  assert.match(ui, /\.patch-rim \{ display: none; \} :is\(#toasts, #toast-tray\) \.tn-ic\.art \.patch-rim \{ display: inline; \}/);
  assert.match(read('css/sky-theme.css'), /#toasts \.tn-ic\.art:has\(\.patch\) \{ background:#dce8f2; \}/);
});

test('the daily note keeps model designations on one line, with the card titles\' escName', async () => {
  const { escName } = await import('../js/flight-card.js');
  assert.equal(escName('Boeing 747-8'), 'Boeing <span style="white-space:nowrap">747-8</span>');
  const main = read('js/main.js'), note = main.slice(main.indexOf('function skyDailyNote()'), main.indexOf('function n2Build('));
  assert.doesNotMatch(note, /escapeHtml\(m\.name\)/);
  const sn = await import('../js/sky-note.js'); /* the Sky note's words moved to js/sky-note.js (2026-11-24): its names go through the same escName */
  assert.equal(sn.escName('Boeing 747-8'), escName('Boeing 747-8'));
  assert.match(read('js/sky-note.js'), /const em = \(s\) => `<em>\$\{escName\(s\)\}<\/em>`/);
  assert.match(main, /<b>\$\{o \? escapeHtml\(widgetName\(o\)\) : escName\(md\.name\)\}<\/b>/);
});

test('before the log knows the hours: from 5 PM no props, low planes, old types or helicopters unless seen then', async () => {
  const P = await import('../js/progress.js'); P.setSkyProgress(true);
  const st = { sky: 'quiet', soonSky: 'quiet', total: 40, hours: 6, days: 2, perHour: 2.5, soonOpen: 1, soonRate: 2.5, flags7: { airline: 30, prop: 4, low: 5, heli: 1, oldtype: 3, high: 20 }, flagsSoon: {} };
  for (const h of [17, 18]) { const can = P.skyPossible(st, { owned: true, hour: h }); for (const id of ['prop', 'low', 'heli', 'bands', 'oldtype']) assert.equal(can.has(id), false, `${id} at ${h}:00`); }
  const noon = P.skyPossible(st, { owned: true, hour: 16 }); for (const id of ['prop', 'low', 'heli', 'oldtype']) assert.ok(noon.has(id), `${id} at 4 PM`);
  assert.ok(P.skyPossible({ ...st, flagsSoon: { oldtype: 1 } }, { owned: true, hour: 17 }).has('oldtype'), 'an old type seen at these hours');
});

test('a reveal chip that opens something wears a ›', () => {
  assert.match(read('js/reveal.js'), /if \(!n\.act\) return; c\.classList\.add\('rv-chip--act'\);/);
  assert.match(read('css/reveal.css'), /\.rv-chip--act::after \{ content: '›';/);
});
