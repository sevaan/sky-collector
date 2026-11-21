// Sky Collector's secrets (2026-11-19, docs/SECRETS-AND-PATCHES.md, Sevaan: "do them all"): found by catching something
// unusual, never listed until found, earned through Space Collector's own secrets system (js/secrets.js SECRET_PATCHES,
// main.js earnSecret: the secret patch, its notice, the patch wall's Secret group). Santa and Dizzy are Space's own and
// work as they do there. Detection is pure (no DOM): tests/sky-secrets.test.mjs runs it on real readsb records.
// Rules (docs/SECRETS-AND-PATCHES.md "Safety and privacy"): nothing here names or follows one aircraft or person; no
// military or police aircraft; no emergencies. Every fact in the texts is checked (sources in the doc).

// The patches. The text is what the patch's card says once found.
import { speed } from './units.js?v=0.1.1845'; /* Jet Stream's speed in the player's units (QA round 5) */
export const SKY_SECRET_PATCHES = {
  overhead: { id: 'overhead', name: 'Straight Up', /* was 'Zenith' (wording pass 2026-11-20); the id stays 'overhead' (not 'zenith': that's a Space Collector patch id) */ text: 'You caught a plane flying almost straight over your head.' },
  balloon: { id: 'balloon', name: 'Up, Up and Away', text: 'You caught a hot-air balloon.' },
  glider: { id: 'glider', name: 'Silent Wings', text: 'You caught a glider, flying with no engine at all.' },
  airship: { id: 'airship', name: 'Lighter Than Air', text: 'You caught an airship.' },
  whale: { id: 'whale', name: 'The Whale', text: 'You caught an Airbus Beluga, the whale-shaped freighter that carries parts of Airbus planes between its factories.' },
  heavylift: { id: 'heavylift', name: 'Heavy Lifter', text: 'You caught one of the giant freighters: an Antonov An-124 or a Boeing Dreamlifter.' },
  firebird: { id: 'firebird', name: 'Firebird', text: 'You caught a water bomber, a plane built to scoop up water from a lake.' } /* names the aircraft, no fire in progress (Sevaan, 2026-11-20) */,
  hurricane: { id: 'hurricane', name: 'Into the Eye', text: 'You caught a NOAA hurricane hunter, a plane that flies into storms to measure them.' },
  vintage: { id: 'vintage', name: 'Vintage', text: 'You caught a plane of a type built more than 50 years ago.' },
  jetstream: { id: 'jetstream', name: 'Jet Stream', get text() { const s = speed(1000); return `You caught an airliner going faster than ${s.v} ${s.u} over the ground, pushed along by the jet stream.`; } },
  ceiling: { id: 'ceiling', name: 'Ceiling', text: 'You caught a plane flying higher than 45,000 ft.' },
  formation: { id: 'formation', name: 'Two of a Kind', /* not 'Formation': that means military or airshow flying (avgeek playtest 2026-11-19); the id stays so earned patches keep */ text: 'You caught a plane with another of the same airline, a different type, in your circle.' },
  /* aviation anniversaries (2026-11-19, review Part 2 F): Space Collector's dated secrets (js/secrets.js DATED,
     datedCrossing), found by tapping what crosses the sky on the day; by day or night, since planes fly by day */
  wright: { id: 'wright', name: 'First Flight', text: 'You remembered the Wright brothers’ first powered flight, at Kitty Hawk on 17 December 1903.' },
  dreamliner: { id: 'dreamliner', name: 'Dreamliner', text: 'You remembered the Boeing 787’s first flight, on 15 December 2009.' },
  jumbo: { id: 'jumbo', name: 'Queen of the Skies', text: 'You remembered the Boeing 747’s first flight, on 9 February 1969.' },
  concorde: { id: 'concorde', name: 'Mach 2', text: 'You remembered Concorde’s first flight, at Toulouse on 2 March 1969.' },
  a380: { id: 'a380', name: 'Superjumbo', text: 'You remembered the Airbus A380’s first flight, on 27 April 2005.' },
  lindbergh: { id: 'lindbergh', name: 'Spirit of St. Louis', text: 'You remembered Charles Lindbergh’s solo flight from New York to Paris, which landed on 21 May 1927.' },
  bleriot: { id: 'bleriot', name: 'Across the Channel', text: 'You remembered Louis Blériot’s flight across the English Channel, on 25 July 1909.' },
  airline: { id: 'airline', name: 'First Airline', text: 'You remembered the first scheduled airline flight, St. Petersburg to Tampa in Florida, on 1 January 1914.' },
  sixcont: { id: 'sixcont', name: 'Six Continents', text: 'Your flights have been heading to all six inhabited continents.' },
};

// ---- what an aircraft is (readsb record or a parsed plane: type t|type, category, gs, alt) ----
const up = (s) => String(s ?? '').trim().toUpperCase();
const typeOf = (p) => up(p?.t ?? p?.type);
const ft = (p) => (typeof p?.altFt === 'number' ? p.altFt : typeof p?.alt_geom === 'number' ? p.alt_geom : typeof p?.alt_baro === 'number' ? p.alt_baro : null);
const AIRLINE = /^[A-Z]{3}\d/;
// A real balloon from adsb.lol (2026-11-19, N801XR, type BALL, 11,200 ft, 0.7 kt) broadcast category A7 (rotorcraft), and
// the type GLID was on an Air Canada jet at 35,000 ft: so each kind also has to fly like one.
export function lighterThanAir(p) {
  const t = typeOf(p), gs = Number(p?.gs) || 0;
  if (t === 'SHIP' || /^(ZEPL|ZNT)$/.test(t)) return 'airship';
  if (t === 'BALL' || (up(p?.category) === 'B2' && t !== 'SHIP')) return gs < 40 ? 'balloon' : (t === 'BALL' ? null : 'airship');
  return null;
}
export function isGlider(p) {
  const t = typeOf(p), gs = Number(p?.gs) || 0, a = ft(p) ?? 0, cs = up(p?.flight ?? p?.callsign);
  return (up(p?.category) === 'B1' || t === 'GLID') && gs > 0 && gs < 110 && a < 20000 && !AIRLINE.test(cs);
}
// Types that stopped being built more than 50 years ago (the DC-3, DC-4, DC-6 and DC-7 airliners, the wartime B-17, B-25,
// B-29, P-51, Spitfire, T-6 and C-46, and the Beech 18, built until 1970), so every one flying is a vintage plane.
const VINTAGE = new Set(['DC3', 'DC4', 'DC6', 'DC7', 'B17', 'B25', 'B29', 'P51', 'SPIT', 'T6', 'C46', 'BE18']);
export const isVintage = (p, now = Date.now()) => VINTAGE.has(typeOf(p)) || (Number(p?.year) > 1900 && Number(p.year) <= new Date(now).getFullYear() - 50);

// The secrets one plane can give when it's caught. hit: { el } where it was in your sky. others: the other planes in
// your circle at that moment ([{ callsign }]). tag: set at parse time from the raw callsign (js/planes.js), because
// the callsign of a non-airline aircraft is blanked before anything else sees it.
export function secretsForCatch(p, { el = 0, others = [], now = Date.now() } = {}) {
  const out = [], t = typeOf(p), gs = Number(p?.gs) || 0, a = ft(p);
  if (el >= 88) out.push('overhead');
  const lta = lighterThanAir(p); if (lta) out.push(lta);
  if (isGlider(p)) out.push('glider');
  if (t === 'A337' || t === 'A3ST') out.push('whale');
  if (t === 'A124' || t === 'BLCF') out.push('heavylift');
  if (t === 'CL2T' || t === 'CL2P') out.push('firebird');
  if (p?.tag === 'hurricane') out.push('hurricane');
  if (isVintage(p, now)) out.push('vintage');
  if (gs >= 540 && AIRLINE.test(up(p?.callsign ?? p?.flight))) out.push('jetstream'); /* 540 kt = 1,000 km/h */
  if (a != null && a >= 45000) out.push('ceiling');
  const a3 = up(p?.callsign ?? p?.flight).slice(0, 3);
  if (AIRLINE.test(up(p?.callsign ?? p?.flight)) && others.some((o) => up(o?.callsign).slice(0, 3) === a3 && up(o?.callsign) !== up(p.callsign) && typeOf(o) && typeOf(o) !== typeOf(p)) /* a different type: two of the same at a hub was near-constant */) out.push('formation');
  return out;
}
// NOAA's hurricane hunters (Lockheed WP-3D Orions N42RF "NOAA42" and N43RF "NOAA43", the Gulfstream IV N49RF "NOAA49").
// Civil government aircraft; the Air Force's hurricane hunters are military and stay generic plane cards.
export const tagOf = (raw) => (/^NOAA4[239]$/.test(up(raw?.flight)) ? 'hurricane' : '');

// ---- Six Continents: where your flights have been heading ----
const CONT = {
  AF: 'DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
  AS: 'AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE',
  EU: 'AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA',
  NA: 'AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI',
  SA: 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE',
  OC: 'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF',
};
const CONT_OF = new Map(Object.entries(CONT).flatMap(([c, l]) => l.split(' ').map((cc) => [cc, c])));
export const continentOf = (cc) => CONT_OF.get(up(cc)) ?? null;
// flights: card snapshots or routes with to.cc. True once their destinations cover all six.
export function sixContinents(flights) {
  const s = new Set(); for (const f of flights ?? []) { const c = continentOf(f?.to?.cc); if (c) s.add(c); }
  return s.size >= 6;
}

// ---- the patches' art (embroidered roundels, js/patches.js): drawn in the patch's ±40 box, cream ink and Sky's red ----
const I = '#fff2b3', R = '#e8493c';
const JET = (x = 0, y = 0, s = 1, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="${I}"><path d="M0 -16 C1.6 -16 2.4 -14 2.4 -12 V-3 L15 4 V7 L2.4 3 V11 L6 14 V16 L0 14.6 L-6 16 V14 L-2.4 11 V3 L-15 7 V4 L-2.4 -3 V-12 C-2.4 -14 -1.6 -16 0 -16Z"/></g>`;
const SKY_ART = {
  overhead: () => `<circle r="20" fill="none" stroke="${I}" stroke-width="2" stroke-dasharray="2 4"/>${JET(0, 0, 1.15)}<path d="M-28 22 H28" stroke="${I}" stroke-width="2"/><path d="M0 22 V27" stroke="${R}" stroke-width="3"/>`,
  balloon: () => `<path d="M0 -26 C16 -26 20 -12 14 0 C10 8 5 11 4 14 H-4 C-5 11 -10 8 -14 0 C-20 -12 -16 -26 0 -26Z" fill="${R}" stroke="${I}" stroke-width="1.6"/><path d="M0 -26 C-6 -18 -6 4 -4 14 M0 -26 C6 -18 6 4 4 14" fill="none" stroke="${I}" stroke-width="1.4"/><path d="M-4 14 L-4 18 M4 14 L4 18" stroke="${I}" stroke-width="1.2"/><rect x="-5" y="18" width="10" height="7" rx="1" fill="#a8743a" stroke="${I}" stroke-width="1"/>`,
  glider: () => `<path d="M-34 2 Q0 -4 34 2 L34 4 Q0 0 -34 4Z" fill="${I}"/><path d="M-2 -6 L2 -6 L1.6 18 L-1.6 18Z" fill="${I}"/><path d="M-9 17 H9 V19.5 H-9Z" fill="${I}"/><path d="M-30 18 Q-10 10 6 14" fill="none" stroke="${I}" stroke-opacity=".5" stroke-width="1.2" stroke-dasharray="2 3"/>`,
  airship: () => `<ellipse rx="27" ry="11" fill="${I}"/><path d="M22 -4 L33 -12 L33 12 L22 4Z" fill="${R}"/><path d="M-6 9 H8 V15 H-6Z" fill="#a8743a" stroke="${I}" stroke-width="1"/><path d="M-20 0 H18" stroke="#c9b98a" stroke-width="1.2"/>`,
  whale: () => `<path d="M-30 4 C-30 -16 -8 -20 8 -12 L24 -4 L32 -14 L32 10 L22 4 C10 12 -12 14 -24 12 C-28 11 -30 8 -30 4Z" fill="${I}"/><circle cx="-20" cy="-2" r="1.8" fill="#14284a"/><path d="M-26 6 Q-20 9 -13 6" fill="none" stroke="#14284a" stroke-width="1.4"/><path d="M-8 6 L-16 20 L-6 20 L4 6Z" fill="${I}"/>`,
  heavylift: () => `${JET(0, 0, 1.7)}<rect x="-9" y="22" width="18" height="7" rx="1" fill="#a8743a" stroke="${I}" stroke-width="1"/>`,
  firebird: () => `${JET(0, -8, 1, 0)}<path d="M-26 20 Q-13 12 0 20 T26 20" fill="none" stroke="#8fd0ff" stroke-width="3"/><path d="M-6 8 Q-8 14 -4 17 M0 9 Q-1 14 2 17 M6 8 Q7 13 5 16" stroke="#8fd0ff" stroke-width="1.6" fill="none"/>`,
  hurricane: () => `<g fill="none" stroke="${I}" stroke-width="3" stroke-linecap="round"><path d="M0 0 m-6 0 a6 6 0 0 1 12 0 a12 12 0 0 1 -18 10"/><path d="M0 0 m6 0 a6 6 0 0 1 -12 0 a12 12 0 0 1 18 -10"/></g><circle r="3" fill="${R}"/>${JET(18, -20, .6, 30)}`,
  vintage: () => `<g fill="${I}"><path d="M-32 0 Q0 -5 32 0 L32 4 Q0 1 -32 4Z"/><path d="M-3 -18 C3 -18 4 -10 4 -4 L3 22 H-3 L-4 -4 C-4 -10 -3 -18 -3 -18Z"/><path d="M-10 18 H10 V21 H-10Z"/></g><path d="M-10 -20 H10" stroke="${R}" stroke-width="2.4"/><circle cy="-20" r="2" fill="${R}"/>`,
  jetstream: () => `<g fill="none" stroke="#8fd0ff" stroke-width="2.4" stroke-linecap="round"><path d="M-34 -10 Q-10 -18 14 -10"/><path d="M-34 12 Q-8 4 18 12"/><path d="M-30 1 H-12"/></g>${JET(12, 0, 1, 90)}`,
  ceiling: () => `<path d="M-30 -18 H30" stroke="${R}" stroke-width="2.4" stroke-dasharray="4 3"/>${JET(0, 4, 1, 0)}<path d="M-30 24 Q0 16 30 24" fill="none" stroke="${I}" stroke-opacity=".5" stroke-width="1.4"/>`,
  formation: () => `${JET(-10, -6, .85)}${JET(12, 8, .85)}<circle r="26" fill="none" stroke="${I}" stroke-width="1.6" stroke-opacity=".6"/>`,
  wright: () => `<g fill="none" stroke="${I}" stroke-width="2.2" stroke-linecap="round"><path d="M-30 -6 H30 M-30 6 H30"/><path d="M-22 -6 V6 M-8 -6 V6 M8 -6 V6 M22 -6 V6"/><path d="M-30 0 H-40 M30 0 H38"/></g><path d="M-30 18 Q0 10 30 18" fill="none" stroke="${I}" stroke-opacity=".5" stroke-width="1.4"/>`,
  dreamliner: () => `${JET(0, 0, 1.3, 70)}<path d="M-30 18 Q0 8 30 18" fill="none" stroke="${I}" stroke-opacity=".5" stroke-width="1.4"/>`,
  jumbo: () => `${JET(0, 0, 1.6, 0)}<circle cx="0" cy="-12" r="3" fill="${I}"/>`,
  concorde: () => `<path d="M0 -30 L5 -10 L22 18 L4 12 L0 22 L-4 12 L-22 18 L-5 -10Z" fill="${I}"/><path d="M-26 -22 L-14 -22 M-30 -14 L-16 -14" stroke="${I}" stroke-opacity=".6" stroke-width="1.6"/>`,
  a380: () => `${JET(0, 0, 1.7, 0)}<path d="M-14 4 H14" stroke="#14284a" stroke-width="1.4"/>`,
  lindbergh: () => `${JET(-6, 4, .9, 80)}<path d="M-32 18 Q-6 0 28 -14" fill="none" stroke="${I}" stroke-width="1.6" stroke-dasharray="3 3"/><circle cx="28" cy="-14" r="3" fill="${R}"/>`,
  bleriot: () => `<g fill="none" stroke="${I}" stroke-width="2.2" stroke-linecap="round"><path d="M-28 -2 H28"/><path d="M0 -10 V14 M-6 14 H6"/></g><path d="M-32 20 Q-16 14 0 20 T32 20" fill="none" stroke="#8fd0ff" stroke-width="2"/>`,
  airline: () => `<g fill="none" stroke="${I}" stroke-width="2.2" stroke-linecap="round"><path d="M-28 -6 H28 M-28 4 H28"/><path d="M-6 4 V12 Q0 16 6 12 V4"/></g><path d="M-32 20 Q-16 15 0 20 T32 20" fill="none" stroke="#8fd0ff" stroke-width="2"/>`,
  sixcont: () => `<circle r="22" fill="none" stroke="${I}" stroke-width="2.2"/><path d="M-22 0 H22 M0 -22 V22 M-16 -15 Q0 -6 16 -15 M-16 15 Q0 6 16 15" fill="none" stroke="${I}" stroke-opacity=".55" stroke-width="1.2"/>${[[-14, -8], [10, -12], [-6, 10], [14, 6], [0, -2], [-16, 4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${R}"/>`).join('')}`,
};
const SKY_TWILL = { overhead: '#14284a', balloon: '#5a2a1a', glider: '#1f3d3a', airship: '#22265a', whale: '#173d5c', heavylift: '#3a3a3a', firebird: '#5a2a1a', hurricane: '#1f2a3a', vintage: '#4a3a22', jetstream: '#173d5c', ceiling: '#14284a', formation: '#10433f', sixcont: '#3f2a58' };
// Into Space Collector's secrets (js/secrets.js) and patch art (js/patches.js); called by main.js and cards-page.js in Sky.
export function registerSkySecrets(SECRET_PATCHES, addSecretArt, patchArt = {}) {
  for (const p of Object.values(SKY_SECRET_PATCHES)) SECRET_PATCHES[p.id] = Object.assign(Object.defineProperties({}, Object.getOwnPropertyDescriptors(p)), { secret: true, icon: '' }); /* descriptors, not a spread: Jet Stream's text is a getter that follows Settings → Units */
  addSecretArt?.({ ...SKY_ART, ...patchArt }, SKY_TWILL); /* patchArt: js/sky-patches.js's patches, drawn the same way */
}

// The anniversaries' crossings (Space Collector's js/secrets.js DATED format: [id, month 0-11, day, title, sub, colour, tap label])
export const SKY_DATED = [
  ['airline', 0, 1, 'The first airliner', 'St. Petersburg–Tampa · 1 Jan 1914', '#8fd0ff', 'Tap to remember'],
  ['jumbo', 1, 9, 'Boeing 747', 'First flight · 9 Feb 1969', '#ffc93d', 'Tap to remember'],
  ['concorde', 2, 2, 'Concorde', 'First flight · 2 Mar 1969', '#e8e3c8', 'Tap to remember'],
  ['a380', 3, 27, 'Airbus A380', 'First flight · 27 Apr 2005', '#8fd0ff', 'Tap to remember'],
  ['lindbergh', 4, 21, 'Spirit of St. Louis', 'New York to Paris · 21 May 1927', '#ffc93d', 'Tap to remember'],
  ['bleriot', 6, 25, 'Blériot XI', 'Across the Channel · 25 Jul 1909', '#e8e3c8', 'Tap to remember'],
  ['dreamliner', 11, 15, 'Boeing 787', 'First flight · 15 Dec 2009', '#8fd0ff', 'Tap to remember'],
  ['wright', 11, 17, 'Wright Flyer', 'Kitty Hawk · 17 Dec 1903', '#ffc93d', 'Tap to remember'],
];
