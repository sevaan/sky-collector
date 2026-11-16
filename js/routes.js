// Flight routes for Sky Collector, straight from the phone (2026-11-15): Virtual Radar Server's standing data (CC0,
// github.com/vradarserver/standing-data), served by GitHub with CORS open, so no server of ours is needed.
// One CSV per airline (routes/schema-01/A/ACA-all.csv: Callsign,…,AirportCodes "CYYZ-EGLL") and one per two-letter
// ICAO prefix for airports (airports/schema-01/C/CY.csv). Only the callsign's airline file is fetched, never your
// position. Files are kept for the session; a route is { from, to } airports or null when the data has none.
// No DOM here.

const SD = 'https://raw.githubusercontent.com/vradarserver/standing-data/main/';
const files = new Map(); // path -> Promise<Map<code,row>>

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

function csv(path) {
  if (files.has(path)) return files.get(path);
  const p = fetch(SD + path, { signal: AbortSignal.timeout?.(8000) })
    .then((r) => (r.ok ? r.text() : ''))
    .then((txt) => {
      const rows = new Map(), table = parseCsv(txt.replace(/^\uFEFF/, ''));
      const head = table.shift() ?? [];
      for (const v of table) { const o = {}; head.forEach((k, i) => (o[k] = v[i])); rows.set(v[0], o); }
      return rows;
    })
    .catch(() => { files.delete(path); return new Map(); }); // a failed fetch is tried again next time
  files.set(path, p);
  return p;
}

export async function airport(icao) {
  if (!/^[A-Z0-9]{4}$/.test(icao ?? '')) return null;
  const a = (await csv(`airports/schema-01/${icao[0]}/${icao.slice(0, 2)}.csv`)).get(icao);
  if (!a) return { icao, iata: '', name: '', city: icao, cc: '', lat: null, lon: null };
  return { icao, iata: a.IATA || '', name: a.Name || '', city: a.Location || a.Name || icao, cc: a.CountryISO2 || '',
    lat: a.Latitude ? +a.Latitude : null, lon: a.Longitude ? +a.Longitude : null };
}

// { callsign, from, to, stops } or null. Multi-stop flights keep their first and last airport.
export async function lookupRoute(callsign) {
  if (!/^[A-Z]{3}\d/.test(callsign ?? '')) return null;
  const row = (await csv(`routes/schema-01/${callsign[0]}/${callsign.slice(0, 3)}-all.csv`)).get(callsign);
  const codes = row?.AirportCodes?.split('-').filter(Boolean) ?? [];
  if (codes.length < 2) return null;
  const [from, to] = await Promise.all([airport(codes[0]), airport(codes[codes.length - 1])]);
  return { callsign, from, to, stops: codes.length };
}

// Great-circle distance in km between two airports (null if either has no position).
export function routeKm(r) {
  const a = r?.from, b = r?.to;
  if (a?.lat == null || b?.lat == null) return null;
  const R = Math.PI / 180, s = Math.sin((b.lat - a.lat) * R / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin((b.lon - a.lon) * R / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(s)));
}
