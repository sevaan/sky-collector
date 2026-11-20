// App icon picker rules (2026-11-19, Space Collector's tests with Sky's list): Original is free, the other seven need
// Plus, a lapsed Plus goes back to Original.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ICONS, iconById, iconAllowed, iconToUse } from '../js/app-icons.js';

test('eight icons, Original first and free, the rest Plus with a native name each', () => {
  assert.equal(ICONS.length, 8);
  assert.equal(ICONS[0].id, 'original'); assert.equal(ICONS[0].plus, false); assert.equal(ICONS[0].native, null);
  for (const ic of ICONS.slice(1)) { assert.equal(ic.plus, true); assert.match(ic.native, /^Icon[A-Z]\w+$/); assert.match(ic.id, /^[a-z]+$/); }
  assert.equal(new Set(ICONS.map((i) => i.native)).size, 8);
});
test('every icon has its picture for the picker', () => {
  for (const ic of ICONS) assert.ok(existsSync(new URL(`../assets/art/app-icons/${ic.id}.webp`, import.meta.url)), ic.id);
});
test('who may use what', () => {
  assert.equal(iconAllowed('original', false), true);
  assert.equal(iconAllowed('airmail', false), false);
  assert.equal(iconAllowed('airmail', true), true);
});
test('a lapsed Plus or an unknown id falls back to Original', () => {
  assert.equal(iconToUse('cockpit', true), 'cockpit');
  assert.equal(iconToUse('cockpit', false), 'original');
  assert.equal(iconToUse('nope', true), 'original');
  assert.equal(iconById(null).id, 'original');
});
