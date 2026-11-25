// Catching a plane in Sky Collector (2026-11-15): the panel under the ring when a plane is in the circle, and what
// Collect does. Catches are kept in localStorage ('skyCatches') for now, apart from Space Collector's sightings, so the
// old collection code never meets a flight. The Collection screen reads them in a later step.

import { aircraftName, isHelicopter } from './planes.js?v=0.1.1902';
import { lookupRoute } from './routes.js?v=0.1.1902';
import { distText } from './units.js?v=0.1.1902';
import { cardsFor, planeKey, unlisted, TIERS } from './flights.js?v=0.1.1902';
import { glyphSvg, miniCardHtml } from './flight-card.js?v=0.1.1902';
import { assess, hasAirlineCallsign, flightStampInfo, planeStampInfo } from './sky-stamps.js?v=0.1.1902';

import { TIER_INFO } from './rarity.js?v=0.1.1902';
import { allCatches, addCatch } from './catch-store.js?v=0.1.1902';
// Catches live in js/catch-store.js (IndexedDB, with a localStorage mirror the Collection page reads).
// Where catches are read from: Space Collector's sightings once main.js says so (Milestone 1.5), the old store until then.
let source = allCatches;
export const setCatchSource = (fn) => { source = fn; };
export function catches() { return source(); }
/* a stored sighting names its card in cardKey (one per card per catch); the old catch store had key / planeKey (2026-11-18) */
const cardOf = (c, key) => (c.cardKey ? c.cardKey === key : c.key === key || c.planeKey === key);
const seenCount = (list, key) => list.filter((c) => cardOf(c, key)).length;

const ft = (p) => (Math.round(p.hKm * 3280.84 / 100) * 100).toLocaleString('en-US');
const set = (el, sel, txt) => { const e = el.querySelector(sel); if (e && e.textContent !== txt) e.textContent = txt; };

/* What it is, in the panel's words (2026-11-19, Sevaan: "I saw a helicopter in the sky and it said New Plane for it") */
const kindWord = (p) => { const g = isHelicopter(p) ? 'heli' : String(p?.type ?? '').toUpperCase(); return g === 'heli' ? 'helicopter' : g === 'BALL' ? 'balloon' : g === 'SHIP' ? 'airship' : g === 'GLID' ? 'glider' : 'plane'; };
// What Collect would do for this plane right now, from the catches on the phone (js/sky-stamps.js assess).
const planeKeyOf = planeKey;
export function previewFor(hit, route, list = catches(), now = Date.now()) {
  const p = hit.plane, a3 = (p.callsign || '').slice(0, 3), full = route?.full;
  const fkey = full ? `F:${a3}:${full.from.icao}-${full.to.icao}` : null;
  return { fkey, out: assess(list, { time: now, hex: p.hex, callsign: p.callsign, flight: fkey ? { key: fkey } : null, plane: { key: planeKeyOf(p), daily: !!(p.anon || isHelicopter(p)) } }) };
}
/* What a catch would give: the one answer the ticket and Settings → Circle highlights share (QA 2026-11-19: an owned flight
   flown by a type you don't have read 'New day' and never locked in "New cards only"). 'new' when it makes a card you don't
   have (the flight or the plane type), 'stamp' when it only adds a stamp, 'none' when you caught it today. */
export const gainOf = (out) => (out?.flightStamps?.isNew || out?.planeStamps?.isNew ? 'new' : !out || out.kind === 'none' ? 'none' : 'stamp');
// Does the circle lock on a plane with this gain, for a Circle highlights mode ('new' | 'stamps' | 'all')?
export const locksFor = (gain, mode) => mode === 'all' || gain === 'new' || (mode === 'stamps' && gain === 'stamp');
export function highlightFor(hit, route, mode, list = catches(), now = Date.now()) {
  if (mode === 'all') return true;
  return locksFor(gainOf(previewFor(hit, route, list, now).out), mode);
}

// Fill the panel for the plane in the circle. `route` is planes.js's route object (airline now, cities once loaded).
// A plane you already stamped today (same aircraft, same local day) reads "STAMPED TODAY" with Collect switched off.
export function catchPanel(el, hit, route, opts = {}) {
  el._hit = hit; el._route = route;
  return discoverPanel(el, hit, route, opts); /* the old #catchbar panel is gone (review 2026-11-19): the circle's ticket is Space's #discover */
}

/* The plane in the circle uses Space Collector's own target ticket, #discover (2026-11-15, Sevaan: "so much looks off
   compared to our neat and tidy Space Collector"): the tier line and name above the circle, the real mini card, the
   distance, and Collect below it, laid out and animated exactly as a satellite's. */
// When you last caught this card (its newest catch), for the mini card's date line; null if it isn't yours yet.
const lastSeen = (key) => { const l = catches(); for (let i = l.length - 1; i >= 0; i--) { const c = l[i]; if (cardOf(c, key)) return c.time; } return null; };
function discoverPanel(el, hit, route, opts = {}) {
  const $ = (id) => document.getElementById(id), txt = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
  const p = hit.plane, type = aircraftName(p) || (isHelicopter(p) ? 'Helicopter' : unlisted(planeKey(p))?.name ?? 'Aircraft'), full = route?.full;
  const { fkey, out } = previewFor(hit, route);
  const gain = gainOf(out), stamped = gain === 'none', again = gain === 'stamp';
  const { flight, plane } = cardsFor(p, full ?? null, route?.airline || '');
  const card = flight ?? plane, tier = TIERS[card?.tier] ?? TIERS.common;
  const what = stamped ? 'Caught today' : again ? (out.stampOn === 'flight' || out.planeStamps?.day ? 'New day' : 'New aircraft') : fkey && out.flightStamps?.isNew ? 'New flight' : fkey ? `New ${kindWord(p)}` :route && !route.none && route.airline && !full ? 'Flight' : `New ${kindWord(p)}`;
  txt('d-tier', stamped ? tier.label : `${tier.label} · ${what}`); /* seen before: just the tier, as Space Collector */
  const ti = TIER_INFO[card?.tier] ?? TIER_INFO.common, dt = $('d-tier'); /* the tier's own mark and colour, as a satellite's (▲ green for Uncommon) */
  if (dt) { dt.style.setProperty('--find-tier', again ? 'var(--cyan)' : ti.color); dt.dataset.gem = again ? '✦' : ti.gem; }
  txt('d-name', full ? `To ${full.to.city}` : route?.airline ? `${route.airline} ${(p.callsign || '').replace(/^[A-Z]{3}/, '')}` : type);
  txt('d-dist', hit.rangeKm != null ? distText(hit.rangeKm) : `${ft(p)} ft`);
  try { globalThis.__fitDRow?.(); } catch {} /* the tier line never cuts its words (js/main.js fitDRow, Space Collector a9bb3aa1) */
  const mk = `${flight?.key}|${plane?.key}|${out.kind}|${catches().length}`, mini = $('d-mini');
  /* Space Collector's ticket card (2026-11-19, review Part 1): main.js's miniCard via opts.mini, the same card as the Collection's, with its level medal.
     A catch with a route gives two cards: the plane card in front and the boarding pass fanned behind it, "+2 cards"
     (2026-11-22, Sevaan picked option 4, design: scratchpad catch-panel-web; the pass alone shrank to a strip you couldn't read). */
  if (mini && mini.dataset.k !== mk && opts.mini && card) { try {
    const two = flight && plane, m = two ? null : opts.mini(card, flight ? 'flight' : 'plane');
    if (two) { const pm = opts.mini(plane, 'plane'), fm = opts.mini(flight, 'flight');
      if (pm && fm) { const fan = document.createElement('span'); fan.className = 'dp-fan';
        const a = document.createElement('span'); a.className = 'dp-pass'; a.append(fm); const b = document.createElement('span'); b.className = 'dp-plane'; b.append(pm);
        fan.append(a, b); if (!stamped) { const n = document.createElement('span'); n.className = 'dp-n'; n.textContent = '+2 cards'; fan.append(n); }
        mini.dataset.k = mk; mini.replaceChildren(fan); } }
    else if (m) { mini.dataset.k = mk; mini.replaceChildren(m); } } catch {} }
  if (mini && mini.dataset.k !== mk) { mini.dataset.k = mk; try { mini.innerHTML = card ? miniCardHtml({ kind: flight ? 'flight' : 'plane', card, type: p.type, last: lastSeen(card.key), n: seenCount(catches(), card.key) || 1 }) : ''; } catch { mini.innerHTML = ''; } }
  /* Already stamped today: Space Collector's seen-before state, a View card button that opens your card (2026-11-15, Sevaan) */
  el.dataset.key = card?.key ?? '';
  const cta = $('d-cta'); if (cta) { cta.hidden = false; txt('d-cta', stamped ? 'View card' : 'Collect'); cta.disabled = false; cta.removeAttribute('aria-disabled'); }
  for (const id of ['d-sub', 'd-check', 'd-switch']) { const e = $(id); if (e) e.hidden = true; }
  $('d-hit')?.setAttribute('aria-label', stamped ? 'View this card' : 'Collect this plane');
  el.classList.toggle('owned', stamped); el.classList.remove('quiet'); el.classList.add('sky-plane'); el.hidden = false;
}
let busy = false;
// Collect: look the route up properly (airports, distance), work out what the catch adds, save it, show it.
// Returns { kind: 'new'|'stamp'|'none', stampOn: 'flight'|'plane', level: 'bronze'|'silver'|'gold', levelUp: bool,
//   stampCount, flightStamps, planeStamps, flight, plane, isNewFlight, isNewPlane, heightFt, speedKmh, awayKm,
//   flightSeen, planeSeen }. 'none' (same aircraft, same local day) saves nothing and shows nothing.
// `show` gets that same object for 'new' and for 'stamp'; main.js's skyReveal branches on `kind`.
// Milestone 1.5: what Collect would save for the plane in the circle, worked out but not saved (main.js capturePlane saves it
// as Space Collector sightings and plays Space Collector's reveal). Returns { out, c } or null; out.kind 'none' = already
// stamped today.
export async function preparePlaneCatch(el, now = Date.now()) {
  const hit = el._hit; if (!hit) return null;
  const p = hit.plane, route = el._route;
  const full = route?.full ?? (route?.none ? null : await lookupRoute(p.callsign, p).catch(() => null)) /* the plane goes along: an implausible route is no route (2026-11-17) */;
  const { flight, plane } = cardsFor(p, full, route?.airline || '');
  const out = assess([...catches()], { time: now, hex: p.hex, callsign: p.callsign, flight, plane });
  const c = { time: now, hex: p.hex, callsign: p.callsign, ...(hasAirlineCallsign(p.callsign) && p.reg ? { reg: p.reg } : {}), type: p.type,
    altFt: Math.round(p.altBaro ?? p.hKm * 3280.84), gsKt: p.gs, rangeKm: Math.round(hit.rangeKm * 10) / 10, airline: route?.airline || '', flight, plane };
  return { out, c };
}
/* collect() went with the old panel (2026-11-19): a catch is main.js capturePlane through Space's reveal */

export { TIERS };
