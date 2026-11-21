// Daily usage totals (server/daily.js, 2026-11-20, Space Collector's tests/daily-totals.test.mjs adapted): saved days must
// give the stats page the same lifetime numbers as the raw rows did, switching the page over changes nothing on today's
// data, test installs flagged late drop out of days that aren't frozen yet, and writing is repeatable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyDocs, windowStart } from '../server/daily.js';
import { statsHtml, FRESH } from '../server/stats-page.js';

const DAY = 86400e3, H = 3600e3;
const KINDS = ['airliner', 'private', 'heli', 'balloon'];
// Made-up players over 200 days after launch: each installs, most play; some catch on the first day, some come back.
function makeRows() {
  const rows = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const row = (iid, ts, name, d = {}, p = 'ios') => rows.push({ ts, rt: ts, iid, v: '0.1.1790', p, x: 0, name, d: JSON.stringify(d) });
  for (let i = 0; i < 260; i++) {
    const iid = (0x10000000 + i * 7919).toString(16).padStart(16, 'a'), p = i % 3 ? 'ios' : 'android';
    const start = FRESH + Math.floor(rnd() * 200) * DAY + 13 * H + Math.floor(rnd() * 6) * H;
    row(iid, start, 'install', {}, p);
    if (rnd() < 0.15) continue; // a throwaway run
    row(iid, start + 9 * 60e3, 'end', { s: 540 }, p);
    if (rnd() < 0.6) { row(iid, start + 15 * 60e3, 'catch', { n: 1, t: rnd() < 0.2 ? 'rare' : 'common', k: KINDS[i % 4] }, p); row(iid, start + 15 * 60e3, 'night', { n: 1 }, p); }
    for (const back of [1, 3, 9, 30, 140]) if (rnd() < 0.4) {
      const t = start + back * DAY; row(iid, t, 'open', {}, p);
      if (rnd() < 0.5) { row(iid, t + 60e3, 'catch', { n: rnd() < 0.5 ? 1 : 0, t: 'uncommon', k: 'airliner' }, p); row(iid, t + 60e3, 'night', { n: 2 }, p); }
      if (rnd() < 0.05) row(iid, t + 2 * 60e3, 'plus', { s: 'buy', plan: 'yearly' }, p);
    }
  }
  return rows.sort((a, b) => a.ts - b.ts);
}
const now = FRESH + 230 * DAY + 15 * H;
const sections = (html) => ['Records and milestones', 'Do new players get it?', 'By platform', 'New players today'].map((h) => { const i = html.indexOf(`<h2>${h}`); return i < 0 ? '' : html.slice(i, html.indexOf('<h2>', i + 4)); });
const frozen = (docs, B) => Object.values(docs).filter((d) => Date.parse(`${d.day}T12:00:00Z`) / DAY < B).map((d) => ({ ...d, final: true }));

test('saved days give the same lifetime numbers as the raw rows', () => {
  const rows = makeRows(), B = windowStart(now);
  const past = frozen(dailyDocs(rows, { now }), B);
  assert.ok(past.length > 50, 'some days are old enough to be saved');
  const raw = statsHtml(rows, { now }), mixed = statsHtml(rows, { now, past, from: B });
  const [a, b] = [sections(raw), sections(mixed)];
  for (let i = 0; i < a.length; i++) { assert.ok(a[i].length > 0); assert.equal(b[i], a[i]); }
});

// Today's data: Sky has sent since Nov 19, so every row is inside the 90-day window and nothing is frozen yet. The page
// with the daily totals switched on must be the same page, byte for byte.
test('the switch changes no number on today\'s data', () => {
  const at = Date.parse('2026-11-20T21:00:00Z'), r = (iid, name, ts, d = {}, extra = {}) => ({ iid, name, ts, rt: ts, v: '0.1.1790', p: 'ios', x: 0, d: JSON.stringify(d), ...extra });
  const a = 'a1'.repeat(10), b = 'b2'.repeat(10), sim = 'c3'.repeat(10), web = 'd4'.repeat(10);
  const rows = [
    r(a, 'install', at - 30 * H), r(a, 'catch', at - 29.8 * H, { k: 'airliner', t: 'rare', n: 1 }), r(a, 'night', at - 29.8 * H, { n: 1 }), r(a, 'end', at - 29.5 * H, { s: 900 }),
    r(a, 'open', at - 3 * H), r(a, 'catch', at - 2.9 * H, { k: 'heli', t: 'epic', n: 1 }), r(a, 'night', at - 2.9 * H, { n: 2 }), r(a, 'plus', at - 2.8 * H, { s: 'buy', plan: 'yearly' }),
    r(b, 'install', at - 20 * H, {}, { p: 'android' }), r(b, 'end', at - 20 * H + 120e3, { s: 60 }, { p: 'android' }),
    r(sim, 'install', at - 10 * H), r(sim, 'catch', at - 9.9 * H, { k: 'glider', t: 'epic', n: 1 }), r(sim, 'open', at - 9 * H, {}, { x: 1 }),
    r(web, 'install', at - 8 * H, {}, { p: 'web' }),
    r('e5'.repeat(10), 'install', Date.parse('2026-11-15T15:00:00Z')), /* before Sky's FRESH: left out either way */
  ];
  const B = windowStart(at), docs = dailyDocs(rows, { now: at });
  assert.deepEqual(Object.keys(docs), ['2026-11-15', '2026-11-19'].filter((k) => docs[k])); /* only whole days before today */
  const past = frozen(docs, B); assert.equal(past.length, 0, 'nothing is old enough to freeze');
  assert.equal(statsHtml(rows, { now: at, past, from: B }), statsHtml(rows, { now: at }));
  const d = docs['2026-11-19'];
  assert.equal(d.installs, 2); assert.equal(d.byPlatform.ios.installs, 1); assert.equal(d.byPlatform.android.installs, 1);
  assert.equal(d.installsPlayed, 1); assert.equal(d.newCards, 1); assert.equal(d.final, false);
});

test('the daily docs hold no install ids and are the same every time they are written', () => {
  const rows = makeRows(), a = dailyDocs(rows, { now }), b = dailyDocs(rows, { now });
  assert.deepEqual(a, b);
  const text = JSON.stringify(a); for (const r of rows) assert.ok(!text.includes(r.iid));
  const one = Object.values(a).find((d) => d.installs > 0);
  assert.deepEqual(Object.keys(one).sort(), ['byPlatform', 'catches', 'caught', 'cohort', 'day', 'events', 'final', 'installs', 'installsPlayed', 'newCards', 'players', 'plusBuys', 'tiers', 'v'].sort());
  assert.deepEqual(Object.keys(one.byPlatform), ['ios', 'android']);
});

test('an install flagged as a test later drops out of days that are not frozen yet, and frozen days are not rewritten', () => {
  const rows = makeRows(), B = windowStart(now);
  const dayOfTs = (ts) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }), dn = (k) => Date.parse(`${k}T12:00:00Z`) / DAY;
  const installsOf = rows.filter((r) => r.name === 'install');
  const recent = installsOf.find((r) => dn(dayOfTs(r.ts)) >= B && dn(dayOfTs(r.ts)) < dn(dayOfTs(now)));
  const old = installsOf.find((r) => dn(dayOfTs(r.ts)) < B - 1);
  const flag = (r) => ({ ts: now - DAY, rt: now - DAY, iid: r.iid, v: '0.1.1790', p: r.p, x: 1, name: 'open', d: '{}' });
  const flagged = [...rows, flag(recent), flag(old)];
  // unfrozen: the server rewrites window days (from = B); the flagged install is gone from its install day
  const before = dailyDocs(rows, { now, from: B })[dayOfTs(recent.ts)], after = dailyDocs(flagged, { now, from: B })[dayOfTs(recent.ts)];
  assert.equal(after.installs, before.installs - 1);
  // frozen: days before the window aren't produced at all, so the saved doc stays as it was
  assert.equal(dailyDocs(flagged, { now, from: B })[dayOfTs(old.ts)], undefined);
});
