// Sky Collector's server (2026-11-18): a Cloud Run function ("api", Node 22) in Sevaan's personal project
// sky-collector-app. Its own small folder, so functions/ stays Space Collector's server, untouched, for syncs.
//   GET /planes?lat&lon&dist   live aircraft near a player (server/planes-relay.js: FlyItalyADSB, shared 1-degree squares)
//   GET /status                how many squares are in memory and the month's request count
// Deploy (personal gcloud login, never the firebase CLI):
//   gcloud functions deploy api --gen2 --runtime=nodejs22 --region=us-central1 --source=server --entry-point=api
//     --trigger-http --allow-unauthenticated --memory=512Mi --cpu=1 --concurrency=40 --max-instances=2 --set-secrets=FLYITALY_KEY=FLYITALY_KEY:latest
//     --project=sky-collector-app --account=<personal>
// max-instances=2: each instance keeps its own squares, so more instances means more requests to the feed.
import functions from '@google-cloud/functions-framework';
import { planesNear, relayState } from './planes-relay.js';

const ALLOWED = [/^https:\/\/sevaan\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https:\/\/localhost$/, /^https:\/\/(www\.)?skycollector\.app$/];

// A small per-instance rate limit per caller (Cloud Run puts the caller first in X-Forwarded-For). The app asks 6 times
// a minute; a script walking a grid of places would turn every request into one to the feed, on our key.
const hits = new Map();
function limited(req, perMin) {
  const ip = String(req.get('X-Forwarded-For') ?? req.ip ?? '').split(',')[0].trim() || '?', now = Date.now();
  let h = hits.get(ip); if (!h || now - h.at > 60e3) { h = { at: now, n: 0 }; hits.set(ip, h); if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > 60e3) hits.delete(k); }
  return ++h.n > perMin;
}

let warned = 0; // the month's count, said in the log once at each mark
function watchBudget() {
  const b = relayState().budget; if (!b?.quota) return;
  const pct = (100 * b.used) / b.quota, mark = [95, 80, 50].find((m) => pct >= m) ?? 0;
  if (mark > warned) { warned = mark; console.warn(`planes budget: ${b.used} of ${b.quota} this month (${Math.round(pct)}%)`); }
  if (mark < warned && pct < 5) warned = 0; // a new month
}

functions.http('api', async (req, res) => {
  const origin = req.get('Origin') ?? '', ok = ALLOWED.some((re) => re.test(origin));
  if (ok) { res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin'); }
  if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'GET'); return res.status(204).send(''); }
  if (origin && !ok) return res.status(403).send('Forbidden');
  const path = req.path.replace(/^\/api/, '').replace(/\/$/, '');
  try {
    if (req.method !== 'GET') return res.status(404).send('not found');
    if (path === '/status') { const s = relayState(); res.set('Cache-Control', 'no-store'); return res.json({ squares: s.squares, used: s.budget?.used ?? null, quota: s.budget?.quota ?? null }); }
    if (path !== '/planes') return res.status(404).send('not found');
    if (limited(req, 30)) return res.status(429).send('slow down');
    const lat = Number(req.query.lat), lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return res.status(400).send('bad lat/lon');
    const r = await planesNear(lat, lon, req.query.dist, process.env.FLYITALY_KEY);
    watchBudget();
    if (r.status !== 200) return res.status(502).send('planes unavailable');
    res.set('Content-Type', 'application/json'); res.set('Cache-Control', 'no-store'); if (r.stale) res.set('X-Stale', '1');
    return res.send(JSON.stringify(r.body));
  } catch (e) { console.error('api', e?.message ?? e); return res.status(502).send('error'); }
});
