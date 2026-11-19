// More plane patches for Sky Collector (2026-11-19, docs/SECRETS-AND-PATCHES.md "Patches", Sevaan: "do them all"):
// earned in plain sight, read off the sightings like every patch (js/progress.js), nothing stored. Each catch's own
// context (the sun's height, the weather, where you stood) is kept on its sighting when it is caught (main.js
// capturePlane: sunEl, wx), so older catches count only for what they already carry. No DOM here.
import { greatCircle } from './flight-facts.js?v=0.1.1771';
import { isProp } from './sky-props.js?v=0.1.1771';

const R = 6371, RAD = Math.PI / 180;
const km = (a, b) => { const s = Math.sin((b.lat - a.lat) * RAD / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin((b.lon - a.lon) * RAD / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(s))); };
const ARCTIC = 66.56;
// Four engines: the A340, the 747, the A380, the An-124 and the Il-96.
const QUAD = /^(A34[2-6]|B74[1-8]|B74[DRS]|BLCF|A388|A124|IL96|A225)$/;
// Turboprops (the propeller list less the piston planes and warbirds)
const TURBOPROP = /^(DH8[A-D]|AT4[3-6]|AT7[2-6]|DHC[67]|SF34|SB20|B190|BE99|B350|BE9[LT]|BE20|BE30|E110|E120|JS3[12]|JS41|D228|D328|SW[34]|C208|C212|CN35|C295|C130|C30J|A400|AN(12|24|26|28|30|32)|L410|PC(6T|12)|TBM[7-9]|P46T|PAY[1-4]|KODI|Y12|MA60|P180|F27|F50)$/;
// Airline alliances by ICAO prefix: long-standing members only (2026-11; a change of membership only moves which
// airlines count toward a patch).
export const ALLIANCES = {
  star: { name: 'Star Alliance', a3: 'ACA AEE AIC ANA ANZ AUA AVA BEL CCA CMP CSZ CTN DLH ETH EVA LOT MSR SAA SIA SWR TAP THA THY UAL' },
  oneworld: { name: 'oneworld', a3: 'AAL ALK ASA BAW CPA FIN IBE JAL MAS QFA QTR RAM RJA' },
  skyteam: { name: 'SkyTeam', a3: 'AEA AFR AMX ARG CAL CES CXA DAL GIA HVN KAL KLM KQA MEA ROT SAS SVA VIR' },
};
const ALLIANCE_OF = new Map(Object.entries(ALLIANCES).flatMap(([id, x]) => x.a3.split(' ').map((a) => [a, id])));
// Meteorological seasons, flipped south of the equator
const seasonOf = (d, lat) => { const m = d.getMonth(), n = m < 2 || m === 11 ? 0 : m < 5 ? 1 : m < 8 ? 2 : 3; return lat < 0 ? (n + 2) % 4 : n; };
const isSnow = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86; // WMO weather codes
const dayNo = (t) => { const d = new Date(t); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); };

export const freshSky2 = () => ({ redeye: 0, homerun: 0, outbound: 0, alliances: { star: new Set(), oneworld: new Set(), skyteam: new Set() }, days: new Set(), catches: [], golden: 0, seasons: new Map(),
  liveries: new Set(), clouds: 0, snow: 0, coast: 0, equator: 0, dateline: 0, pole: 0, countries: new Set(), quad: 0, turboprops: new Set(), rotors: new Set(), distance: 0 });
// One sighting (s) with its card snapshot (c), counted once per catch for the flight side. Called by progress().
export function noteSky2(k, s, c) {
  const d = new Date(s.time), hr = d.getHours(), tc = String(s.typeCode ?? '').toUpperCase(), cs = String(s.callsign ?? '');
  k.days.add(dayNo(s.time));
  if (!k.catches.length || s.time - k.catches[k.catches.length - 1] >= 3000) k.catches.push(s.time); /* a catch saves two sightings at once */
  if (typeof s.sunEl === 'number' && s.sunEl >= 0 && s.sunEl <= 6 && hr >= 12) k.golden++;
  if (s.lat != null) { const y = d.getFullYear(), set = k.seasons.get(y) ?? k.seasons.set(y, new Set()).get(y); set.add(seasonOf(d, s.lat)); }
  if (s.wx) { if ((s.wx.cloud ?? 0) >= 90) k.clouds++; if (isSnow(s.wx.code ?? 0)) k.snow++; }
  const al = ALLIANCE_OF.get(cs.slice(0, 3)); if (al && /^[A-Z]{3}\d/.test(cs)) k.alliances[al].add(cs.slice(0, 3));
  if (c.sky === 'plane') {
    if (QUAD.test(tc)) k.quad++;
    if (tc && /^[A-Z]{3}\d/.test(cs)) k.liveries.add(`${tc}|${cs.slice(0, 3)}`); /* a type in an airline's colours (#9) */
    if (TURBOPROP.test(tc)) k.turboprops.add(tc);
    if ((c.glyph === 'heli' || c.setId === 'helicopters') && tc && tc !== 'HELI') k.rotors.add(tc);
  }
  if (c.sky === 'flight' && c.from && c.to) {
    const f = c.from, t = c.to, len = c.km ?? (f.lat != null && t.lat != null ? km(f, t) : null);
    if (len != null) k.distance += len;
    if (t.cc) k.countries.add(t.cc);
    if (len != null && len >= 4000 && hr < 5) k.redeye++;
    if (s.lat != null && t.lat != null && km({ lat: s.lat, lon: s.lon }, t) <= 30) k.homerun++;
    if (s.lat != null && f.lat != null && km({ lat: s.lat, lon: s.lon }, f) <= 30) k.outbound++;
    if (f.cc && f.cc === t.cc && (len ?? 0) >= 3500) k.coast++;
    if (f.lat != null && t.lat != null) {
      if (f.lat * t.lat < 0) k.equator++;
      const g = greatCircle(f, t); if (g.dateLine) k.dateline++; if (g.maxLat > ARCTIC && f.lat < ARCTIC && t.lat < ARCTIC) k.pole++;
    }
  }
}
// The longest run of days in a row, and the most catches within ten minutes
const longestRun = (days) => { const l = [...days].sort((a, b) => a - b); let best = 0, run = 0; for (let i = 0; i < l.length; i++) { run = i && l[i] === l[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); } return best; };
const rush = (ts) => { let best = 0; for (let i = 0, j = 0; i < ts.length; i++) { while (ts[i] - ts[j] > 600000) j++; best = Math.max(best, i - j + 1); } return best; };
const K = (a) => a.sky2 ?? freshSky2();
const maxSeasons = (a) => { let n = 0; for (const s of K(a).seasons.values()) n = Math.max(n, s.size); return n; };
// [id, name, text, need, have]
const P = (id, name, text, need, have) => ({ id, name, text, icon: '', done: (a) => have(a) >= need, prog: (a) => [Math.min(need, have(a)), need] });
export const SKY_PATCHES_MORE = [
  P('sky-redeye', 'Red-eye', 'Catch a long-haul flight between midnight and 5 am', 1, (a) => K(a).redeye),
  P('sky-homerun', 'Home Run', 'Catch a flight landing at an airport near you', 1, (a) => K(a).homerun),
  P('sky-outbound', 'Outbound', 'Catch a flight that took off from an airport near you', 1, (a) => K(a).outbound),
  P('sky-star', 'Star Alliance', 'Catch five Star Alliance airlines', 5, (a) => K(a).alliances.star.size),
  P('sky-oneworld', 'oneworld', 'Catch five oneworld airlines', 5, (a) => K(a).alliances.oneworld.size),
  P('sky-skyteam', 'SkyTeam', 'Catch five SkyTeam airlines', 5, (a) => K(a).alliances.skyteam.size),
  P('sky-seven', 'Seven Skies', 'Catch a plane seven days in a row', 7, (a) => longestRun(K(a).days)),
  P('sky-thirty', 'Thirty Skies', 'Catch a plane thirty days in a row', 30, (a) => longestRun(K(a).days)),
  P('sky-rush', 'Rush Hour', 'Catch five planes in ten minutes', 5, (a) => rush(K(a).catches)),
  P('sky-golden', 'Golden Hour', 'Catch a plane as the sun goes down', 1, (a) => K(a).golden),
  P('sky-seasons', 'Four Seasons', 'Catch planes in all four seasons of one year', 4, maxSeasons),
  P('sky-clouds', 'Above the Clouds', 'Catch a plane on an overcast day', 1, (a) => K(a).clouds),
  P('sky-snow', 'Snow Day', 'Catch a plane while it snows', 1, (a) => K(a).snow),
  P('sky-coast', 'Coast to Coast', 'Catch a flight of 3,500 km or more within one country', 1, (a) => K(a).coast),
  P('sky-equator', 'Equator Crosser', 'Catch a flight between the northern and southern halves of the world', 1, (a) => K(a).equator),
  P('sky-dateline', 'Date Line', 'Catch a flight whose shortest path crosses the International Date Line', 1, (a) => K(a).dateline),
  P('sky-pole', 'Pole Hopper', 'Catch a flight whose shortest path passes north of the Arctic Circle', 1, (a) => K(a).pole),
  P('sky-passport10', 'Passport', 'Catch flights to 10 countries', 10, (a) => K(a).countries.size),
  P('sky-passport25', 'Well Travelled', 'Catch flights to 25 countries', 25, (a) => K(a).countries.size),
  P('sky-passport50', 'Globetrotter’s Passport', 'Catch flights to 50 countries', 50, (a) => K(a).countries.size),
  P('sky-quad', 'Four Engines', 'Catch a four-engined plane', 1, (a) => K(a).quad),
  P('sky-turboprop10', 'Turboprop Ten', 'Catch ten kinds of turboprop', 10, (a) => K(a).turboprops.size),
  P('sky-rotors3', 'Rotor Club', 'Catch three kinds of helicopter', 3, (a) => K(a).rotors.size),
  P('sky-airlines50', 'Fifty Airlines', 'Catch 50 different airlines', 50, (a) => a.sky?.airlines?.size ?? 0),
  P('sky-airlines100', 'Hundred Airlines', 'Catch 100 different airlines', 100, (a) => a.sky?.airlines?.size ?? 0),
  P('sky-livery10', 'Livery Spotter', 'Catch 10 liveries: a type in an airline’s colours', 10, (a) => K(a).liveries.size),
  P('sky-livery25', 'Livery Collector', 'Catch 25 liveries', 25, (a) => K(a).liveries.size),
  P('sky-livery50', 'Paint Shop', 'Catch 50 liveries', 50, (a) => K(a).liveries.size),
  P('sky-world', 'Round the World', 'Catch flights adding up to 40,075 km, once round the Earth', 40075, (a) => Math.round(K(a).distance)),
  P('sky-moon', 'To the Moon', 'Catch flights adding up to 384,400 km, the distance to the Moon', 384400, (a) => Math.round(K(a).distance)),
];
export { QUAD, TURBOPROP, isProp };

// ---- the patches' art (js/patches.js addSecretArt, keyed by id): cream ink and Sky's red in the ±40 box ----
const I = '#fff2b3', RD = '#e8493c', BL = '#8fd0ff';
const JET = (x = 0, y = 0, s = 1, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="${I}"><path d="M0 -16 C1.6 -16 2.4 -14 2.4 -12 V-3 L15 4 V7 L2.4 3 V11 L6 14 V16 L0 14.6 L-6 16 V14 L-2.4 11 V3 L-15 7 V4 L-2.4 -3 V-12 C-2.4 -14 -1.6 -16 0 -16Z"/></g>`;
const TOWER = `<g fill="${I}"><path d="M-3 24 L-2 -2 H2 L3 24Z"/><path d="M-8 -10 H8 L6 -2 H-6Z"/><rect x="-6" y="-14" width="12" height="4" fill="${BL}"/></g>`;
const RING = (n) => `<text y="7" text-anchor="middle" font-family="SC Display, Impact, sans-serif" font-size="${String(n).length > 2 ? 18 : 22}" fill="${I}">${n}</text>`;
const GLOBE = `<circle r="18" fill="none" stroke="${I}" stroke-width="2"/><path d="M-18 0 H18 M0 -18 Q-10 0 0 18 M0 -18 Q10 0 0 18" fill="none" stroke="${I}" stroke-width="1.2" stroke-opacity=".6"/>`;
export const SKY_PATCH_ART = {
  'sky-redeye': () => `<path d="M14 -20 A16 16 0 1 0 22 6 A12 12 0 1 1 14 -20Z" fill="${I}"/>${JET(-6, 8, .8, 60)}`,
  'sky-homerun': () => `${TOWER}${JET(-16, -14, .7, 135)}`,
  'sky-outbound': () => `${TOWER}${JET(18, -16, .7, 45)}`,
  'sky-star': () => `<polygon points="0,-22 5,-7 21,-7 8,2 13,18 0,8 -13,18 -8,2 -21,-7 -5,-7" fill="none" stroke="${I}" stroke-width="2.4"/>`,
  'sky-oneworld': () => `<circle r="20" fill="none" stroke="${I}" stroke-width="2.4"/><circle r="7" fill="${RD}"/>`,
  'sky-skyteam': () => `<path d="M-22 6 Q0 -26 22 6" fill="none" stroke="${I}" stroke-width="3"/><path d="M-16 14 Q0 -12 16 14" fill="none" stroke="${BL}" stroke-width="2.4"/>`,
  'sky-seven': () => `${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${-27 + i * 8}" y="-6" width="6" height="12" rx="1.5" fill="${i === 6 ? RD : I}"/>`).join('')}<path d="M-27 14 H27" stroke="${I}" stroke-width="1.4"/>`,
  'sky-thirty': () => RING(30),
  'sky-rush': () => `${JET(-14, -10, .55, 45)}${JET(0, -14, .55, 45)}${JET(14, -6, .55, 45)}${JET(-6, 8, .55, 45)}${JET(10, 12, .55, 45)}`,
  'sky-golden': () => `<path d="M-28 10 H28" stroke="${I}" stroke-width="2"/><path d="M-14 10 A14 14 0 0 1 14 10Z" fill="#f2b632"/>${JET(14, -16, .6, 80)}`,
  'sky-seasons': () => `<g stroke="${I}" stroke-width="2" fill="none"><path d="M0 -22 V22 M-22 0 H22"/></g><circle cx="-11" cy="-11" r="5" fill="#9fd47a"/><circle cx="11" cy="-11" r="5" fill="#f2b632"/><circle cx="11" cy="11" r="5" fill="#d9772e"/><circle cx="-11" cy="11" r="5" fill="#cfe5f6"/>`,
  'sky-clouds': () => `${JET(0, -14, .7, 90)}<path d="M-24 14 Q-24 2 -12 4 Q-8 -6 4 -2 Q16 -6 18 6 Q28 6 26 14Z" fill="${I}"/>`,
  'sky-snow': () => `<g stroke="${I}" stroke-width="2.4" stroke-linecap="round">${[0, 60, 120].map((r) => `<path d="M0 -20 V20" transform="rotate(${r})"/><path d="M-5 -15 L0 -10 L5 -15" fill="none" transform="rotate(${r})"/><path d="M-5 15 L0 10 L5 15" fill="none" transform="rotate(${r})"/>`).join('')}</g>`,
  'sky-coast': () => `<path d="M-30 4 Q0 -18 30 4" fill="none" stroke="${I}" stroke-width="2" stroke-dasharray="3 3"/><circle cx="-30" cy="4" r="3" fill="${RD}"/><circle cx="30" cy="4" r="3" fill="${RD}"/>${JET(0, -6, .55, 90)}`,
  'sky-equator': () => `${GLOBE}<path d="M-24 0 H24" stroke="${RD}" stroke-width="3"/>`,
  'sky-dateline': () => `${GLOBE}<path d="M0 -24 V24" stroke="${RD}" stroke-width="3"/>`,
  'sky-pole': () => `<circle r="20" fill="none" stroke="${I}" stroke-width="2"/><circle r="9" fill="none" stroke="${BL}" stroke-width="1.6" stroke-dasharray="2 2"/><circle r="2" fill="${I}"/><path d="M-22 14 Q0 -6 22 14" fill="none" stroke="${RD}" stroke-width="2.4"/>`,
  'sky-passport10': () => `<rect x="-14" y="-20" width="28" height="38" rx="3" fill="#14284a" stroke="${I}" stroke-width="2"/>${GLOBE.replace(/r="18"/, 'r="8"').replace(/18/g, '8')}${RING('')}<text y="14" text-anchor="middle" font-size="9" fill="${I}" font-family="SC Display, Impact, sans-serif">10</text>`,
  'sky-passport25': () => `<rect x="-14" y="-20" width="28" height="38" rx="3" fill="#14284a" stroke="${I}" stroke-width="2"/><text y="14" text-anchor="middle" font-size="9" fill="${I}" font-family="SC Display, Impact, sans-serif">25</text><circle cy="-4" r="8" fill="none" stroke="${I}" stroke-width="1.6"/>`,
  'sky-passport50': () => `<rect x="-14" y="-20" width="28" height="38" rx="3" fill="#14284a" stroke="#f2b632" stroke-width="2"/><text y="14" text-anchor="middle" font-size="9" fill="#f2b632" font-family="SC Display, Impact, sans-serif">50</text><circle cy="-4" r="8" fill="none" stroke="#f2b632" stroke-width="1.6"/>`,
  'sky-quad': () => `${JET(0, 0, 1.4)}${[-14, -8, 8, 14].map((x) => `<rect x="${x - 1.5}" y="${Math.abs(x) > 10 ? 4 : 1}" width="3" height="6" rx="1" fill="${RD}"/>`).join('')}`,
  'sky-turboprop10': () => `<g fill="${I}"><path d="M-30 -2 H30 V3 H-30Z"/><path d="M-2 -18 H2 L1.6 18 H-1.6Z"/></g>${[-14, 14].map((x) => `<g transform="translate(${x} -4)"><path d="M0 -9 V9" stroke="${RD}" stroke-width="2"/></g>`).join('')}`,
  'sky-rotors3': () => `<g fill="${I}"><ellipse cy="4" rx="8" ry="10"/><rect x="-1.5" y="12" width="3" height="14"/></g><path d="M-26 -10 L26 -2 M-26 -2 L26 -10" stroke="${I}" stroke-width="2.4"/>${RING('')}`,
  'sky-airlines50': () => RING(50),
  'sky-airlines100': () => RING(100),
  'sky-world': () => `${GLOBE}<path d="M-26 -12 A28 14 0 1 0 26 -12" fill="none" stroke="${RD}" stroke-width="2" stroke-dasharray="3 3"/>${JET(24, -14, .45, 60)}`,
  'sky-moon': () => `<circle cx="10" cy="-8" r="14" fill="${I}"/><circle cx="6" cy="-12" r="3" fill="#c9b98a"/><circle cx="14" cy="-2" r="2" fill="#c9b98a"/>${JET(-16, 14, .55, 45)}`,
};
const LIVERY = (n, c = I) => `<path d="M-6 -24 L-2 -24 L14 -2 L14 4 L-2 0 L-2 14 L4 18 L4 22 L-4 20 L-12 22 L-12 18 L-6 14 L-6 0 L-22 4 L-22 -2 L-6 -24Z" fill="${c}" transform="translate(4 2)"/><path d="M4 -12 L12 -2" stroke="${RD}" stroke-width="3"/><path d="M0 -6 L8 4" stroke="${BL}" stroke-width="3"/><text x="16" y="26" font-size="11" text-anchor="middle" fill="${I}" font-family="SC Display, Impact, sans-serif">${n}</text>`;
Object.assign(SKY_PATCH_ART, { 'sky-livery10': () => LIVERY(10), 'sky-livery25': () => LIVERY(25), 'sky-livery50': () => LIVERY(50, '#f2b632') });
