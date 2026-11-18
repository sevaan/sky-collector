import test from 'node:test';
import assert from 'node:assert/strict';
import { tileOf, distKm, ttlFor, slice, planesNear, resetRelay } from '../server/planes-relay.js';

test('tiles: every place in a 1-degree square shares one centre', () => {
  assert.equal(tileOf(43.68, -79.63).key, '43.5,-79.5');
  assert.equal(tileOf(43.01, -79.99).key, tileOf(43.99, -79.01).key);
  assert.notEqual(tileOf(43.99, -79.5).key, tileOf(44.01, -79.5).key);
  assert.equal(tileOf(-33.9, 151.2).key, '-33.5,151.5');
  assert.equal(tileOf(90, 0).la, 89.5); assert.equal(tileOf(-90, 0).la, -89.5); assert.equal(tileOf(0, 180).lo, 179.5); assert.equal(tileOf(0, -180).lo, -179.5);
});

test('tiles: one 160 km circle from the centre covers a player at any corner plus their 80 km', () => {
  for (const lat of [0, 30, 45, 60, 75]) {
    const t = tileOf(lat + 0.001, 10.001);
    for (const [la, lo] of [[lat, 10], [lat + 0.999, 10.999], [lat, 10.999], [lat + 0.999, 10]]) assert.ok(distKm(t.la, t.lo, la, lo) + 80 <= 160, `corner at ${lat}`);
  }
});

test('distance: Toronto Pearson to Montreal Trudeau is about 505 km', () => {
  assert.ok(Math.abs(distKm(43.677, -79.631, 45.470, -73.741) - 505) < 8);
});

test('refresh time follows the month\'s budget, never past 40 s (the app drops planes at 60 s)', () => {
  const mid = Date.UTC(2026, 10, 16), q = 300000; // half-way through November
  assert.equal(ttlFor(null, mid), 15);
  assert.equal(ttlFor({ used: 0.50 * q, quota: q, hot: 0 }, mid), 15);  // on pace
  assert.equal(ttlFor({ used: 0.30 * q, quota: q, hot: 0 }, mid), 15);  // under
  assert.equal(ttlFor({ used: 0.60 * q, quota: q, hot: 0 }, mid), 30);  // a little ahead
  assert.equal(ttlFor({ used: 0.70 * q, quota: q, hot: 0 }, mid), 40);  // well ahead
  assert.equal(ttlFor({ used: 0.98 * q, quota: q, hot: 0 }, mid), 40);  // nearly gone
  assert.equal(ttlFor({ used: 0.10 * q, quota: q, hot: mid + 30000 }, mid), 30); // the minute limit was just hit
  assert.equal(ttlFor({ used: 0.10 * q, quota: q, hot: mid - 1 }, mid), 15);
});

test('refresh time stretches when more squares are busy than 30 a minute can serve', () => {
  const t = Date.UTC(2026, 10, 16), b = { used: 0, quota: 300000, perMin: 30, hot: 0 };
  assert.equal(ttlFor(b, t, 1), 15); assert.equal(ttlFor(b, t, 6), 15);
  assert.equal(ttlFor(b, t, 8), 20); assert.equal(ttlFor(b, t, 12), 30); assert.equal(ttlFor(b, t, 16), 40);
  assert.equal(ttlFor(b, t, 100), 40); // past 16 busy squares the free plan cannot keep every square fresh: time for the next plan
  for (const n of [1, 6, 8, 12, 16]) assert.ok(n * 60 / ttlFor(b, t, n) <= 30, `${n} squares fit in the minute`);
  assert.equal(ttlFor({ ...b, perMin: 60 }, t, 16), 20); // the 9-euro plan
});

test('a player gets only the aircraft within their range, and positionless ones are left out', () => {
  const all = { now: 1, ac: [{ hex: 'near', lat: 43.7, lon: -79.6 }, { hex: 'far', lat: 44.9, lon: -79.6 }, { hex: 'nopos' }] };
  assert.deepEqual(slice(all, 43.68, -79.63, 74).map((a) => a.hex), ['near']);
});

const answer = (ac) => ({ ok: true, status: 200, headers: new Map([['X-FIA-Used-Month', '10'], ['X-FIA-Quota-Month', '300000'], ['X-FIA-Limit-Per-Min', '30']]), json: async () => ({ now: Date.now() / 1000, ac }) });
const later = async (ms, fn) => { const real = Date.now; Date.now = () => real() + ms; try { return await fn(); } finally { Date.now = real; } };

test('players in one square share one request; only FlyItalyADSB is ever asked', async () => {
  resetRelay(); const calls = [];
  const fake = async (url) => { calls.push(url); return answer([{ hex: 'a', lat: 10.4, lon: 20.4, type: 'adsb_icao' }, { hex: 'b', lat: 10.9, lon: 20.9, type: 'mlat' }, { hex: 'odd', lat: 10.5, lon: 20.5, type: 'other' }]); };
  const [r1, r2] = await Promise.all([planesNear(10.4, 20.4, 40, 'k', fake), planesNear(10.6, 20.6, 40, 'k', fake)]); // together: one request in flight
  const r3 = await planesNear(10.9, 20.9, 5, 'k', fake); // a moment later: from memory
  assert.equal(calls.length, 1); assert.match(calls[0], /flyitalyadsb\.com\/v2\/lat\/10\.5\/lon\/20\.5\/dist\/160$/);
  assert.deepEqual(r1.body.ac.map((a) => a.hex), ['a']); assert.equal(r2.body.total, 2); assert.deepEqual(r3.body.ac.map((a) => a.hex), ['b']);
  assert.deepEqual(r2.body.sources, { flyitaly: 2, here: 2, skipped: 1 }); // the "other" record is left out and counted
  assert.ok(r1.body.now > 1e12); // seconds from the feed become milliseconds
  await later(16000, () => planesNear(10.4, 20.4, 40, 'k', fake)); assert.equal(calls.length, 2); // due again after 15 s
});

test('when the feed says no: the last answer stands in, the square waits before asking again, then the app is told', async () => {
  resetRelay(); const calls = []; let mode = 'ok';
  const fake = async (url) => { calls.push(url); return mode === 'ok' ? answer([{ hex: 'a', lat: 10.4, lon: 20.4 }]) : { ok: false, status: mode, headers: new Map(), json: async () => ({}) }; };
  await planesNear(10.4, 20.4, 40, 'k', fake); mode = 429;
  const r = await later(20000, async () => { const a = await planesNear(10.4, 20.4, 40, 'k', fake), b = await planesNear(10.4, 20.4, 40, 'k', fake); return [a, b]; });
  assert.equal(calls.length, 2); // the second player's request did not ask the feed again
  assert.equal(r[0].status, 200); assert.equal(r[0].stale, true); assert.equal(r[1].body.ttl, 30); // slowed for a minute after a 429
  const gone = await later(60000, () => planesNear(10.4, 20.4, 40, 'k', fake)); assert.equal(gone.status, 502); // older than the app would show anyway
  resetRelay(); assert.equal((await planesNear(10.4, 20.4, 40, '', fake)).status, 502); assert.equal(calls.length, 3); // no key: nothing is asked
  mode = 503; resetRelay(); assert.equal((await planesNear(10.4, 20.4, 40, 'k', fake)).status, 502);
});
