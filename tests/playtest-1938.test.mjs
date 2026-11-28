// Sky Build's playtest of v0.1.1938 (2026-11-28): the rarity named for its card, the tour's radar label, one country
// count on Today, and plane photos in the paint of the airline you caught.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { planePhotoFor, noteTypeAirlines } = await import('../js/flight-card.js');
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('a type photo in another airline\'s paint gives way to the airline you first caught it with; private catches never count', () => {
  noteTypeAirlines([]); assert.match(planePhotoFor('CRJ9').title, /DLH/);
  noteTypeAirlines([{ time: 1, type: 'CRJ9', callsign: 'N123AB' }]); assert.match(planePhotoFor('CRJ9').title, /DLH/);
  noteTypeAirlines([{ time: 2, type: 'CRJ9', callsign: 'JZA1' }, { time: 1, type: 'CRJ9', callsign: 'EDV4815' }]); assert.match(planePhotoFor('CRJ9').title, /Endeavor/);
  assert.match(planePhotoFor('A320').title, /House colors/); // a maker's paint stays
  noteTypeAirlines([]);
});
test('the Collect panel and Today name which card the rarity is for', () => {
  assert.match(read('js/sky-catch.js'), /noun = flight && plane \? \(byPlane \? kindWord\(p\) : 'flight'\) : ''/);
  assert.match(read('js/main.js'), /noun: tf && tp \? \(byPlane \?/);
});
test('Today\'s map says right now and leaves the country count to the board', () => {
  const t = read('js/sky-today.js'); assert.match(t, /are over you right now/); assert.doesNotMatch(t, /\} are over you<\/div>/);
});
test('the tour\'s radar label is navy on the pale sky', () => {
  assert.match(read('css/sky-theme.css'), /body\.sky-only\.ob-tour #radar-up, body\.sky-only\.ob-tour #radar-up b \{ color:#0d2238 !important/);
});
