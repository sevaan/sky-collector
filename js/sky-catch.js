// Catching a plane in Sky Collector (2026-11-15): the panel under the ring when a plane is in the circle, and what
// Collect does. Catches are kept in localStorage ('skyCatches') for now, apart from Space Collector's sightings, so the
// old collection code never meets a flight. The Collection screen reads them in a later step.

import { aircraftName, isHelicopter } from './planes.js?v=0.1.1580';
import { lookupRoute } from './routes.js?v=0.1.1580';
import { cardsFor, TIERS } from './flights.js?v=0.1.1580';
import { glyphSvg, showCatch } from './flight-card.js?v=0.1.1580';

const KEY = 'skyCatches';
export function catches() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-2000))); } catch {} }
const seenCount = (list, key) => list.filter((c) => c.key === key || c.planeKey === key).length;

const ft = (p) => (Math.round(p.hKm * 3280.84 / 100) * 100).toLocaleString('en-US');
const set = (el, sel, txt) => { const e = el.querySelector(sel); if (e && e.textContent !== txt) e.textContent = txt; };

// Fill the panel for the plane in the circle. `route` is planes.js's route object (airline now, cities once loaded).
export function catchPanel(el, hit, route) {
  el._hit = hit; el._route = route;
  const p = hit.plane, type = aircraftName(p) || (isHelicopter(p) ? 'Helicopter' : 'Aircraft');
  const list = catches(), a3 = (p.callsign || '').slice(0, 3);
  const full = route?.full;
  const fkey = full ? `F:${a3}:${full.from.icao}-${full.to.icao}` : null;
  const owned = fkey ? seenCount(list, fkey) > 0 : seenCount(list, `P:${p.type || ''}`) > 0;
  set(el, '.cb-k', owned ? (fkey ? 'IN YOUR COLLECTION' : 'PLANE YOU HAVE') : fkey ? 'NEW FLIGHT' : route && !route.none && route.airline && !full ? 'FLIGHT' : 'NEW PLANE');
  set(el, '.cb-name', full ? `To ${full.to.city}` : route?.airline ? `${route.airline} ${(p.callsign || '').replace(/^[A-Z]{3}/, '')}` : type);
  set(el, '.cb-sub', [full ? `${route.airline || a3} · from ${full.from.city}` : null, type, `${ft(p)} ft`].filter(Boolean).join(' · '));
  const art = el.querySelector('.cb-art'), g = isHelicopter(p) ? 'heli' : 'jet';
  if (art.dataset.g !== g) { art.dataset.g = g; art.innerHTML = glyphSvg(g); }
  el.classList.toggle('owned', owned);
}

let busy = false;
// Collect: look the route up properly (airports, distance), save the catch, show the card.
export async function collect(el, { onDone } = {}) {
  const hit = el._hit; if (!hit || busy) return;
  busy = true;
  try {
    const p = hit.plane, route = el._route;
    const full = route?.full ?? (await lookupRoute(p.callsign).catch(() => null));
    const { flight, plane } = cardsFor(p, full, route?.airline || '');
    const list = catches();
    const isNewFlight = flight ? seenCount(list, flight.key) === 0 : false;
    const isNewPlane = seenCount(list, plane.key) === 0;
    list.push({ key: flight?.key ?? plane.key, planeKey: plane.key, time: Date.now(), hex: p.hex, callsign: p.callsign, reg: p.reg,
      type: p.type, altFt: Math.round(p.hKm * 3280.84), gsKt: p.gs, rangeKm: Math.round(hit.rangeKm * 10) / 10, airline: route?.airline || '',
      flight, plane });
    save(list);
    await showCatch({ flight, plane, isNewFlight, isNewPlane, heightFt: Math.round(p.hKm * 3280.84), speedKmh: Math.round(p.gs * 1.852),
      awayKm: Math.round(hit.rangeKm), flightSeen: flight ? seenCount(list, flight.key) : 0, planeSeen: seenCount(list, plane.key) });
  } finally { busy = false; onDone?.(); }
}

export { TIERS };
