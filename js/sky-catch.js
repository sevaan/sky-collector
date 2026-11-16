// Catching a plane in Sky Collector (2026-11-15): the panel under the ring when a plane is in the circle, and what
// Collect does. Catches are kept in localStorage ('skyCatches') for now, apart from Space Collector's sightings, so the
// old collection code never meets a flight. The Collection screen reads them in a later step.

import { aircraftName, isHelicopter } from './planes.js?v=0.1.1631';
import { lookupRoute } from './routes.js?v=0.1.1631';
import { cardsFor, TIERS } from './flights.js?v=0.1.1631';
import { glyphSvg, showCatch, miniCardHtml } from './flight-card.js?v=0.1.1631';
import { assess, hasAirlineCallsign, flightStampInfo, planeStampInfo } from './sky-stamps.js?v=0.1.1631';

import { TIER_INFO } from './rarity.js?v=0.1.1631';
import { allCatches, addCatch } from './catch-store.js?v=0.1.1631';
// Catches live in js/catch-store.js (IndexedDB, with a localStorage mirror the Collection page reads).
export function catches() { return allCatches(); }
const seenCount = (list, key) => list.filter((c) => c.key === key || c.planeKey === key).length;

const ft = (p) => (Math.round(p.hKm * 3280.84 / 100) * 100).toLocaleString('en-US');
const set = (el, sel, txt) => { const e = el.querySelector(sel); if (e && e.textContent !== txt) e.textContent = txt; };

// What Collect would do for this plane right now, from the catches on the phone (js/sky-stamps.js assess).
const planeKeyOf = (p) => `P:${p.type || (isHelicopter(p) ? 'HELI' : 'UNKNOWN')}`;
export function previewFor(hit, route, list = catches(), now = Date.now()) {
  const p = hit.plane, a3 = (p.callsign || '').slice(0, 3), full = route?.full;
  const fkey = full ? `F:${a3}:${full.from.icao}-${full.to.icao}` : null;
  return { fkey, out: assess(list, { time: now, hex: p.hex, callsign: p.callsign, flight: fkey ? { key: fkey } : null, plane: { key: planeKeyOf(p) } }) };
}

// Fill the panel for the plane in the circle. `route` is planes.js's route object (airline now, cities once loaded).
// A plane you already stamped today (same aircraft, same local day) reads "STAMPED TODAY" with Collect switched off.
export function catchPanel(el, hit, route) {
  el._hit = hit; el._route = route;
  if (el.id === 'discover') return discoverPanel(el, hit, route);
  const p = hit.plane, type = aircraftName(p) || (isHelicopter(p) ? 'Helicopter' : 'Aircraft');
  const a3 = (p.callsign || '').slice(0, 3), full = route?.full;
  const { fkey, out } = previewFor(hit, route);
  const stamped = out.kind === 'none', again = out.kind === 'stamp';
  set(el, '.cb-k', stamped ? 'STAMPED TODAY' : again ? (out.stampOn === 'flight' ? 'NEW STAMP · FLIGHT' : 'NEW STAMP · PLANE')
    : fkey ? 'NEW FLIGHT' : route && !route.none && route.airline && !full ? 'FLIGHT' : 'NEW PLANE');
  set(el, '.cb-name', full ? `To ${full.to.city}` : route?.airline ? `${route.airline} ${(p.callsign || '').replace(/^[A-Z]{3}/, '')}` : type);
  set(el, '.cb-sub', [full ? `${route.airline || a3} · from ${full.from.city}` : null, type, `${ft(p)} ft`].filter(Boolean).join(' · '));
  const art = el.querySelector('.cb-art'), g = isHelicopter(p) ? 'heli' : 'jet';
  if (art.dataset.g !== g) { art.dataset.g = g; art.innerHTML = glyphSvg(g); }
  const btn = el.querySelector('#cb-collect'); if (btn) { btn.disabled = stamped; btn.setAttribute('aria-disabled', String(stamped)); }
  el.classList.toggle('owned', stamped || again);
  el.classList.toggle('stamped', stamped);
}

/* The plane in the circle uses Space Collector's own target ticket, #discover (2026-11-15, Sevaan: "so much looks off
   compared to our neat and tidy Space Collector"): the tier line and name above the circle, the real mini card, the
   distance, and Collect below it, laid out and animated exactly as a satellite's. */
function discoverPanel(el, hit, route) {
  const $ = (id) => document.getElementById(id), txt = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
  const p = hit.plane, type = aircraftName(p) || (isHelicopter(p) ? 'Helicopter' : 'Aircraft'), full = route?.full;
  const { fkey, out } = previewFor(hit, route);
  const stamped = out.kind === 'none', again = out.kind === 'stamp';
  const { flight, plane } = cardsFor(p, full ?? null, route?.airline || '');
  const card = flight ?? plane, tier = TIERS[card?.tier] ?? TIERS.common;
  const what = stamped ? 'Stamped today' : again ? 'New stamp' : fkey ? 'New flight' : route && !route.none && route.airline && !full ? 'Flight' : 'New plane';
  txt('d-tier', `${tier.label} · ${what}`);
  const ti = TIER_INFO[card?.tier] ?? TIER_INFO.common, dt = $('d-tier'); /* the tier's own mark and colour, as a satellite's (▲ green for Uncommon) */
  if (dt) { dt.style.setProperty('--find-tier', again ? 'var(--cyan)' : ti.color); dt.dataset.gem = again ? '✦' : ti.gem; }
  txt('d-name', full ? `To ${full.to.city}` : route?.airline ? `${route.airline} ${(p.callsign || '').replace(/^[A-Z]{3}/, '')}` : type);
  txt('d-dist', hit.rangeKm != null ? `${Math.round(hit.rangeKm)} km` : `${ft(p)} ft`);
  const mk = `${card?.key}|${out.kind}`, mini = $('d-mini');
  if (mini && mini.dataset.k !== mk) { mini.dataset.k = mk; try { mini.innerHTML = card ? miniCardHtml({ kind: flight ? 'flight' : 'plane', card, type: p.type }) : ''; } catch { mini.innerHTML = ''; } }
  const cta = $('d-cta'); if (cta) { cta.hidden = false; txt('d-cta', stamped ? 'Stamped today' : 'Collect'); cta.disabled = stamped; cta.setAttribute('aria-disabled', String(stamped)); }
  for (const id of ['d-sub', 'd-check', 'd-switch']) { const e = $(id); if (e) e.hidden = true; }
  $('d-hit')?.setAttribute('aria-label', stamped ? 'Already stamped today' : 'Collect this plane');
  el.classList.toggle('owned', stamped); el.classList.remove('quiet'); el.classList.add('sky-plane'); el.hidden = false;
}
let busy = false;
// Collect: look the route up properly (airports, distance), work out what the catch adds, save it, show it.
// Returns { kind: 'new'|'stamp'|'none', stampOn: 'flight'|'plane', level: 'bronze'|'silver'|'gold', levelUp: bool,
//   stampCount, flightStamps, planeStamps, flight, plane, isNewFlight, isNewPlane, heightFt, speedKmh, awayKm,
//   flightSeen, planeSeen }. 'none' (same aircraft, same local day) saves nothing and shows nothing.
// `show` gets that same object for 'new' and for 'stamp'; main.js's skyReveal branches on `kind`.
export async function collect(el, { onDone, show = showCatch, now = Date.now() } = {}) {
  const hit = el._hit; if (!hit || busy) return null;
  busy = true;
  try {
    const p = hit.plane, route = el._route;
    const full = route?.full ?? (await lookupRoute(p.callsign).catch(() => null));
    const { flight, plane } = cardsFor(p, full, route?.airline || '');
    const list = [...catches()];
    const out = assess(list, { time: now, hex: p.hex, callsign: p.callsign, flight, plane });
    if (out.kind === 'none') return { ...out, flight, plane };
    // reg is kept only when there's an airline-style callsign (otherwise the callsign IS the registration); hex is always kept.
    const entry = { key: flight?.key ?? plane.key, planeKey: plane.key, time: now, hex: p.hex, callsign: p.callsign, ...(hasAirlineCallsign(p.callsign) && p.reg ? { reg: p.reg } : {}),
      type: p.type, altFt: Math.round(p.hKm * 3280.84), gsKt: p.gs, rangeKm: Math.round(hit.rangeKm * 10) / 10, airline: route?.airline || '',
      flight, plane };
    list.push(entry); await addCatch(entry);
    const result = { ...out, flight, plane, isNewFlight: !!flight && out.flightStamps?.isNew, isNewPlane: !!out.planeStamps?.isNew,
      heightFt: Math.round(p.hKm * 3280.84), speedKmh: Math.round(p.gs * 1.852), awayKm: Math.round(hit.rangeKm),
      flightSeen: flight ? seenCount(list, flight.key) : 0, planeSeen: seenCount(list, plane.key),
      flightStampInfo: flight ? flightStampInfo(list, flight.key) : null, planeStampInfo: planeStampInfo(list, plane.key), callsign: p.callsign };
    await show(result);
    return result;
  } finally { busy = false; onDone?.(); }
}

export { TIERS };
