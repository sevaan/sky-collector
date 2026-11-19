// js/plane-feed.js: the plane feed's rules, and a simulated day of play (2026-11-18).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, clampDial, dayKey, freshFeed, pickSource, nextGap, afterAnswer, feedDown, maxAgeS, easeLeft } from '../js/plane-feed.js';

const T0 = new Date(2026, 10, 18, 20, 0, 0).getTime(); // 8 PM local

test('dial: odd or missing values keep the defaults, numbers are kept in bounds', () => {
  assert.deepEqual(clampDial(null), DEFAULTS);
  assert.deepEqual(clampDial({ idleS: 'x' }), DEFAULTS);
  assert.equal(clampDial({ idleS: 1 }).idleS, 5);
  assert.equal(clampDial({ idleS: 9999 }).idleS, 300);
  assert.equal(clampDial({ idleS: 20, nearS: 40 }).nearS, 20); /* near is never slower than idle */
});

test('source: phone first in the app, relay on the website, none when both are out', () => {
  const st = freshFeed();
  assert.equal(pickSource(st, { phoneOk: true, relayOk: true, now: T0 }), 'phone');
  assert.equal(pickSource(st, { phoneOk: false, relayOk: true, now: T0 }), 'relay');
  assert.equal(pickSource(st, { phoneOk: false, relayOk: false, now: T0 }), 'none');
  const off = { ...st, phoneOff: dayKey(T0) };
  assert.equal(pickSource(off, { phoneOk: true, relayOk: true, now: T0 }), 'relay');
  assert.equal(pickSource(off, { phoneOk: true, relayOk: true, now: T0 + 24 * 3600e3 }), 'phone'); /* adsb.lol again the next day */
  assert.equal(feedDown({ ...off, relayDownUntil: T0 + 1e5 }, { phoneOk: true, relayOk: true, now: T0 }), true);
});

test('gap: 30 s idle, 10 s near, slower when the allowance runs low, backoff on failures', () => {
  const st = freshFeed();
  assert.equal(nextGap(st, 'phone', { near: false }), 30);
  assert.equal(nextGap(st, 'phone', { near: true }), 10);
  assert.equal(nextGap({ ...st, remaining: 100 }, 'phone', { near: false }), 60);
  assert.equal(nextGap({ ...st, remaining: 100 }, 'phone', { near: true }), 30);
  assert.equal(nextGap({ ...st, remaining: 40 }, 'phone', { near: false }), 120);
  assert.equal(nextGap({ ...st, remaining: 40 }, 'relay', { near: true }), 10); /* the phone's allowance doesn't slow the relay */
  assert.equal(nextGap({ ...st, failures: 1 }, 'phone', { near: false }), 60);
  assert.equal(nextGap({ ...st, failures: 9 }, 'phone', { near: false }), 180);
});

test('switch: low allowance, a 429 or two failures in a row hand the day to the relay', () => {
  const today = dayKey(T0);
  assert.equal(afterAnswer(freshFeed(), { src: 'phone', ok: true, remaining: 20 }, T0).phoneOff, today);
  assert.equal(afterAnswer(freshFeed(), { src: 'phone', ok: false, status: 429 }, T0).phoneOff, today);
  const one = afterAnswer(freshFeed(), { src: 'phone', ok: false, status: 0 }, T0);
  assert.equal(one.phoneOff, ''); assert.equal(afterAnswer(one, { src: 'phone', ok: false, status: 0 }, T0).phoneOff, today);
  assert.equal(afterAnswer(one, { src: 'phone', ok: true, remaining: 300 }, T0).phoneFails, 0); /* a success resets the count */
  const r1 = afterAnswer(freshFeed(), { src: 'relay', ok: false, status: 502 }, T0), r2 = afterAnswer(r1, { src: 'relay', ok: false, status: 502 }, T0);
  assert.ok(r2.relayDownUntil > T0);
});

test('drawing: planes kept for two gaps (never under a minute); corrections ease out', () => {
  assert.equal(maxAgeS(10), 60); assert.equal(maxAgeS(30), 70); assert.equal(maxAgeS(120), 240);
  assert.equal(easeLeft(0, 0), 1); assert.equal(easeLeft(0, 1500), 0); assert.ok(easeLeft(0, 750) > 0.4 && easeLeft(0, 750) < 0.6);
});

// ---- a simulated day ----
// One request every gap while the app is open. adsb.lol: an allowance that counts down (500 a day per address, shared
// by everyone on it), up = whether it answers. relay: up or down. near: the share of the session with a plane near the
// circle or something being shown (in alternating stretches).
function day({ sessions, allowance = 500, adsbUp = true, relayUp = true, relayOk = true, phoneOk = true, nearShare = 0.25 }) {
  let st = freshFeed(), left = allowance, t = T0, downS = 0; const count = { phone: 0, relay: 0 };
  for (const mins of sessions) {
    let next = t; const end = t + mins * 60e3;
    for (let s = t; s < end; s += 1000) {
      const near = ((s - t) / 60e3) % 10 < nearShare * 10;
      const env = { phoneOk, relayOk, now: s }, src = pickSource(st, env);
      if (src === 'none') { downS++; continue; }
      if (s < next) continue;
      count[src]++;
      let r;
      if (src === 'phone') { if (!adsbUp) r = { ok: false, status: 0 }; else if (left <= 0) r = { ok: false, status: 429, remaining: 0 }; else { left--; r = { ok: true, status: 200, remaining: left }; } }
      else r = relayUp ? { ok: true, status: 200 } : { ok: false, status: 502 };
      st = afterAnswer(st, { src, ...r }, s);
      next = s + nextGap(st, pickSource(st, { ...env, now: s }), { near }) * 1000;
    }
    t = end + 3 * 3600e3; /* the next session later that day */
  }
  return { ...count, downMin: Math.round(downS / 60) };
}

test('a simulated day', () => {
  const rows = {
    'casual 10 min': day({ sessions: [10] }),
    '3-hour session': day({ sessions: [180] }),
    'shared address, 60 left': day({ sessions: [180], allowance: 60 }),
    'two hours, then two more': day({ sessions: [120, 120] }),
    'adsb.lol down': day({ sessions: [60], adsbUp: false }),
    'relay down': day({ sessions: [60], relayUp: false }),
    'both down': day({ sessions: [60], adsbUp: false, relayUp: false }),
    'website (relay only)': day({ sessions: [60], phoneOk: false }),
  };
  console.log('requests in a day (phone = adsb.lol, relay = our server):');
  for (const [k, v] of Object.entries(rows)) console.log(`  ${k.padEnd(26)} phone ${String(v.phone).padStart(4)}  relay ${String(v.relay).padStart(4)}  planes off ${v.downMin} min`);
  assert.ok(rows['casual 10 min'].phone <= 40 && rows['casual 10 min'].relay === 0);
  assert.ok(rows['3-hour session'].phone <= 500); /* 3 hours fits in a day's allowance */
  assert.ok(rows['shared address, 60 left'].relay > 0 && rows['shared address, 60 left'].phone <= 60 && rows['shared address, 60 left'].downMin === 0);
  assert.ok(rows['adsb.lol down'].phone <= 2 && rows['adsb.lol down'].relay > 0 && rows['adsb.lol down'].downMin === 0);
  assert.equal(rows['relay down'].relay, 0); assert.equal(rows['relay down'].downMin, 0);
  assert.ok(rows['both down'].downMin > 0);
});

test('no signal: network errors only back off, never hand the day to the relay; online, six in a row rest the phone 30 min', () => {
  let st = freshFeed();
  for (let i = 0; i < 20; i++) st = afterAnswer(st, { src: 'phone', ok: false, status: 0, net: true, online: false }, T0 + i * 1000);
  assert.equal(st.phoneOff, ''); assert.equal(pickSource(st, { phoneOk: true, relayOk: true, now: T0 + 30e3 }), 'phone');
  assert.ok(nextGap(st, 'phone', { near: false }) > DEFAULTS.idleS); /* backed off */
  st = afterAnswer(st, { src: 'phone', ok: true, status: 200, remaining: 400 }, T0 + 40e3);
  assert.equal(st.failures, 0); assert.equal(nextGap(st, 'phone', { near: false }), DEFAULTS.idleS); /* signal back: the normal pace */
  let on = freshFeed();
  for (let i = 0; i < 6; i++) on = afterAnswer(on, { src: 'phone', ok: false, status: 0, net: true, online: true }, T0 + i * 1000);
  assert.equal(on.phoneOff, ''); assert.equal(pickSource(on, { phoneOk: true, relayOk: true, now: T0 + 10e3 }), 'relay');
  assert.equal(pickSource(on, { phoneOk: true, relayOk: true, now: T0 + 31 * 60e3 }), 'phone');
});
