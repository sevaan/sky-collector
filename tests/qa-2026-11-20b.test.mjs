// QA 2026-11-20 (second pass): the daily note never prints a time it doesn't have, All around you keeps its pictures on
// the strip, and a private aircraft keeps its type.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

test('a daily-note pick with no time shows no time (Sky\'s level nudge printed "Invalid Date")', async () => {
  const { noteTime } = await import('../js/note-time.js');
  assert.equal(noteTime({ owned: true, meta: '9 of 10 aircraft' }, null), null, 'Sky level pick: no time, no pass');
  assert.equal(noteTime(undefined, undefined), null);
  assert.equal(noteTime({ time: undefined }, { start: undefined }), null);
  assert.equal(noteTime({ time: NaN }, null), null);
  assert.equal(noteTime({ time: 1000 }, { start: 5 }), 1000, 'its own time first');
  assert.equal(noteTime({}, { start: 5 }), 5, 'else the pass start');
  // every attached card's time in n2Build goes through noteTime and is printed only when there is one
  const src = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function n2Build('), src.indexOf('const replies = []', src.indexOf('function n2Build(')));
  assert.match(body, /t = noteTime\(a, p\)/);
  assert.match(body, /t != null \? escapeHtml\(fmtTime\(t\)\) : ''/);
  assert.doesNotMatch(body, /fmtTime\(a\.time|fmtTime\(p\?\.start|a\.time \?\? p\?\.start/);
});

test('All around you: a picture near the edge stays on the strip and steps aside from another', async () => {
  const { stripSpot } = await import('../js/sky-feet.js');
  for (const W of [280, 310, 350]) { // the strip at 360-430 px screens
    const x = stripSpot(W + 10, 100, 43, 30, W);
    assert.ok(x - 21.5 >= 0 && x + 21.5 <= W, `photo inside at ${W}`);
    const l = stripSpot(-10, 100, 30, 34, W); assert.ok(l - 15 >= 0, 'left edge too');
    // a tail fin already at the right edge: the photo lands beside it, not on it, and still on the strip
    const fin = [W - 2 - 30, 83, 30, 34];
    const p = stripSpot(W - 5, 100, 43, 30, W, [fin]);
    assert.ok(p - 21.5 >= 0 && p + 21.5 <= W);
    assert.ok(Math.abs(p - (fin[0] + 15)) >= (43 + 30) / 2, 'no overlap');
  }
  assert.equal(stripSpot(150, 100, 40, 27, 300), 150, 'room: stays where it is');
});

test('a private Cessna 172 under a registration callsign keeps its type; only who it is goes', async () => {
  const { parsePlanes } = await import('../js/planes.js');
  const { cardsFor } = await import('../js/flights.js');
  const { catchSightings } = await import('../js/sky-cards.js');
  const { scrubSighting } = await import('../js/plane-privacy.js');
  const rec = { hex: 'c06ee4', type: 'tisb_icao', flight: 'CGPZV   ', r: 'C-GPZV', t: 'C172', desc: 'CESSNA 172 Skyhawk', alt_baro: 3500, gs: 105, category: 'A1', lat: 43.6, lon: -79.6 };
  const [p] = parsePlanes({ now: Date.now(), ac: [rec] });
  assert.equal(p.anon, true); assert.equal(p.callsign, ''); assert.equal(p.reg, ''); assert.match(p.hex, /^~/);
  assert.equal(p.type, 'C172');
  // the next answer has no database fields (a TIS-B record from another source): the type stays
  const { t, desc, r, ...bare } = rec; void t; void desc; void r;
  const [p2] = parsePlanes({ now: Date.now(), ac: [bare] });
  assert.equal(p2.type, 'C172'); assert.equal(p2.reg, ''); assert.equal(p2.callsign, '');
  const { flight, plane } = cardsFor(p2, null, '');
  assert.equal(flight, null); assert.equal(plane.key, 'P:C172'); assert.equal(plane.type, 'C172'); assert.equal(plane.reg, '');
  // a catch saved under the callsign before the rules: scrubbed of who, never of what
  const old = catchSightings({ time: 1, hex: 'c06ee4', callsign: 'CGPZV', reg: 'C-GPZV', type: 'C172', plane: cardsFor({ hex: 'c06ee4', callsign: 'CGPZV', type: 'C172', category: 'A1' }, null, '').plane })[0];
  const s = scrubSighting(old);
  assert.equal(s.typeCode, 'C172'); assert.equal(s.cardKey, 'P:C172'); assert.equal(s.cardSnapshot.type, 'C172');
  assert.equal(s.callsign, ''); assert.equal(s.reg, ''); assert.match(s.hex, /^~/);
});

test('the relay merge fills a record\'s missing type from another feed and keeps every feed\'s privacy flags', async () => {
  const { mergeFeeds } = await import('../relay/worker-planes.js');
  const lol = { now: 1000, ac: [{ hex: 'c06ee4', flight: 'CGPZV', t: 'C172', desc: 'CESSNA 172 Skyhawk', r: 'C-GPZV', lat: 1, lon: 1, seen_pos: 5, dbFlags: 8 }] };
  const fi = { now: 1002, ac: [{ hex: 'c06ee4', flight: 'CGPZV', lat: 2, lon: 2, seen_pos: 0 }] };
  const m = mergeFeeds([{ id: 'adsblol', j: lol }, { id: 'adsbfi', j: fi }]);
  const a = m.ac[0];
  assert.equal(a.lat, 2, 'fresher position still wins');
  assert.equal(a.t, 'C172'); assert.equal(a.desc, 'CESSNA 172 Skyhawk');
  assert.equal(a.dbFlags & 8, 8, 'LADD from either feed');
});

test('gov and military rules unchanged: type kept, nothing else', async () => {
  const { parsePlanes } = await import('../js/planes.js');
  const { cardsFor } = await import('../js/flights.js');
  const [m] = parsePlanes({ now: Date.now(), ac: [{ hex: 'ae1234', flight: 'RCH123', t: 'C17', r: '05-5140', dbFlags: 1, alt_baro: 20000, lat: 43.6, lon: -79.6, category: 'A5', gs: 400 }] });
  assert.equal(m.type, 'C17'); assert.equal(m.callsign, ''); assert.equal(m.reg, ''); assert.equal(m.gov, true); assert.match(m.hex, /^~/);
  const c = cardsFor(m, { from: { icao: 'KDOV' }, to: { icao: 'ETAR' }, callsign: 'RCH123' }, 'x');
  assert.equal(c.flight, null); assert.equal(c.plane.type, 'C17'); assert.equal(c.plane.stamp, ''); assert.equal(c.plane.reg, '');
});
