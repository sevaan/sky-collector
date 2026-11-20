// What a catch is worth in Sky Collector (2026-11-15, Sevaan): the main cards are FLIGHTS (an airline flying a route,
// e.g. Icelandair Toronto → Reykjavík), and every catch also counts toward PLANES (the aircraft type). Anything with no
// route (helicopters, light planes, balloons, private jets) is a Planes card only. No DOM here.

import { isProp } from './sky-props.js?v=0.1.1812';
import { aircraftName, isHelicopter, catchClass, isGovOrMil } from './planes.js?v=0.1.1812';
import { routeKm } from './routes.js?v=0.1.1812';
import { hasAirlineCallsign } from './sky-stamps.js?v=0.1.1812';
import { typeTier } from './sky-tiers.js?v=0.1.1812';
import { planeSet, flightSet, homeCountry } from './sky-sets.js?v=0.1.1812';
import { CARGO_AIRLINES } from './sky-cargo.js?v=0.1.1812';
import { typeName } from './sky-type-names.js?v=0.1.1812';

export const TIERS = {
  common: { label: 'Common', mark: '●', color: '#4a6178' },
  uncommon: { label: 'Uncommon', mark: '▲', color: '#1f7a50' },
  rare: { label: 'Rare', mark: '◆', color: '#1f5fbf' },
  epic: { label: 'Epic', mark: '★', color: '#7a3fc4' },
  legendary: { label: 'Legendary', mark: '✦', color: '#9a6a00' },
};
export const CARGO = CARGO_AIRLINES;
/* An aircraft the feed has no type for (2026-11-18, Sevaan: "a completely unknown aircraft? ... still have some data that could
   be a better card title"). About 1 in 20 aircraft in the sample study: new deliveries and anything else not yet in the public
   registers. Most still broadcast their ADS-B size category (87% of them), so each category is its own card, named for what
   that says; the airline comes from the callsign and is shown on the card's identity line. Weights are the category's own
   limits (15,500 / 75,000 / 300,000 lb). */
/* 2026-11-20 (Sevaan): a type code Sky has no name for (no entry in its own lists, and no description from the feed) used to
   be a Rare card called "Aircraft". It now lands on these same Common cards, by its size category, so the words say only
   what is true of both kinds of catch: Sky doesn't know the exact type. */
const UNLISTED = 'Sky doesn’t know this aircraft’s exact type: it may be brand new and not in the public registers yet.';
export const SIZE_CLASSES = {
  A1: { name: 'Light Aircraft', mark: 'LIGHT', glyph: 'prop', fact: `${UNLISTED} Its transponder says it weighs **under 7 tonnes**: a light aircraft, like a Cessna or a Piper.` },
  A2: { name: 'Small Aircraft', mark: 'SMALL', glyph: 'jet', fact: `${UNLISTED} Its transponder says it weighs **7 to 34 tonnes**: the size of a business jet or a regional turboprop.` },
  A3: { name: 'Large Aircraft', mark: 'LARGE', glyph: 'jet', fact: `${UNLISTED} Its transponder says it weighs **34 to 136 tonnes**: the size of a Boeing 737 or an Airbus A320.` },
  A4: { name: 'Large Aircraft', mark: 'LARGE', glyph: 'jet', fact: `${UNLISTED} Its transponder says it is a large aircraft that leaves a **strong wake**, like a Boeing 757.` },
  A5: { name: 'Heavy Aircraft', mark: 'HEAVY', glyph: 'jet', fact: `${UNLISTED} Its transponder says it weighs **more than 136 tonnes**: a wide-body, like a Boeing 777 or an Airbus A350.` },
  A6: { name: 'Fast Jet', mark: 'FAST', glyph: 'jet', fact: `${UNLISTED} Its transponder says it can fly **faster than 740 km/h** and pull more than 5 g.` },
  B1: { name: 'Glider', mark: 'GLIDER', glyph: 'glider', fact: 'A glider has **no engine**: it is towed or winched up, then stays up on rising air.' },
  B2: { name: 'Balloon or Airship', mark: 'BALLOON', glyph: 'balloon', fact: 'Lighter than air: a **balloon or an airship**, drifting or cruising far slower than anything with wings.' },
  B4: { name: 'Ultralight', mark: 'ULTRA', glyph: 'prop', fact: 'An **ultralight**: one or two seats, a small engine, and often an open cockpit.' },
  B6: { name: 'Drone', mark: 'DRONE', glyph: 'prop', fact: 'An aircraft with **nobody on board**, flown from the ground.' },
};
const NO_CLASS = { name: 'Unidentified Aircraft', mark: '', glyph: 'jet', fact: 'Sky doesn’t know this aircraft’s exact type, and its transponder doesn’t say what kind it is.' };
// The class of a plane card that has no type (key P:UNKNOWN or P:UNKNOWN-A3), else null.
export const unlisted = (key) => { const m = /^P:UNKNOWN(?:-(\w+))?$/.exec(String(key ?? '')); return m ? (SIZE_CLASSES[m[1]] ?? NO_CLASS) : null; };
// Sky knows this type: a name for it (its own lists or the feed's description), or it's a helicopter (always its own card).
export const knownType = (p) => !!p?.type && (!!aircraftName(p) || isHelicopter(p));
/* A plane card's key: its type when Sky knows it; else a helicopter, else its size category, else plain UNKNOWN. A type code
   Sky has no name for (2026-11-20, Sevaan: was a Rare "Aircraft") shares the size category's card with planes that have no
   type at all: one "Large Aircraft" card, not a separate same-named card for every code Sky can't name. */
export const planeKey = (p) => `P:${knownType(p) ? p.type : isHelicopter(p) ? 'HELI' : SIZE_CLASSES[p.category] ? `UNKNOWN-${p.category}` : 'UNKNOWN'}`;
/* The drawn plane when there is no photo. Straight wings for light and propeller types only (it read C2 as propeller, so a
   Citation CJ3, C25B, was drawn as one, 2026-11-18). */
export const glyphFor = (type, heli = false, cat = '') => { const t = String(type ?? '').toUpperCase(), c = String(cat ?? '').toUpperCase(); return t === 'BALL' || (c === 'B2' && t !== 'SHIP') ? 'balloon' : t === 'SHIP' ? 'airship' : t === 'GLID' || c === 'B1' ? 'glider' : heli ? 'heli' : isProp(t) ? 'prop' : 'jet'; }; /* js/sky-props.js since 2026-11-19 (QA: the DC-3, C-130J, A400M, C295 and An-12 were drawn as jets, the Beechjet as a prop) */
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
  if (card.sky === 'flight' || card.kind === 'flight') { const a3 = card.airlineIcao || String(card.key ?? '').split(':')[1] || ''; const st = flightSet(card.km ?? null, card.from, card.to, a3, card.homeCc ?? homeCountry()); card.tier = flightTier(card.km ?? null, a3); card.set = st.name; card.setId = st.id; }
  else if (card.sky === 'plane' || card.kind === 'plane') { const code = (/^P:(.+)$/.exec(card.key ?? '') || [])[1] || '', heli = card.glyph === 'heli' || code === 'HELI', st = planeSet(code, heli); const un = unlisted(card.key); card.tier = typeTier(code === 'HELI' || un ? '' : code, heli); card.set = st.name; card.setId = st.id; if (un) { card.name = un.name; card.typeName = un.name; card.type = ''; card.glyph = un.glyph; } else if (!heli) card.glyph = glyphFor(code); const nm = typeName(code); if (nm) { card.name = nm; card.typeName = nm; } /* the exact type name, for a card saved as "Boeing 737" */ }
  return card;
}

/* Catches saved as the old Rare "Aircraft" (a type code Sky has no name for; 2026-11-20, Sevaan) move to the Common size
   card new catches of them land on (planeKey): each plane catch by its own saved size category, else the one most of that
   card's catches had (one type code is one size), else P:UNKNOWN. Catches are kept, never dropped; a flight catch's link to
   its plane card follows. Pure: returns the new list and the sightings that changed (the same objects when nothing did). */
export function rekeyUnlisted(list) {
  const codeOf = (k) => (/^P:(.+)$/.exec(String(k ?? '')) || [])[1] || '';
  const old = (k, name) => { const c = codeOf(k); return !!c && c !== 'HELI' && !/^UNKNOWN/.test(c) && name === 'Aircraft' && !knownType({ type: c }); };
  const plane = (s) => s && (s.type === 'plane' || /^P:/.test(String(s.cardKey ?? ''))) && old(s.cardKey, s.cardSnapshot?.name ?? s.name);
  const cats = new Map(); /* old key -> { category: count } */
  for (const s of list ?? []) if (plane(s) && SIZE_CLASSES[s.cat]) { const m = cats.get(s.cardKey) ?? {}; m[s.cat] = (m[s.cat] ?? 0) + 1; cats.set(s.cardKey, m); }
  const cardCat = (k) => Object.entries(cats.get(k) ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const keyFor = (k, cat) => { const c = SIZE_CLASSES[cat] ? cat : cardCat(k); return `P:${c ? `UNKNOWN-${c}` : 'UNKNOWN'}`; };
  const byCatch = new Map(), changed = [];
  const out = (list ?? []).map((s) => {
    if (!plane(s)) return s;
    const nk = keyFor(s.cardKey, s.cat), snap = retier({ ...(s.cardSnapshot ?? { sky: 'plane' }), key: nk, id: nk, type: '' });
    byCatch.set(`${s.time}|${s.hex}`, snap);
    const t = { ...s, cardKey: nk, objectId: nk, name: snap.name, cardSnapshot: snap, plane: { key: nk, name: snap.name } }; changed.push(t); return t;
  }).map((s) => {
    if (!s?.plane?.key || s.type === 'plane' || !old(s.plane.key, s.plane.name)) return s;
    const snap = byCatch.get(`${s.time}|${s.hex}`), nk = snap?.key ?? keyFor(s.plane.key, ''), name = snap?.name ?? unlisted(nk).name;
    const t = { ...s, plane: { key: nk, name } }; changed.push(t); return t;
  });
  return { list: out, changed };
}

const fmtKm = (km) => (km == null ? '—' : km.toLocaleString('en-US'));
// Rough time in the air: 800 km/h cruise plus half an hour for climbing and landing.
const airTime = (km) => { if (km == null) return null; const m = Math.round((km / 800 + 0.5) * 60 / 5) * 5; return { h: Math.floor(m / 60), m: m % 60 }; };

// A caught plane + its route (or null) -> { flight, plane }: the card data for each collection.
export function cardsFor(p, route, airline) {
  const heli = isHelicopter(p), key = planeKey(p), un = unlisted(key), code = key.slice(2);
  const typeName = aircraftName(p) || (heli ? 'Helicopter' : un ? un.name : 'Aircraft');
  const plane = {
    kind: 'plane', key, name: typeName, type: un ? '' : (p.type || ''), /* a code Sky can't name isn't printed on the card (js/flight-card.js) */
    glyph: un ? un.glyph : glyphFor(p.type, heli, p.category),
    tier: typeTier(un ? '' : p.type, heli), set: planeSet(un ? code : p.type, heli).name, setId: planeSet(un ? code : p.type, heli).id,
    stamp: airline || '', reg: hasAirlineCallsign(p.callsign) ? (p.reg || '') : '', // no airline callsign: the callsign is the registration, so it isn't kept
  };
  /* this catch's own facts for the card (2026-11-19, card spike): what kind of thing it was (js/planes.js catchClass), the
     airline's name for an airline callsign, its heading and size category. js/sky-cards.js catchSightings moves them onto
     the sighting and keeps them off the card snapshot. Whether it had a route is known here too. */
  Object.defineProperty(plane, 'caught', { enumerable: false, configurable: true, writable: true, value: {
    cls: p.cls ?? catchClass({ callsign: p.callsign, category: p.category, type: p.type, heli, anon: p.anon }),
    ...((p.clsOp || (hasAirlineCallsign(p.callsign) && airline)) ? { op: p.clsOp || airline } : {}),
    ...(Number.isFinite(p.track) ? { track: Math.round(p.track) } : {}), ...(p.category ? { cat: p.category } : {}), routed: !!(route?.from && route?.to) } });
  /* a military or government aircraft is a plane card only, even if a route turned up (Sevaan 2026-11-19: type, never unit or route) */
  if (p.gov || p.cls === 'mil' || p.cls === 'gov' || isGovOrMil(p)) { plane.stamp = ''; plane.reg = ''; delete plane.caught.op; return { flight: null, plane }; }
  if (!route?.from || !route?.to) return { flight: null, plane };
  const a3 = (route.callsign ?? p.callsign ?? '').slice(0, 3), km = routeKm(route), st = flightSet(km, route.from, route.to, a3), set = st.name, homeCc = homeCountry() || undefined;
  const t = airTime(km);
  const flight = {
    kind: 'flight', key: `F:${a3}:${route.from.icao}-${route.to.icao}`,
    from: route.from, to: route.to, airline: airline || a3, airlineIcao: a3, callsign: route.callsign,
    type: p.type || '', typeName, // the aircraft that flew it: the card shows its photo (js/type-photos.js)
    km, kmText: fmtKm(km), air: t, set, setId: st.id, homeCc, tier: flightTier(km, a3), /* homeCc: where it was caught, so its set doesn't change when you travel */
    fact: km == null ? `${route.to.city} is where this ${airline || ''} flight is headed.`.replace('  ', ' ')
      : `${route.from.city} to ${route.to.city} is **${fmtKm(km)} km**, about ${t.h ? `${t.h}\u00a0h ${String(t.m).padStart(2, '0')}\u00a0m` : `${t.m} minutes`} in the air${typeName === 'Aircraft' || typeName === 'Helicopter' ? '' : `, on ${/^[AEIOU]/i.test(typeName) ? 'an' : 'a'} ${typeName}`}.` /* no "on an Aircraft" when the type isn't known (visual playtest 2026-11-19) */,
  };
  return { flight, plane };
}
