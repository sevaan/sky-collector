// Sky Collector plane relay (2026-11-15): the request handler, served by relay/deno-planes.ts on Deno Deploy.
// The plane feeds don't allow websites to read them directly, so the test site asks this instead.
//   GET /?lat&lon&dist  live aircraft near a point: adsb.lol first (ODbL), then adsb.fi, then airplanes.live.
// Only rounded coordinates are sent upstream. Commercial-use terms are still to be checked (docs/RESEARCH-PLAN.md).
const ALLOWED = [/^https:\/\/sevaan\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https:\/\/localhost$/];
const UA = "SkyCollector/0.1 (+https://github.com/sevaan/sky-collector)";
const memo = new Map<string, { at: number; body: string; src: string }>();

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
  const tries: [string, string][] = [
    ["adsb.lol", `https://api.adsb.lol/v2/point/${la}/${lo}/${d}`],
    ["adsb.fi", `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${d}`],
    ["airplanes.live", `https://api.airplanes.live/v2/point/${la}/${lo}/${d}`],
  ];
  for (const [src, u] of tries) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      const body = await r.text();
      if (!body.startsWith("{")) continue;
      memo.set(key, { at: Date.now(), body, src });
      if (memo.size > 500) memo.delete(memo.keys().next().value!);
      return send(body, src, cors);
    } catch { /* try the next feed */ }
  }
  return new Response("planes unavailable", { status: 502, headers: cors });
}

function send(body: string, src: string, cors: Record<string, string>) {
  return new Response(body, { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Source": src } });
}
