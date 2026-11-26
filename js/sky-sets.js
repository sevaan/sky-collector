// Sky Collector's sets (docs/DESIGN-LOOP.md §2, approved by Sevaan 2026-11-17). A plane card belongs to its family; a
// flight card to where it goes, measured from the flight itself so the sets mean the same in any country. Each set has
// bronze / silver / gold goals below its full size, so a quiet sky can still earn it. No DOM.
//
// Not built: "Freighters" as a plane set (a type code doesn't say cargo: a B77L is both the 777 freighter and the
// 777-200LR), so cargo is a flight set only; and "Next door" has no border data, so it is any international flight
// under 1,500 km.
import { CARGO_AIRLINES } from './sky-cargo.js?v=0.1.1927';

// Order matters: the first match is the card's set.
export const PLANE_SETS = [
  /* Two sets beyond the approved ten (2026-11-17), so fighters and museum pieces don't sit in "Everything Else"; whole codes
     throughout: 'C17' must not take the Cessna C172. */
  { id: 'rarebirds', name: 'Rare Birds', color: '#9a6a00', goals: [1, 2, 4], test: (t) => /^(DC3|B17|B29|LANC|SPIT|P51|JU52|SHIP|BALL|A124|A3ST|A337|BLCF)$/ /* no retired types (A225, Concorde, Constellation: 2026-11-19) */.test(t) },
  /* the Military set is back (Sevaan 2026-11-19: "I should be able to catch a stealth bomber if I see it and it's in the api
     data"): by type only, never by callsign, registration, unit or route (js/plane-privacy.js) */
  { id: 'military', name: 'Military', color: '#55633a', goals: [1, 3, 6], test: (t) => /^(C17|C130|C30J|C5M|A400|K35[ER]|E3[TC]F|E6|B52|B1|B2|P8|C2|C295|V22|U2|F16|F18S|F15|F35|EUFI|A10|H47|H53|H60|AN12|IL76)$/.test(t) },
  { id: 'giants', name: 'Giants', color: '#7a3fc4', goals: [1, 2, 4], test: (t) => /^(B74.|A38.|A34.|MD11|DC10)$/.test(t) },
  { id: 'helicopters', name: 'Helicopters', color: '#c0562e', goals: [1, 3, 6], test: (t, heli) => heli },
  { id: 'b737', name: 'The 737 Family', color: '#1f5fbf', goals: [2, 3, 5], test: (t) => /^(B73[0-9]|B3[789X]M|B37M)/.test(t) },
  { id: 'a320', name: 'The A320 Family', color: '#2a8a9a', goals: [2, 3, 5], test: (t) => /^(A318|A319|A320|A321|A19N|A20N|A21N)$/.test(t) },
  { id: 'twinaisle', name: 'Twin Aisles', color: '#3f58a8', goals: [3, 6, 10], test: (t) => /^(B76[234]|B77[23LW]|B78[89X]|B779|B778|A33[0-9]|A35[9K]|A30[06B]|A310|IL96)/.test(t) },
  { id: 'regional', name: 'Regional Jets', color: '#1f7a50', goals: [2, 4, 7], test: (t) => /^(E170|E75[LS]|E190|E195|E29[05]|E135|E145|E45X|CRJ[1279X]|BCS[13]|F100|F70|RJ[0-9]|B46[1-3]|SU95)/.test(t) },
  { id: 'props', name: 'Propeller Airliners', color: '#8a6a2a', goals: [1, 2, 4], test: (t) => /^(DH8[A-D]|AT4[3-6]|AT7[2-6]|DHC6|DHC7|SF34|SB20|B190|E120|JS[34][12]|D228|D328|SW4|C208|BE99|L410|AN2[46])/.test(t) },
  { id: 'bizjets', name: 'Business Jets', color: '#4a4f66', goals: [2, 5, 10], test: (t) => /^(C25[0-9ABCM]|C5[0-9]{2}|C56X|C68[0A]|C700|C750|CL3[05]|CL60|GL[567E][TX]|GLF[2-6]|GA[5-8]C|G[12]50|G280|E5[05]P|E545|E550|F2TH|F900|FA[5-8]X|FA[0-9]{2}|LJ[2-7][0-9]|H25[A-C]|HDJT|PC24|PRM1|BE40|ASTR|GALX|HA4T|E35L|SF50|EA50)/.test(t) },
  { id: 'light', name: 'Light Aircraft', color: '#b08a1e', goals: [2, 4, 8], test: (t) => /^(UNKNOWN-A1|UNKNOWN-B[14]|C1[2-9][0-9]|C2[01][0-9]|C[0-9]{2}[RT]|P28[A-U]|PA[1-4][0-9]|P32[RT]?|P46T?|SR2[02]T?|S22T|DHC[23]|DA[2-6][0-9]|DV20|BE[1-3][0-9]|BE[5-9][0-9]|BE9[LT]|BE20|B350|PC12|TBM[7-9]|M20[A-Z]|RV[0-9]+|TWEN|AA5|GLAS|COL[34]|EVOT|SIRA|ULAC|GLID)/.test(t) },
  { id: 'others', name: 'Everything Else', color: '#6b7785', goals: [3, 8, 20], test: () => true },
];
// km: route length (null when unknown); from/to: airports with a country code (cc); a3: the airline's ICAO prefix.
export const FLIGHT_SETS = [
  { id: 'cargo', name: 'Cargo Runs', color: '#8a6a2a', goals: [1, 4, 10], test: (km, from, to, a3) => CARGO_AIRLINES.has(a3) },
  { id: 'longway', name: 'The Long Way', color: '#7a3fc4', goals: [1, 2, 5], test: (km) => km != null && km >= 10000 },
  { id: 'crossings', name: 'Long Haul', /* not 'Ocean Crossings': it counts overland flights too (avgeek playtest 2026-11-19) */ color: '#1f5fbf', goals: [1, 4, 10], test: (km, from, to) => km != null && km >= 5000 && from?.cc !== to?.cc },
  { id: 'hops', name: 'Short Hops', color: '#1f7a50', goals: [3, 8, 20], test: (km) => km != null && km < 500 },
  /* the player's own country (DESIGN-LOOP §2; QA 2026-11-19: Boston to San Francisco caught in Toronto said Home Skies).
     home: the country code where it was caught (setHomeCountry); unknown, any domestic flight as before */
  { id: 'home', name: 'Home Skies', color: '#c0562e', goals: [3, 10, 25], test: (km, from, to, a3, home) => !!from?.cc && from.cc === to?.cc && (!home || from.cc === home) },
  { id: 'nextdoor', name: 'Next Door', color: '#2a8a9a', goals: [2, 6, 15], test: (km, from, to) => km != null && km < 1500 && !!from?.cc && !!to?.cc && from.cc !== to.cc },
  { id: 'world', name: 'Other Routes', /* the catch-all, so a domestic flight can land here: not 'Around the World' (2026-11-19) */ color: '#3f58a8', goals: [3, 8, 20], test: () => true },
];
export const planeSet = (type, heli = false) => PLANE_SETS.find((s) => s.test(String(type || '').toUpperCase(), !!heli));
/* kept in localStorage 'homeCc' so the Collection frame and the next launch know it before any card is drawn; a card
   caught before 2026-11-19 has no homeCc of its own and uses this (QA 2026-11-19) */
let HOME = ''; try { HOME = /^[A-Z]{2}$/.test(localStorage.getItem('homeCc') ?? '') ? localStorage.getItem('homeCc') : ''; } catch {}
export const setHomeCountry = (cc) => { const v = /^[A-Z]{2}$/.test(cc ?? '') ? cc : ''; if (!v) return; HOME = v; try { localStorage.setItem('homeCc', v); } catch {} };
export const homeCountry = () => HOME;
export const flightSet = (km, from, to, a3, home = HOME) => FLIGHT_SETS.find((s) => s.test(km, from, to, a3, home));
export const SKY_SETS = [...FLIGHT_SETS, ...PLANE_SETS];
export const SKY_SET_BY_ID = Object.fromEntries(SKY_SETS.map((s) => [s.id, s]));
// A set's level from how many of its cards you own: 0 none, 1 bronze, 2 silver, 3 gold.
export const setLevel = (set, owned) => { const g = set?.goals ?? [1, 2, 3]; return owned >= g[2] ? 3 : owned >= g[1] ? 2 : owned >= g[0] ? 1 : 0; };
// For Space Collector's album code (js/sets.js useSets): a set there has a test over cards.
export const SKY_ALBUM_SETS = SKY_SETS.map((s) => ({ id: s.id, name: s.name, color: s.color, goals: s.goals, test: (o) => (o.setId ?? o.set) === s.id }));
