// Sky Collector's Today page (2026-11-15; docs/TONIGHT-PLAN.md, build steps 1–4). It takes over the Tonight panel:
//   Up now           the best catch overhead right now, then everything up, best first, with Show me
//   Coming over next planes that will climb above 15° in the next 15 minutes, projected from position, speed and track
//   Today so far     planes your phone has seen, by hour (only the hours the app was open: gaps are said, not guessed)
// The seen log is kept on the phone (localStorage 'skySeen': today's date, a set of hexes, counts by hour).
// No server. No DOM outside the container it's given.

import { isProp } from './sky-props.js?v=0.1.1825';
import { planesUp } from './sky-up.js?v=0.1.1825';
import { planeKey } from './flights.js?v=0.1.1825';
import { aircraftName, isHelicopter, planePath } from './planes.js?v=0.1.1825';
import { glyphSvg, flightPhotoFor, photoFor, FAMILY } from './flight-card.js?v=0.1.1825';
import { airlineIcon } from './airline-icons.js?v=0.1.1825';
import { catches, previewFor } from './sky-catch.js?v=0.1.1825';
import { regulars, noteRegulars, clockText } from './sky-regulars.js?v=0.1.1825';
import { noteLocal, rareHere, localStats } from './sky-local.js?v=0.1.1825';
import { planeSet } from './sky-sets.js?v=0.1.1825';
import { MIL_TYPES } from './plane-privacy.js?v=0.1.1825';
import { isOldType, isNewType, isBoeing, isAirbus, continentOfAirport } from './sky-kinds.js?v=0.1.1825';
import { cloudsHtml, rainHtml } from './weather-art.js?v=0.1.1825';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
export const dirWord = (az) => DIRS[Math.round(((az % 360) + 360) % 360 / 45) % 8];
const ft = (hKm) => `${(Math.round(hKm * 3280.84 / 100) * 100).toLocaleString('en-US')} ft`;

// ---------- seen log ----------
const SEEN = 'skySeen';
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function readSeen() {
  let s = null; try { s = JSON.parse(localStorage.getItem(SEEN) || 'null'); } catch {}
  if (!s || s.day !== dayKey()) s = { day: dayKey(), hexes: [], hours: Array(24).fill(0), open: Array(24).fill(0) };
  return s;
}
let seenCache = null, seenSaved = 0;
// What a seen plane could count for in a mission (js/progress.js SKY_MISSIONS reads the same words).
const localFlags = (p) => { const f = [], st = planeSet(p.type, isHelicopter(p)).id; if (st === 'helicopters') f.push('heli'); if (st === 'twinaisle' || st === 'giants') f.push('wide'); if (st === 'props' || st === 'light') f.push('prop'); if ((p.altFt ?? 0) >= 35000) f.push('high'); if (p.altFt != null && p.altFt < 5000) f.push('low'); if (/^[A-Z]{3}\d/.test(p.callsign ?? '')) f.push('airline', `al:${p.callsign.slice(0, 3)}`) /* which airline: week themes count different airlines (js/progress.js skyWeekPossible) */; return f; };
/* More of what a plane could do for a mission (2026-11-20, design/missions-draft.md): its kind, whether it's climbing or coming
   down, right overhead, rising into your sky; and once its route is known (only an airline's), where it's going. By type
   only for military planes. a: { plane, el }; ctx.route(callsign): a route already looked up (never asks for one). */
function moreFlags(a, ctx, now) {
  const p = a.plane, f = [], t = String(p.type ?? '').toUpperCase(), st = planeSet(p.type, isHelicopter(p)).id, alt = p.altFt;
  if (st === 'giants') f.push('giant'); if (st === 'regional') f.push('regional'); if (st === 'bizjets' || p.cls === 'biz') f.push('biz');
  if (st === 'military' || MIL_TYPES.test(t)) f.push('mil'); if (isBoeing(t)) f.push('boeing'); if (isAirbus(t)) f.push('airbus');
  if (isOldType(t)) f.push('oldtype'); if (isNewType(t, now)) f.push('newtype');
  if (p.climbKnown && alt != null && alt < 15000) { if (p.climb >= 1000) f.push('up'); if (p.climb <= -1000) f.push('down'); }
  if (a.el > 70) f.push('overhead');
  if (rose.has(p.hex)) f.push('rise');
  const full = /^[A-Z]{3}\d/.test(p.callsign ?? '') ? ctx?.route?.(p.callsign)?.full : null;
  if (full?.from && full?.to) {
    f.push('routed'); const km = kmOf(full), fc = full.from.cc, tc = full.to.cc, c1 = continentOfAirport(full.from), c2 = continentOfAirport(full.to);
    if (fc && tc && fc !== tc) f.push('abroad'); if (c1 && c2 && c1 !== c2) f.push('cont');
    if (km != null) { if (km > 3000) f.push('far'); if (km > 5000) f.push('ocean'); if (km < 500) f.push('short'); }
    if (tc) f.push(`to:${tc}`); /* the country it's going to: Passport week counts different ones */
    if (ctx?.obs && full.to.lat != null && hav(ctx.obs.lat, ctx.obs.lon, full.to.lat, full.to.lon) <= 30) f.push('landing');
  }
  return f;
}
/* Rising into your sky (the "first minute" mission): a plane the app saw at 5° or lower, then above it. Only planes seen
   rising count, never ones already up when the app opened. hex → when it rose (ms), for today. */
const low = new Set(), rose = new Map(); let riseDay = '';
export const upForOf = (hex, t = Date.now()) => (rose.has(hex) ? Math.max(0, Math.round((t - rose.get(hex)) / 1000)) : null);
const noted = new Map(); let flagsAt = 0;
// Called with the planes above the horizon each poll (about every 10 s while Explore or Today is open).
export function logSeen(list, ctx = null) {
  try { noteRegulars((list ?? []).map((a) => a.plane)); } catch {} /* Regulars: airline callsigns and when they pass (js/sky-regulars.js) */
  const s = seenCache && seenCache.day === dayKey() ? seenCache : (seenCache = readSeen());
  const h = new Date().getHours(), have = new Set(s.hexes), newHour = !s.open[h], fresh = [], late = [], now = Date.now();
  s.open[h] = 1;
  if (riseDay !== s.day) { riseDay = s.day; low.clear(); rose.clear(); noted.clear(); }
  for (const a of list ?? []) { const x = a.plane?.hex; if (!x) continue; if (a.el <= 5) low.add(x); else if (low.has(x) && !rose.has(x)) rose.set(x, now); }
  for (const a of list ?? []) { const x = a.plane?.hex; if (x && !have.has(x)) { have.add(x); s.hexes.push(x); s.hours[h]++; const fl = localFlags(a.plane); noted.set(x, new Set(fl)); fresh.push({ type: a.plane.type, flags: fl }); } }
  /* every couple of seconds: what each plane up has shown since it was first counted (each flag once a plane a day) */
  if (now - flagsAt > 2000) { flagsAt = now; for (const a of list ?? []) { const x = a.plane?.hex; if (!x || a.el <= 5) continue; const n = noted.get(x) ?? noted.set(x, new Set()).get(x), add = moreFlags(a, ctx, now).filter((f) => !n.has(f)); if (add.length) { add.forEach((f) => n.add(f)); late.push({ flags: add }); } } }
  noteLocal(fresh, newHour, h, late); /* the 30-day tally behind "Rare here" and mission sizing (js/sky-local.js) */
  if (Date.now() - seenSaved > 15000) { seenSaved = Date.now(); try { localStorage.setItem(SEEN, JSON.stringify(s)); } catch {} }
}

// ---------- what each plane is worth to you ----------
function worth(a, route, owned) {
  const p = a.plane, a3 = (p.callsign || '').slice(0, 3), full = route?.full;
  const fkey = full ? `F:${a3}:${full.from.icao}-${full.to.icao}` : null, pkey = planeKey(p);
  const newFlight = !!fkey && !owned.has(fkey), newPlane = !owned.has(pkey);
  const name = full ? `To ${full.to.city}` : route?.airline ? `${route.airline} ${(p.callsign || '').replace(/^[A-Z]{3}/, '')}` : aircraftName(p) || (isHelicopter(p) ? 'Helicopter' : 'Aircraft');
  const type = aircraftName(p) || null;
  const sub = [full ? `${route.airline || a3} · from ${full.from.city}` : null, type && type !== name ? type : null].filter(Boolean).join(' · ');
  /* what Collect would give now (js/sky-catch.js previewFor): a plane caught today gives nothing and goes to the bottom, a
     stamp (a new day on a flight, a new aircraft on a plane card) sits between those and a new card (QA 2026-11-19: Today's
     top pick was a plane already caught today) */
  let gain = 'new'; try { const k = previewFor(a, route).out?.kind; gain = k === 'none' ? 'none' : k === 'stamp' ? 'stamp' : (newFlight || newPlane) ? 'new' : 'stamp'; } catch {}
  const tag = gain === 'none' ? 'CAUGHT TODAY' : newFlight ? 'NEW FLIGHT' : newPlane ? (isHelicopter(p) ? 'NEW HELICOPTER' : 'NEW PLANE') : gain === 'stamp' ? 'NEW STAMP' : fkey ? 'IN YOUR COLLECTION' : 'SEEN BEFORE';
  const score = gain === 'none' ? a.el / 100 - 1000 : (newFlight ? 100 : 0) + (newPlane ? 60 : 0) + (gain === 'stamp' && !newFlight && !newPlane ? 30 : 0) + (isHelicopter(p) ? 25 : 0) + (full ? 10 : 0) + a.el / 10;
  return { name, sub, tag, score, gain, isNew: newFlight || newPlane, glyph: isHelicopter(p) ? 'heli' : 'jet' };
}

/* A Coming over next row's second line: the type, unless the title already is the type (Sky Build playtest v0.1.1812: "Boeing
   737-800" over "Common · Boeing 737-800 · from the north" for a plane with no route), then where it comes from. */
export const nextSub = (name, p, az) => { const ty = aircraftName(p); return [ty && ty !== name ? ty : null, az != null ? `from the ${dirWord(az)}` : null].filter(Boolean).join(' · '); };
// ---------- Coming over next: straight-line projection from position, speed and track ----------
export const upcoming = (...a) => forecast(...a); // js/sky-alerts.js: what's coming over in the next 15 minutes
/* A fix older than 2 minutes isn't projected (Sky Tester 2026-11-20): coming back to the app, the planes from before you
   left were carried 10+ minutes along a straight line and listed as coming over until the feed answered. upS: how long
   it stays above 15° (js/sky-alerts.js sure). */
export const FORECAST_MAX_AGE = 120e3;
function forecast(planes, obs, nowMs, visibleHexes) {
  const out = [];
  for (const p of planes) {
    if (visibleHexes.has(p.hex) || !(nowMs - p.at <= FORECAST_MAX_AGE)) continue;
    const path = planePath(p, obs, nowMs, 0, 900, 15); // the next 15 minutes, every 15 s
    const i = path.findIndex((q) => q.el > 15);
    if (i < 0) continue;
    let peak = path[i]; for (let j = i; j < path.length && path[j].el >= peak.el; j++) peak = path[j];
    const az = (Math.atan2(path[i].enu[0], path[i].enu[1]) * 180 / Math.PI + 360) % 360;
    let j = i; while (j < path.length && path[j].el > 15) j++;
    out.push({ p, inS: path[i].t, peakEl: peak.el, az, upS: (j - i) * 15 });
  }
  return out.sort((a, b) => a.inS - b.inS).slice(0, 8);
}

// ---------- the empty hero: three different reasons for no planes ----------
// 'ok' with nothing up is a quiet sky; 'failing' is the feed being unreachable; 'loading' is still asking.
function skyState(ctx) {
  const st = ctx.planes?.status ?? (ctx.positions ? 'ok' : 'loading');
  if (st === 'failing') return `<h3>Can’t reach the plane feed</h3><p class="td-lead">No word from the plane feed${ctx.planes?.lastOk ? ` since ${new Date(ctx.planes.lastOk).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}. Check your connection, and we’ll keep trying.</p>`;
  if (st === 'loading' || !ctx.positions) return '<h3>Checking what’s flying</h3><p class="td-lead">Finding the planes near you…</p>';
  if (ctx.noCoverage) return '<h3>No plane tracking here yet</h3><p class="td-lead">Sky Collector hears about planes from volunteers’ receivers, and none of them reach this place. It will work as soon as one does, and anywhere you travel that has them.</p>'; /* docs/DESIGN-LOOP.md §6 */
  /* pacing from your own sky (js/sky-local.js, 30 days here): how many usually pass, so how long until the next is likely (QA 2026-11-19, #6) */
  let ls = null; try { ls = localStats(); } catch {}
  if (ls && ls.hours >= 3 && ls.perHour > 0) { const n = ls.perHour, lo = Math.max(1, Math.floor(n)), hi = Math.max(lo + 1, Math.ceil(n * 1.25)), wait = Math.max(2, Math.round(60 / n / 5) * 5 || 2);
    return `<h3>Quiet sky</h3><p class="td-lead">Nothing above the trees right now. Usually ${n < 1 ? 'about one plane every hour or two' : `about ${lo} to ${hi} planes an hour`} pass over here, so the next is likely ${n < 1 ? 'within the hour' : `within about ${wait} min`}.</p>`; }
  return '<h3>Quiet sky</h3><p class="td-lead">Nothing above the trees right now. Planes come and go every few minutes.</p>';
}

// ---------- render ----------
// ctx: { planes: PlaneTracker, obs, positions: [{plane, az, el, rangeKm}], route(callsign), show(hex), place }
// The weather in the hero: { cls, html, word } from the forecast's now (cloud %, kind).
const WX_WORDS = { rain: 'Rain', snow: 'Snow', storm: 'Storms', fog: 'Fog' };
function heroSky(wx) {
  const n = wx?.now; if (!n) return { cls: '', html: '', word: '' };
  const cloud = Math.max(0, Math.min(1, (n.cloud ?? 0) / 100)), wet = ['rain', 'storm'].includes(n.kind), grey = wet || ['snow', 'fog'].includes(n.kind) || cloud >= 0.8;
  const word = WX_WORDS[n.kind] ?? (cloud >= 0.8 ? 'Overcast' : cloud >= 0.35 ? 'Partly cloudy' : 'Clear');
  if (cloud < 0.2 && !wet) return { cls: ' clear', html: '', word };
  const tint = grey ? [214, 223, 232] : [255, 255, 255];
  return { cls: ` cloudy${grey ? ' grey' : ''}`, html: `<div class="tn-sky" aria-hidden="true">${cloudsHtml(wet ? 1 : Math.max(0.45, cloud), { tint })}${wet ? rainHtml(50) : ''}</div>`, word };
}
const TARGET = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4"/></svg>'; /* main.js ICON_TARGET */
// The card keys you own, flight and plane (what makes a plane NEW to you)
/* (playtest 2026-11-18: every plane stayed NEW) the list is stored sightings since main.js setCatchSource(skySightings),
   with the card in cardKey; the old catch store had key / planeKey: read both */
function ownedKeys() { const owned = new Set(); for (const c of catches()) for (const k of [c.cardKey, c.key, c.planeKey]) if (k) owned.add(k); return owned; }
// A live plane's photo (the type in its airline's livery, its parent's, or the maker's), sm/ size, with the box the plane
// sits in; null when there's none yet. For pictures outside a card: All around you, Today's rows.
export function planePhoto(p) {
  const ph = p?.type ? flightPhotoFor({ callsign: p.callsign || '' }, p.type) : null; if (!ph) return null;
  return { ...ph, sm: String(ph.url).replace(/\/([^/]+)$/, '/sm/$1') };
}
// All around you in Sky Collector (2026-11-18): everything up now, worth first, and what's coming over next, named.
export function aroundPlanes(positions, planes, obs, route) {
  const owned = ownedKeys();
  const up = planesUp(positions).map((a) => ({ a, w: worth(a, route(a.plane.callsign), owned) })).sort((x, y) => y.w.score - x.w.score);
  const next = obs ? forecast(planes ?? [], obs, Date.now(), new Set(up.map((u) => u.a.plane.hex))) : [];
  return { up, next: next.map((n) => { const r = route(n.p.callsign), full = r?.full; return { ...n, name: full ? `To ${full.to.city}` : r?.airline || aircraftName(n.p) || 'Aircraft' }; }) };
}

// ================= Today, "the mix" (2026-11-18, Sevaan picked D of design/today-options.html) =================
// Top to bottom: 1 the live card (the best plane up now: photo, tail, a countdown until it leaves your sky, an arrow that
// turns with the phone, Show me), 2 a rare-plane alert (Epic or Legendary up or coming), 3 today's missions as cards (dealt
// face down in your card back once a day, turned over as they come into view; each shows the plane that would finish it),
// 4 coming over next (tails sliding toward now), 5 over you now (a departures board: Just arrived, Overhead, Leaving soon,
// NEW as its own tag, Show me on each row), 6 where they're going (arcs from you to every destination up there), 7 today
// so far (planes, airlines, countries, the farthest flight, the hours). Everything has a picture: a photo or a tail.
// ctx (from main.js renderSkyToday): planes, obs, positions, wx, noCoverage, route(cs), show(hex, fromEl, wait),
// open(hex, rect), tierOf(plane) -> {id, label, color} | null, missions() -> [{ id, text, done, by }],
// cardPhoto(cardKey) -> { url, tail } | null, facing() -> degrees | null, hint({az, el}) -> words, visible() -> bool.
const WIDE_T = /^(A3[3-9]|A35|A38|B74|B76|B77|B78|IL96|A30)/;
const PROP_T = { test: isProp }; /* js/sky-props.js: whole type codes (QA 2026-11-19: the old pattern counted Citation jets, the C-17 and the Beechjet) */
const altFt = (p) => p.altBaro ?? (p.hKm ?? 0) * 3280.84; /* barometric, as flight trackers show it (2026-11-19) */
const mins = (s) => Math.max(1, Math.round(s / 60));
const kmOf = (full) => { try { return full?.from?.lat != null && full?.to?.lat != null ? hav(full.from.lat, full.from.lon, full.to.lat, full.to.lon) : null; } catch { return null; } };
function hav(a1, o1, a2, o2) { const R = Math.PI / 180, s = Math.sin((a2 - a1) * R / 2) ** 2 + Math.cos(a1 * R) * Math.cos(a2 * R) * Math.sin((o2 - o1) * R / 2) ** 2; return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s))); }
function brg(a1, o1, a2, o2) { const R = Math.PI / 180, y = Math.sin((o2 - o1) * R) * Math.cos(a2 * R), x = Math.cos(a1 * R) * Math.sin(a2 * R) - Math.sin(a1 * R) * Math.cos(a2 * R) * Math.cos((o2 - o1) * R); return (Math.atan2(y, x) / R + 360) % 360; }
const tailOf = (p) => { const a3 = (p?.callsign || '').slice(0, 3); if (!/^[A-Z]{3}$/.test(a3)) return null; try { } catch {} const ic = airlineIcon(a3) || (FAMILY[a3] && airlineIcon(FAMILY[a3])); return ic?.tail ?? null; };
const tailImg = (url, cls = 'td2-tail') => (url ? `<img class="${cls}" src="${esc(url)}" alt="" decoding="async">` : '');
/* A picture for any plane: its photo, else its type's maker photo, else a photo of the nearest kind (no drawn glyphs) */
const FALLBACK_TYPE = { heli: 'EC35', prop: 'AT76', wide: 'B789', jet: 'A320' };
function picOf(p) { const ph = planePhoto(p); if (ph) return ph; const k = isHelicopter(p) ? 'heli' : PROP_T.test(p?.type ?? '') ? 'prop' : WIDE_T.test(p?.type ?? '') ? 'wide' : 'jet'; const f = photoFor(FALLBACK_TYPE[k]); return f ? { ...f, sm: String(f.url).replace(/\/([^/]+)$/, '/sm/$1') } : null; }
const bg = (ph) => (ph ? `background-image:url('${esc(ph.sm)}');background-position:${Math.round(((ph.box?.[0] ?? 0) + (ph.box?.[2] ?? 1)) * 50)}% ${Math.round(((ph.box?.[1] ?? 0) + (ph.box?.[3] ?? 1)) * 50)}%` : '');
// How long a plane stays above 3° from now (s, null past 30 min), and whether it came up in the last two minutes
function skyLeft(p, obs, t) { try { const path = planePath(p, obs, t, 0, 1800, 15), i = path.findIndex((q) => q.el < 3); return i < 0 ? null : path[i].t; } catch { return null; } }
function justUp(p, obs, t) { try { const q = planePath(p, obs, t, -120, -120, 1)[0]; return q && q.el < 3; } catch { return false; } }

// ---------- today's tally (planes, airlines, countries, the farthest flight), kept with the seen log ----------
const TALLY = 'skyTally';
function readTally() { let s = null; try { s = JSON.parse(localStorage.getItem(TALLY) || 'null'); } catch {} return s && s.day === dayKey() ? s : { day: dayKey(), airlines: [], countries: [], far: null }; }
let tally = null, tallySaved = 0;
function noteTally(up, route) {
  tally = tally && tally.day === dayKey() ? tally : readTally(); const A = new Set(tally.airlines), C = new Set(tally.countries);
  for (const u of up) { const p = u.a.plane, r = route(p.callsign), full = r?.full; if (r?.airline) A.add(r.airline);
    if (full) { if (full.to?.cc) C.add(full.to.cc); if (full.from?.cc) C.add(full.from.cc); const km = kmOf(full);
      if (km && (!tally.far || km > tally.far.km)) tally.far = { km: Math.round(km), city: full.to.city, from: full.from.city, airline: r.airline || '', callsign: p.callsign, type: p.type, t: Date.now() }; } }
  tally.airlines = [...A]; tally.countries = [...C];
  if (Date.now() - tallySaved > 15000) { tallySaved = Date.now(); try { localStorage.setItem(TALLY, JSON.stringify(tally)); } catch {} }
  return tally;
}

/* every plane up now is caught today (QA 2026-11-19: the top card still offered Show me on a plane that gives nothing) */
function allCaught(nexts) {
  const n = nexts.find((c) => c.isNew) ?? nexts[0];
  return `<h3>Everything up is caught</h3><p class="td-lead">You’ve caught every plane in your sky today.${n ? ` Next over: <b>${esc(n.name)}</b> in about ${Math.max(1, Math.round(n.n.inS / 60))} min.` : ' New ones come over every few minutes.'}</p>`;
}
// ---------- missions: the plane that would finish each one ----------
const rareHereT = (t) => { try { return rareHere(t); } catch { return false; } };
/* the plane families caught today (a plane card's set), for "planes from two families" */
const famsToday = () => { const d = dayKey(), f = new Set(); for (const c of catches()) if (dayKey(c.time) === d) { const id = c.cardSnapshot?.setId ?? c.cardSnapshot?.set; if (id && c.cardSnapshot?.sky === 'plane') f.add(id); } return f; };
function finisherFor(m, cands, route) {
  const test = {
    wide: (c) => WIDE_T.test(c.p.type ?? ''), heli: (c) => isHelicopter(c.p), prop: (c) => PROP_T.test(c.p.type ?? ''),
    far: (c) => (c.km ?? 0) > 3000, ocean: (c) => (c.km ?? 0) > 5000, short: (c) => c.km != null && c.km < 500,
    abroad: (c) => c.full?.from?.cc && c.full?.to?.cc && c.full.from.cc !== c.full.to.cc,
    airlines3: (c) => !!c.r?.airline, high: (c) => altFt(c.p) >= 35000, low: (c) => altFt(c.p) > 0 && altFt(c.p) < 5000,
    bands: (c) => altFt(c.p) >= 35000 || (altFt(c.p) > 0 && altFt(c.p) < 5000), rarenew: (c) => c.isNew && ['rare', 'epic', 'legendary'].includes(c.tier?.id),
    rarehere: (c) => c.w?.gain !== 'none' && rareHereT(c.p.type), families2: (c) => c.w?.gain !== 'none' && !famsToday().has(planeSet(c.p.type, isHelicopter(c.p)).id), newflights2: (c) => c.isNew, again: (c) => !c.isNew && c.w?.gain !== 'none', /* QA 2026-11-19: 'rare here' and 'two families' took any new plane, 'again' a plane caught today */
    firstcard: () => true, firstflight: (c) => !!c.full, types2: () => true, catches3: () => true,
    /* round 2 (2026-11-20): the ones a plane up now or coming over can be told to do */
    continent: (c) => { const x = continentOfAirport(c.full?.from), y = continentOfAirport(c.full?.to); return !!x && !!y && x !== y; },
    oldtype: (c) => isOldType(c.p.type), newtype: (c) => isNewType(c.p.type), overhead: (c) => (c.a?.el ?? c.n?.peakEl ?? 0) > 70,
    up: (c) => c.p.climbKnown && c.p.climb >= 1000 && altFt(c.p) > 0 && altFt(c.p) < 15000, down: (c) => c.p.climbKnown && c.p.climb <= -1000 && altFt(c.p) > 0 && altFt(c.p) < 15000,
    giant: (c) => planeSet(c.p.type, isHelicopter(c.p)).id === 'giants', regional: (c) => planeSet(c.p.type, isHelicopter(c.p)).id === 'regional',
    biz: (c) => planeSet(c.p.type, isHelicopter(c.p)).id === 'bizjets', military: (c) => planeSet(c.p.type, isHelicopter(c.p)).id === 'military' || MIL_TYPES.test(String(c.p.type ?? '').toUpperCase()),
    boeingairbus: (c) => isBoeing(c.p.type) || isAirbus(c.p.type),
  }[m.id];
  return test ? cands.find((c) => { try { return test(c); } catch { return false; } }) ?? null : null;
}
const DEAL = 'skyMcDeal';
// Coming over next: a plane whose label would overlap the one before it sits a row higher
const tlX = (c) => 4 + Math.min(1, c.n.inS / 900) * 88; /* % across the timeline */
const tlUp = (arr, i) => { let up = false; for (let k = 1; k <= i; k++) up = tlX(arr[k]) - tlX(arr[k - 1]) < 26 ? !up : false; return up; }; /* closer than a label's width on screen */

// ---------- the departures board's split-flap ----------
// (2026-11-18, Sevaan: "do these names animate in like a real board when it scrolls into view for the first time?
// high fidelity, but still good on performance") A fixed field of 10 tiles. The first time the board comes into view each
// time Today opens, every tile spins through characters and lands, left to right and row by row; afterwards only a
// plane new to the board flaps in. One requestAnimationFrame loop drives every tile; each change is one text write and a
// short compositor-only flip (transform), and the loop stops when the last tile lands (~2 s). Reduced motion: no spin.
const FIELD = 10, FLAP_CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
// The flight's name as a board shows it, in up to two lines of FIELD tiles (2026-11-18, Sevaan: "names should fit
// though... maybe multiline"): the destination, else the callsign, else the type; words wrap to the second line, and a
// single word longer than a line runs on into it. Longer than two lines: cut at the last whole word that fits.
function boardLines(c) {
  const u = String(c.full?.to?.city || c.p.callsign || aircraftName(c.p) || c.p.type || 'Aircraft').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() || 'AIRCRAFT';
  const lines = ['']; for (const w of u.split(' ')) { let x = w;
    while (x) { const cur = lines.at(-1), room = FIELD - (cur ? cur.length + 1 : 0);
      if (x.length <= room) { lines[lines.length - 1] = cur ? `${cur} ${x}` : x; x = ''; }
      else if (!cur && x.length > FIELD) { lines[lines.length - 1] = x.slice(0, FIELD); x = x.slice(FIELD); lines.push(''); }
      else lines.push(''); } }
  const out = lines.filter(Boolean); return out.slice(0, 2);
}
let flapJobs = [], flapRaf = 0;
const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
function flapIn(rows, t0 = performance.now()) {
  if (reducedMotion()) return;
  rows.forEach((row, r) => [...row.querySelectorAll('i')].forEach((el, i) => {
    const fin = el.textContent, n = 5 + ((i * 7 + r * 3) % 6) + (fin === ' ' ? -2 : 0); el.textContent = FLAP_CH[(i * 11 + r * 5) % FLAP_CH.length]; el.classList.remove('sp');
    flapJobs.push({ el, fin, n, at: t0 + r * 110 + i * 38, k: -1 });
  }));
  if (!flapRaf) flapRaf = requestAnimationFrame(flapTick);
}
function flapTick(t) {
  let live = 0;
  for (const j of flapJobs) {
    if (j.done) continue; if (!j.el.isConnected) { j.done = true; continue; } live++;
    const k = Math.floor((t - j.at) / 58); if (k < 0 || k === j.k) continue; j.k = k;
    const last = k >= j.n; j.el.textContent = last ? j.fin : FLAP_CH[(Math.random() * FLAP_CH.length) | 0];
    if (last) { j.done = true; if (j.fin === ' ') j.el.classList.add('sp'); }
    j.el.animate([{ transform: 'perspective(60px) rotateX(-78deg)', filter: 'brightness(.6)' }, { transform: 'none', filter: 'none' }], { duration: 70, easing: 'ease-out' });
  }
  if (live) flapRaf = requestAnimationFrame(flapTick); else { flapRaf = 0; flapJobs = []; }
}
let boardShown = new Set(), boardIo = null, lastRender = 0, boardSpun = false;

// The top card: Space Collector's Tonight hero (.now-hero) for a plane, its .nh-card slot filled with the real mini card
// by js/main.js (skyFillMinis). One renderer for Today and How to play's last slide (main.js htUpNow).
export function heroHtml({ hex, color, kick, left = null, until = null, tierLine = '', name, what = '', where = '', az = 0, hint = '' }) {
  return `<div class="now-hero" style="--c:${color ?? '#9aa4b1'}" data-hex="${esc(hex)}"><span class="nh-k">${esc(kick)}</span>
      <div class="nh-top"><button type="button" class="nh-card" data-show="${esc(hex)}" data-mini="${esc(hex)}" aria-label="Show me ${esc(name)}"></button>
        <div class="nh-side"><div class="nh-t">${left != null ? `<b${until ? ` data-until="${until}"` : ''}>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b><small class="nh-u">left in your sky</small>` : '<b>Up now</b>'}</div>
          <span class="nh-tier">${esc(tierLine)}</span><span class="nh-name">${esc(name)}</span><span class="nh-what">${esc(what)}</span><span class="nh-where">${esc(where)}</span></div></div>
      <span class="nh-dir"><i class="nh-arrow" data-az="${Number(az).toFixed(1)}" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2.5 L19 10 H14.5 V21 H9.5 V10 H5 Z" fill="currentColor"/></svg></i><span class="nh-turn" data-hint>${esc(hint)}</span></span>
      <div class="nh-acts"><button type="button" class="pill-o nh-go" data-show="${esc(hex)}"><span class="ico-svg">${TARGET}</span> Show me</button></div></div>`;
}

// ---------- the page ----------
let tick = 0, expanded = false, dealIo = null;
export function renderToday(el, ctx) {
  const owned = ownedKeys(), t = Date.now(), obs = ctx.obs;
  const up = planesUp(ctx.positions).map((a) => ({ a, w: worth(a, ctx.route(a.plane.callsign), owned) })).sort((x, y) => y.w.score - x.w.score);
  const next = obs ? forecast(ctx.planes.planes ?? [], obs, t, new Set(up.map((u) => u.a.plane.hex))) : [];
  const seen = readSeen(), maxH = Math.max(1, ...seen.hours), nowH = new Date().getHours(), sky = heroSky(ctx.wx);
  const T = noteTally(up, ctx.route);
  const tierOf = (p) => { try { return ctx.tierOf?.(p) ?? null; } catch { return null; } };
  // every plane once, with what the sections need
  const cand = (p, extra) => { const r = ctx.route(p.callsign), full = r?.full ?? null; return { p, r, full, km: kmOf(full), tier: tierOf(p), ...extra }; };
  const ups = up.map((u) => cand(u.a.plane, { a: u.a, w: u.w, isNew: u.w.isNew, left: obs ? skyLeft(u.a.plane, obs, t) : null }));
  const nexts = next.map((n) => { const r = ctx.route(n.p.callsign), full = r?.full; return cand(n.p, { n, isNew: !owned.has(planeKey(n.p)), name: full ? `To ${full.to.city}` : r?.airline || aircraftName(n.p) || 'Aircraft' }); });
  const best = ups[0];
  const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

  // Space Collector's own pieces (2026-11-19, review Part 1, Sevaan: "keep things matching"): section heads are .tn-sec,
  // the top card is Space's Tonight hero (.now-hero) with the real mini card (js/main.js fills [data-mini] slots with
  // miniCard), Up now is Space's tile row (.tn-up), Coming over next is Space's run (.tn-r rows).
  const sec = (k, r = '') => `<div class="tn-sec"><span class="k">${k}</span><span>${r}</span></div>`;
  const where = (a) => `${dirWord(a.az)}, ${Math.round(a.el)}° up`;
  // 1 · the hero: Space's .now-hero for the best plane up now
  let live = '';
  if (best && best.w?.gain !== 'none') {
    const p = best.p, tier = best.tier, type = aircraftName(p);
    const fin = (ctx.missions?.() ?? []).some((m) => !m.done && finisherFor(m, [best], ctx.route));
    const newWord = best.isNew ? (best.w.tag === 'NEW FLIGHT' ? 'new flight' : isHelicopter(p) ? 'new helicopter' : 'new plane') : '';
    const ft = Math.round(altFt(p) / 100) * 100;
    live = heroHtml({ hex: p.hex, color: tier?.color, kick: `Up now${up.length > 1 ? ` · best of ${up.length}` : ''}${sky.word ? ` · ${sky.word}` : ''}`, left: best.left, until: best.left != null ? t + best.left * 1000 : null,
      tierLine: `${tier ? `${tier.gem ?? ''} ${tier.label}` : ''}${newWord ? ` · ${newWord}` : ''}${fin ? ' · finishes a mission' : ''}`, name: best.w.name,
      what: [best.r?.airline && best.full ? best.r.airline : null, type !== best.w.name ? type : null].filter(Boolean).join(' · ') /* never the title again */, where: [ft ? `${ft.toLocaleString('en-US')} ft` : null, where(best.a)].filter(Boolean).join(' · '),
      az: best.a.az, hint: ctx.hint?.({ az: best.a.az, el: best.a.el }) || `Look ${where(best.a)}` });
  } else live = `<section class="tn-wx td-wx${sky.cls}">${sky.html}<span class="k">Up now${sky.word ? `<em>${esc(sky.word)}</em>` : ''}</span>${best ? allCaught(nexts) : skyState(ctx)}</section>`;

  // 2 · rare alert: the rarest Epic or Legendary up (not the live card) or coming over
  const rares = [...ups.slice(1), ...nexts].filter((c) => (RANK[c.tier?.id] ?? 0) >= 3).sort((x, y) => (RANK[y.tier.id] - RANK[x.tier.id]) || ((x.n?.inS ?? 0) - (y.n?.inS ?? 0)));
  const rare = rares[0];
  /* the rare plane, when it isn't the hero: Space's way, a row in the run with a .tn-pill (no banner of its own) */
  const rareRow = rare && rare.p.hex !== best?.p?.hex ? (() => { const p = rare.p; return `<div class="tn-r next" style="--c:${rare.tier.color}" role="button" tabindex="0" data-open="${esc(p.hex)}"><div class="t"><b>${rare.n ? esc(new Date(t + rare.n.inS * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) : 'Now'}</b><small class="soon">${rare.n ? `in ${mins(rare.n.inS)} min` : 'up now'}</small></div>
      <div class="n"><b>${esc(aircraftName(p) || rare.w?.name || rare.name)}</b><div class="w"><span class="g nw">${esc(rare.tier.gem ?? '')} ${esc(rare.tier.label)}&nbsp;·</span> <span class="nw">${esc([(rare.w?.name ?? rare.name) !== (aircraftName(p) || rare.w?.name || rare.name) ? (rare.w?.name ?? rare.name) : null, rare.n ? `from the ${dirWord(rare.n.az)}` : where(rare.a)].filter(Boolean).join(' · '))}</span></div><div class="tn-pills"><span class="tn-pill hd">${esc(rare.tier.gem ?? '')} ${esc(rare.tier.label)} · ${rare.n ? 'on its way' : 'up now'}</span></div></div>
      <div class="acts"><button type="button" class="ic showme" data-show="${esc(p.hex)}"${rare.n ? ` data-az="${rare.n.az.toFixed(1)}" data-el="15" data-at="${t + rare.n.inS * 1000}" data-name="${esc(rare.name)}"` : ''} aria-label="Show me">${TARGET}</button></div></div>`; })() : '';

  // 3 · mission cards
  const ms = (() => { try { return ctx.missions?.() ?? []; } catch { return []; } })();
  const pool = [...ups, ...nexts];
  /* Space Collector's mission cards (2026-11-19, Sevaan: "They should look like real cards in space collector and let me
     tap and shuffle them like space collector"): this works out each card's words and picture; js/main.js skyMissionCards
     draws them with Space's deck (main.js mcTap: tap to turn one over, all face down and they shuffle; dealt face down
     the first time each day). Each card its own picture: the plane that would finish it, else one that fits the mission,
     never the same photo twice. */
  const FIT = { firstcard: 'B738', firstflight: 'B789', types2: 'AT76', high: 'A359', low: 'C172', bands: 'DH8D', rarenew: 'A388', rarehere: 'B748', families2: 'E190', newflights2: 'A21N', again: 'A320', airlines3: 'B38M', revisit3: 'CRJ9', pair10: 'A321', levelup: 'B77W', catches3: 'E75L', continent: 'B77W', landing: 'E75L', oldtype: 'C172', newtype: 'A21N', overhead: 'B738', up: 'A320', down: 'B38M', three10: 'A20N', quick: 'CRJ9', dark: 'B789', shiny: 'A388', boeingairbus: 'B38M', giant: 'B748', regional: 'E75L', biz: 'C25B', military: 'C130', cardlevel: 'A321', newairline: 'B789', livery: 'A320', moreaircraft: 'A21N', livery2: 'B738', sameairline: 'A320', compass: 'B763', dusk: 'B77W' };
  const SPARE = ['B789', 'A359', 'AT76', 'E190', 'B38M', 'A21N', 'DH8D', 'B77W', 'CRJ9', 'A320', 'B738', 'A388'];
  const used = new Set(), smOf = (ph) => (ph ? (ph.sm ?? String(ph.url).replace(/\/([^/]+)$/, '/sm/$1')) : null), take = (u) => (u && !used.has(u) ? (used.add(u), u) : null);
  const mcItems = ms.map((m) => {
    if (m.done) { const cp = m.by?.cardKey ? ctx.cardPhoto?.(m.by.cardKey) : null; return { id: m.id, text: m.text, done: true, sub: 'Done', art: take(cp?.url) }; }
    const f = finisherFor(m, pool, ctx.route), p = f?.p;
    const sub = f ? `${f.w?.name ?? f.name} · ${f.n ? `in ${mins(f.n.inS)} min` : 'up now'}` : 'Watch for one';
    return { id: m.id, text: m.text, done: false, sub, art: p ? take(smOf(picOf(p))) : null };
  });
  for (const it of mcItems) if (!it.art) for (const ty of [FIT[it.id], ...SPARE].filter(Boolean)) { const u = take(smOf(photoFor(ty))); if (u) { it.art = u; break; } }
  const nDone = ms.filter((m) => m.done).length;
  const missions = ms.length ? `${sec('Today’s missions', `${nDone} of ${ms.length}`)}<div id="sky-missions"></div>` : '';

  // 4 · coming over next
  const runRow = (c) => `<div class="tn-r" style="--c:${c.tier?.color ?? '#9aa4b1'}" role="button" tabindex="0" data-open="${esc(c.p.hex)}"><div class="t"><b>${esc(new Date(t + c.n.inS * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</b><small class="${c.n.inS < 300 ? 'soon' : ''}">in ${mins(c.n.inS)} min</small></div>
      <div class="n"><b>${esc(c.name)}</b><div class="w"><span class="g nw">${esc(c.tier?.gem ?? '')} ${esc(c.tier?.label ?? '')}&nbsp;·</span> <span class="nw">${esc(nextSub(c.name, c.p, c.n.az))}</span></div>${c.isNew ? '<div class="tn-pills"><span class="tn-pill">New to you</span></div>' : ''}</div>
      <div class="acts"><button type="button" class="ic showme" data-show="${esc(c.p.hex)}" data-az="${c.n.az.toFixed(1)}" data-el="15" data-at="${t + c.n.inS * 1000}" data-name="${esc(c.name)}" aria-label="Show me">${TARGET}</button></div></div>`;
  const tl = nexts.length || rareRow ? `${sec('Coming over next', 'Next 15 min')}<div class="tn-run">${rareRow}${nexts.slice(0, 4).map(runRow).join('')}</div>` : `${sec('Coming over next')}<p class="td-empty td2-card">${ctx.planes?.status === 'failing' ? 'Waiting for the plane feed to answer.' /* not a quiet sky (QA 2026-11-19) */ : 'Nothing heading your way in the next 15 minutes that we can see yet.'}</p>`;

  // 5 · over you now: Space's Up now tiles, each with its real mini card (the hero's plane is in the hero)
  const tiles = ups.filter((c) => c !== best || best.w?.gain === 'none'), shownT = expanded ? tiles : tiles.slice(0, 10), nNewUp = ups.filter((c) => c.isNew).length;
  const board = tiles.length ? `${sec(`Over you now${nNewUp ? ` · ${nNewUp} new` : ''}`, `${up.length} up${sky.word ? ` · ${esc(sky.word)}` : ''}`)}<div class="tn-up">${shownT.map((c) => `<button type="button" class="tn-chip tile${c.isNew ? ' new' : ' seen'}" style="--c:${c.tier?.color ?? '#9aa4b1'}" data-show="${esc(c.p.hex)}"><span class="tn-chip-mini" data-mini="${esc(c.p.hex)}" aria-hidden="true">${c.isNew ? '<em>New</em>' : ''}</span><span><b>${esc(c.w.name)}</b><small><i class="gm" aria-hidden="true">${esc(c.tier?.gem ?? '')}</i> ${esc(`${c.isNew ? '' : 'Yours · '}${where(c.a)}`)}</small></span></button>`).join('')}</div>${tiles.length > 10 ? `<button type="button" class="tn-more" data-more><span>${expanded ? 'Show fewer' : `All ${tiles.length}`}</span><b>›</b></button>` : ''}` : '';

  // 6 · where they're going
  const dests = new Map(); for (const c of ups) { const to = c.full?.to; if (to?.lat == null || !obs) continue; const k = to.city; if (!dests.has(k)) dests.set(k, { to, n: 0 }); dests.get(k).n++; }
  const map = dests.size >= 2 ? (() => { const W = 340, H = 230, cx = 170, cy = 112, R = 98; const kmTo = (d) => hav(obs.lat, obs.lon, d.to.lat, d.to.lon), maxKm = Math.max(800, ...[...dests.values()].map(kmTo)); /* scaled to the farthest one up there, so a sky of short hops still fills the map */
    const dl = [...dests.values()].slice(0, 14).map((d) => { const km = kmTo(d), b = brg(obs.lat, obs.lon, d.to.lat, d.to.lon), r = 20 + (R - 20) * Math.sqrt(km / maxKm); return { ...d, x: cx + r * Math.sin(b * Math.PI / 180), y: cy - r * Math.cos(b * Math.PI / 180) * .92, b }; });
    const arcs = dl.map((d, i) => { const mx = (cx + d.x) / 2, my = (cy + d.y) / 2, dx = d.x - cx, dy = d.y - cy, k = .22; return `<path style="animation-delay:${(i * .15).toFixed(2)}s" d="M${cx} ${cy} Q${(mx - dy * k).toFixed(1)} ${(my + dx * k).toFixed(1)} ${d.x.toFixed(1)} ${d.y.toFixed(1)}"/>`; }).join('');
    const placed = []; const labels = dl.map((d) => { const right = d.x > cx, w = d.to.city.length * 5.6, lx = Math.max(3, Math.min(W - 3 - w, right ? d.x + 5 : d.x - 5 - w)) /* kept inside the card (visual playtest 2026-11-19: "an Francisco") */, ly = d.y - 6; if (placed.some((q) => Math.abs(q.y - ly) < 11 && lx < q.x + q.w && lx + w > q.x)) return `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="2.6" fill="#d7362b"/>`; placed.push({ x: lx, y: ly, w }); return `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="3" fill="#d7362b"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}">${esc(d.to.city)}</text>`; }).join('');
    const nC = new Set(dl.map((d) => d.to.cc).filter(Boolean)).size;
    return `${sec('Where they’re going', 'Right now')}<div class="td2-map"><svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#c9d9e6" stroke-dasharray="2 4"/><circle cx="${cx}" cy="${cy}" r="${R / 2}" fill="none" stroke="#c9d9e6" stroke-dasharray="2 4"/><g class="td2-arcs" fill="none" stroke="#d7362b" stroke-width="1.6" stroke-linecap="round">${arcs}</g><circle cx="${cx}" cy="${cy}" r="16" fill="#d7362b22"/><circle cx="${cx}" cy="${cy}" r="5" fill="#0d2238"/><g font-family="SC Label, sans-serif" font-size="11" fill="#0d2238">${labels}<text x="${cx + 8}" y="${cy - 6}" font-size="10" fill="#4a6178">YOU</text></g></svg><div class="td2-cap"><b>Flights to ${dests.size} ${dests.size === 1 ? 'city' : 'cities'}</b> in ${nC} ${nC === 1 ? 'country' : 'countries'} are over you</div></div>`; })() : '';

  // 7 · today so far
  const far = T.far, farPh = far ? picOf({ type: far.type, callsign: far.callsign }) : null;
  const story = `${sec('Today so far', `${seen.hexes.length.toLocaleString()} plane${seen.hexes.length === 1 ? '' : 's'} seen`)}<div class="td2-story">
    <div class="td2-big"><div><b>${seen.hexes.length.toLocaleString()}</b><span>planes</span></div><div><b>${T.airlines.length}</b><span>airlines</span></div><div><b>${T.countries.length}</b><span>countries</span></div></div>
    ${far ? `<div class="td2-far"><span class="td2-farpic" style="${bg(farPh)}"></span><div><b>Farthest: to ${esc(far.city)}</b><span>${esc([far.airline, `${far.km.toLocaleString('en-US')} km from ${far.from}`].filter(Boolean).join(' · '))}, over you at ${new Date(far.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div></div>` : ''}
    <div class="td-chart" aria-label="Planes seen by hour">${seen.hours.map((n, h) => `<i class="${h === nowH ? 'now' : ''}${seen.open[h] ? '' : ' gap'}" style="height:${seen.open[h] ? Math.max(4, Math.round(n / maxH * 54)) : 4}px" title="${h}:00 · ${seen.open[h] ? n : 'app closed'}"></i>`).join('')}</div>
    <div class="td-axis"><span>12 AM</span><span>6</span><span>NOON</span><span>6</span><span>11 PM</span></div></div>
    <p class="td-note">Counts only the hours Sky Collector was open. Grey bars are hours it wasn’t.</p>`;

  /* Your regulars (js/sky-regulars.js): flights that pass at about the same time most days, the next three due today */
  let regs = ''; try { const now = Date.now(), rl = regulars(now).filter((r) => r.next - now < 12 * 3600e3).slice(0, 3);
    if (rl.length) regs = `${sec('Your regulars', 'Learned here')}<div class="td2-card td2-regs">${rl.map((r) => { const rt = ctx.route(r.callsign), full = rt?.full, a3 = r.callsign.slice(0, 3), fkey = full ? `F:${a3}:${full.from.icao}-${full.to.icao}` : null, mine = fkey && owned.has(fkey), mins = Math.round((r.next - now) / 60000);
      const name = full ? `${rt.airline || a3} ${r.callsign.replace(/^[A-Z]{3}/, '')} to ${full.to.city}` : `${rt?.airline || a3} ${r.callsign.replace(/^[A-Z]{3}/, '')}`;
      return `<div class="td2-reg"><b>${esc(name)}</b><span>Usually ${esc(clockText(r.minute))} · seen ${r.days} of the last ${r.of} days${mins <= 2 ? ' · due now' : mins < 60 ? ` · in ${mins} min` : ''}${mine ? ' · <em>in your collection</em>' : ''}</span></div>`; }).join('')}</div>`; } catch {}
  el.innerHTML = live + missions + regs + tl + board + map + story;
  try { ctx.fillMinis?.(el); } catch {} /* the real mini cards in the hero and the tiles (js/main.js skyFillMinis) */
  try { const n2 = ctx.note?.(); if (n2) el.prepend(n2); } catch {} /* Space's daily note, the app talking (js/main.js skyDailyNote) */
  { const box = el.querySelector('#sky-missions'); if (box) try { ctx.missionCards?.(box, mcItems); } catch {} }

  lastRender = t; /* the departures board and its split-flap spin-in were replaced by Space's Up now tiles (2026-11-19) */
  dealIo?.disconnect(); dealIo = null; /* the old tiles' deal; the mission cards are dealt by main.js now (Space's mcFlipWhenSeen) */
  // taps: Show me, a row's card, the board's All
  el.onclick = (e) => {
    const more = e.target.closest('[data-more]'); if (more) { expanded = !expanded; renderToday(el, ctx); return; }
    const s = e.target.closest('[data-show]'); if (s) { e.stopPropagation(); const d = s.dataset; ctx.show(d.show, s, d.at ? { az: Number(d.az), el: Number(d.el), at: Number(d.at), name: d.name } : null); return; }
    const o = e.target.closest('[data-open]'); if (o && ctx.open) ctx.open(o.dataset.open, o.getBoundingClientRect());
  };
  el.onkeydown = (e) => { const o = e.target.closest?.('[data-open]'); if (o && (e.key === 'Enter' || e.key === ' ') && e.target === o) { e.preventDefault(); o.click(); } };
  // every second: the countdown, the arrow turning with the phone and its words
  clearInterval(tick);
  tick = setInterval(() => {
    if (!el.isConnected || (ctx.visible && !ctx.visible())) { clearInterval(tick); return; }
    const cd = el.querySelector('[data-until]'); if (cd) { const s = Math.max(0, Math.round((Number(cd.dataset.until) - Date.now()) / 1000)); cd.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    const ar = el.querySelector('.nh-arrow'); if (ar) { const f = ctx.facing?.(); if (f != null) { ar.style.transform = `rotate(${((Number(ar.dataset.az) - f + 540) % 360) - 180}deg)`; ar.hidden = false; } const h = el.querySelector('[data-hint]'); if (h && best) { const w = ctx.hint?.({ az: best.a.az, el: best.a.el }); if (w && h.textContent !== w) h.textContent = w; } }
  }, 1000);
}
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (az) => COMPASS[Math.round(((az % 360) + 360) % 360 / 45) % 8];
