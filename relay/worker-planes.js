// Sky Collector's plane relay (2026-11-15): a Cloudflare Worker on Sevaan's personal account, never Roundtrip's.
// The plane feeds don't allow websites to read them directly (no CORS), so the test site asks this instead.
//   GET /planes?lat&lon&dist   live aircraft near a point. adsb.lol first (ODbL, "© adsb.lol contributors"), adsb.fi if
//                              adsb.lol turns us away. Cached 8 s per 0.1° square so nearby players share one request.
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

async function upstream(la, lo, d) {
  const tries = [
    ['adsb.lol', `https://api.adsb.lol/v2/point/${la}/${lo}/${d}`],
    ['adsb.fi', `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${d}`],
  ];
  for (const [src, u] of tries) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
      if (r.ok) { const text = await r.text(); if (text.startsWith('{')) return { src, text }; }
    } catch {}
  }
  return null;
}
