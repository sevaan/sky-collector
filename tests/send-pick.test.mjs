// The Send cards picker's picks (js/send-pick.js): they survive tab switches, searches and By card <-> By day, and
// Select all works on what's shown (2026-11-20, Sevaan: the list "can get really long too").
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPicks, toggle, allPicked, countPicked, pickShown, pickedSightings, countLine, filtersOn } from '../js/send-pick.js';

// A small collection: planes P:*, flights F:*; a card's name is what search matches.
const CARDS = [
  { key: 'P:A320', name: 'airbus a320' }, { key: 'P:B738', name: 'boeing 737' }, { key: 'P:DH8D', name: 'dash 8' },
  { key: 'F:ACA:YYZ-YVR', name: 'toronto vancouver' }, { key: 'F:JZA:YTZ-YOW', name: 'toronto ottawa' }, { key: 'F:QTR:ORD-DOH', name: 'chicago doha' },
];
const kindOf = (k) => (k.startsWith('F:') ? 'flight' : 'plane');
// What the page shows for the picker's current tab and search (the page asks the Collection's own filter for this).
const shown = (sel) => CARDS.filter((c) => kindOf(c.key) === sel.kind && (!sel.query || c.name.includes(sel.query))).map((c) => c.key);
const DAY = 86400e3;
const SIGHTINGS = [
  { cardKey: 'P:A320', time: 1 * DAY }, { cardKey: 'F:ACA:YYZ-YVR', time: 1 * DAY },
  { cardKey: 'P:B738', time: 2 * DAY }, { cardKey: 'F:JZA:YTZ-YOW', time: 2 * DAY },
  { cardKey: 'P:A320', time: 3 * DAY }, { cardKey: 'F:QTR:ORD-DOH', time: 3 * DAY }, { cardKey: 'P:DH8D', time: 3 * DAY },
];
const dayOf = (s) => Math.floor(s.time / DAY);

test('picks survive switching Planes / Flights, searching and By card <-> By day', () => {
  const sel = createPicks({ kind: 'plane' });
  assert.equal(sel.tab, 'card'); assert.equal(sel.kind, 'plane');
  toggle(sel.cards, 'P:A320');
  sel.kind = 'flight'; toggle(sel.cards, 'F:QTR:ORD-DOH');
  sel.query = 'toronto'; assert.deepEqual(shown(sel), ['F:ACA:YYZ-YVR', 'F:JZA:YTZ-YOW']);
  toggle(sel.cards, 'F:ACA:YYZ-YVR');
  sel.tab = 'night'; toggle(sel.nights, 2);
  sel.tab = 'card'; sel.query = ''; sel.kind = 'plane';
  assert.deepEqual([...sel.cards].sort(), ['F:ACA:YYZ-YVR', 'F:QTR:ORD-DOH', 'P:A320']);
  assert.deepEqual([...sel.nights], [2]);
  // the total adds both ways of picking, with no sighting twice
  const p = pickedSightings(SIGHTINGS, sel, dayOf);
  assert.equal(p.length, 6); /* A320 x2, ACA, QTR, plus day 2's B738 and JZA */
  assert.equal(new Set(p.map((s) => s.cardKey)).size, 5);
  assert.equal(countPicked(sel.cards, shown(sel)), 1); /* this tab shows one picked plane of three */
  assert.equal(countLine(countPicked(sel.cards, shown(sel)), shown(sel).length, ['plane', 'planes']), '1 of 3 planes picked');
});

test('Select all picks only what is shown; Select none unpicks only what is shown', () => {
  const sel = createPicks({ kind: 'flight' });
  toggle(sel.cards, 'P:B738'); /* a plane picked on the other tab */
  sel.query = 'toronto';
  assert.equal(pickShown(sel.cards, shown(sel)), true);
  assert.deepEqual([...sel.cards].sort(), ['F:ACA:YYZ-YVR', 'F:JZA:YTZ-YOW', 'P:B738']);
  assert.ok(allPicked(sel.cards, shown(sel)));
  sel.query = ''; /* Doha isn't picked: Select all again adds just it */
  assert.equal(allPicked(sel.cards, shown(sel)), false);
  assert.equal(pickShown(sel.cards, shown(sel)), true);
  assert.equal(sel.cards.size, 4);
  sel.query = 'toronto'; /* now Select none: the two Toronto flights go, the rest stay */
  assert.equal(pickShown(sel.cards, shown(sel)), false);
  assert.deepEqual([...sel.cards].sort(), ['F:QTR:ORD-DOH', 'P:B738']);
  assert.equal(allPicked(sel.cards, []), false); /* nothing shown is never "all picked" */
  assert.equal(pickShown(sel.cards, []), true); assert.equal(sel.cards.size, 2);
});

test('a card sent straight from the viewer sends only it; nothing picked sends nothing', () => {
  assert.deepEqual(pickedSightings(SIGHTINGS, createPicks({ only: ['P:A320'] }), dayOf).map((s) => s.time), [DAY, 3 * DAY]);
  assert.equal(pickedSightings(SIGHTINGS, createPicks(), dayOf).length, 0);
});

test('count line and the Filters dot', () => {
  assert.equal(countLine(0, 1, ['flight', 'flights']), '0 of 1 flight picked');
  assert.equal(countLine(1234, 2000), '1,234 of 2,000 cards picked');
  const sel = createPicks(); assert.equal(filtersOn(sel), false);
  sel.query = 'boeing'; assert.equal(filtersOn(sel), false); /* the search isn't a filter */
  sel.sort = 'az'; assert.equal(filtersOn(sel), true);
});
