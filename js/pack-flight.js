// A real flight for the sample pack's first card (skycollector.app/pack, 2026-11-18, Sevaan: "the fun part of the game is
// the flight stuff and we don't have a flight card and I think users should see one that goes over their area").
// Where the visitor is comes from the browser's time zone only (no permission prompt on a page someone was just sent):
// the zone's city from js/tz-places.js. The page asks Sky's relay for planes within 40 nmi of that city's centre (the
// city's coordinates, never the visitor's), picks a good airliner here (rankFlights), and checks its route against the
// bundled route data (js/routes.js). When that can't be done in time, the card is a flight recorded over the nearest hub
// (js/pack-flights.js, scripts/build-pack-flights.mjs), labelled with when it was seen, never "right now".
// No DOM here: the pure parts are tested in tests/pack-flight.test.mjs.
import { TZ_PLACES } from './tz-places.js?v=0.1.1868';
import { isGovOrMil } from './plane-privacy.js?v=0.1.1868';

// The relay (server/, Cloud Run "api" in sky-collector-app): one upstream request per 1-degree square every 15 s, shared
// by everyone asking about the same square. Allows skycollector.app, sevaan.github.io and localhost.
export const RELAY = 'https://api-ybymfwdlgq-uc.a.run.app/planes';

// No table entry for the zone: a big city in the same part of the world, then London.
const REGION = { America: 'America/New_York', Europe: 'Europe/London', Asia: 'Asia/Singapore', Africa: 'Africa/Johannesburg', Australia: 'Australia/Sydney', Pacific: 'Pacific/Auckland', Atlantic: 'Europe/London', Indian: 'Asia/Dubai' };
export function cityForZone(tz) {
  const z = String(tz || ''), p = TZ_PLACES[z] ?? TZ_PLACES[REGION[z.split('/')[0]]] ?? TZ_PLACES['Europe/London'];
  return { name: p[2], lat: p[0], lon: p[1] };
}
export const visitorZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } };

const R_KM = 6371, RAD = Math.PI / 180;
export function km(lat1, lon1, lat2, lon2) {
  const s = Math.sin((lat2 - lat1) * RAD / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin((lon2 - lon1) * RAD / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

// The relay's answer -> planes in the shape js/flights.js cardsFor() takes (the same as js/planes.js parse(), which isn't
// exported and brings the whole tracker with it).
export function normalize(json) {
  const now = json?.now ?? Date.now(), at = now < 1e12 ? now * 1000 : now, out = [];
  for (const a of json?.ac ?? json?.aircraft ?? []) {
    if (a.lat == null || a.lon == null || a.alt_baro === 'ground') continue;
    const ft = typeof a.alt_geom === 'number' ? a.alt_geom : a.alt_baro; if (typeof ft !== 'number') continue;
    out.push({ hex: a.hex, flags: Number(a.dbFlags) & 13 /* LADD, PIA, military: never shown (js/planes.js isAnonymous) */, callsign: String(a.flight ?? '').trim().toUpperCase(), reg: a.r ?? '', type: a.t ?? '', desc: a.desc ?? '', category: a.category ?? '',
      lat: a.lat, lon: a.lon, hKm: ft * 0.0003048, altFt: ft, gs: a.gs ?? 0, track: a.track ?? a.true_heading ?? 0, climb: a.geom_rate ?? a.baro_rate ?? 0, at: at - (a.seen_pos ?? 0) * 1000 });
  }
  return out;
}

// The planes worth a card, best first. Only airliners: an airline callsign (three letters and a number), not a
// helicopter, and a photo of that airline's own aircraft of that type plus its logo (hasArt), so the card is the real
// thing. Airborne and moving (2,500 ft and up, 120 kt and up). Best = nearest the city centre, with planes up where they
// look like a flight (8,000 ft and up) ahead of ones just off the runway.
export function rankFlights(planes, center, hasArt) {
  return (planes ?? [])
    .filter((p) => !p.flags && !isGovOrMil({ flight: p.callsign, t: p.type }) /* never a military or government aircraft, whatever its callsign (QA 2026-11-19) */ && /^[A-Z]{3}\d/.test(p.callsign ?? '') && p.category !== 'A7' && p.type && p.altFt >= 2500 && p.gs >= 120 && hasArt(p.callsign.slice(0, 3), p.type))
    .map((p) => ({ p, score: km(center.lat, center.lon, p.lat, p.lon) + (p.altFt < 8000 ? 40 : 0) }))
    .sort((a, b) => a.score - b.score).map((x) => x.p);
}

// The tag over the card, in plain words: only a live flight says "right now".
export const liveTag = (city) => `Over ${city} right now`;
export const seenTag = (hub, when) => `Seen over ${hub} ${when}`;
// "on 18 November" (or "today"), from the recorded time, in the visitor's language
export function seenWhen(ms, now = Date.now(), locale) {
  const d = new Date(ms), n = new Date(now);
  if (d.toDateString() === n.toDateString()) return 'today';
  try { return 'on ' + d.toLocaleDateString(locale, { day: 'numeric', month: 'long' }); } catch { return 'on ' + d.toDateString().slice(4, 10); }
}

// The recorded flight nearest the city (canned: [{ hub, lat, lon, ... }]).
export function nearestCanned(city, canned) {
  let best = null, d = Infinity;
  for (const c of canned ?? []) { const k = km(city.lat, city.lon, c.lat, c.lon); if (k < d) { d = k; best = c; } }
  return best;
}

// Ask the relay about a city and find a flight whose route the bundled data knows and that this plane is plausibly
// flying: { plane, route, airline } or null. deps: { fetch, lookupRoute, airlineName, hasArt, timeoutMs }. Never throws.
export async function findLiveFlight(city, deps) {
  const { fetch: get = globalThis.fetch, lookupRoute, airlineName, hasArt, timeoutMs = 2500 } = deps;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const stop = setTimeout(() => ctl?.abort(), timeoutMs);
  try {
    const r = await get(`${RELAY}?lat=${city.lat.toFixed(2)}&lon=${city.lon.toFixed(2)}&dist=40`, { signal: ctl?.signal, cache: 'no-store' });
    if (!r.ok) return null;
    const list = rankFlights(normalize(await r.json()), city, hasArt).slice(0, 6);
    for (const p of list) {
      const route = await lookupRoute(p.callsign, p).catch(() => null);
      if (route?.from && route?.to) return { plane: p, route, airline: airlineName(p.callsign) || '' };
    }
    return null;
  } catch { return null; } finally { clearTimeout(stop); }
}
