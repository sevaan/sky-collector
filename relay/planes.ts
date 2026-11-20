// Sky Collector plane relay (2026-11-15): the request handler. Runs on Val Town (val sevaan/sky-collector-planes); relay/deno-planes.ts serves it on Deno if needed.
// The plane feeds don't allow websites to read them directly, so the test site asks this instead.
//   GET /?lat&lon&dist  live aircraft near a point: asks adsb.lol (ODbL), adsb.fi and airplanes.live at once (4 s each),
//   merges by hex (newest position wins) and says which answered: {now, ac, total, sources:{adsblol,adsbfi,airplaneslive,merged}}.
// Only rounded coordinates are sent upstream. Commercial-use terms are still to be checked (docs/RESEARCH-PLAN.md).
const ALLOWED = [/^https:\/\/sevaan\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https:\/\/localhost$/];
const UA = "SkyCollector/0.1 (+https://github.com/sevaan/sky-collector)";
const memo = new Map<string, { at: number; body: string; src: string }>();
const FEEDS: [string, string, (la: string, lo: string, d: number) => string][] = [
  ["adsblol", "adsb.lol", (la, lo, d) => `https://api.adsb.lol/v2/point/${la}/${lo}/${d}`],
  ["adsbfi", "adsb.fi", (la, lo, d) => `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${d}`],
  ["airplaneslive", "airplanes.live", (la, lo, d) => `https://api.airplanes.live/v2/point/${la}/${lo}/${d}`],
];

export default async function (req: Request): Promise<Response> {
  const url = new URL(req.url), origin = req.headers.get("Origin") ?? "";
  const ok = ALLOWED.some((re) => re.test(origin));
  const cors: Record<string, string> = ok ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET" } });
  if (origin && !ok) return new Response("Forbidden", { status: 403 });
  const lat = Number(url.searchParams.get("lat")), lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return new Response("Sky Collector plane relay. Ask /?lat=..&lon=..&dist=..", { status: 400, headers: cors });
  }
  const la = lat.toFixed(1), lo = lon.toFixed(1), d = Math.min(100, Math.max(1, Math.round(Number(url.searchParams.get("dist") ?? 40))));
  const key = `${la},${lo},${d}`, hit = memo.get(key);
  if (hit && Date.now() - hit.at < 8000) return send(hit.body, hit.src, cors);
  const got = await Promise.all(FEEDS.map(async ([id, , mk]) => {
    try {
      const r = await fetch(mk(la, lo, d), { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) return { id, j: null };
      const t = await r.text();
      return { id, j: t.startsWith("{") ? JSON.parse(t) : null };
    } catch { return { id, j: null }; }
  }));
  const merged = mergeFeeds(got);
  if (merged) {
    const src = FEEDS.filter(([id]) => got.find((g) => g.id === id)?.j).map(([, name]) => name).join("+");
    const body = JSON.stringify(merged);
    memo.set(key, { at: Date.now(), body, src });
    if (memo.size > 500) memo.delete(memo.keys().next().value!);
    return send(body, src, cors);
  }
  return new Response("planes unavailable", { status: 502, headers: cors });
}

function send(body: string, src: string, cors: Record<string, string>) {
  return new Response(body, { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Source": src } });
}

// Merge the feeds' answers by hex. Each aircraft's position time is the feed's `now` minus its seen_pos (or seen); the
// newest wins, ties keep the earlier feed (adsb.lol). Returns null when no feed answered.
// Keep identical to mergeFeeds in relay/worker-planes.js (tests/relay-merge.test.mjs covers that copy).
// deno-lint-ignore no-explicit-any
const DB_KEYS = ['t', 'desc', 'r', 'ownOp', 'year', 'category'];
export function mergeFeeds(got: { id: string; j: any }[]) {
  // deno-lint-ignore no-explicit-any
  const ok = got.filter((g) => g.j && Array.isArray(g.j.ac ?? g.j.aircraft)) as { id: string; j: any }[];
  if (!ok.length) return null;
  const ms = (n: number) => (n < 1e12 ? n * 1000 : n);
  const now = Math.max(...ok.map((g) => ms(Number(g.j.now) || Date.now())));
  // deno-lint-ignore no-explicit-any
  const best = new Map<string, { a: any; t: number }>();
  // deno-lint-ignore no-explicit-any
  const db = new Map<string, any>();
  const sources: Record<string, number> = { adsblol: 0, adsbfi: 0, airplaneslive: 0 };
  for (const g of ok) {
    const fnow = ms(Number(g.j.now) || Date.now()), list = g.j.ac ?? g.j.aircraft;
    sources[g.id] = list.length;
    for (const a of list) {
      if (!a?.hex) continue;
      const t = a.lat == null || a.lon == null ? -Infinity : fnow - (a.seen_pos ?? a.seen ?? 0) * 1000, cur = best.get(a.hex);
      if (!cur || t > cur.t) best.set(a.hex, { a, t });
      const d = db.get(a.hex) ?? db.set(a.hex, {}).get(a.hex);
      for (const k of DB_KEYS) if (d[k] == null && a[k] != null && a[k] !== '') d[k] = a[k];
      if (a.dbFlags != null) d.dbFlags = (Number(d.dbFlags) || 0) | (Number(a.dbFlags) || 0);
    }
  }
  /* the aircraft's database fields from whichever feed had them (QA 2026-11-20: a private Cessna 172 came out with no type
     when the freshest record, often a TIS-B one, carried none), and its privacy flags from every feed */
  const fill = (a: any) => { const d = db.get(a.hex); if (!d) return a; const o = { ...a }; for (const k of DB_KEYS) if ((o[k] == null || o[k] === '') && d[k] != null) o[k] = d[k]; if (d.dbFlags != null) o.dbFlags = d.dbFlags; return o; };
  const ac = [...best.values()].map(({ a, t }) => (Number.isFinite(t) ? { ...fill(a), seen_pos: Math.max(0, Math.round(now - t) / 1000) } : fill(a)));
  return { now, ac, total: ac.length, sources: { ...sources, merged: ac.length } };
}
