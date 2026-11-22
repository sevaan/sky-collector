// Facts on a flight card (2026-11-18, Sevaan: "Are there other facts flights could have too? If no fact available the
// distance one can be used but it'd be nice to change it up sometimes" … "Do all three"). A flight card has a list:
//   the route's distance and time in the air (cardsFor's f.fact, always first),
//   then, taking turns, the airline's researched facts (js/airline-facts.js), the departure and arrival airports'
//   researched facts (js/airport-facts.js) and facts worked out here from the two airports.
// The card shows the one for the number of days you've caught that flight (1st day: the first, 2nd: the next …, round
// again), as an aircraft card turns by aircraft (js/sky-facts.js typeFact), so it never shows the same fact twice running
// unless it has only one. Researched facts: docs/FACT-STYLE.md, sources in docs/FACTS-SOURCES.md.
// The worked-out facts are true whatever path the plane really flies: the countries of the two airports, the
// equator (crossed by any path between two hemispheres), where one city lies from the other, and what the SHORTEST path
// between them passes (the date line, the Arctic or Antarctic Circle), said as that. No DOM here.
import { AIRLINE_FACTS } from './airline-facts.js?v=0.1.1881';
import { AIRPORT_FACTS } from './airport-facts.js?v=0.1.1881';

const RAD = Math.PI / 180;
// Country names, with "the" where English uses it
const THE = new Set(['US', 'GB', 'NL', 'AE', 'PH', 'BS', 'DO', 'CF', 'GM', 'MV', 'SC', 'KM', 'MH', 'SB', 'KY', 'VG', 'VI', 'TC', 'FO', 'CK', 'FK', 'VA', 'CD', 'CG']);
let names = null;
const SHORT = { CN: 'China', HK: 'Hong Kong', MO: 'Macao', TW: 'Taiwan', KR: 'South Korea', KP: 'North Korea', RU: 'Russia', IR: 'Iran', SY: 'Syria', LA: 'Laos', VN: 'Vietnam', BO: 'Bolivia', VE: 'Venezuela', TZ: 'Tanzania', MD: 'Moldova', BN: 'Brunei', CI: 'Ivory Coast', CV: 'Cape Verde', MM: 'Myanmar', PS: 'the Palestinian territories', TR: 'Turkey' }; /* the everyday names, not Intl's "Hong Kong SAR China" */
export function countryName(cc) {
  const c = String(cc || '').toUpperCase(); if (!/^[A-Z]{2}$/.test(c)) return '';
  try { names ??= new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return ''; }
  let n = SHORT[c] ?? ''; if (!n) try { n = names.of(c) || ''; } catch {} if (!n || n === c || /unknown/i.test(n)) return '';
  return (THE.has(c) ? 'the ' : '') + n;
}
const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export function bearing(a, b) {
  const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD), x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
// The highest and lowest latitude on the shortest path, and whether it crosses longitude 180
export function greatCircle(a, b, steps = 180) {
  const v = (p) => [Math.cos(p.lat * RAD) * Math.cos(p.lon * RAD), Math.cos(p.lat * RAD) * Math.sin(p.lon * RAD), Math.sin(p.lat * RAD)];
  const A = v(a), B = v(b), d = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
  let maxLat = -90, minLat = 90, dateLine = false, lastLon = a.lon;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, s = Math.sin(d) || 1, k1 = d ? Math.sin((1 - t) * d) / s : 1 - t, k2 = d ? Math.sin(t * d) / s : t;
    const x = k1 * A[0] + k2 * B[0], y = k1 * A[1] + k2 * B[1], z = k1 * A[2] + k2 * B[2];
    const lat = Math.atan2(z, Math.hypot(x, y)) / RAD, lon = Math.atan2(y, x) / RAD;
    maxLat = Math.max(maxLat, lat); minLat = Math.min(minLat, lat);
    if (i && Math.abs(lon - lastLon) > 180) dateLine = true; lastLon = lon;
  }
  return { maxLat, minLat, dateLine };
}
const ARCTIC = 66.56;
// Facts worked out from the two airports (f.from / f.to: { city, cc, lat, lon }); each one exactly one **bold** phrase
export function routeFacts(f) {
  const a = f?.from, b = f?.to, out = [];
  if (!a?.city || !b?.city || a.lat == null || b.lat == null) return out;
  const ca = countryName(a.cc), cb = countryName(b.cc);
  if (ca && cb && a.cc === b.cc) out.push(`${a.city} and ${b.city} are both in ${ca}, so this is a **domestic flight**.`);
  else if (ca && cb) out.push(`An **international flight**: it takes off in ${ca} and lands in ${cb}.`);
  const p = POINTS[Math.round(bearing(a, b) / 45) % 8];
  out.push(`The shortest way from ${a.city} to ${b.city} starts out heading **${p}**${(p === 'north' || p === 'south') && Math.abs(b.lon - a.lon) > 60 ? ', not the way a flat map would suggest' : ''}.`);
  if ((a.lat > 0) !== (b.lat > 0) && a.lat !== 0 && b.lat !== 0) out.push(`This flight crosses the **equator**, from the ${a.lat > 0 ? 'northern' : 'southern'} half of the world to the ${b.lat > 0 ? 'northern' : 'southern'}.`);
  const g = greatCircle(a, b);
  if (g.dateLine) out.push(`The shortest path from ${a.city} to ${b.city} crosses the **International Date Line**, where the calendar changes by a day.`);
  if (g.maxLat > ARCTIC && a.lat < ARCTIC && b.lat < ARCTIC) out.push(`The shortest path from ${a.city} to ${b.city} curves north of the **Arctic Circle**, over the top of the world.`);
  if (g.minLat < -ARCTIC && a.lat > -ARCTIC && b.lat > -ARCTIC) out.push(`The shortest path from ${a.city} to ${b.city} dips south of the **Antarctic Circle**.`);
  return out;
}
const list = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
// The whole list for a flight card, in the order the card turns through it
export function flightFacts(f) {
  const first = f?.fact ? [String(f.fact)] : [];
  const airline = list(AIRLINE_FACTS[String(f?.airlineIcao || (/^F:([A-Z]{3}):/.exec(f?.key ?? '') || [])[1] || '').toUpperCase()]);
  const ports = [];
  const pa = list(AIRPORT_FACTS[f?.from?.icao]), pb = list(AIRPORT_FACTS[f?.to?.icao]);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { if (pa[i]) ports.push(pa[i]); if (pb[i]) ports.push(pb[i]); }
  const worked = routeFacts(f), out = [...first];
  for (let i = 0; i < Math.max(airline.length, ports.length, worked.length); i++) for (const g of [airline, ports, worked]) if (g[i]) out.push(g[i]);
  return [...new Set(out)];
}
// n = the 1-based number of days you've caught this flight (stamps); a card you don't have yet shows the first
export function flightFact(f, n = 1) {
  const l = flightFacts(f); return l.length ? l[(Math.max(1, Math.floor(n)) - 1) % l.length] : '';
}
