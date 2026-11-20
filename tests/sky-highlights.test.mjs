// Settings → Circle highlights (QA 2026-11-19): the ring and the ticket use one decision, js/sky-catch.js gainOf / highlightFor.
// Three planes against one profile, in each of the three modes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewFor, gainOf, highlightFor } from '../js/sky-catch.js';
import { cardsFor } from '../js/flights.js';
import { catchSightings } from '../js/sky-cards.js';

const now = Date.UTC(2026, 10, 19, 18), H = 3600e3;
const R = (airline, from, to) => ({ airline, full: { from: { icao: from, city: 'Toronto' }, to: { icao: to, city: 'Somewhere' } } });
const P = (hex, callsign, type) => ({ hex, callsign, type, hKm: 10, track: 0 });
const catchOf = (p, r, time) => { const { flight, plane } = cardsFor(p, r.full, r.airline); return { time, hex: p.hex, callsign: p.callsign, type: p.type, flight, plane }; };
// owned: a 737-800 on WJA100 yesterday; an A320 on ACA851 ten minutes ago
const list = [catchOf(P('aaa111', 'WJA100', 'B738'), R('WestJet', 'CYYZ', 'CYVR'), now - 26 * H),
  catchOf(P('ccc333', 'ACA851', 'A320'), R('Air Canada', 'CYYZ', 'CYYC'), now - 10 * 60e3)].flatMap(catchSightings);
const planes = {
  newType: [P('abc001', 'ACA790', 'B38M'), R('Air Canada', 'CYYZ', 'KLAX')],     // a type and flight you don't have
  stamp: [P('bbb222', 'WJA100', 'B738'), R('WestJet', 'CYYZ', 'CYVR')],          // owned flight + type: a new day, a new aircraft
  caughtToday: [P('ccc333', 'ACA851', 'A320'), R('Air Canada', 'CYYZ', 'CYYC')], // the same aircraft, caught today
  newTypeOwnedFlight: [P('ddd444', 'WJA100', 'B39M'), R('WestJet', 'CYYZ', 'CYVR')], // an owned flight flown by a type you don't have
};
const want = { newType: [1, 1, 1], stamp: [0, 1, 1], caughtToday: [0, 0, 1], newTypeOwnedFlight: [1, 1, 1] };
const gains = { newType: 'new', stamp: 'stamp', caughtToday: 'none', newTypeOwnedFlight: 'new' };

test('Circle highlights lock per mode from the ticket\'s own answer', () => {
  for (const [name, [p, r]] of Object.entries(planes)) {
    assert.equal(gainOf(previewFor({ plane: p }, r, list, now).out), gains[name], name);
    ['new', 'stamps', 'all'].forEach((mode, i) => assert.equal(highlightFor({ plane: p }, r, mode, list, now), !!want[name][i], `${name} in ${mode}`));
  }
});

test('main.js uses the shared decision for the ring and the lock-on sound', () => {
  const src = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(src, /function skyHighlights\(p\)[\s\S]{0,400}skyHighlightFor\(/);
  assert.match(src, /planeHit: state\.planeLock/);
  assert.match(src, /planeShown !== hit\.plane\.hex && state\.planeLock === hit\.plane\.hex\) \{ const now2 = performance\.now\(\); sky\.lockPulseAt/);
});
