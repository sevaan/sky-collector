import test from 'node:test';
import assert from 'node:assert/strict';
import { localDay, levelFor, flightStampInfo, planeStampInfo, planeLine, assess, hasAirlineCallsign, airlineOf } from '../js/sky-stamps.js';
import { cardsFor, CARGO } from '../js/flights.js';
import { parseCsv } from '../js/routes.js';

const DAY = 86400e3;
const T0 = new Date(2026, 10, 1, 12, 0).getTime(); // noon, local
const FK = 'F:ROU:CYYZ-BIKF', PK = 'P:A321';
const flight = { key: FK, airlineIcao: 'ROU' };
const mk = (dayN, hex = 'c0ffee', over = {}) => ({ time: T0 + dayN * DAY + (over.dt ?? 0), hex, callsign: 'ROU1908', flight, plane: { key: PK }, ...over });
const probe = (c) => ({ time: c.time, hex: c.hex, callsign: c.callsign, flight: { key: FK }, plane: { key: PK } });

test('localDay is the local calendar date', () => {
  assert.equal(localDay(new Date(2026, 10, 1, 0, 5).getTime()), '2026-11-01');
  assert.equal(localDay(new Date(2026, 10, 1, 23, 55).getTime()), '2026-11-01');
  assert.equal(localDay(new Date(2026, 10, 2, 0, 5).getTime()), '2026-11-02');
});

test('level thresholds: flights 1/5/15 days, planes 1/10/50 aircraft', () => {
  assert.deepEqual([0, 1, 4, 5, 14, 15].map((n) => levelFor('flight', n)), ['none', 'bronze', 'bronze', 'silver', 'silver', 'gold']);
  assert.deepEqual([0, 1, 9, 10, 49, 50].map((n) => levelFor('plane', n)), ['none', 'bronze', 'bronze', 'silver', 'silver', 'gold']);
});

test('a flight gets one stamp per local day, and the level moves at the thresholds', () => {
  const list = [];
  const first = assess(list, probe(mk(0)));
  assert.equal(first.kind, 'new'); assert.equal(first.stampCount, 1); assert.equal(first.level, 'bronze');
  list.push(mk(0));
  let last;
  for (let d = 1; d <= 4; d++) { last = assess(list, probe(mk(d, `h${d}`))); assert.equal(last.kind, 'stamp'); assert.equal(last.stampCount, d + 1); list.push(mk(d, `h${d}`)); }
  assert.equal(last.level, 'silver'); assert.equal(last.levelUp, true); // day 5
  assert.equal(flightStampInfo(list, FK).level, 'silver');
  for (let d = 5; d <= 13; d++) list.push(mk(d, `h${d}`));
  const g = assess(list, probe(mk(14, 'h14')));
  assert.equal(g.level, 'gold'); assert.equal(g.levelUp, true); assert.equal(g.stampCount, 15);
});

test('stamps come from old catch records: no migration, no stored counters', () => {
  const old = [{ time: T0, hex: 'aaa111', callsign: 'ROU1908', flight, plane: { key: PK } }, { time: T0 + 2 * DAY, hex: 'aaa111', flight, plane: { key: PK } }];
  const i = flightStampInfo(old, FK);
  assert.equal(i.count, 2); assert.deepEqual(i.stamps.map((s) => s.day), [localDay(T0), localDay(T0 + 2 * DAY)]);
});

test('the same aircraft on the same local day gives nothing', () => {
  const list = [mk(0, 'c0ffee')];
  const again = assess(list, probe(mk(0, 'c0ffee', { dt: 3600e3 })));
  assert.equal(again.kind, 'none');
  assert.equal(assess(list, probe(mk(1, 'c0ffee'))).kind, 'stamp'); // next day: a stamp
});

test('plane-only catches (no route) stamp per aircraft', () => {
  const p = (hex, t) => ({ time: t, hex, plane: { key: 'P:R44' }, callsign: 'N123AB' });
  const list = [p('a1', T0)];
  assert.equal(assess(list, { ...p('a1', T0 + 1000), flight: null }).kind, 'none');
  const o = assess(list, { ...p('b2', T0 + 1000), flight: null });
  assert.equal(o.kind, 'stamp'); assert.equal(o.stampOn, 'plane'); assert.equal(o.stampCount, 2);
});

test('plane types count distinct aircraft and distinct liveries (by ICAO prefix, not name)', () => {
  const c = (hex, cs, name) => ({ time: T0 + Math.random() * 1000, hex, callsign: cs, airline: name, flight: { key: 'F:X', airlineIcao: cs.slice(0, 3) }, plane: { key: PK } });
  const list = [c('a', 'ACA101', 'Air Canada'), c('a', 'ACA202', 'Air Canada Ltd'), c('b', 'ACA303', 'AIR CANADA'), c('c', 'DLH9', 'Lufthansa'), c('d', 'ROU12', 'Rouge'), c('e', 'ROU13', 'Air Canada Rouge')];
  const i = planeStampInfo(list, PK);
  assert.equal(i.count, 5); assert.equal(i.liveryCount, 3); assert.deepEqual(i.liveries.sort(), ['ACA', 'DLH', 'ROU']);
  assert.equal(planeLine(i, 'A321'), '5 A321s with 3 operators');
  assert.equal(planeLine({ count: 1, liveryCount: 1 }, 'A321'), '1 A321 with 1 operator');
});

test('registration only counts with an airline-style callsign', () => {
  assert.ok(hasAirlineCallsign('ACA123')); assert.ok(!hasAirlineCallsign('N123AB')); assert.ok(!hasAirlineCallsign('CFABC')); assert.ok(!hasAirlineCallsign(''));
  assert.equal(airlineOf({ callsign: 'ROU1908' }), 'ROU'); assert.equal(airlineOf({ callsign: 'N123AB' }), '');
  const heli = cardsFor({ type: 'R44', reg: 'C-GABC', callsign: 'CGABC' }, null, '');
  assert.equal(heli.plane.reg, '');
  const jet = cardsFor({ type: 'A321', reg: 'C-ABCD', callsign: 'ROU1908' }, null, '');
  assert.equal(jet.plane.reg, 'C-ABCD');
});

test('KAL is not cargo', () => {
  assert.ok(!CARGO.has('KAL')); assert.ok(CARGO.has('FDX'));
  const route = { callsign: 'KAL81', from: { icao: 'RKSI', city: 'Seoul', cc: 'KR', lat: 37.46, lon: 126.44 }, to: { icao: 'KLAX', city: 'Los Angeles', cc: 'US', lat: 33.94, lon: -118.41 } };
  const { flight: f } = cardsFor({ type: 'B77W', callsign: 'KAL81', hex: 'x' }, route, 'Korean Air');
  assert.notEqual(f.set, 'Cargo');
});

test('CSV reader handles a quoted field containing a comma', () => {
  const rows = parseCsv('Code,Name,Location\r\nCYYZ,"Toronto Pearson, Intl",Toronto\r\n\r\nEGLL,"He said ""hi""",London\n');
  assert.deepEqual(rows, [['Code', 'Name', 'Location'], ['CYYZ', 'Toronto Pearson, Intl', 'Toronto'], ['EGLL', 'He said "hi"', 'London']]);
  assert.deepEqual(parseCsv('a,,c\n,\n'), [['a', '', 'c'], ['', '']]);
});
