// What a catch is worth in Sky Collector (2026-11-15, Sevaan): the main cards are FLIGHTS (an airline flying a route,
// e.g. Icelandair Toronto → Reykjavík), and every catch also counts toward PLANES (the aircraft type). Anything with no
// route (helicopters, light planes, balloons, private jets) is a Planes card only. No DOM here.

import { aircraftName, isHelicopter } from './planes.js?v=0.1.1648';
import { routeKm } from './routes.js?v=0.1.1648';
import { hasAirlineCallsign } from './sky-stamps.js?v=0.1.1648';

export const TIERS = {
  common: { label: 'Common', mark: '●', color: '#4a6178' },
  uncommon: { label: 'Uncommon', mark: '▲', color: '#1f7a50' },
  rare: { label: 'Rare', mark: '◆', color: '#1f5fbf' },
  epic: { label: 'Epic', mark: '★', color: '#7a3fc4' },
  legendary: { label: 'Legendary', mark: '✦', color: '#9a6a00' },
};
export const CARGO = new Set(['FDX', 'UPS', 'CJT', 'GTI', 'CLX', 'ABX', 'ATN', 'BOX', 'CKS', 'DHK', 'GEC', 'NCA', 'PAC']);
const SUN = new Set(['MX', 'CU', 'DO', 'JM', 'BS', 'BB', 'AW', 'CW', 'LC', 'TC', 'KY', 'PR', 'CR', 'PA', 'BZ', 'HT', 'AG', 'VC', 'GD', 'TT', 'SX', 'MF', 'BQ', 'VG', 'VI', 'KN']);
const EUROPE = new Set(['GB', 'IE', 'IS', 'FR', 'DE', 'NL', 'BE', 'LU', 'CH', 'AT', 'IT', 'ES', 'PT', 'DK', 'NO', 'SE', 'FI', 'PL', 'CZ', 'HU', 'GR', 'TR', 'HR', 'RO', 'BG', 'RS', 'SK', 'SI', 'LT', 'LV', 'EE', 'MT', 'CY', 'AL', 'ME', 'MK', 'BA', 'UA', 'MD', 'BY', 'FO', 'GL']);
const NORTH_AMERICA = new Set(['CA', 'US']);

// The far end of the flight, for sets: from North America, the destination; otherwise the origin if it's yours.
function setFor(route, airline3) {
  if (CARGO.has(airline3)) return 'Cargo';
  const a = route.from.cc, b = route.to.cc;
  if (a === 'CA' && b === 'CA') return 'Across Canada';
  if ((NORTH_AMERICA.has(a) && EUROPE.has(b)) || (EUROPE.has(a) && NORTH_AMERICA.has(b))) return 'Across the Atlantic';
  if (SUN.has(a) || SUN.has(b)) return 'Sun Destinations';
  if (NORTH_AMERICA.has(a) && NORTH_AMERICA.has(b)) return 'North America';
  return 'Around the World';
}

function tierFor(km, airline3) {
  if (CARGO.has(airline3)) return 'epic';
  if (km == null) return 'common';
  if (km >= 9000) return 'epic';
  if (km >= 4000) return 'rare';
  if (km >= 1500) return 'uncommon';
  return 'common';
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
    tier: heli ? 'rare' : /^(A38|B74|A34|AN|C17|C5|KC|E3|C30|C13)/.test(p.type || '') ? 'epic' : 'common',
    stamp: airline || '', reg: hasAirlineCallsign(p.callsign) ? (p.reg || '') : '', // no airline callsign: the callsign is the registration, so it isn't kept
  };
  if (!route?.from || !route?.to) return { flight: null, plane };
  const a3 = (route.callsign ?? p.callsign ?? '').slice(0, 3), km = routeKm(route), set = setFor(route, a3);
  const t = airTime(km);
  const flight = {
    kind: 'flight', key: `F:${a3}:${route.from.icao}-${route.to.icao}`,
    from: route.from, to: route.to, airline: airline || a3, airlineIcao: a3, callsign: route.callsign,
    type: p.type || '', typeName, // the aircraft that flew it: the card shows its photo (js/type-photos.js)
    km, kmText: fmtKm(km), air: t, set, tier: tierFor(km, a3),
    fact: km == null ? `${route.to.city} is where this ${airline || ''} flight is headed.`.replace('  ', ' ')
      : `${route.from.city} to ${route.to.city} is **${fmtKm(km)} km** as the crow flies: about ${t.h ? `${t.h}\u00a0h ${String(t.m).padStart(2, '0')}\u00a0m` : `${t.m} minutes`} in the air, on a ${typeName}.`,
  };
  return { flight, plane };
}
