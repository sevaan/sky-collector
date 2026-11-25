// Regulars (js/sky-regulars.js): flights that pass at about the same time on most days.
import test from 'node:test';
import assert from 'node:assert/strict';
const store = {}; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const { noteRegulars, regulars, regularOf, regularFor, _resetRegulars } = await import('../js/sky-regulars.js');
const at = (d, h, m) => new Date(2026, 10, d, h, m).getTime();
test('a flight seen at about 6:40 PM on 4 of the last 5 days is a regular; its usual time and next pass', () => {
  _resetRegulars({});
  for (const [d, m] of [[10, 35], [11, 42], [13, 38], [14, 50]]) noteRegulars([{ callsign: 'ACA856' }, { callsign: '' }], at(d, 18, m));
  noteRegulars([{ callsign: 'WJA1' }], at(11, 9, 0)); noteRegulars([{ callsign: 'WJA1' }], at(12, 21, 0)); noteRegulars([{ callsign: 'WJA1' }], at(13, 14, 0)); /* three days, never the same time */
  const now = at(14, 20, 0), r = regulars(now);
  assert.deepEqual(r.map((x) => x.callsign), ['ACA856']);
  assert.equal(r[0].days, 4); assert.ok(Math.abs(r[0].minute - (18 * 60 + 41)) <= 3, `usual ${r[0].minute}`);
  assert.equal(new Date(r[0].next).getDate(), 15, 'already passed today: tomorrow');
  assert.ok(regularFor('aca856', now));
});
test('only airline flights, never an anonymous aircraft; two days are not enough; times around midnight agree', () => {
  _resetRegulars({}); for (const d of [10, 11, 12]) noteRegulars([{ callsign: 'CGJLN' }, { callsign: '' }], at(d, 8, 0));
  assert.equal(regulars(at(12, 9, 0)).length, 0);
  assert.equal(regularOf({ '2026-11-10': 600, '2026-11-11': 610 }, at(11, 12, 0)), null);
  const r = regularOf({ '2026-11-10': 1435, '2026-11-11': 5, '2026-11-12': 1430 }, at(12, 12, 0)); assert.ok(r && (r.minute >= 1420 || r.minute <= 10));
});
test('only airlines on Sky\'s list become regulars; an unlisted charter or air ambulance, NetJets and old saved ones are dropped', async () => {
  const { regularAllowed } = await import('../js/sky-regulars.js');
  assert.ok(regularAllowed('ACA856')); assert.ok(regularAllowed('wja1'));
  for (const cs of ['ZZQ123', 'LIF201', 'EJA514', 'RCH421', 'CGJLN', '']) assert.equal(regularAllowed(cs), false, cs);
  /* seen at the same time four days running, but not an airline on the list: never kept, never named */
  _resetRegulars({}); for (const d of [10, 11, 12, 13]) noteRegulars([{ callsign: 'ZZQ123' }, { callsign: 'ACA856' }], at(d, 18, 40));
  assert.deepEqual(regulars(at(13, 20, 0)).map((x) => x.callsign), ['ACA856']);
  /* one saved before this rule is pruned from the phone on load */
  const days = { '2026-11-10': 1120, '2026-11-11': 1121, '2026-11-12': 1119 };
  store.skyRegulars = JSON.stringify({ ZZQ123: days, ACA856: days }); _resetRegulars(null);
  assert.deepEqual(regulars(at(12, 20, 0)).map((x) => x.callsign), ['ACA856']);
  assert.deepEqual(Object.keys(JSON.parse(store.skyRegulars)), ['ACA856']);
});
