// What flies over YOU (docs/DESIGN-LOOP.md §1 and §3, approved 2026-11-17). Sky keeps a 30-day tally, on this phone
// only, of the aircraft types it has seen here (unique aircraft per day) and the hours it was open. Two things read it:
//   "Rare here": a type that is under 1% of what has been seen, once 200 aircraft have been seen. A ribbon and bonus XP;
//                the card's tier never changes.
//   How busy your sky is: aircraft per open hour → 'quiet' (under 4), 'steady', 'busy' (over 20), which sizes missions;
//                and which missions a plane seen here in the last 7 days could complete.
// localStorage 'skyLocal' = { d: { 'yyyy-m-d': { h: openHours, t: { TYPE: n }, f: { flag: n } } } }. No DOM.
const KEY = 'skyLocal', DAYS = 30, MIN_SEEN = 200, RARE_SHARE = 0.01;
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const dayTime = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
let cache = null, saved = 0;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { cache = null; }
  if (!cache || typeof cache.d !== 'object') cache = { d: {} };
  const cut = Date.now() - DAYS * 86400e3; for (const k of Object.keys(cache.d)) if (!(dayTime(k) >= cut)) delete cache.d[k];
  return cache;
}
const save = (now = false) => { if (!now && Date.now() - saved < 15000) return; saved = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {} };
// Newly seen aircraft (each once a day): [{ type, flags: ['heli', 'wide', 'prop', 'low', 'high', ...] }]; newHour: this
// clock hour hadn't been counted as open yet today.
export function noteLocal(planes, newHour) {
  if (!planes?.length && !newHour) return;
  const c = load(), day = (c.d[dayKey()] ??= { h: 0, t: {}, f: {} });
  if (newHour) day.h++;
  for (const p of planes ?? []) { const t = String(p.type || '?').toUpperCase(); day.t[t] = (day.t[t] ?? 0) + 1; for (const f of p.flags ?? []) day.f[f] = (day.f[f] ?? 0) + 1; }
  save();
}
// { total, hours, byType: Map, flags7: { flag: n } (last 7 days), perHour, sky: 'new' | 'quiet' | 'steady' | 'busy' }
export function localStats(now = Date.now()) {
  const c = load(), byType = new Map(), flags7 = {}; let total = 0, hours = 0; const week = now - 7 * 86400e3;
  for (const [k, d] of Object.entries(c.d)) {
    hours += d.h ?? 0;
    for (const [t, n] of Object.entries(d.t ?? {})) { byType.set(t, (byType.get(t) ?? 0) + n); total += n; }
    if (dayTime(k) >= week - 86400e3) for (const [f, n] of Object.entries(d.f ?? {})) flags7[f] = (flags7[f] ?? 0) + n;
  }
  const perHour = hours ? total / hours : 0;
  return { total, hours, byType, flags7, perHour, sky: hours < 3 ? 'new' : perHour < 4 ? 'quiet' : perHour > 20 ? 'busy' : 'steady' };
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
