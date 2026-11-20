// Saved and sent catches never keep a private, business, military or government aircraft's callsign, registration,
// real id or operator (QA 2026-11-19: catches saved before the privacy rules; packs from older apps).
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
const { scrubSightings, privateCatch } = await import('../js/plane-privacy.js');
const { packGift, unpackGift } = await import('../js/gift.js');
const T = Date.parse('2026-11-10T20:00:00Z');
const flight = (cs, type, extra = {}) => ({ key: 1, time: T, hex: 'c0ffee', callsign: cs, reg: 'C-GABC', typeCode: type, type: 'flight', cardKey: `F:${cs.slice(0, 3)}:CYYZ-KJFK`, objectId: `F:${cs.slice(0, 3)}:CYYZ-KJFK`, stampKey: 'DAY:2026-11-10', name: 'Toronto to New York', cardSnapshot: { key: `F:${cs.slice(0, 3)}:CYYZ-KJFK`, sky: 'flight', callsign: cs, airline: 'X', type }, ...extra });
const plane = (cs, type, extra = {}) => ({ key: 2, time: T, hex: 'c0ffee', callsign: cs, reg: 'C-GABC', op: 'AirSprint', cls: 'airline', typeCode: type, type: 'plane', cardKey: `P:${type}`, objectId: `P:${type}`, stampKey: 'HEX:c0ffee', name: type, cardSnapshot: { key: `P:${type}`, sky: 'plane', type, reg: 'C-GABC', stamp: 'AirSprint' }, ...extra });

test('an airline catch is left alone', () => {
  const l = [flight('ACA856', 'A333'), plane('ACA856', 'A333')];
  const r = scrubSightings(l); assert.equal(r.changed, 0); assert.deepEqual(r.dropped, []); assert.equal(r.list[1].callsign, 'ACA856');
});
for (const [cs, type, why] of [['ASP473', 'C25B', 'business-jet operator'], ['AFR123', 'C130', 'military type'], ['XYZ123', 'KC10', 'military type'], ['N123AB', 'C172', 'registration as callsign']]) {
  test(`${cs} on a ${type} (${why}): flight card dropped, plane catch keeps the type only`, () => {
    assert.equal(privateCatch(plane(cs, type)), true);
    const { list, dropped } = scrubSightings([flight(cs, type), plane(cs, type)]);
    if (/^[A-Z]{3}\d/.test(cs)) assert.deepEqual(dropped, [1]);
    const p = list.find((s) => s.type === 'plane');
    assert.equal(p.callsign, ''); assert.equal(p.reg, ''); assert.equal(p.op, undefined); assert.equal(p.cls, undefined);
    assert.match(p.hex, /^~/); assert.match(p.stampKey, /^HEX:~/); assert.equal(p.cardSnapshot.reg, undefined); assert.equal(p.cardSnapshot.stamp, '');
    assert.equal(p.cardKey, `P:${type}`);
  });
}
test('a scrub is stable: the same aircraft keeps one hashed id, and a second pass changes nothing', () => {
  const a = scrubSightings([plane('ASP473', 'C25B')]).list[0], b = scrubSightings([plane('ASP473', 'C25B', { key: 3 })]).list[0];
  assert.equal(a.stampKey, b.stampKey);
  assert.equal(scrubSightings([a]).changed, 0);
});
test('a sent pack carries no private flight card and no real aircraft id', () => {
  const g = packGift([flight('ASP473', 'C25B'), plane('ASP473', 'C25B'), flight('ACA856', 'A333')]);
  const j = JSON.stringify(g);
  assert.ok(!j.includes('ASP'), j); assert.ok(!j.includes('c0ffee') || j.includes('F:ACA'), 'only the airline flight may keep its day stamp');
  assert.ok(!j.includes('HEX:c0ffee')); assert.ok(!j.includes('C-GABC') || false);
});
test('a received pack from an older app is scrubbed on the way in', () => {
  /* an old app's pack: no scrub on its side */
  const g = { v: 1, f: '', m: 0, b: null, at: T, k: ['F:ASP:CYYZ-KJFK', 'P:C130'], o: [['F:ASP:CYYZ-KJFK', 'Toronto to New York', 'flight', null], ['P:C130', 'C130', 'plane', null]], s: ['DAY:2026-11-10', 'HEX:ae1234'],
    r: [[T, 0, 0, 0, null, null, null, null, null, null, -1, -1], [0, 1, 1, 1, null, null, null, null, null, null, -1, -1]],
    d: {}, w: {}, c: { 'F:ASP:CYYZ-KJFK': { key: 'F:ASP:CYYZ-KJFK', sky: 'flight', callsign: 'ASP473', type: 'C25B' }, 'P:C130': { key: 'P:C130', sky: 'plane', type: 'C130', reg: '12-3456', stamp: 'USAF' } } };
  const { sightings } = unpackGift(g);
  assert.equal(sightings.some((s) => s.cardKey === 'F:ASP:CYYZ-KJFK'), false);
  const p = sightings.find((s) => s.cardKey === 'P:C130');
  assert.match(p.stampKey, /^HEX:~/); assert.equal(p.cardSnapshot.reg, undefined); assert.equal(p.cardSnapshot.stamp, '');
});
test('regulars saved before the rule drop business, military and government callsigns', async () => {
  const d = (k) => { const o = {}; for (let i = 0; i < 4; i++) o[`2026-11-${10 + i}`] = 600; return o; };
  localStorage.setItem('skyRegulars', JSON.stringify({ ASP473: d(), RCH123: d(), ACA856: d() }));
  const r = await import(`../js/sky-regulars.js?t=${Date.now()}`); r._resetRegulars();
  const now = Date.parse('2026-11-14T12:00:00');
  const cs = r.regulars(now).map((x) => x.callsign);
  assert.deepEqual(cs, ['ACA856']);
});
