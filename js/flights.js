// What a catch is worth in Sky Collector (2026-11-15, Sevaan): the main cards are FLIGHTS (an airline flying a route,
// e.g. Icelandair Toronto → Reykjavík), and every catch also counts toward PLANES (the aircraft type). Anything with no
// route (helicopters, light planes, balloons, private jets) is a Planes card only. No DOM here.

import { aircraftName, isHelicopter } from './planes.js?v=0.1.1694';
import { routeKm } from './routes.js?v=0.1.1694';
import { hasAirlineCallsign } from './sky-stamps.js?v=0.1.1694';
import { typeTier } from './sky-tiers.js?v=0.1.1694';
import { planeSet, flightSet } from './sky-sets.js?v=0.1.1694';
import { CARGO_AIRLINES } from './sky-cargo.js?v=0.1.1694';
import { typeName } from './sky-type-names.js?v=0.1.1694';

export const TIERS = {
  common: { label: 'Common', mark: '●', color: '#4a6178' },
  uncommon: { label: 'Uncommon', mark: '▲', color: '#1f7a50' },
  rare: { label: 'Rare', mark: '◆', color: '#1f5fbf' },
  epic: { label: 'Epic', mark: '★', color: '#7a3fc4' },
  legendary: { label: 'Legendary', mark: '✦', color: '#9a6a00' },
};
export const CARGO = CARGO_AIRLINES;
/* Tiers and sets (docs/DESIGN-LOOP.md, approved 2026-11-17). A flight's tier is how far it goes; cargo is Rare, not
   Epic (cargo hubs made every card Epic); 14,000 km and beyond is Legendary. A plane's tier is how much of the world's
   traffic its type is (js/sky-tiers.js). Sets: js/sky-sets.js. */
export function flightTier(km, airline3) {
  if (km != null && km >= 14000) return 'legendary';
  if (km != null && km >= 10000) return 'epic';
  if (CARGO.has(airline3)) return 'rare';
  if (km == null) return 'common';
  if (km >= 5000) return 'rare';
  if (km >= 1500) return 'uncommon';
  return 'common';
}
// A saved card brought up to today's rules (cards are kept as snapshots on their sightings, so one caught under older
// rules would keep its old tier and set for ever). Returns the same object, changed in place.
export function retier(card) {
  if (!card) return card;
  if (card.sky === 'flight' || card.kind === 'flight') { const a3 = card.airlineIcao || String(card.key ?? '').split(':')[1] || ''; const st = flightSet(card.km ?? null, card.from, card.to, a3); card.tier = flightTier(card.km ?? null, a3); card.set = st.name; card.setId = st.id; }
  else if (card.sky === 'plane' || card.kind === 'plane') { const code = (/^P:(.+)$/.exec(card.key ?? '') || [])[1] || '', heli = card.glyph === 'heli' || code === 'HELI', st = planeSet(code, heli); card.tier = typeTier(code === 'HELI' || code === 'UNKNOWN' ? '' : code, heli); card.set = st.name; card.setId = st.id; const nm = typeName(code); if (nm) { card.name = nm; card.typeName = nm; } /* the exact type name, for a card saved as "Boeing 737" */ }
  return card;
}

const fmtKm = (km) => (km == null ? '—' : km.toLocaleString('en-US'));
// Rough time in the air: 800 km/h cruise plus half an hour for climbing and landing.
const airTime = (km) => { if (km == null) return null; const m = Math.round((km / 800 + 0.5) * 60 / 5) * 5; return { h: Math.floor(m / 60), m: m % 60 }; };

// A caught plane + its route (or null) -> { flight, plane }: the card data for each collection.
export function cardsFor(p, route, airline) {
  const typeName = aircraftName(p) || (isHelicopter(p) ? 'Helicopter' : 'Aircraft');
  const heli = isHelicopter(p);
  const plane = {
    kind: 'plane', key: `P:${p.type || (heli ? 'HELI' : 'UNKNOWN')}`, name: typeName, type: p.type || '',
    glyph: heli ? 'heli' : /^(C1|C2|PA|P2|SR|DA|BE|PC|C208|DH8|AT)/.test(p.type || '') ? 'prop' : 'jet',
    tier: typeTier(p.type, heli), set: planeSet(p.type, heli).name, setId: planeSet(p.type, heli).id,
    stamp: airline || '', reg: hasAirlineCallsign(p.callsign) ? (p.reg || '') : '', // no airline callsign: the callsign is the registration, so it isn't kept
  };
  if (!route?.from || !route?.to) return { flight: null, plane };
  const a3 = (route.callsign ?? p.callsign ?? '').slice(0, 3), km = routeKm(route), st = flightSet(km, route.from, route.to, a3), set = st.name;
  const t = airTime(km);
  const flight = {
    kind: 'flight', key: `F:${a3}:${route.from.icao}-${route.to.icao}`,
    from: route.from, to: route.to, airline: airline || a3, airlineIcao: a3, callsign: route.callsign,
    type: p.type || '', typeName, // the aircraft that flew it: the card shows its photo (js/type-photos.js)
    km, kmText: fmtKm(km), air: t, set, setId: st.id, tier: flightTier(km, a3),
    fact: km == null ? `${route.to.city} is where this ${airline || ''} flight is headed.`.replace('  ', ' ')
      : `${route.from.city} to ${route.to.city} is **${fmtKm(km)} km** as the crow flies: about ${t.h ? `${t.h}\u00a0h ${String(t.m).padStart(2, '0')}\u00a0m` : `${t.m} minutes`} in the air, on a ${typeName}.`,
  };
  return { flight, plane };
}
