// A week of play, simulated (2026-11-19, docs/DESIGN-LOOP.md §4 "the first rank-up lands on day 2"): catches from the
// recorded Toronto feed (scripts/perf/fixtures/planes-yyz.json) on real routes, made into sightings the way main.js
// capturePlane does, scored by js/progress.js. Prints XP, rank, missions and patches day by day.
//   node scripts/sim/week.mjs [catches on day 1] [catches on later days] [days]
import { readFileSync } from 'node:fs';
const store = {}; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const [D1 = 6, DN = 4, DAYS = 7] = process.argv.slice(2).map(Number);
const ROOT = new URL('../../', import.meta.url);
const r = await import('../../js/routes.js'); r.setRouteLoader(async (rel) => { try { return readFileSync(new URL(`data/routes/${rel}`, ROOT), 'utf8'); } catch { return null; } });
const { parsePlanes, loadAirlines, airlineName } = await import('../../js/planes.js'); await loadAirlines?.();
const { cardsFor } = await import('../../js/flights.js');
const { catchSightings } = await import('../../js/sky-cards.js');
const { progress, setSkyProgress } = await import('../../js/progress.js'); setSkyProgress(true);
const feed = JSON.parse(readFileSync(new URL('scripts/perf/fixtures/planes-yyz.json', ROOT), 'utf8'));
const planes = parsePlanes({ ...feed, now: Date.now() });
let seed = 7; const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296);
const models = new Map(), list = [], start = new Date(2026, 10, 2, 18, 0).getTime(); // a Monday evening
const caughtDay = new Map();
console.log('day | catches | cards | XP (+day) | rank | missions done today | patches (new today)');
let prevXp = 0, prevPatches = new Set();
for (let d = 0; d < DAYS; d++) {
  const n = d === 0 ? D1 : DN, pool = planes.slice().sort(() => rnd() - 0.5);
  let made = 0;
  for (const p0 of pool) {
    if (made >= n) break;
    const key = `${p0.hex}|${d}`; if (caughtDay.has(key)) continue;
    /* another airframe on the same flight on later days, as at a real airport */
    const p = { ...p0, hex: p0.anon ? p0.hex : `${p0.hex}${d % 3}` };
    const rt = p.callsign ? await r.lookupRoute(p.callsign).catch(() => null) : null;
    const { flight, plane } = cardsFor(p, rt, airlineName?.(p.callsign) || '');
    const t = start + d * 86400e3 + made * 150e3;
    const sl = catchSightings({ time: t, hex: p.hex, callsign: p.callsign, type: p.type, altFt: p.altFt, lat: 43.66, lon: -79.58, flight, plane });
    for (const m of [flight, plane]) if (m) models.set(m.key, m);
    for (const s of sl) list.push({ ...s, sim: false });
    caughtDay.set(key, 1); made++;
  }
  const now = start + d * 86400e3 + 3 * 3600e3;
  const pr = progress(list, (k) => models.get(k) ?? { tier: 'common' }, { now, lon: -79.58, keep: false });
  const pts = new Set(pr.achievements.filter((x) => x.done).map((x) => x.id)), fresh = [...pts].filter((x) => !prevPatches.has(x));
  console.log(`${d + 1} | ${made} | ${new Set(list.map((s) => s.cardKey)).size} | ${pr.xp} (+${pr.xp - prevXp}) | ${pr.rank?.name ?? pr.rank?.[1] ?? JSON.stringify(pr.rank).slice(0, 30)} | ${pr.missions.filter((m) => m.done).length}/${pr.missions.length} | ${pts.size} (${fresh.join(', ')})`);
  prevXp = pr.xp; prevPatches = pts;
}
