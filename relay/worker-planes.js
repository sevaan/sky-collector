// Sky Collector's plane relay (2026-11-15): a Cloudflare Worker on Sevaan's personal account, never Roundtrip's.
// The plane feeds don't allow websites to read them directly (no CORS), so the test site asks this instead.
//   GET /planes?lat&lon&dist   live aircraft near a point. adsb.lol (ODbL, "© adsb.lol contributors"), adsb.fi and airplanes.live
//                              asked at once, merged by hex (newest position wins), with a `sources` field. Cached 8 s per 0.1° square so nearby players share one request.
// Only rounded coordinates are ever sent upstream. Deploy: npx wrangler deploy -c relay/wrangler-planes.toml
// Commercial-use terms for both feeds are still to be checked before launch (docs/RESEARCH-PLAN.md, phase 1).
const ALLOWED = [/^https:\/\/sevaan\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https:\/\/localhost$/];
const UA = 'SkyCollector/0.1 (+https://github.com/sevaan/sky-collector)';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), origin = req.headers.get('Origin') ?? '';
    const ok = ALLOWED.some((re) => re.test(origin));
    const cors = ok ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });
    if (origin && !ok) return new Response('Forbidden', { status: 403 });
    const path = url.pathname.replace(/\/$/, '');
    if (path !== '/planes' || req.method !== 'GET') return new Response('not found', { status: 404, headers: cors });
    const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return new Response('bad lat/lon', { status: 400, headers: cors });
    const la = lat.toFixed(1), lo = lon.toFixed(1), d = Math.min(100, Math.max(1, Math.round(Number(url.searchParams.get('dist') ?? 40))));
    const key = new Request(`https://cache.skycollector/planes/${la},${lo},${d}`), cache = caches.default;
    let res = await cache.match(key);
    if (!res) {
      const body = await upstream(la, lo, d);
      if (!body) return new Response('planes unavailable', { status: 502, headers: cors });
      res = new Response(body.text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=8', 'X-Source': body.src } });
      ctx.waitUntil(cache.put(key, res.clone()));
    }
    const h = new Headers(res.headers); for (const [k, v] of Object.entries(cors)) h.set(k, v); h.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: 200, headers: h });
  },
};

const FEEDS = [
  ['adsblol', 'adsb.lol', (la, lo, d) => `https://api.adsb.lol/v2/point/${la}/${lo}/${d}`],
  ['adsbfi', 'adsb.fi', (la, lo, d) => `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${d}`],
  ['airplaneslive', 'airplanes.live', (la, lo, d) => `https://api.airplanes.live/v2/point/${la}/${lo}/${d}`],
];

async function upstream(la, lo, d) {
  const got = await Promise.all(FEEDS.map(async ([id, , mk]) => {
    try {
      const r = await fetch(mk(la, lo, d), { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) return { id, j: null };
      const t = await r.text();
      return { id, j: t.startsWith('{') ? JSON.parse(t) : null };
    } catch { return { id, j: null }; }
  }));
  const merged = mergeFeeds(got);
  if (!merged) return null;
  return { src: FEEDS.filter(([id]) => got.find((g) => g.id === id)?.j).map(([, name]) => name).join('+'), text: JSON.stringify(merged) };
}

// Merge the feeds' answers by hex. Each aircraft's position time is the feed's `now` minus its seen_pos (or seen); the
// newest wins, ties keep the earlier feed (adsb.lol). Returns null when no feed answered.
// Keep identical to mergeFeeds in relay/planes.ts (tests/relay-merge.test.mjs covers this copy).
export function mergeFeeds(got) {
  const ok = got.filter((g) => g.j && Array.isArray(g.j.ac ?? g.j.aircraft));
  if (!ok.length) return null;
  const ms = (n) => (n < 1e12 ? n * 1000 : n);
  const now = Math.max(...ok.map((g) => ms(Number(g.j.now) || Date.now())));
  const best = new Map();
  const sources = { adsblol: 0, adsbfi: 0, airplaneslive: 0 };
  for (const g of ok) {
    const fnow = ms(Number(g.j.now) || Date.now()), list = g.j.ac ?? g.j.aircraft;
    sources[g.id] = list.length;
    for (const a of list) {
      if (!a?.hex) continue;
      const t = a.lat == null || a.lon == null ? -Infinity : fnow - (a.seen_pos ?? a.seen ?? 0) * 1000, cur = best.get(a.hex);
      if (!cur || t > cur.t) best.set(a.hex, { a, t });
    }
  }
  const ac = [...best.values()].map(({ a, t }) => (Number.isFinite(t) ? { ...a, seen_pos: Math.max(0, Math.round(now - t) / 1000) } : a));
  return { now, ac, total: ac.length, sources: { ...sources, merged: ac.length } };
}
