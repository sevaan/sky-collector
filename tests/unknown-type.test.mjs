// A type code Sky has no name for (2026-11-20, Sevaan): no longer a Rare card called "Aircraft", but the Common card for its
// size category (P:UNKNOWN-A1..), the same card a plane with no type at all lands on. Old catches move there on load.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, String(v)); }, removeItem(k) { this.m.delete(k); } };
const { planeKey, knownType, cardsFor, retier, rekeyUnlisted, unlisted, SIZE_CLASSES } = await import('../js/flights.js');
const { catchSightings } = await import('../js/sky-cards.js');

test('an unrecognised type code is a Common card named for its size category', () => {
  for (const [cat, name] of [['A1', 'Light Aircraft'], ['A2', 'Small Aircraft'], ['A3', 'Large Aircraft'], ['A5', 'Heavy Aircraft']]) {
    const p = { hex: 'abc123', callsign: 'N123AB', reg: 'N123AB', type: 'ZZ9Q', category: cat };
    assert.equal(knownType(p), false); assert.equal(planeKey(p), `P:UNKNOWN-${cat}`);
    const { plane } = cardsFor(p, null, '');
    assert.equal(plane.name, name); assert.equal(plane.name, SIZE_CLASSES[cat].name); assert.equal(plane.tier, 'common');
    assert.equal(plane.type, ''); assert.equal(plane.reg, ''); // no airline callsign: the registration isn't kept
  }
  const { plane } = cardsFor({ type: 'ZZ9Q', category: '' }, null, '');
  assert.equal(plane.key, 'P:UNKNOWN'); assert.equal(plane.name, 'Unidentified Aircraft'); assert.equal(plane.tier, 'common');
  assert.doesNotMatch(plane.name, /^Aircraft$/);
});
test('known types, feed descriptions and helicopters keep their own cards', () => {
  assert.equal(planeKey({ type: 'B738', category: 'A3' }), 'P:B738');
  assert.equal(planeKey({ type: 'ZZ9Q', desc: 'CESSNA 177 Cardinal', category: 'A1' }), 'P:ZZ9Q'); // named from the feed
  assert.equal(planeKey({ type: 'ZZ9Q', category: 'A7' }), 'P:ZZ9Q'); // a helicopter with an unknown code: still a helicopter card
  assert.equal(planeKey({ type: '', category: 'A3' }), 'P:UNKNOWN-A3');
  assert.equal(cardsFor({ type: 'A124', category: 'A5' }, null, '').plane.tier, 'legendary');
});
test('the card fact is true of both a type-less plane and an unrecognised code', () => {
  for (const k of ['P:UNKNOWN-A3', 'P:UNKNOWN']) assert.match(unlisted(k).fact, /Sky doesn’t know this aircraft’s exact type/);
});

// old saved catches, as js/sky-cards.js catchSightings wrote them under the old rules
const oldCatch = (time, hex, cat, withFlight = false) => {
  const plane = { kind: 'plane', key: 'P:ZZ9Q', name: 'Aircraft', type: 'ZZ9Q', glyph: 'jet', tier: 'rare', set: 'Others', setId: 'others', stamp: '', reg: '' };
  Object.defineProperty(plane, 'caught', { enumerable: false, value: { cls: 'private', ...(cat ? { cat } : {}), routed: withFlight } });
  const flight = withFlight ? { kind: 'flight', key: 'F:ACA:CYYZ-CYUL', name: 'Toronto to Montréal', from: { city: 'Toronto' }, to: { city: 'Montréal' }, km: 500, tier: 'common' } : null;
  return catchSightings({ time, hex, callsign: '', reg: '', type: 'ZZ9Q', plane, flight }).map((s, i) => ({ ...s, key: time * 10 + i }));
};
test('old Rare "Aircraft" catches move to the size card, keeping every catch', () => {
  const list = [...oldCatch(1000, 'aaa111', 'A3'), ...oldCatch(2000, 'bbb222', ''), ...oldCatch(3000, 'ccc333', 'A1', true),
    { key: 9, type: 'plane', cardKey: 'P:B738', objectId: 'P:B738', name: 'Boeing 737-800', cardSnapshot: { key: 'P:B738', sky: 'plane', name: 'Boeing 737-800' } }];
  const { list: out, changed } = rekeyUnlisted(list);
  assert.equal(out.length, list.length);
  const planes = out.filter((s) => s.type === 'plane');
  assert.deepEqual(planes.map((s) => s.cardKey), ['P:UNKNOWN-A3', 'P:UNKNOWN-A3', 'P:UNKNOWN-A1', 'P:B738']); // no category: the card's own (A3 and A1 tie: first seen)
  const a3 = planes[0];
  assert.equal(a3.cardSnapshot.name, 'Large Aircraft'); assert.equal(a3.cardSnapshot.tier, 'common'); assert.equal(a3.cardSnapshot.type, '');
  assert.equal(a3.objectId, 'P:UNKNOWN-A3'); assert.equal(a3.plane.key, 'P:UNKNOWN-A3'); assert.equal(a3.stampKey, 'HEX:aaa111'); assert.equal(a3.key, 10000);
  const fl = out.find((s) => s.type === 'flight');
  assert.deepEqual(fl.plane, { key: 'P:UNKNOWN-A1', name: 'Light Aircraft' }); // the flight's plane follows its own catch
  assert.equal(changed.length, 4); assert.equal(out[out.length - 1], list[list.length - 1]); // the B738 untouched
  assert.equal(rekeyUnlisted(out).changed.length, 0); // once only
});
test('an old card with no category anywhere becomes Unidentified Aircraft, Common', () => {
  const { list } = rekeyUnlisted(oldCatch(1000, 'aaa111', ''));
  assert.equal(list[0].cardKey, 'P:UNKNOWN'); assert.equal(list[0].cardSnapshot.name, 'Unidentified Aircraft'); assert.equal(list[0].cardSnapshot.tier, 'common');
  assert.equal(retier({ ...list[0].cardSnapshot }).tier, 'common');
});
test('a card named from the feed’s description is left alone', () => {
  const s = { key: 1, type: 'plane', cardKey: 'P:ZZ9Q', name: 'Cessna 177 Cardinal', cat: 'A1', cardSnapshot: { key: 'P:ZZ9Q', sky: 'plane', name: 'Cessna 177 Cardinal', tier: 'rare' } };
  assert.equal(rekeyUnlisted([s]).changed.length, 0);
});
