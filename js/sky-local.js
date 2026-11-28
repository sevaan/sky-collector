// What flies over YOU (docs/DESIGN-LOOP.md §1 and §3, approved 2026-11-17). Sky keeps a 30-day tally, on this phone
// only, of the aircraft types it has seen here (unique aircraft per day) and the hours it was open. Two things read it:
//   "Rare here": a type that is under 1% of what has been seen, once 200 aircraft have been seen. A ribbon and bonus XP;
//                the card's tier never changes.
//   How busy your sky is: aircraft per open hour → 'quiet' (under 4), 'steady', 'busy' (over 20), which sizes missions;
//                and which missions a plane seen here in the last 7 days could complete.
// localStorage 'skyLocal' = { d: { 'yyyy-m-d': { h: openHours, t: { TYPE: n }, f: { flag: n }, oh: [clock hours open],
// fh: { hour: { flag: n } } } } }: oh and fh (2026-11-20) say WHEN things fly here, so missions fit the hour. No DOM.
import { later } from './save-later.js?v=0.1.1939';
const KEY = 'skyLocal', DAYS = 30, MIN_SEEN = 200, RARE_SHARE = 0.01;
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const dayTime = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
let cache = null, saved = 0, dirty = false, readAt = 0;
/* fresh: a reader (localStats) takes what another page saved since (playtest 2026-11-20: the Collection's frame loaded
   its copy once, before the first tally was saved, and its Find said "Keep Sky Collector open" all session). Never over
   this page's own tallies that aren't saved yet, and at most every few seconds. */
function load(fresh = false) {
  if (cache && !(fresh && !dirty && Date.now() - readAt > 3000)) return cache;
  readAt = Date.now();
  try { cache = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { cache = null; }
  if (!cache || typeof cache.d !== 'object') cache = { d: {} };
  const cut = Date.now() - DAYS * 86400e3; for (const k of Object.keys(cache.d)) if (!(dayTime(k) >= cut)) delete cache.d[k];
  return cache;
}
const write = () => { saved = Date.now(); dirty = false; try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {} }, writeLater = later(() => { if (dirty) write(); });
const save = (now = false) => { dirty = true; if (!now && Date.now() - saved < 15000) { writeLater(); return; } write(); };
// Newly seen aircraft (each once a day): [{ type, flags: ['heli', 'wide', 'prop', 'low', 'high', ...] }]; newHour: this
// clock hour hadn't been counted as open yet today.
/* late: [{ flags }] for aircraft already counted today that showed something new (its route came in, it climbed past 70°…):
   their flags count, the aircraft doesn't count again (2026-11-20, missions: nh = aircraft per clock hour) */
export function noteLocal(planes, newHour, hour = new Date().getHours(), late = null) {
  if (!planes?.length && !newHour && !late?.length) return;
  const c = load(), day = (c.d[dayKey()] ??= { h: 0, t: {}, f: {} });
  if (newHour) { day.h++; (day.oh ??= []).includes(hour) || day.oh.push(hour); }
  /* 'al:ACA' (an airline) and 'to:GB' (where a flight goes) are kept by the day only, never by the hour: week themes count
     how many different ones flew here (js/progress.js skyWeekPossible); missions don't need them per hour */
  const flag = (f) => { day.f[f] = (day.f[f] ?? 0) + 1; if (f.includes(':')) return; const fh = ((day.fh ??= {})[hour] ??= {}); fh[f] = (fh[f] ?? 0) + 1; };
  for (const p of planes ?? []) { const t = String(p.type || '?').toUpperCase(); day.t[t] = (day.t[t] ?? 0) + 1; (day.nh ??= {})[hour] = (day.nh[hour] ?? 0) + 1; for (const f of p.flags ?? []) flag(f); }
  for (const p of late ?? []) for (const f of p.flags ?? []) flag(f);
  save();
}
// The next few clock hours (from now, not past midnight: the day's missions end then) are what missions are dealt for.
export const SOON_HOURS = 4;
const soonHours = (now) => { const h = new Date(now).getHours(); return Array.from({ length: Math.min(SOON_HOURS, 24 - h) }, (_, i) => h + i); };
// { total, hours, byType: Map, types7: Map (last 7 days), airlines7, countries7 (different ones, last 7 days), flags7: { flag: n } (last 7 days), perHour, sky: 'new' | 'quiet' | 'steady' | 'busy',
//   flagsSoon: { flag: n } seen in the coming hours of the clock on the last 7 days, soonOpen: how many of those hours the
//   app was open (0: nothing known about this time of day yet) }
export function localStats(now = Date.now()) {
  const c = load(true), byType = new Map(), typeDays = new Map(), typesToday = new Set(), today = dayKey(now), types7 = new Map(), flags7 = {}, flagsSoon = {}, soon = soonHours(now), byHour = {}, openByHour = {}; let total = 0, hours = 0, soonOpen = 0, soonN = 0, days = 0, soonPlanes = 0; const week = now - 7 * 86400e3;
  for (const [k, d] of Object.entries(c.d)) {
    hours += d.h ?? 0; if (d.h) days++;
    for (const [t, n] of Object.entries(d.t ?? {})) { byType.set(t, (byType.get(t) ?? 0) + n); total += n; if (n > 0) { typeDays.set(t, (typeDays.get(t) ?? 0) + 1); if (k === today) typesToday.add(t); } }
    if (dayTime(k) >= week - 86400e3) {
      for (const [f, n] of Object.entries(d.f ?? {})) flags7[f] = (flags7[f] ?? 0) + n;
      for (const [t, n] of Object.entries(d.t ?? {})) types7.set(t, (types7.get(t) ?? 0) + n);
      for (const h of soon) { if (d.oh?.includes(h)) { soonOpen++; if (d.nh) soonPlanes++; } soonN += d.nh?.[h] ?? 0; for (const [f, n] of Object.entries(d.fh?.[h] ?? {})) flagsSoon[f] = (flagsSoon[f] ?? 0) + n; }
      for (const h of d.oh ?? []) { openByHour[h] = (openByHour[h] ?? 0) + 1; byHour[h] = (byHour[h] ?? 0) + (d.nh?.[h] ?? 0); }
    }
  }
  const perHour = hours ? total / hours : 0, word = (r) => (r < 4 ? 'quiet' : r > 20 ? 'busy' : 'steady');
  /* how busy the coming hours have been on the last 7 days (aircraft per open hour), once that's known; else the place's own */
  const soonRate = soonPlanes >= 2 ? soonN / soonPlanes : perHour, sky = hours < 3 ? 'new' : word(perHour);
  /* how many different airlines and destination countries flew here in the last 7 days (week themes) */
  const distinct = (pre) => Object.keys(flags7).filter((k) => k.startsWith(pre)).length;
  return { total, hours, days, byType, typeDays, typesToday, types7, airlines7: distinct('al:'), countries7: distinct('to:'), flags7, flagsSoon, soonOpen, soonN, soonRate, soonSky: sky === 'new' ? 'new' : soonPlanes >= 2 ? word(soonRate) : sky, byHour, openByHour, perHour, sky };
}
/* Find's line under a type that has flown over you (Sky Build playtest v0.1.1812: a fresh install said "Seen 8 times near
   you in the last 30 days" after 2 minutes, 8 different aircraft of one type in the first feed, as if it were a month's
   history). A visit is a day, as for Regulars (js/sky-regulars.js): the days this type was seen here, out of the days
   Sky was open. Until there are HISTORY_DAYS of them, only what's true today, or nothing. */
/* The types seen here on the 7 days before today, and how many days the log has (the daily note's "stranger to your sky",
   js/sky-note.js): types only, as the log keeps them */
export function typesWeek(now = Date.now()) {
  const c = load(true), today = dayKey(now), from = dayTime(today) - 7 * 86400e3, types = new Set(); let days = 0;
  for (const [k, d] of Object.entries(c.d)) { if (d.h) days++; if (k === today || dayTime(k) < from) continue; for (const [t, n] of Object.entries(d.t ?? {})) if (n > 0) types.add(t); }
  return { types, days };
}
export const HISTORY_DAYS = 3;
export function seenLine(type, stats) {
  const t = String(type || '').toUpperCase(), n = stats?.typeDays?.get(t) ?? 0, of = stats?.days ?? 0;
  if (!t || t === '?' || !n) return '';
  if (of < HISTORY_DAYS) return stats.typesToday?.has(t) ? 'Flew over you today' : '';
  return n >= of ? `Seen near you all ${of} days you’ve looked` : `Seen near you on ${n} of ${of} days`;
}
// Is this type unusual where you are? Never before enough has been seen, and never for a plane with no type code.
export function rareHere(type, stats = localStats()) {
  const t = String(type || '').toUpperCase(); if (!t || t === '?' || stats.total < MIN_SEEN) return false;
  return (stats.byType.get(t) ?? 0) / stats.total < RARE_SHARE;
}
// Does plane tracking reach this place at all? (docs/DESIGN-LOOP.md §6) Each good answer from the feed is counted, and
// whether it held any aircraft within range. 60 good answers (ten minutes of an open app) with never a single aircraft
// means volunteers' receivers don't cover here: the game says so instead of looking broken.
export function noteFeed(n) { const c = load(), day = (c.d[dayKey()] ??= { h: 0, t: {}, f: {} }); day.q = (day.q ?? 0) + 1; if (n > 0) day.r = (day.r ?? 0) + 1; save(); }
export function noCoverage() { let q = 0, r = 0; for (const d of Object.values(load().d)) { q += d.q ?? 0; r += d.r ?? 0; } return q >= 60 && r === 0; }
export const _resetLocal = (v = null) => { cache = v; saved = 0; }; // tests
