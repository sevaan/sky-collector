// Flight routes for Sky Collector. Source: Virtual Radar Server's standing data (CC0,
// github.com/vradarserver/standing-data). Since 2026-11-17 the data the game needs is BUNDLED in data/routes/ (built by
// scripts/routes/build-routes.mjs, see docs/DATA-ROUTES.md): r/<AAA>.json per ICAO airline prefix ({ "1372": "KSEA-KSFO" },
// callsign minus its 3-letter prefix) and airports.json (ICAO -> [IATA, name, city, country, lat, lon]). Only when a
// bundled file can't be loaded does it fall back to the live GitHub CSVs (routes/schema-01/A/ACA-all.csv, airports/
// schema-01/C/CY.csv). Files are kept for the session. A route is { callsign, from, to, stops, airports } or null.
// Wrong routes are filtered by routePlausible / lookupRoute(callsign, plane): see docs/DATA-ROUTES.md. No DOM here.

const SD = 'https://raw.githubusercontent.com/vradarserver/standing-data/main/';
const files = new Map(); // path -> Promise<Map<key,value>>
let loader = null; // tests: (relativePath) => Promise<string|null>
export function setRouteLoader(fn) { loader = fn; files.clear(); }

async function getText(rel, url) {
  if (loader) return loader(rel);
  const r = await fetch(url, { signal: AbortSignal.timeout?.(8000) });
  return r.ok ? r.text() : null;
}
const bundled = (rel) => getText(rel, new URL('../data/routes/' + rel, import.meta.url).href).then((t) => (t ? JSON.parse(t) : null)).catch(() => null);

// A small RFC 4180 reader: "quoted, fields" may hold commas, doubled quotes ("") and line breaks. Blank lines are skipped.
export function parseCsv(txt) {
  const rows = []; let row = [], f = '', q = false, any = false;
  const end = () => { row.push(f); f = ''; if (any || row.length > 1) rows.push(row); row = []; any = false; };
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
    if (ch === '"') { q = true; any = true; } else if (ch === ',') { row.push(f); f = ''; any = true; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; end(); }
    else { f += ch; any = true; }
  }
  if (any || f || row.length) end();
  return rows;
}


function memo(key, make) {
  if (files.has(key)) return files.get(key);
  const p = make().catch(() => null).then((v) => { if (!v) files.delete(key); return v; }); // a failed load is tried again next time
  files.set(key, p);
  return p;
}

// GitHub CSV fallback -> Map(callsign -> row)
function csv(path) {
  return memo('gh:' + path, () => fetch(SD + path, { signal: AbortSignal.timeout?.(8000) })
    .then((r) => (r.ok ? r.text() : ''))
    .then((txt) => {
      const rows = new Map(), table = parseCsv(txt.replace(/^\uFEFF/, ''));
      const head = table.shift() ?? [];
      for (const v of table) { const o = {}; head.forEach((k, i) => (o[k] = v[i])); rows.set(v[0], o); }
      return rows;
    })).then((m) => m ?? new Map());
}

// The country you're in, from the nearest airport the routes know (within 400 km), for Home Skies (js/sky-sets.js). '' if none.
export async function countryNear(lat, lon) {
  const t = await bundledAirports(); if (!t || lat == null || lon == null) return '';
  let best = '', d = 400;
  for (const a of Object.values(t)) { if (a[4] == null || !a[3]) continue; const k = hav(lat, lon, a[4], a[5]); if (k < d) { d = k; best = a[3]; } }
  return best;
}
// Fixes to VRS's city names (QA 2026-11-19): typos, and airports named after their small town instead of the city they serve.
const CITY_BY_ICAO = { RJGG: 'Nagoya', RJCC: 'Sapporo', MPTO: 'Panama City', SKRG: 'Medellín' };
const CITY_TYPO = { Belgrad: 'Belgrade', Larnarca: 'Larnaca', 'Rodes Island': 'Rhodes', Naqpur: 'Nagpur' };
const cityFix = (icao, c) => CITY_BY_ICAO[icao] ?? CITY_TYPO[c] ?? String(c).replace(/\/+$/, '');
// Bundled airports (one file) or null when unavailable.
const bundledAirports = () => memo('airports', () => bundled('airports.json'));

export async function airport(icao) {
  if (!/^[A-Z0-9]{4}$/.test(icao ?? '')) return null;
  const t = await bundledAirports();
  if (t) {
    const a = t[icao];
    return a ? { icao, iata: a[0] || '', name: a[1] || '', city: cityFix(icao, a[2] || a[1] || icao), cc: a[3] === 'KS' ? 'XK' : a[3] || '', lat: a[4] ?? null, lon: a[5] ?? null }
      : { icao, iata: '', name: '', city: icao, cc: '', lat: null, lon: null };
  }
  const a = (await csv(`airports/schema-01/${icao[0]}/${icao.slice(0, 2)}.csv`)).get(icao);
  if (!a) return { icao, iata: '', name: '', city: icao, cc: '', lat: null, lon: null };
  return { icao, iata: a.IATA || '', name: a.Name || '', city: a.Location || a.Name || icao, cc: a.CountryISO2 || '',
    lat: a.Latitude ? +a.Latitude : null, lon: a.Longitude ? +a.Longitude : null };
}

// ICAO codes ("KSEA-KSFO" split) for a callsign, from the bundled shard, else GitHub.
async function codesFor(callsign) {
  const pre = callsign.slice(0, 3);
  const shard = await memo('r:' + pre, () => bundled(`r/${pre}.json`));
  if (shard) return (shard[callsign.slice(3)] ?? '').split('-').filter(Boolean);
  let row = (await csv(`routes/schema-01/${callsign[0]}/${pre}-all.csv`)).get(callsign);
  /* big airlines' routes come in numbered parts (RYR-1.csv, RYR-2.csv …; QA 2026-11-19) */
  for (let n = 1; !row && n <= 12; n++) { const t = await csv(`routes/schema-01/${callsign[0]}/${pre}-${n}.csv`); if (!t.size) break; row = t.get(callsign); }
  return row?.AirportCodes?.split('-').filter(Boolean) ?? [];
}

// { callsign, from, to, stops, airports } or null. airports lists every stop in order (A-B-C = 3). Without a plane,
// multi-stop flights keep their first and last airport. With a plane ({ lat, lon, track, altFt|altitude }), the leg it
// is plausibly on is chosen and an implausible route returns null (see routePlausible).
export async function lookupRoute(callsign, plane) {
  if (!/^[A-Z]{3}\d/.test(callsign ?? '')) return null;
  const codes = await codesFor(callsign);
  if (codes.length < 2) return null;
  const airports = await Promise.all(codes.map(airport));
  const r = { callsign, from: airports[0], to: airports[airports.length - 1], stops: codes.length, airports };
  if (!r.from || !r.to || airports.some((x) => !x)) return null; /* a code that isn't an airport (EDDF-QKL): no route, not a TypeError (QA 2026-11-19) */
  if (plane) return sameCity(routeForPlane(r, plane));
  if (r.from.icao === r.to.icao && airports.length > 2) { r.to = airports[1]; return sameCity(r); } // A-B-A: first leg
  return r.from.icao === r.to.icao ? null : sameCity(r);
}

/* Two airports of one city (Paris CDG to Orly, London Heathrow to Gatwick) make no flight card: "Paris to Paris" is a
   repositioning hop or a wrong route (QA 2026-11-19) */
const sameCity = (r) => (r && r.from?.city && r.from.city === r.to?.city && r.from.cc === r.to.cc ? null : r);
const R_KM = 6371, RAD = Math.PI / 180;
function hav(lat1, lon1, lat2, lon2) {
  const s = Math.sin((lat2 - lat1) * RAD / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin((lon2 - lon1) * RAD / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}
function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * RAD) * Math.cos(lat2 * RAD), x = Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) - Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lon2 - lon1) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

// Thresholds (docs/DATA-ROUTES.md): corridor margin = max(150 km, 25% of route length); heading must be within 100 deg of
// the bearing to the destination, tested only at or above 10,000 ft and while more than the margin away from the destination.
export const PLAUSIBLE = { marginFrac: 0.25, marginFloorKm: 150, cruiseFt: 10000, headingTolDeg: 100 };

// Is this single leg ({from,to} airports) plausible for the plane? true when there is not enough data to say.
function legOk(a, b, plane) {
  if (!a || !b || a.icao === b.icao || (a.icao && a.icao === b.icao)) return false;
  if (a.lat == null || b.lat == null || plane?.lat == null || plane?.lon == null) return true;
  const L = hav(a.lat, a.lon, b.lat, b.lon), margin = Math.max(PLAUSIBLE.marginFloorKm, PLAUSIBLE.marginFrac * L);
  const d13 = hav(a.lat, a.lon, plane.lat, plane.lon) / R_KM;
  const t12 = bearing(a.lat, a.lon, b.lat, b.lon) * RAD, t13 = bearing(a.lat, a.lon, plane.lat, plane.lon) * RAD;
  const xt = Math.asin(Math.max(-1, Math.min(1, Math.sin(d13) * Math.sin(t13 - t12)))) * R_KM;
  const along = (Math.cos(t13 - t12) < 0 ? -1 : 1) * Math.acos(Math.max(-1, Math.min(1, Math.cos(d13) / Math.cos(xt / R_KM)))) * R_KM;
  if (Math.abs(xt) > margin || along < -margin || along > L + margin) return false;
  const ft = plane.altFt ?? plane.altitude ?? (typeof plane.alt_baro === 'number' ? plane.alt_baro : null);
  if (typeof plane.track === 'number' && ft != null && ft >= PLAUSIBLE.cruiseFt && hav(plane.lat, plane.lon, b.lat, b.lon) > margin) {
    const diff = Math.abs(((bearing(plane.lat, plane.lon, b.lat, b.lon) - plane.track + 540) % 360) - 180);
    if (diff > PLAUSIBLE.headingTolDeg) return false;
  }
  return true;
}

// The route with from/to set to the leg the plane is plausibly on (best corridor fit among the legs of A-B-C), or null.
export function routeForPlane(route, plane) {
  if (!route?.from || !route?.to) return null;
  const stops = route.airports?.length >= 2 ? route.airports : [route.from, route.to];
  let best = null, bestScore = Infinity;
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i], b = stops[i + 1];
    if (!legOk(a, b, plane)) continue;
    const score = a.lat == null || plane?.lat == null ? i : hav(plane.lat, plane.lon, (a.lat + b.lat) / 2, (a.lon + b.lon) / 2) / Math.max(1, hav(a.lat, a.lon, b.lat, b.lon));
    if (score < bestScore) { best = [a, b]; bestScore = score; }
  }
  return best ? { ...route, from: best[0], to: best[1] } : null;
}

// true when the route (or one of its legs) is plausible for this plane.
export function routePlausible(route, plane) { return !!routeForPlane(route, plane); }

// Great-circle distance in km between two airports (null if either has no position).
export function routeKm(r) {
  const a = r?.from, b = r?.to;
  if (a?.lat == null || b?.lat == null) return null;
  return Math.round(hav(a.lat, a.lon, b.lat, b.lon));
}
