// The sample pack's stand-in flights (js/pack-flights.js, 2026-11-18): when the page can't get a live flight over the
// visitor's city in time (relay slow or down, nothing usable overhead), its first card is a real flight that Sky's relay
// saw over the nearest of these hubs. This asks the relay about each hub now, picks a flight the same way the page does
// (js/pack-flight.js rankFlights + the bundled routes), and writes what was seen and when. Nothing is made up: the card
// says "Seen over <hub> on <date>". Re-run it now and then so the dates stay recent.
// Usage: node scripts/build-pack-flights.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { RELAY, rankFlights, normalize } = await import('../js/pack-flight.js');
const { lookupRoute, setRouteLoader } = await import('../js/routes.js');
const { airlinePhoto } = await import('../js/airline-photos.js');
const { airlineLogo } = await import('../js/airline-logos.js');
const { airlineName, loadAirlines } = await import('../js/planes.js');
setRouteLoader(async (rel) => { try { return readFileSync(join(ROOT, 'data/routes', rel), 'utf8'); } catch { return null; } });
await loadAirlines();
const hasArt = (a3, type) => !!(airlinePhoto(a3, type) && airlineLogo(a3));

// Big airports' cities, spread so every time zone city is within reach of one (lat, lon of the city centre).
const HUBS = [
  ['Toronto', 43.65, -79.38], ['Montreal', 45.5, -73.57], ['Vancouver', 49.28, -123.12], ['Calgary', 51.05, -114.07],
  ['New York', 40.71, -74.01], ['Chicago', 41.88, -87.63], ['Atlanta', 33.75, -84.39], ['Dallas', 32.78, -96.8], ['Denver', 39.74, -104.99],
  ['Los Angeles', 34.05, -118.24], ['San Francisco', 37.77, -122.42], ['Miami', 25.76, -80.19], ['Seattle', 47.61, -122.33], ['Honolulu', 21.31, -157.86],
  ['Mexico City', 19.43, -99.13], ['Bogotá', 4.71, -74.07], ['Lima', -12.05, -77.04], ['São Paulo', -23.55, -46.63], ['Buenos Aires', -34.6, -58.38], ['Santiago', -33.45, -70.67],
  ['London', 51.51, -0.13], ['Dublin', 53.35, -6.26], ['Paris', 48.86, 2.35], ['Amsterdam', 52.37, 4.9], ['Frankfurt', 50.11, 8.68], ['Madrid', 40.42, -3.7],
  ['Rome', 41.9, 12.5], ['Zurich', 47.38, 8.54], ['Copenhagen', 55.68, 12.57], ['Warsaw', 52.23, 21.01], ['Athens', 37.98, 23.73], ['Istanbul', 41.01, 28.98],
  ['Dubai', 25.2, 55.27], ['Doha', 25.29, 51.53], ['Cairo', 30.04, 31.24], ['Johannesburg', -26.2, 28.05], ['Nairobi', -1.29, 36.82], ['Lagos', 6.52, 3.38], ['Casablanca', 33.57, -7.59],
  ['New Delhi', 28.61, 77.21], ['Mumbai', 19.08, 72.88], ['Singapore', 1.35, 103.82], ['Bangkok', 13.76, 100.5], ['Kuala Lumpur', 3.14, 101.69], ['Jakarta', -6.21, 106.85],
  ['Hong Kong', 22.32, 114.17], ['Shanghai', 31.23, 121.47], ['Beijing', 39.9, 116.41], ['Taipei', 25.03, 121.57], ['Seoul', 37.57, 126.98], ['Tokyo', 35.68, 139.69], ['Manila', 14.6, 120.98],
  ['Sydney', -33.87, 151.21], ['Melbourne', -37.81, 144.96], ['Brisbane', -27.47, 153.03], ['Perth', -31.95, 115.86], ['Auckland', -36.85, 174.76],
];
const out = [];
/* a hub with nothing usable right now (night there, a quiet hour) keeps the flight it had last time, with its own date */
const before = await import('../js/pack-flights.js').then((m) => m.PACK_FLIGHTS).catch(() => []);
for (const [hub, lat, lon] of HUBS) {
  let row = null;
  try {
    const r = await fetch(`${RELAY}?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&dist=40`, { headers: { Origin: 'https://skycollector.app' }, signal: AbortSignal.timeout(15000) });
    const json = r.ok ? await r.json() : null;
    for (const p of rankFlights(normalize(json), { lat, lon }, hasArt).slice(0, 8)) {
      const route = await lookupRoute(p.callsign, p);
      if (route?.from && route?.to) {
        row = { hub, lat, lon, seen: Math.round(json.now < 1e12 ? json.now * 1000 : json.now), plane: { callsign: p.callsign, type: p.type, reg: p.reg, category: p.category, lat: +p.lat.toFixed(3), lon: +p.lon.toFixed(3), altFt: p.altFt, gs: Math.round(p.gs), track: Math.round(p.track) },
          airline: airlineName(p.callsign), route: { callsign: route.callsign, from: route.from, to: route.to, stops: route.stops } }; /* the route as the game resolved it, so the page needs no lookup */
        break;
      }
    }
  } catch (e) { console.warn(hub, String(e).slice(0, 80)); }
  console.log(hub.padEnd(14), row ? `${row.plane.callsign} ${row.plane.type} ${row.route.from.icao}-${row.route.to.icao} ${row.plane.altFt} ft (${row.airline})` : '— nothing usable');
  if (!row) { row = before.find((x) => x.hub === hub) ?? null; if (row) console.log('  kept the earlier one, seen', new Date(row.seen).toISOString().slice(0, 10)); }
  if (row) out.push(row);
  await new Promise((ok) => setTimeout(ok, 2100)); // the relay allows 30 requests a minute
}
const js = `// The sample pack's stand-in flights: real flights Sky's relay saw over these cities, with when. Generated by
// scripts/build-pack-flights.mjs (${new Date().toISOString().slice(0, 10)}); the page uses the nearest one when it can't get a live flight in time.
export const PACK_FLIGHTS = ${JSON.stringify(out, null, 0).replace(/\},\{"hub"/g, '},\n  {"hub"').replace(/^\[/, '[\n  ').replace(/\]$/, ',\n]')};
`;
writeFileSync(join(ROOT, 'js/pack-flights.js'), js);
console.log(out.length, 'of', HUBS.length, 'hubs');
