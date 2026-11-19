// Sky Collector's server (2026-11-18): a Cloud Run function ("api", Node 22) in Sevaan's personal project
// sky-collector-app. Its own small folder, so functions/ stays Space Collector's server, untouched, for syncs.
//   GET /planes?lat&lon&dist   live aircraft near a player (server/planes-relay.js: FlyItalyADSB, shared 1-degree squares)
//   GET /status                how many squares are in memory and the month's request count
//   POST /t                    anonymous usage reports (js/field-notes.js) → Firestore collection sky_events (2026-11-19)
//   GET /stats?key=…           the dashboard (stats-page.js, Space Collector's, ported); the key is the STATS_KEY secret
//   POST /pack, GET /pack/<id> Send cards' short links (Space Collector's, 2026-11-19): a pack stored under a random 7-character id,
//                              Firestore sky_packs, gone after 90 days (a TTL policy on 'exp')
// Deploy (personal gcloud login, never the firebase CLI):
//   gcloud functions deploy api --gen2 --runtime=nodejs22 --region=us-central1 --source=server --entry-point=api
//     --trigger-http --allow-unauthenticated --memory=512Mi --cpu=1 --concurrency=40 --max-instances=2 --set-secrets=FLYITALY_KEY=FLYITALY_KEY:latest,STATS_KEY=STATS_KEY:latest
//     --project=sky-collector-app --account=<personal>
// max-instances=2: each instance keeps its own squares, so more instances means more requests to the feed.
import functions from '@google-cloud/functions-framework';
import { Firestore } from '@google-cloud/firestore';
import { gzipSync, gunzipSync } from 'node:zlib';
import { planesNear, relayState } from './planes-relay.js';
import { statsHtml } from './stats-page.js';
const db = new Firestore(); /* Sky's own Firestore (sky-collector-app, Native mode); never Space Collector's */

const ALLOWED = [/^https:\/\/sevaan\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https:\/\/localhost$/, /^https:\/\/(www\.)?skycollector\.app$/];

// A small per-instance rate limit per caller (Cloud Run puts the caller first in X-Forwarded-For). The app asks 6 times
// a minute; a script walking a grid of places would turn every request into one to the feed, on our key.
const hits = new Map();
function limited(req, perMin, kind = 'q') {
  const ip = `${kind}/${String(req.get('X-Forwarded-For') ?? req.ip ?? '').split(',')[0].trim() || '?'}`, now = Date.now();
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

// ---- Usage reports and the stats page: Space Collector's (functions/index.js report, statRows, stats), ported 2026-11-19
// for Sky's own project. Same rows, same snapshot cache, so fixes port both ways. Collections: sky_events, sky_statcache.
const EVENTS = 'sky_events', CACHE = 'sky_statcache', CHUNK = 900000, SLOT = 10 * 60e3;
// Sky adds 'feed' (where each session's planes came from) and 'rare' (a rare type alert) to Space's names.
const NAMES = new Set(['install', 'open', 'night', 'end', 'tour', 'motion', 'calib', 'plus', 'err', 'sky', 'help', 'remind', 'catch', 'share', 'boot', 'perm', 'secret', 'gift', 'review', 'feed', 'rare']);
async function report(body) {
  let b; try { b = JSON.parse(String(body ?? '').slice(0, 40000)); } catch { return 400; }
  const iid = String(b?.i ?? ''); if (!/^[a-f0-9]{16,40}$/.test(iid)) return 400;
  const v = String(b?.v ?? '').slice(0, 20), p = ['ios', 'android', 'web'].includes(b?.p) ? b.p : 'web', x = b?.x ? 1 : 0, now = Date.now();
  const rows = (Array.isArray(b?.e) ? b.e : []).slice(0, 60).filter((e) => Array.isArray(e) && NAMES.has(e[0]));
  if (rows.length) { const batch = db.batch(); for (const e of rows) batch.set(db.collection(EVENTS).doc(), { ts: Math.min(now, Math.max(now - 30 * 86400000, Number(e[1]) || now)), rt: now, iid, v, p, x, name: String(e[0]), d: JSON.stringify(e[2] ?? {}).slice(0, 600) }); await batch.commit(); }
  return 204;
}
/* The page reads a gzipped snapshot of the rows plus only the rows received since (Space's 2026-11-17 cost fix), and every
   instance renders the same 10-minute mark. ?rebuild=1 re-reads everything once. */
let snapMem = null;
async function loadSnapshot() {
  const meta = (await db.collection(CACHE).doc('meta').get()).data();
  if (!meta) return null;
  if (snapMem && snapMem.ver === meta.ver) return snapMem;
  const docs = await db.getAll(...Array.from({ length: meta.chunks }, (_, k) => db.collection(CACHE).doc(`c${k}`)));
  const list = JSON.parse(gunzipSync(Buffer.concat(docs.map((d) => d.data().b))).toString('utf8'));
  snapMem = { ver: meta.ver, rtUpTo: meta.rtUpTo, rows: new Map(list.map((r) => [r._id, r])) }; return snapMem;
}
async function saveSnapshot(rows, rtUpTo) {
  const keep = Date.now() - 120 * 86400e3, list = [...rows.values()].filter((r) => r.ts > keep);
  const gz = gzipSync(Buffer.from(JSON.stringify(list), 'utf8')), n = Math.max(1, Math.ceil(gz.length / CHUNK)), ver = `${Date.now()}`;
  const batch = db.batch();
  for (let k = 0; k < n; k++) batch.set(db.collection(CACHE).doc(`c${k}`), { b: gz.subarray(k * CHUNK, (k + 1) * CHUNK) });
  batch.set(db.collection(CACHE).doc('meta'), { ver, chunks: n, rtUpTo, rows: list.length, at: Date.now() });
  await batch.commit();
  snapMem = { ver, rtUpTo, rows: new Map(list.map((r) => [r._id, r])) };
}
async function statRows(at, rebuild) {
  const snap = rebuild ? null : await loadSnapshot().catch((e) => { console.warn('stats snapshot', e?.message); return null; });
  if (!snap) {
    const all = await db.collection(EVENTS).where('ts', '>', at - 120 * 86400e3).get();
    const rows = new Map(all.docs.map((d) => [d.id, { ...d.data(), _id: d.id }])), mark = Date.now() - 60e3;
    await saveSnapshot(rows, mark).catch((e) => console.warn('stats snapshot save', e?.message));
    return [...rows.values()];
  }
  const fresh = await db.collection(EVENTS).where('rt', '>', snap.rtUpTo - 60e3).get();
  const rows = new Map(snap.rows); let added = 0, top = snap.rtUpTo;
  for (const d of fresh.docs) { const r = { ...d.data(), _id: d.id }; if (!rows.has(d.id)) added++; rows.set(d.id, r); if (r.rt > top) top = r.rt; }
  if (added >= 300 || (added && Date.now() - Number(snap.ver) > 6 * 3600e3)) await saveSnapshot(rows, top).catch((e) => console.warn('stats snapshot save', e?.message));
  return [...rows.values()];
}
const statsMemo = new Map();
async function stats(all, before = false, rebuild = false) {
  const at = Math.floor(Date.now() / SLOT) * SLOT, mk = `${all}|${before}`, hit = statsMemo.get(mk);
  if (!rebuild && hit && hit.at === at) return hit.html;
  const rows = (await statRows(at, rebuild)).filter((e) => e.ts <= at);
  const html = statsHtml(rows, { all, before, now: at, keyQs: `key=${encodeURIComponent(process.env.STATS_KEY ?? '')}`, relay: relayState() });
  statsMemo.set(mk, { at, html }); return html;
}

// Send cards (Space Collector functions/index.js, ported 2026-11-19): the pack lives here under a random 7-character id, so
// every link is short (skycollector.app/c/<id>). The code is what the app would have put in the link: card keys, times and
// the cards' own data; no places, no names, no accounts.
const PACK_ABC = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', PACK_DAYS = 90, PACK_MAX = 300000;
const packId = () => { let s = ''; const b = new Uint8Array(7); crypto.getRandomValues(b); for (const x of b) s += PACK_ABC[x % PACK_ABC.length]; return s; };
async function savePack(code) {
  for (let i = 0; i < 4; i++) { const id = packId(); try { await db.collection('sky_packs').doc(id).create({ c: code, at: Date.now(), exp: new Date(Date.now() + PACK_DAYS * 86400e3) }); return id; } catch (e) { if (e?.code !== 6) throw e; } } // 6 = already exists
  throw new Error('no id');
}

functions.http('api', async (req, res) => {
  const origin = req.get('Origin') ?? '', ok = ALLOWED.some((re) => re.test(origin));
  if (ok) { res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin'); }
  if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'GET, POST'); res.set('Access-Control-Allow-Headers', 'Content-Type'); return res.status(204).send(''); }
  const path = req.path.replace(/^\/api/, '').replace(/\/$/, '');
  try {
    /* the stats page is opened in a browser (no Origin); a wrong or missing key looks like any unknown path */
    if (path === '/stats' && req.method === 'GET') { if (!process.env.STATS_KEY || req.query.key !== process.env.STATS_KEY) return res.status(404).send('not found'); res.set('Content-Type', 'text/html; charset=utf-8'); res.set('Cache-Control', 'private, no-store'); return res.send(await stats(req.query.all === '1', req.query.before === '1', req.query.rebuild === '1')); }
    if (origin && !ok) return res.status(403).send('Forbidden');
    if (path === '/pack' && req.method === 'POST') { if (!ok) return res.status(403).send('Forbidden'); if (limited(req, 20, 'pk')) return res.status(429).send('slow down');
      const code = String(typeof req.body === 'string' ? req.body : req.rawBody?.toString() ?? '').trim();
      if (code.length > PACK_MAX || !/^g\d[A-Za-z0-9_~-]+$/.test(code)) return res.status(400).send('bad pack');
      res.set('Content-Type', 'application/json'); return res.send(JSON.stringify({ id: await savePack(code) })); }
    { const m = /^\/pack\/([A-Za-z0-9]{7})$/.exec(path); if (m && req.method === 'GET') { if (limited(req, 60, 'pg')) return res.status(429).send('slow down');
      const doc = await db.collection('sky_packs').doc(m[1]).get(), d = doc.exists ? doc.data() : null;
      if (!d || (d.exp?.toMillis?.() ?? 0) < Date.now()) return res.status(404).send('not found');
      res.set('Access-Control-Allow-Origin', '*'); res.set('Content-Type', 'application/json'); res.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
      return res.send(JSON.stringify({ c: d.c })); } }
    if (path === '/t' && req.method === 'POST') { if (!ok) return res.status(403).send('Forbidden'); if (limited(req, 20, 't')) return res.status(429).send('slow down'); return res.status(await report(typeof req.body === 'string' ? req.body : req.rawBody?.toString() ?? JSON.stringify(req.body))).send(''); }
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
