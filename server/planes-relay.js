// Sky Collector's plane relay (2026-11-18, Sevaan): live aircraft near a player, from FlyItalyADSB (CC BY-SA 4.0;
// commercial use allowed on every plan and a cache on our own server allowed: flyitalyadsb.com/data/api/docs/commercial-use).
// The key is the FLYITALY_KEY env var of the Cloud Run service (from Secret Manager; server/index.js), never in the app. No second feed:
// adsb.fi and airplanes.live say non-commercial (docs/DATA-TERMS.md) and adsb.lol turns cloud servers away. When
// FlyItalyADSB says no, the last answer stands in for up to STALE_S, then the app is told the feed is down.
// Left out: records whose `type` is "other" (review 2026-11-18). Near Peterborough they carried metres and km/h where
// the feed's documentation says feet and knots (the same aircraft was 4,050 ft on adsb.fi and "1358" here; parked
// aircraft read 190 to 192, the airport's height in metres, with no "ground"), while one near New York was in feet. A
// plane drawn at a third of its height is worse than no plane, so they stay out until FlyItalyADSB says what they are.
// One request for many players: the world is cut into 1-degree squares; the relay asks for one circle that covers the
// whole square plus a player's range (TILE_KM) and every player in that square gets their own part of it. Only the
// square's centre is ever sent upstream, never a player's place.
// Budget: the free plan is 300,000 requests a month and 30 a minute. A square is refreshed at most every 15 s while
// someone is playing in it, and less often (up to MAX_TTL) when the month's count runs ahead of the calendar, when the
// minute limit was hit, or when more squares are busy than 30 a minute can refresh; the app moves planes along their
// track between answers, and drops a plane it has not heard about for 60 s, which is why MAX_TTL stops at 40. The cache is this instance's memory:
// a second instance keeps its own, which costs a few extra requests and nothing else (the month's count comes from
// FlyItalyADSB's own headers). No DOM, no dependencies. Tests: tests/relay-tiles.test.mjs.
const MAX_KM = 80;   // the furthest a player may ask for (the app asks for 40 nm, 74 km)
const TILE_KM = 160; // one circle from a square's centre: its half-diagonal (79 km at the equator) + MAX_KM
const STALE_S = 50;  // how long the last answer may stand in when the feed says no (the app drops planes at 60 s)
const MAX_TTL = 40;  // the slowest a busy square is refreshed
const RETRY_S = 10;  // after a failed refresh, how long before that square asks again
const FIA = 'https://api.flyitalyadsb.com/v2';
const UA = 'SkyCollector/0.1 (https://skycollector.app)';

// The 1-degree square a place is in, by its centre.
export function tileOf(lat, lon) {
  const la = Math.max(-89.5, Math.min(89.5, Math.floor(lat) + 0.5)), lo = Math.max(-179.5, Math.min(179.5, Math.floor(lon) + 0.5));
  return { la, lo, key: `${la},${lo}` };
}

// Great-circle distance in km.
export function distKm(la1, lo1, la2, lo2) {
  const R = Math.PI / 180, dla = (la2 - la1) * R, dlo = (lo2 - lo1) * R;
  const h = Math.sin(dla / 2) ** 2 + Math.cos(la1 * R) * Math.cos(la2 * R) * Math.sin(dlo / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Seconds a square's answer is kept. From the month's count (FlyItalyADSB's X-FIA-Used-Month / X-FIA-Quota-Month
// headers, kept as { used, quota, perMin, hot }): 15 s while the count is on pace with the calendar, slower as it runs
// ahead, so the month never runs out early; 30 s for a minute after the per-minute limit was hit (hot = when that
// ends). And from how many squares are busy: `busy` squares each refreshed every ttl seconds must fit in 80% of the
// minute limit, or some squares would never get an answer.
export function ttlFor(budget, nowMs = Date.now(), busy = 1) {
  let ttl = 15;
  if (budget && budget.quota > 0) {
    const d = new Date(nowMs), start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    const month = (nowMs - start) / (end - start), used = budget.used / budget.quota, ahead = used - month;
    if (used >= 0.97 || ahead > 0.15) ttl = MAX_TTL;
    else if (ahead > 0.05 || budget.hot > nowMs) ttl = 30;
  }
  const perMin = (budget?.perMin > 0 ? budget.perMin : 30) * 0.8;
  return Math.min(MAX_TTL, Math.max(ttl, Math.ceil((busy * 60) / perMin)));
}

// A player's part of a square's answer: the aircraft with a position within km of them.
export function slice(all, lat, lon, km) {
  return all.ac.filter((a) => a.lat != null && a.lon != null && distKm(lat, lon, a.lat, a.lon) <= km);
}

const tiles = new Map(); // square → { at, asked, failed, all: { now (ms), ac }, src, skipped }
const flying = new Map(); // square → the request in flight, so players arriving together share it
let budget = null;
export const relayState = () => ({ budget, squares: tiles.size });
export const resetRelay = () => { tiles.clear(); flying.clear(); budget = null; }; // tests

const ms = (n) => (n < 1e12 ? n * 1000 : n);
const shape = (j) => { const list = j?.ac ?? j?.aircraft; if (!Array.isArray(list)) return null; const ac = list.filter((a) => a?.type !== 'other'); return { now: ms(Number(j.now) || Date.now()), ac, skipped: list.length - ac.length }; };

// One circle for the square. Returns { all, src } or null when FlyItalyADSB did not answer.
async function upstream(tile, key, fetchFn) {
  if (!key) { console.warn('planes: no FLYITALY_KEY'); return null; }
  try {
    const r = await fetchFn(`${FIA}/lat/${tile.la}/lon/${tile.lo}/dist/${TILE_KM}`, { headers: { 'X-Api-Key': key, 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(4500) });
    const used = Number(r.headers.get('X-FIA-Used-Month')), quota = Number(r.headers.get('X-FIA-Quota-Month')), perMin = Number(r.headers.get('X-FIA-Limit-Per-Min'));
    if (quota > 0) budget = { used, quota, perMin, hot: budget?.hot ?? 0 };
    if (r.status === 429) { budget = { used: budget?.used ?? 0, quota: budget?.quota ?? 300000, perMin: budget?.perMin ?? 30, hot: Date.now() + 60000 }; console.warn('planes: FlyItalyADSB 429', budget.used, 'of', budget.quota); return null; }
    if (r.ok) { const all = shape(await r.json()); if (all) return { all, src: 'flyitaly' }; }
    console.warn('planes: FlyItalyADSB', r.status);
  } catch (e) { console.warn('planes: FlyItalyADSB threw', e?.name, e?.message); }
  return null;
}

// The aircraft within distNm nautical miles of a place (the app asks in nautical miles; at most 80 km is given).
// Returns { status: 200, body: { now, ac, total, sources, age, ttl }, stale } or { status: 502 }.
export async function planesNear(lat, lon, distNm, key, fetchFn = fetch) {
  const km = Math.min(MAX_KM, Math.max(1, (Number(distNm) || 40) * 1.852)), tile = tileOf(lat, lon), now = Date.now();
  let hit = tiles.get(tile.key);
  if (!hit) { hit = { at: 0, asked: 0, failed: 0, all: null }; tiles.set(tile.key, hit); }
  hit.asked = now;
  let busy = 0; for (const v of tiles.values()) if (now - v.asked < 60000) busy++; // squares someone asked about in the last minute
  const ttl = ttlFor(budget, now, busy);
  if ((!hit.all || now - hit.at > ttl * 1000) && now - hit.failed > RETRY_S * 1000) { // due, and not just refused: a feed that is down is not asked again by every player's next request
    let p = flying.get(tile.key);
    if (!p) { p = upstream(tile, key, fetchFn).finally(() => flying.delete(tile.key)); flying.set(tile.key, p); }
    const got = await p;
    if (got) { hit.at = Date.now(); hit.failed = 0; hit.all = got.all; hit.src = got.src; }
    else hit.failed = Date.now();
    if (tiles.size > 300) for (const [k, v] of tiles) if (Date.now() - v.asked > 120000) tiles.delete(k);
  }
  const age = Date.now() - hit.at;
  if (!hit.all || age > STALE_S * 1000) return { status: 502 }; // nothing recent enough to stand in
  const ac = slice(hit.all, lat, lon, km);
  return { status: 200, stale: age > ttl * 1000, body: { now: hit.all.now, ac, total: ac.length, sources: { [hit.src]: hit.all.ac.length, here: ac.length, skipped: hit.all.skipped }, age: Math.round(age / 1000), ttl } };
}
