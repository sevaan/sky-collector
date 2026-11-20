// Sky Build playtest v0.1.1812 (iPhone 17e simulator, Android emulator), round 2: one rule for what's up on the welcome
// card, the tour waits for the location answer, one patch total, Find's line only claims real days, durations without a
// zero part, Coming over next never repeats its title, the catch label measured to the fraction of a pixel, the pack's art
// kept drawn through a missed tear.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hoursMins, tidyHours } from '../js/flights.js';
import { seenLine, HISTORY_DAYS } from '../js/sky-local.js';
import { nextSub } from '../js/sky-today.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const NB = ' ';

test('durations: no zero part ("2 h", not "2 h 00 m"; "45 minutes", not "0 h 45 m")', () => {
  assert.equal(hoursMins({ h: 2, m: 0 }), `2${NB}h`);
  assert.equal(hoursMins({ h: 1, m: 5 }), `1${NB}h 05${NB}m`);
  assert.equal(hoursMins({ h: 0, m: 45 }), '45 minutes');
  assert.equal(hoursMins(null), '');
  /* cards saved with the old words are tidied when shown */
  assert.equal(tidyHours(`about 2${NB}h 00${NB}m in the air`), `about 2${NB}h in the air`);
  assert.equal(tidyHours(`about 0${NB}h 45${NB}m in the air`), 'about 45 minutes in the air');
  assert.equal(tidyHours(`about 1${NB}h 05${NB}m`), `about 1${NB}h 05${NB}m`);
  /* the boarding pass's estimate and the countdowns say it the same way */
  assert.match(read('js/flight-card.js'), /const airLine = [^\n]*hoursMins\(/);
  assert.match(read('js/main.js'), /cd\.textContent = h \? `\$\{h\} h\$\{m \? ` \$\{m\} min` : ''\}`/);
});

test('Find: a fresh install never claims 30 days of history; a visit is a day', () => {
  const stats = (days, typeDays, today = []) => ({ days, typeDays: new Map(Object.entries(typeDays)), typesToday: new Set(today) });
  /* two minutes in: 8 different 737-800s on day one is still one day, said as today */
  assert.equal(seenLine('B738', stats(1, { B738: 1 }, ['B738'])), 'Flew over you today');
  assert.equal(seenLine('B738', stats(2, { B738: 1 }, [])), ''); /* not seen today, not enough history: nothing */
  assert.equal(seenLine('B738', stats(HISTORY_DAYS, { B738: 2 }, ['B738'])), `Seen near you on 2 of ${HISTORY_DAYS} days`);
  assert.equal(seenLine('B738', stats(9, { B738: 9 })), 'Seen near you all 9 days you’ve looked');
  assert.equal(seenLine('?', stats(9, { '?': 9 })), '');
  assert.doesNotMatch(read('js/cards-page.js'), /near you in the last 30 days/);
});

test('Coming over next: the second line never repeats the title', () => {
  const p = { type: 'B738' };
  const sub = nextSub('Boeing 737-800', p, 0);
  assert.equal(sub, 'from the north');
  assert.equal(nextSub('Air Canada', p, 90), 'Boeing 737-800 · from the east');
  assert.equal(nextSub('Aircraft', {}, 180), 'from the south');
});

test('the welcome card counts what is up by the radar\'s rule (js/sky-up.js)', () => {
  const src = read('js/main.js'), i = src.indexOf("const live = () => { const el = card.querySelector('#wc-live')");
  assert.ok(i > 0); const line = src.slice(i, src.indexOf('\n', i));
  assert.match(line, /n = planesUp\(state\.planes\.positions\(state\.observer\)\)\.length/);
});

test('one patch total: the card, the wall and the stats share patchWall, and the albums are counted every time', () => {
  const src = read('js/cards-page.js');
  assert.doesNotMatch(src, /albums: state\.albums/); /* the first logbook ran before the albums were listed */
  assert.doesNotMatch(src, /state\.albums \?\?=/);
  const op = src.slice(src.indexOf('function openPatch('), src.indexOf('$(\'pv-position\')', src.indexOf('function openPatch(')));
  assert.match(op, /patchWall\(\)/);
  assert.doesNotMatch(op, /fossilFound|SECRET_PATCHES/);
});

test('the tour: a step that asks the system waits for the answer before the next card rises, and the rising card never spins', () => {
  const src = read('js/main.js');
  assert.match(src, /const h = steps\[k\]\.hold\?\.\(\); if \(h\) \{ holding = true;/);
  assert.match(src, /Object\.assign\(steps\[0\], \{ onYes: \(\) => \{[^\n]*requestLocation\(\{ onAnswer/);
  const css = read('css/app.css');
  assert.doesNotMatch(css, /\.tc\.waiting \.acts:not\(\.pick\) \.yes::after/);
  assert.match(css, /\.tc \.acts \.yes\.working::after \{/);
  assert.match(read('js/native.js'), /onAnswer\?\.\(\)/);
});

test('the catch label is measured to the fraction of a pixel', () => {
  const src = read('js/main.js');
  assert.match(src, /function dRowOver\(t\)/);
  assert.doesNotMatch(src, /t\.scrollWidth <= t\.clientWidth \+ 1/);
});

test('the pack keeps its artwork drawn through a missed tear', () => {
  assert.match(read('js/gift-pack.js'), /im\.decode\?\.\(\)/);
  assert.match(read('css/gift.css'), /#gift \.gp-pk:not\(\.opened\) \.gp-art \{ will-change: transform; \}/);
});
