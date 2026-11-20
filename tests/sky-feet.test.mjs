// The compass at your feet, for planes (js/sky-feet.js): which planes go on the map, which get a name, how they're called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { feetPlanes, feetName, FEET_LABELS } from '../js/sky-feet.js';

const A = (hex, el, extra = {}) => ({ plane: { hex, track: 90, ...extra }, az: (el * 7) % 360, el, rangeKm: 20 });

test('only planes above the horizon go on the map, capped, highlighted and new first, then highest', () => {
  const list = [A('low', 1), A('a', 30), A('b', 60), A('new', 10), A('quiet', 80), A('neg', -3)];
  const out = feetPlanes(list, { fresh: (p) => p.hex === 'new' || p.hex === 'quiet', highlight: (p) => p.hex !== 'quiet', max: 4 });
  assert.deepEqual(out.map((g) => g.id), ['new', 'b', 'a', 'quiet']);
  assert.equal(out[0].isNew, true);
  const q = out.find((g) => g.id === 'quiet');
  assert.equal(q.quiet, true); assert.equal(q.isNew, false, 'not highlighted: never marked new'); assert.equal(q.label, false);
});

test('a busy sky names only a few planes', () => {
  const list = Array.from({ length: 30 }, (_, i) => A(`p${i}`, 5 + i * 2));
  const out = feetPlanes(list);
  assert.equal(out.length, 30);
  assert.equal(out.filter((g) => g.label).length, FEET_LABELS);
  assert.ok(out.every((g) => g.kind === 'plane' && g.icon === 'plane'));
  assert.equal(feetPlanes(list, { max: 12 }).length, 12);
});

test('helicopters get the helicopter icon; nothing up gives an empty map', () => {
  assert.equal(feetPlanes([A('h', 20, { heli: true })])[0].icon, 'heli');
  assert.deepEqual(feetPlanes(null), []);
});

test('anonymous aircraft are named by type only', () => {
  const route = { airline: 'Air Canada', flight: 'ACA851' };
  assert.equal(feetName({ anon: true, callsign: 'CGABC' }, route, 'Cessna 172'), 'Cessna 172');
  assert.equal(feetName({ anon: true, heli: true }, null, ''), 'Helicopter');
  assert.equal(feetName({ callsign: 'ACA851' }, route, 'Airbus A320'), 'Air Canada 851');
  assert.equal(feetName({ callsign: 'WJA100' }, null, 'Boeing 737'), 'WJA100');
});

test('long airline names lose their brackets on the map', () => {
  assert.equal(feetName({ callsign: 'JZA478' }, { airline: 'Jazz (Air Canada Express)', flight: 'JZA478' }, ''), 'Jazz 478');
});
