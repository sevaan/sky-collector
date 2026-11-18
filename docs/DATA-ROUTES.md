# Flight route data (js/routes.js)

## What is bundled
Virtual Radar Server standing data, CC0 (https://github.com/vradarserver/standing-data), reduced to what the game reads:
- `data/routes/r/<AAA>.json`: one shard per ICAO airline prefix (1521 files), `{ "<callsign minus prefix>": "ICAO-ICAO[-ICAO]" }`. 482,869 routes.
- `data/routes/airports.json`: the 3,794 airports those routes use, `ICAO: [IATA, name, city, country, lat, lon]`.
- `data/routes/index.json`: build date and counts.

Licence line: Flight routes: Virtual Radar Server standing data, CC0 1.0 (already credited in the app's About list).

`js/routes.js` loads `r/<prefix>.json` for the callsign's airline and `airports.json` (once), no GitHub call. If a bundled
file cannot be loaded (missing shard, offline-cache miss, bad JSON) it falls back to the live GitHub CSVs as before.

## Sizes
- In the repo: about 9.5 MB of bytes (9.1 MB shards + 0.3 MB airports); about 13.8 MB on disk because of 1521 small files.
- Over the wire with gzip (GitHub Pages gzips JSON): all shards about 2.3 MB, airports about 110 KB.
- Typical phone session: airports.json (~110 KB gzipped) + a handful of shards (ACA ~15 KB, UAL ~39 KB gzipped, most under 15 KB), so roughly 150-300 KB.

## Refresh
`node scripts/routes/build-routes.mjs` (shallow-clones the standing data; or pass a path to an existing clone). Then commit data/routes.
Do it every month or two; routes change slowly.

## Plausibility rules (routePlausible, routeForPlane, lookupRoute(callsign, plane))
A route that fails is unknown (no flight card), never shown wrong. Thresholds are in `PLAUSIBLE` in js/routes.js.
1. From and to must be different airports (also applied with no plane).
2. Corridor: with L the great-circle length, margin = max(150 km, 25% of L). The plane's cross-track distance from the great circle must be <= margin, and its along-track position must lie between -margin and L + margin.
3. Heading, only at >= 10,000 ft (below that planes manoeuvre) and more than margin from the destination: track within 100 degrees of the bearing to the destination.
4. Multi-leg (A-B-C): each consecutive leg is tested; the plausible leg with the best fit (plane closest to the leg's midpoint relative to its length) becomes from/to. Without a plane, first-to-last is kept (first leg for A-B-A).
5. If the plane position or airport coordinates are missing, only rule 1 applies.
Altitude is read from `plane.altFt`, else `plane.altitude`, else numeric `plane.alt_baro`.
