// Regulars (2026-11-19, Sevaan: "do them all", playtest idea #2): flights that pass over you at about the same time each
// day, learned on this phone from the plane feed while Sky is open (js/sky-today.js logSeen) and never sent anywhere.
// Airline flights only: private and other anonymous aircraft have no callsign here (js/planes.js isAnonymous), so a
// person's plane can never become a "regular". The plane version of a satellite's pass. No DOM.
// localStorage 'skyRegulars' = { CALLSIGN: { 'yyyy-m-d': minuteOfDay first seen } }, 14 days, at most 600 callsigns.
import { later } from './save-later.js?v=0.1.1920';
import { privateCatch, GOV_OPS, BIZ_OPS } from './plane-privacy.js?v=0.1.1920';
import { AIRLINE_ICONS } from './airline-icons.js?v=0.1.1920';
import { AIRLINE_FACTS } from './airline-facts.js?v=0.1.1920';
const KEY = 'skyRegulars', KEEP_DAYS = 14, MAX = 600, WINDOW = 45, MIN_DAYS = 3, LOOK_DAYS = 7;
const AIRLINE = /^[A-Z]{3}\d/;
/* Only airlines on Sky's own list (2026-11-24, Content Writing's review via Boss: any callsign shaped like an airline's was
   kept, so an unlisted charter or air-ambulance operator could be named with its usual time): the airlines Sky has a mark
   or facts for, never a business or government operator even if listed (NetJets has a mark). Kept and named only for these. */
const LISTED = new Set([...Object.keys(AIRLINE_ICONS), ...Object.keys(AIRLINE_FACTS)].filter((op) => !GOV_OPS.has(op) && !BIZ_OPS.has(op)));
export const regularAllowed = (callsign) => { const cs = String(callsign ?? '').trim().toUpperCase(); return AIRLINE.test(cs) && LISTED.has(cs.slice(0, 3)) && !privateCatch({ callsign: cs }); };
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const dayStart = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const minuteOf = (t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
let cache = null, savedAt = 0;
const load = () => { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { cache = {}; } { let cut = false; for (const cs of Object.keys(cache)) if (!regularAllowed(cs)) { delete cache[cs]; cut = true; } if (cut) try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {} } /* gone from the phone too, not just hidden */ /* never a business, military or government callsign, even one saved before the rule (QA 2026-11-19) */ return cache; };
const write = () => { savedAt = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {} }, writeLater = later(write);
const save = () => { if (Date.now() - savedAt < 15000) { writeLater(); return; } write(); };
// Callsigns seen now ([{ callsign }]); each callsign's first sighting of the day is kept.
export function noteRegulars(planes, now = Date.now()) {
  const c = load(), k = dayKey(now), m = minuteOf(now), ty = loadTypes(); let changed = false, typed = false;
  for (const p of planes ?? []) { const cs = String(p?.callsign ?? '').trim().toUpperCase(); if (!regularAllowed(cs)) continue; const r = (c[cs] ??= {}); if (r[k] == null) { r[k] = m; changed = true; }
    const t = String(p?.type ?? '').trim().toUpperCase(); if (/^[A-Z0-9]{2,4}$/.test(t) && ty[cs] !== t) { ty[cs] = t; typed = true; } }
  if (typed) saveTypes(c);
  if (!changed) return;
  const cut = now - KEEP_DAYS * 86400e3;
  for (const [cs, r] of Object.entries(c)) { for (const d of Object.keys(r)) if (dayStart(d) < cut) delete r[d]; if (!Object.keys(r).length) delete c[cs]; }
  const all = Object.keys(c); if (all.length > MAX) all.sort((a, b) => Math.max(...Object.keys(c[a]).map(dayStart)) - Math.max(...Object.keys(c[b]).map(dayStart))).slice(0, all.length - MAX).forEach((cs) => delete c[cs]);
  save();
}
/* Each regular's aircraft type, last seen (2026-11-20, simulator check: a regular that isn't flying now had no type, so the
   widgets and the daily note had no photo of it). localStorage 'skyRegularTypes' = { CALLSIGN: 'B38M' }, only callsigns in
   'skyRegulars' (pruned with it) */
const TYPES = 'skyRegularTypes'; let types = null, typesAt = 0;
const loadTypes = () => { if (types) return types; try { types = JSON.parse(localStorage.getItem(TYPES) || '{}') || {}; } catch { types = {}; } return types; };
let typesC = null; const typesLater = later(() => { typesAt = 0; if (typesC) saveTypes(typesC); });
function saveTypes(c) { typesC = c; if (Date.now() - typesAt < 15000) { typesLater(); return; } typesAt = Date.now(); for (const cs of Object.keys(types)) if (!c[cs]) delete types[cs]; try { localStorage.setItem(TYPES, JSON.stringify(types)); } catch {} }
export const regularType = (callsign) => loadTypes()[String(callsign ?? '').toUpperCase()] || '';
// Minutes apart on a clock face (23:50 and 00:10 are 20 apart)
const apart = (a, b) => { const d = Math.abs(a - b) % 1440; return Math.min(d, 1440 - d); };
// One callsign's days → { minute (usual time), days (in the window), of (days looked at) } or null when it isn't regular.
export function regularOf(days, now = Date.now()) {
  const from = dayStart(dayKey(now)) - (LOOK_DAYS - 1) * 86400e3;
  const seen = Object.entries(days ?? {}).filter(([k]) => dayStart(k) >= from).map(([, m]) => m);
  if (seen.length < MIN_DAYS) return null;
  let best = null;
  for (const c of seen) { const near = seen.filter((x) => apart(x, c) <= WINDOW); if (!best || near.length > best.length) best = near; }
  if (best.length < MIN_DAYS) return null;
  /* the usual time: the circular mean of the times that agree */
  const a = best.reduce((s, x) => [s[0] + Math.cos(x / 1440 * 2 * Math.PI), s[1] + Math.sin(x / 1440 * 2 * Math.PI)], [0, 0]);
  const minute = Math.round(((Math.atan2(a[1], a[0]) / (2 * Math.PI) * 1440) + 1440) % 1440);
  const first = Math.min(...Object.keys(days).map(dayStart)), of = Math.min(LOOK_DAYS, Math.floor((dayStart(dayKey(now)) - Math.max(first, from)) / 86400e3) + 1);
  return { minute, days: best.length, of: Math.max(of, best.length) };
}
// Every regular, with when it's next due: [{ callsign, minute, days, of, next (ms) }], soonest first.
export function regulars(now = Date.now(), store = load()) {
  const out = [], today = dayStart(dayKey(now));
  for (const [cs, days] of Object.entries(store)) {
    if (!regularAllowed(cs)) continue; const r = regularOf(days, now); if (!r) continue;
    let next = today + r.minute * 60000; if (next < now - WINDOW * 60000 / 3) next += 86400e3; /* just gone: tomorrow */
    out.push({ callsign: cs, ...r, next });
  }
  return out.sort((a, b) => a.next - b.next);
}
/* the minute of the day a flight was first seen today, or null (the daily note's "came over at", js/sky-note.js) */
export const seenTodayMinute = (callsign, now = Date.now()) => { const d = load()[String(callsign ?? '').toUpperCase()]; const m = d?.[dayKey(now)]; return m == null ? null : m; };
export const regularFor = (callsign, now = Date.now()) => { const d = load()[String(callsign ?? '').toUpperCase()]; return d ? regularOf(d, now) : null; };
export const clockText = (minute) => new Date(2000, 0, 1, Math.floor(minute / 60), minute % 60).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
/* Airlines (3-letter prefixes) seen here in the last `days` days at these clock hours (2026-11-20: "Catch an airline you've
   never caught" is dealt only when one you don't have has flown here at this time of day this week) */
export function airlinesAt(hours, now = Date.now(), days = 7, store = load()) {
  const from = dayStart(dayKey(now)) - days * 86400e3, hs = new Set(hours), out = new Set();
  for (const [cs, d] of Object.entries(store)) for (const [k, m] of Object.entries(d)) if (dayStart(k) >= from && hs.has(Math.floor(m / 60))) { out.add(cs.slice(0, 3)); break; }
  return out;
}
export const _resetRegulars = (v = null) => { cache = v; savedAt = 0; types = null; typesAt = 0; }; // tests
