// Sky Collector's Today page (2026-11-15; docs/TONIGHT-PLAN.md, build steps 1–4). It takes over the Tonight panel:
//   Up now           the best catch overhead right now, then everything up, best first, with Show me
//   Coming over next planes that will climb above 15° in the next 15 minutes, projected from position, speed and track
//   Today so far     planes your phone has seen, by hour (only the hours the app was open: gaps are said, not guessed)
// The seen log is kept on the phone (localStorage 'skySeen': today's date, a set of hexes, counts by hour).
// No server. No DOM outside the container it's given.

import { planeKey } from './flights.js?v=0.1.1705';
import { aircraftName, isHelicopter, planePath } from './planes.js?v=0.1.1705';
import { glyphSvg, flightPhotoFor, photoFor, FAMILY } from './flight-card.js?v=0.1.1705';
import { airlineIcon } from './airline-icons.js?v=0.1.1705';
import { catches } from './sky-catch.js?v=0.1.1705';
import { noteLocal } from './sky-local.js?v=0.1.1705';
import { planeSet } from './sky-sets.js?v=0.1.1705';
import { cloudsHtml, rainHtml } from './weather-art.js?v=0.1.1705';

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
const localFlags = (p) => { const f = [], st = planeSet(p.type, isHelicopter(p)).id; if (st === 'helicopters') f.push('heli'); if (st === 'twinaisle' || st === 'giants') f.push('wide'); if (st === 'props' || st === 'light') f.push('prop'); if ((p.altFt ?? 0) >= 35000) f.push('high'); if (p.altFt != null && p.altFt < 5000) f.push('low'); if (/^[A-Z]{3}\d/.test(p.callsign ?? '')) f.push('airline'); return f; };
// Called with the planes above the horizon each poll (about every 10 s while Explore or Today is open).
export function logSeen(list) {
  const s = seenCache && seenCache.day === dayKey() ? seenCache : (seenCache = readSeen());
  const h = new Date().getHours(), have = new Set(s.hexes), newHour = !s.open[h], fresh = [];
  s.open[h] = 1;
  for (const a of list ?? []) { const x = a.plane?.hex; if (x && !have.has(x)) { have.add(x); s.hexes.push(x); s.hours[h]++; fresh.push({ type: a.plane.type, flags: localFlags(a.plane) }); } }
  noteLocal(fresh, newHour); /* the 30-day tally behind "Rare here" and mission sizing (js/sky-local.js) */
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
  const tag = newFlight ? 'NEW FLIGHT' : newPlane ? 'NEW PLANE' : fkey ? 'IN YOUR COLLECTION' : 'SEEN BEFORE';
  const score = (newFlight ? 100 : 0) + (newPlane ? 60 : 0) + (isHelicopter(p) ? 25 : 0) + (full ? 10 : 0) + a.el / 10;
  return { name, sub, tag, score, isNew: newFlight || newPlane, glyph: isHelicopter(p) ? 'heli' : 'jet' };
}

// ---------- Coming over next: straight-line projection from position, speed and track ----------
function forecast(planes, obs, nowMs, visibleHexes) {
  const out = [];
  for (const p of planes) {
    if (visibleHexes.has(p.hex)) continue;
    const path = planePath(p, obs, nowMs, 0, 900, 15); // the next 15 minutes, every 15 s
    const i = path.findIndex((q) => q.el > 15);
    if (i < 0) continue;
    let peak = path[i]; for (let j = i; j < path.length && path[j].el >= peak.el; j++) peak = path[j];
    const az = (Math.atan2(path[i].enu[0], path[i].enu[1]) * 180 / Math.PI + 360) % 360;
    out.push({ p, inS: path[i].t, peakEl: peak.el, az });
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
function ownedKeys() { const owned = new Set(); for (const c of catches()) { owned.add(c.key); if (c.planeKey) owned.add(c.planeKey); } return owned; }
// A live plane's photo (the type in its airline's livery, its parent's, or the maker's), sm/ size, with the box the plane
// sits in; null when there's none yet. For pictures outside a card: All around you, Today's rows.
export function planePhoto(p) {
  const ph = p?.type ? flightPhotoFor({ callsign: p.callsign || '' }, p.type) : null; if (!ph) return null;
  return { ...ph, sm: String(ph.url).replace(/\/([^/]+)$/, '/sm/$1') };
}
// All around you in Sky Collector (2026-11-18): everything up now, worth first, and what's coming over next, named.
export function aroundPlanes(positions, planes, obs, route) {
  const owned = ownedKeys();
  const up = (positions ?? []).filter((a) => a.el > 0).map((a) => ({ a, w: worth(a, route(a.plane.callsign), owned) })).sort((x, y) => y.w.score - x.w.score);
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
const PROP_T = /^(DH8|AT[4-7]|C208|PC12|SF34|B190|DHC|JS4|D228|SW4|C130|E120|BE[0-9]|C1[5-9]|C2[0-9]|PA[0-9])/;
const altFt = (p) => (p.hKm ?? 0) * 3280.84;
const mins = (s) => Math.max(1, Math.round(s / 60));
const kmOf = (full) => { try { return full?.from?.lat != null && full?.to?.lat != null ? hav(full.from.lat, full.from.lon, full.to.lat, full.to.lon) : null; } catch { return null; } };
function hav(a1, o1, a2, o2) { const R = Math.PI / 180, s = Math.sin((a2 - a1) * R / 2) ** 2 + Math.cos(a1 * R) * Math.cos(a2 * R) * Math.sin((o2 - o1) * R / 2) ** 2; return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s))); }
function brg(a1, o1, a2, o2) { const R = Math.PI / 180, y = Math.sin((o2 - o1) * R) * Math.cos(a2 * R), x = Math.cos(a1 * R) * Math.sin(a2 * R) - Math.sin(a1 * R) * Math.cos(a2 * R) * Math.cos((o2 - o1) * R); return (Math.atan2(y, x) / R + 360) % 360; }
const tailOf = (p) => { const a3 = (p?.callsign || '').slice(0, 3); if (!/^[A-Z]{3}$/.test(a3)) return null; try { if (localStorage.getItem('skyLogos') === 'off') return null; } catch {} const ic = airlineIcon(a3) || (FAMILY[a3] && airlineIcon(FAMILY[a3])); return ic?.tail ?? null; };
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

// ---------- missions: the plane that would finish each one ----------
function finisherFor(m, cands, route) {
  const test = {
    wide: (c) => WIDE_T.test(c.p.type ?? ''), heli: (c) => isHelicopter(c.p), prop: (c) => PROP_T.test(c.p.type ?? ''),
    far: (c) => (c.km ?? 0) > 3000, ocean: (c) => (c.km ?? 0) > 5000, short: (c) => c.km != null && c.km < 500,
    abroad: (c) => c.full?.from?.cc && c.full?.to?.cc && c.full.from.cc !== c.full.to.cc,
    airlines3: (c) => !!c.r?.airline, high: (c) => altFt(c.p) >= 35000, low: (c) => altFt(c.p) > 0 && altFt(c.p) < 5000,
    bands: (c) => altFt(c.p) >= 35000 || (altFt(c.p) > 0 && altFt(c.p) < 5000), rarenew: (c) => c.isNew && ['rare', 'epic', 'legendary'].includes(c.tier?.id),
    rarehere: (c) => c.isNew, families2: (c) => c.isNew, newflights2: (c) => c.isNew, again: (c) => !c.isNew,
    firstcard: () => true, firstflight: (c) => !!c.full, types2: () => true,
  }[m.id];
  return test ? cands.find((c) => { try { return test(c); } catch { return false; } }) ?? null : null;
}
const DEAL = 'skyMcDeal';

// ---------- the page ----------
let tick = 0, expanded = false;
export function renderToday(el, ctx) {
  const owned = ownedKeys(), t = Date.now(), obs = ctx.obs;
  const up = (ctx.positions ?? []).filter((a) => a.el > 5).map((a) => ({ a, w: worth(a, ctx.route(a.plane.callsign), owned) })).sort((x, y) => y.w.score - x.w.score);
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

  // 1 · live card
  let live = '';
  if (best) {
    const p = best.p, ph = picOf(p), tier = best.tier, type = aircraftName(p);
    const fin = (ctx.missions?.() ?? []).some((m) => !m.done && finisherFor(m, [best], ctx.route));
    live = `<section class="td2-live" data-hex="${esc(p.hex)}">
      <div class="td2-ph" style="${bg(ph)}">${tailImg(tailOf(p), 'td2-tail td2-tail--live')}${best.left != null ? `<span class="td2-leave">LEAVES YOUR SKY IN <b data-until="${t + best.left * 1000}">${Math.floor(best.left / 60)}:${String(best.left % 60).padStart(2, '0')}</b></span>` : `<span class="td2-leave">UP FOR A WHILE</span>`}</div>
      <div class="td2-bd"><span class="td2-k">Up now${up.length > 1 ? ` · best of ${up.length}` : ''}${sky.word ? ` · ${esc(sky.word)}` : ''}</span>
        <h3>${esc(best.w.name)}</h3>
        <div class="td2-sub">${esc([best.r?.airline && best.full ? best.r.airline : null, type, `${Math.round(altFt(p) / 100) * 100 ? (Math.round(altFt(p) / 100) * 100).toLocaleString('en-US') + ' ft' : ''}`, `${dirWord(best.a.az)}, ${Math.round(best.a.el)}° up`].filter(Boolean).join(' · '))}</div>
        <div class="td2-chips">${tier ? `<span class="td2-chip" style="--c:${tier.color}">${esc(tier.gem ?? '')} ${esc(tier.label)}</span>` : ''}${best.isNew ? `<span class="td2-chip td2-chip--new">${esc(best.w.tag === 'NEW FLIGHT' ? 'New flight' : 'New plane')}</span>` : ''}${fin ? '<span class="td2-chip td2-chip--ms">◇ Finishes a mission</span>' : ''}</div>
        <div class="td2-aim"><span class="td2-arrow" data-az="${best.a.az.toFixed(1)}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 20 21 12 16 4 21z"/></svg></span><span><b data-hint>${esc(ctx.hint?.({ az: best.a.az, el: best.a.el }) || `Look ${dirWord(best.a.az)}, ${Math.round(best.a.el)}° up`)}</b><small>${esc(dirWord(best.a.az))}, ${Math.round(best.a.el)}° up</small></span></div>
        <button type="button" class="td2-btn" data-show="${esc(p.hex)}">${TARGET}<span>Show me</span></button></div></section>`;
  } else live = `<section class="tn-wx td-wx${sky.cls}">${sky.html}<span class="k">Up now${sky.word ? `<em>${esc(sky.word)}</em>` : ''}</span>${skyState(ctx)}</section>`;

  // 2 · rare alert: the rarest Epic or Legendary up (not the live card) or coming over
  const rares = [...ups.slice(1), ...nexts].filter((c) => (RANK[c.tier?.id] ?? 0) >= 3).sort((x, y) => (RANK[y.tier.id] - RANK[x.tier.id]) || ((x.n?.inS ?? 0) - (y.n?.inS ?? 0)));
  const rare = rares[0];
  const alert = rare ? (() => { const p = rare.p, ph = picOf(p), when = rare.n ? `Over you in <em>${mins(rare.n.inS)} min</em>, ${esc(dirWord(rare.n.az))}.` : `Up now, ${esc(dirWord(rare.a.az))}, ${Math.round(rare.a.el)}° up.`;
    return `<section class="td2-alert" style="--c:${rare.tier.color}"><span class="td2-alert-pic" style="${bg(ph)}">${tailImg(tailOf(p))}</span><span class="td2-alert-w"><i>${esc(rare.tier.gem ?? '')} ${esc(rare.tier.label.toUpperCase())} · ${rare.n ? 'ON ITS WAY' : 'UP NOW'}</i><b>${esc(aircraftName(p) || rare.w?.name || rare.name)}</b><span>${esc(rare.w?.name ?? rare.name)}. ${when}</span></span>
      <button type="button" class="td2-alert-go" data-show="${esc(p.hex)}"${rare.n ? ` data-az="${rare.n.az.toFixed(1)}" data-el="15" data-at="${t + rare.n.inS * 1000}" data-name="${esc(rare.name)}"` : ''} aria-label="Show me">${TARGET}</button></section>`; })() : '';

  // 3 · mission cards
  const ms = (() => { try { return ctx.missions?.() ?? []; } catch { return []; } })();
  const pool = [...ups, ...nexts];
  let dealt = true; try { dealt = localStorage.getItem(DEAL) === dayKey(); } catch {}
  const mcard = (m) => {
    if (m.done) { const cp = m.by?.cardKey ? ctx.cardPhoto?.(m.by.cardKey) : null;
      return `<div class="td2-mc done"><div class="td2-flip"><div class="td2-bk"><div class="td2-in"></div></div><div class="td2-face"><div class="td2-in"><div class="td2-pic" style="${cp ? `background-image:url('${esc(cp.url)}')` : ''}">${tailImg(cp?.tail)}</div><div class="td2-w"><b>${esc(m.text)}</b><small class="ok">Done</small></div></div></div></div></div>`; }
    const f = finisherFor(m, pool, ctx.route), p = f?.p, ph = p ? picOf(p) : null;
    const where = f ? (f.n ? `In ${mins(f.n.inS)} min · ${dirWord(f.n.az)}` : `Up now · ${dirWord(f.a.az)}`) : 'Watch for one';
    const who = f ? (f.w?.name ?? f.name) : '';
    const go = f ? ` data-show="${esc(p.hex)}"${f.n ? ` data-az="${f.n.az.toFixed(1)}" data-el="15" data-at="${t + f.n.inS * 1000}" data-name="${esc(f.name)}"` : ''}` : '';
    return `<button type="button" class="td2-mc"${go}><div class="td2-flip"><div class="td2-bk"><div class="td2-in"></div></div><div class="td2-face"><div class="td2-in"><div class="td2-pic" style="${bg(ph || picOf({ type: m.id === 'wide' ? 'B789' : m.id === 'heli' ? 'EC35' : m.id === 'prop' ? 'AT76' : 'A320', callsign: '' }))}">${tailImg(p ? tailOf(p) : null)}</div><div class="td2-w"><b>${esc(m.text)}</b>${who ? `<i>${esc(who)}</i>` : ''}<small>${esc(where)}</small></div></div></div></div></button>`;
  };
  const nDone = ms.filter((m) => m.done).length;
  const missions = ms.length ? `<p class="td-h">TODAY'S MISSIONS <span>${nDone} OF ${ms.length}</span></p><div class="td2-mcs${dealt ? ' on' : ''}" data-deal>${ms.map(mcard).join('')}</div>` : '';

  // 4 · coming over next
  const tl = nexts.length ? `<p class="td-h">COMING OVER NEXT <span>NEXT 15 MIN</span></p><div class="td2-tl"><div class="td2-axis"><span>NOW</span><span>15 MIN</span></div>${nexts.slice(0, 5).map((c) => `<button type="button" class="td2-tp" data-show="${esc(c.p.hex)}" data-az="${c.n.az.toFixed(1)}" data-el="15" data-at="${t + c.n.inS * 1000}" data-name="${esc(c.name)}" style="left:${(4 + Math.min(1, c.n.inS / 900) * 88).toFixed(1)}%">${tailImg(tailOf(c.p)) || `<span class="td2-tdot" style="${bg(picOf(c.p))}"></span>`}<small>${esc(c.name.replace(/^To /, ''))} · ${mins(c.n.inS)}</small></button>`).join('')}</div>` : `<p class="td-h">COMING OVER NEXT <span></span></p><p class="td-empty td2-card">Nothing heading your way in the next 15 minutes that we can see yet.</p>`;

  // 5 · over you now: the departures board
  const status = (c) => (c.left != null && c.left < 240 ? ['LEAVING SOON', 'soon'] : obs && justUp(c.p, obs, t) ? ['JUST ARRIVED', 'go'] : ['OVERHEAD', '']);
  const rows = (expanded ? ups : ups.slice(0, 6)).map((c) => { const [st, cls] = status(c), word = (c.full?.to?.city || c.r?.airline || aircraftName(c.p) || 'Aircraft').toUpperCase(), who = [c.r?.airline ? `${c.r.airline} ${(c.p.callsign || '').replace(/^[A-Z]{3}/, '')}`.toUpperCase() : (c.p.callsign || '').toUpperCase(), (c.p.type || '').toUpperCase(), `${compass(c.a.az)} ${Math.round(c.a.el)}°`].filter(Boolean).join(' · ');
    const tl2 = tailOf(c.p);
    return `<div class="td2-fr" role="button" tabindex="0" data-open="${esc(c.p.hex)}">${tl2 ? tailImg(tl2) : `<span class="td2-fpic" style="${bg(picOf(c.p))}"></span>`}<div class="td2-fw"><span class="td2-flap${cls === 'go' ? ' roll' : ''}">${[...word.slice(0, 9)].map((ch) => `<i>${esc(ch)}</i>`).join('')}</span><span class="td2-who">${c.isNew ? '<em>NEW</em>' : ''}${esc(who)}</span></div><div class="td2-st ${cls}"><b>${c.left == null ? '30+ min' : `${mins(c.left)} min`}</b>${st}</div><button type="button" class="td2-go" data-show="${esc(c.p.hex)}" aria-label="Show me">${TARGET}</button></div>`; }).join('');
  const board = ups.length ? `<p class="td-h">OVER YOU NOW <span>${up.length}${sky.word ? ` · ${esc(sky.word.toUpperCase())}` : ''}</span></p><div class="td2-fids"><div class="td2-fcols"><span>Flight</span><span>In sky · status</span></div>${rows}${ups.length > 6 ? `<button type="button" class="td2-more" data-more>${expanded ? 'Show fewer' : `All ${ups.length} ›`}</button>` : ''}</div>` : '';

  // 6 · where they're going
  const dests = new Map(); for (const c of ups) { const to = c.full?.to; if (to?.lat == null || !obs) continue; const k = to.city; if (!dests.has(k)) dests.set(k, { to, n: 0 }); dests.get(k).n++; }
  const map = dests.size >= 2 ? (() => { const W = 340, H = 230, cx = 170, cy = 112, R = 98; const kmTo = (d) => hav(obs.lat, obs.lon, d.to.lat, d.to.lon), maxKm = Math.max(800, ...[...dests.values()].map(kmTo)); /* scaled to the farthest one up there, so a sky of short hops still fills the map */
    const dl = [...dests.values()].slice(0, 14).map((d) => { const km = kmTo(d), b = brg(obs.lat, obs.lon, d.to.lat, d.to.lon), r = 20 + (R - 20) * Math.sqrt(km / maxKm); return { ...d, x: cx + r * Math.sin(b * Math.PI / 180), y: cy - r * Math.cos(b * Math.PI / 180) * .92, b }; });
    const arcs = dl.map((d, i) => { const mx = (cx + d.x) / 2, my = (cy + d.y) / 2, dx = d.x - cx, dy = d.y - cy, k = .22; return `<path style="animation-delay:${(i * .15).toFixed(2)}s" d="M${cx} ${cy} Q${(mx - dy * k).toFixed(1)} ${(my + dx * k).toFixed(1)} ${d.x.toFixed(1)} ${d.y.toFixed(1)}"/>`; }).join('');
    const placed = []; const labels = dl.map((d) => { const right = d.x > cx, w = d.to.city.length * 5.6, lx = right ? d.x + 5 : d.x - 5 - w, ly = d.y - 6; if (placed.some((q) => Math.abs(q.y - ly) < 11 && lx < q.x + q.w && lx + w > q.x)) return `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="2.6" fill="#d7362b"/>`; placed.push({ x: lx, y: ly, w }); return `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="3" fill="#d7362b"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}">${esc(d.to.city)}</text>`; }).join('');
    const nC = new Set(dl.map((d) => d.to.cc).filter(Boolean)).size;
    return `<p class="td-h">WHERE THEY'RE GOING <span>RIGHT NOW</span></p><div class="td2-map"><svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#c9d9e6" stroke-dasharray="2 4"/><circle cx="${cx}" cy="${cy}" r="${R / 2}" fill="none" stroke="#c9d9e6" stroke-dasharray="2 4"/><g class="td2-arcs" fill="none" stroke="#d7362b" stroke-width="1.6" stroke-linecap="round">${arcs}</g><circle cx="${cx}" cy="${cy}" r="16" fill="#d7362b22"/><circle cx="${cx}" cy="${cy}" r="5" fill="#0d2238"/><g font-family="SC Label, sans-serif" font-size="11" fill="#0d2238">${labels}<text x="${cx + 8}" y="${cy - 6}" font-size="10" fill="#4a6178">YOU</text></g></svg><div class="td2-cap"><b>Flights to ${dests.size} ${dests.size === 1 ? 'city' : 'cities'}</b> in ${nC} ${nC === 1 ? 'country' : 'countries'} are over you</div></div>`; })() : '';

  // 7 · today so far
  const far = T.far, farPh = far ? picOf({ type: far.type, callsign: far.callsign }) : null;
  const story = `<p class="td-h">TODAY SO FAR <span>${seen.hexes.length.toLocaleString()} PLANE${seen.hexes.length === 1 ? '' : 'S'} SEEN</span></p><div class="td2-story">
    <div class="td2-big"><div><b>${seen.hexes.length.toLocaleString()}</b><span>planes</span></div><div><b>${T.airlines.length}</b><span>airlines</span></div><div><b>${T.countries.length}</b><span>countries</span></div></div>
    ${far ? `<div class="td2-far"><span class="td2-farpic" style="${bg(farPh)}"></span><div><b>Farthest: to ${esc(far.city)}</b><span>${esc([far.airline, `${far.km.toLocaleString('en-US')} km from ${far.from}`].filter(Boolean).join(' · '))}, over you at ${new Date(far.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div></div>` : ''}
    <div class="td-chart" aria-label="Planes seen by hour">${seen.hours.map((n, h) => `<i class="${h === nowH ? 'now' : ''}${seen.open[h] ? '' : ' gap'}" style="height:${seen.open[h] ? Math.max(4, Math.round(n / maxH * 54)) : 4}px" title="${h}:00 · ${seen.open[h] ? n : 'app closed'}"></i>`).join('')}</div>
    <div class="td-axis"><span>12 AM</span><span>6</span><span>NOON</span><span>6</span><span>11 PM</span></div></div>
    <p class="td-note">Counts only the hours Sky Collector was open. Grey bars are hours it wasn’t.</p>`;

  el.innerHTML = live + alert + missions + tl + board + map + story;

  // the deal: face down until the cards are well on screen, then turned over one by one (once a day)
  const deal = el.querySelector('[data-deal]');
  if (deal && !deal.classList.contains('on')) { const io = new IntersectionObserver((es) => { for (const e of es) if (e.intersectionRatio > .6) { deal.classList.add('on'); try { localStorage.setItem(DEAL, dayKey()); } catch {} io.disconnect(); } }, { threshold: [0, .6, 1] }); io.observe(deal); }
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
    const ar = el.querySelector('.td2-arrow'); if (ar) { const f = ctx.facing?.(); if (f != null) { ar.style.transform = `rotate(${((Number(ar.dataset.az) - f + 540) % 360) - 180}deg)`; ar.hidden = false; } const h = el.querySelector('[data-hint]'); if (h && best) { const w = ctx.hint?.({ az: best.a.az, el: best.a.el }); if (w && h.textContent !== w) h.textContent = w; } }
  }, 1000);
}
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (az) => COMPASS[Math.round(((az % 360) + 360) % 360 / 45) % 8];
