// One rule for what's up (2026-11-20: the radar said "1 overhead" while Today said "Quiet sky"). The radar's count, the
// map at your feet and Today's Up now / Quiet sky all read js/sky-up.js; and Sky's Android build makes only its own
// notification channels, dropping Space Collector's "Sky events" left by earlier builds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UP_MIN_EL, isUp, planesUp } from '../js/sky-up.js';
import { feetPlanes } from '../js/sky-feet.js';
import { channelList, staleChannels } from '../js/native.js';

const A = (hex, el) => ({ plane: { hex, track: 0 }, az: 90, el, rangeKm: 20 });

test('a plane just over the horizon is not "up": the radar count, the feet map and Today agree', () => {
  const positions = [A('low', 1), A('edge', UP_MIN_EL), A('high', UP_MIN_EL + 0.5), A('top', 80)];
  assert.deepEqual(planesUp(positions).map((a) => a.plane.hex), ['high', 'top']);
  assert.deepEqual(feetPlanes(positions).map((g) => g.id).sort(), ['high', 'top']);
  assert.equal(isUp(A('low', 1)), false); assert.equal(isUp(null), false); assert.equal(isUp({ az: 0, el: 40 }), false);
  assert.deepEqual(planesUp(null), []);
});

test('Today, the radar and the morning note all count with planesUp, not their own thresholds', () => {
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const today = readFileSync(new URL('../js/sky-today.js', import.meta.url), 'utf8');
  assert.match(main, /const visible = SKY_ONLY \? planesUp\(state\.planeItems\)\.length/);
  assert.match(today, /const up = planesUp\(ctx\.positions\)/);
  assert.doesNotMatch(today, /\.filter\(\(a\) => a\.el > \d/);
});

test('Sky makes only its own notification channels and drops Space Collector\'s', () => {
  const sky = channelList(true).map((c) => c[0]);
  assert.deepEqual(sky, ['asked', 'tonight', 'alerts']);
  assert.ok(!channelList(true).some((c) => /sky events/i.test(c[1])));
  assert.equal(channelList(true).find((c) => c[0] === 'alerts')[1], 'Plane alerts');
  const have = [{ id: 'default' }, { id: 'asked' }, { id: 'tonight' }, { id: 'events' }, { id: 'alerts' }, { id: 'sound_ping' }];
  assert.deepEqual(staleChannels(have, true), ['events']);
  assert.deepEqual(staleChannels(have, false), [], 'Space Collector keeps all four');
});

test('catching: up, and near enough for its size (2026-11-21: a light aircraft 56 km off was collectable)', async () => {
  const { canCatch, catchKm, firstUp } = await import('../js/sky-up.js');
  const P = (cat, el, km) => ({ plane: { hex: `${cat}-${km}`, category: cat }, az: 0, el, rangeKm: km });
  assert.equal(canCatch(P('A1', 20, 56)), false, 'a light aircraft 56 km off');
  assert.equal(canCatch(P('A1', 20, 10)), true);
  assert.equal(canCatch(P('A3', 20, 56)), true, 'an airliner 56 km off');
  assert.equal(canCatch(P('A5', 3, 20)), false, 'on the horizon');
  assert.equal(canCatch(P('A7', 30, 15)), false, 'a helicopter 15 km off');
  assert.equal(catchKm({}), 60, 'no category: an airliner');
  assert.equal(firstUp([P('A1', 30, 40), P('A3', 30, 50)]).plane.category, 'A3', 'the first catch steers to one you can catch');
  assert.equal(firstUp([P('A1', 30, 40)]), null);
});

test('night catch distances: half as far again when properly dark, not for balloons and drones', async () => {
  const { canCatch, catchKm, isNight, firstUp } = await import('../js/sky-up.js');
  const P = (cat, el, km) => ({ plane: { hex: `${cat}-${km}`, category: cat }, az: 0, el, rangeKm: km });
  assert.equal(canCatch(P('A3', 20, 80), false), false, 'airliner 80 km by day');
  assert.equal(canCatch(P('A3', 20, 80), true), true, 'airliner 80 km at night (90)');
  assert.equal(canCatch(P('A1', 20, 20), false), false, 'light aircraft 20 km by day');
  assert.equal(canCatch(P('A1', 20, 20), true), true, 'light aircraft 20 km at night (22.5)');
  assert.equal(canCatch(P('B2', 20, 25), true), false, 'a balloon keeps 20 km at night');
  assert.equal(catchKm({ category: 'B6' }, true), 5, 'a drone keeps 5 km');
  assert.equal(catchKm({}, true), 90, 'no category: 90 at night');
  assert.equal(canCatch(P('A3', 4, 10), true), false, 'the 5 degree floor stays at night');
  assert.equal(isNight(-6), false, 'civil twilight\'s edge is not yet night'); assert.equal(isNight(-6.1), true); assert.equal(isNight(-2), false); assert.equal(isNight(undefined), false);
  assert.equal(firstUp([P('A1', 30, 20)], true).plane.category, 'A1');
});
