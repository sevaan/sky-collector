// Space Collector server on Firebase (2026-10-26, Sevaan: "Go with Firebase"). A Cloud Run function ("api", Node 22) in
// the personal project space-collector-91cc7, served through Firebase Hosting at https://spacecollector.app/api/…, so
// the Hosting CDN caches what it can (Cache-Control s-maxage) and nearby players share upstream requests.
// Deployed with gcloud (personal login), never the firebase CLI. Same routes as worker/src/index.js:
//   GET  /api/wx?lat&lon        MET Norway (CC BY 4.0), reshaped for js/weather.js; cached 30 min per 0.1°
//   GET  /api/planes?lat&lon&dist   adsb.lol (ODbL); cached 8 s
//   GET  /api/catalog, /api/comets  the repo's daily files (the phone apps keep fresh data with them); cached 3 h
//   GET  /api/route?cs=ACA851   usual route for an airline callsign, from Virtual Radar Server's standing data (CC0); cached a day
//   POST /api/t                 anonymous usage reports → Firestore collection sc_events
//   POST /api/pack              Send cards: store a pack (its g1… code), answer { id } for a short link (2026-11-07)
//   GET  /api/pack/<id>         that pack's code; packs expire after 90 days (Firestore TTL on 'exp')
//   GET  /api/stats?key=…       the dashboard (?all=1 includes test builds); the key is the STATS_KEY env var
import functions from '@google-cloud/functions-framework';
import { Firestore } from '@google-cloud/firestore';
import { statsHtml } from './stats-page.js';
const db = new Firestore();
const ALLOWED = [/^https:\/\/sevaan\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https:\/\/localhost$/, /^https:\/\/spacecollector\.app$/];
const UA = 'SpaceCollector/1.0 (https://spacecollector.app; hello@spacecollector.app)';
const REPO_RAW = 'https://raw.githubusercontent.com/sevaan/space-collector-data/main/'; // public copy of data/ (the game's repo went private 2026-11-06)
const mem = new Map(); // per-instance cache on top of the CDN's
async function cached(key, ms, make) { const h = mem.get(key); if (h && Date.now() - h.at < ms) return h.body; const body = await make(); if (body != null) { mem.set(key, { at: Date.now(), body }); if (mem.size > 2000) mem.clear(); } return body; }
// A small per-instance rate limit per caller (Cloud Run puts the caller first in X-Forwarded-For). Bug hunt 2026-10-26:
// with no limit, a script walking a lat/lon grid would turn every request into a MET Norway call under our User-Agent.
const hits = new Map();
function limited(req, kind, perMin) {
  const ip = String(req.get('X-Forwarded-For') ?? req.ip ?? '').split(',')[0].trim() || '?', k = `${kind}/${ip}`, now = Date.now();
  let h = hits.get(k); if (!h || now - h.at > 60e3) { h = { at: now, n: 0 }; hits.set(k, h); if (hits.size > 5000) { for (const [key, v] of hits) if (now - v.at > 60e3) hits.delete(key); if (hits.size > 20000) hits.clear(); } } // drop only expired callers, so a flood of new keys can't reset everyone's limit (audit 2026-11-03); clear all only as a memory cap
  return ++h.n > perMin;
}
const coord = (q) => { const lat = Number(q.lat), lon = Number(q.lon); return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10 } : null; };
function wmo(sym = '') {
  const s = String(sym).replace(/_(day|night|polartwilight)$/, '');
  if (/thunder/.test(s)) return 95; if (/snow|sleet/.test(s)) return /heavy/.test(s) ? 75 : 71;
  if (/rain/.test(s)) return /heavy/.test(s) ? 65 : /light/.test(s) ? 61 : 63;
  if (s === 'fog') return 45; if (s === 'cloudy') return 3; if (s === 'partlycloudy') return 2; if (s === 'fair') return 1; return 0;
}
async function weather(p) {
  return cached(`wx/${p.lat},${p.lon}`, 30 * 60e3, async () => {
    const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${p.lat}&lon=${p.lon}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const ts = (await r.json())?.properties?.timeseries ?? [];
    const rows = ts.map((x) => { const d = x.data ?? {}, n = d.next_1_hours ?? d.next_6_hours ?? d.next_12_hours, det = d.instant?.details ?? {};
      return { t: Date.parse(x.time), step: d.next_1_hours ? 1 : d.next_6_hours ? 6 : 12, cloud: Math.round(det.cloud_area_fraction ?? 0), code: wmo(n?.summary?.symbol_code), temp: det.air_temperature ?? null, wind: det.wind_speed != null ? Math.round(det.wind_speed * 3.6) : null }; });
    const hours = []; for (const r2 of rows) for (let h = 0; h < r2.step && hours.length < 24 * 9; h++) hours.push({ t: r2.t + h * 3600e3, cloud: r2.cloud, code: r2.code, temp: r2.temp, wind: r2.wind });
    return JSON.stringify({ now: rows[0] ? { cloud: rows[0].cloud, code: rows[0].code } : { cloud: 0, code: 0 }, hours, source: 'MET Norway' });
  });
}
async function planes(p, d) {
  return cached(`planes/${p.lat},${p.lon},${d}`, 8e3, async () => {
    try { const r = await fetch(`https://api.adsb.lol/v2/point/${p.lat}/${p.lon}/${d}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) console.warn('planes upstream', r.status, (await r.text().catch(() => '')).slice(0, 200)); return r.ok ? await r.text() : null;
    } catch (e) { console.warn('planes upstream threw', e?.name, e?.message); return null; } /* 2026-11-15: every lookup was failing; log why */
  });
}
const repoFile = (path) => cached(`repo/${path}`, 3 * 3600e3, async () => { const r = await fetch(REPO_RAW + path, { headers: { 'User-Agent': UA } }); return r.ok ? await r.text() : null; });

const NAMES = new Set(['install', 'open', 'night', 'end', 'tour', 'motion', 'calib', 'plus', 'err', 'sky', 'help', 'remind', 'catch', 'share', 'boot', 'perm', 'secret', 'gift', 'review']); // gift: cards sent (how: move/copy) or received (in), 2026-11-07
async function report(body) {
  let b; try { b = JSON.parse(String(body ?? '').slice(0, 40000)); } catch { return 400; }
  const iid = String(b?.i ?? ''); if (!/^[a-f0-9]{16,40}$/.test(iid)) return 400;
  const v = String(b?.v ?? '').slice(0, 20), p = ['ios', 'android', 'web'].includes(b?.p) ? b.p : 'web', x = b?.x ? 1 : 0, now = Date.now();
  const rows = (Array.isArray(b?.e) ? b.e : []).slice(0, 60).filter((e) => Array.isArray(e) && NAMES.has(e[0]));
  if (rows.length) { const batch = db.batch(); for (const e of rows) batch.set(db.collection('sc_events').doc(), { ts: Math.min(now, Math.max(now - 30 * 86400000, Number(e[1]) || now)), iid, v, p, x, name: String(e[0]), d: JSON.stringify(e[2] ?? {}).slice(0, 600) }); await batch.commit(); }
  if (process.env.NTFY_TOPIC && !x && p !== 'web') { try { await notify(rows, { v, p }); } catch (err) { console.error('ntfy', err?.message ?? err); } }
  return 204;
}
// Phone pings via ntfy (2026-11-08, Sevaan: "a notification every time someone installs my app"). Only real store
// builds (x = 0, not the website): an 'install' row, and a 'plus' row with s = 'buy' (a purchase or the trial start).
// The topic is the NTFY_TOPIC env var (set at deploy); anyone who knows the name can read it, so it is a long random one.
const PLAT_WORD = { ios: 'iPhone', android: 'Android' };
async function notify(rows, { v, p }) {
  const installs = rows.filter((e) => e[0] === 'install').length;
  const buys = rows.filter((e) => e[0] === 'plus' && e[2]?.s === 'buy');
  if (!installs && !buys.length) return;
  const msgs = [];
  if (installs) {
    const now = new Date(), tz = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(now), part = (t) => Number(tz.find((x) => x.type === t)?.value) || 0;
    const start = now.getTime() - ((part('hour') % 24) * 3600e3 + part('minute') * 60e3 + part('second') * 1e3 + now.getMilliseconds()); /* midnight in Toronto, whatever the DST offset */
    let today = installs; /* the batch is already committed, so the count includes this install */
    try { const snap = await db.collection('sc_events').where('ts', '>=', start).select('name', 'x', 'p').get(); today = snap.docs.filter((d) => { const r = d.data(); return r.name === 'install' && !r.x && r.p !== 'web'; }).length || installs; } catch {}
    msgs.push({ title: `New install - ${PLAT_WORD[p] ?? p}`, body: `v${v}, ${today} today`, tags: 'iphone' });
  }
  for (const b of buys) msgs.push({ title: `Plus - ${b[2]?.plan ?? 'bought'} - ${PLAT_WORD[p] ?? p}`, body: `Someone bought Plus (${b[2]?.plan ?? '?'}) on ${PLAT_WORD[p] ?? p}, v${v}`, tags: 'star', priority: '4' });
  for (const m of msgs) await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, { method: 'POST', headers: { Title: m.title, Tags: m.tags, Priority: m.priority ?? '3', 'User-Agent': UA }, body: m.body, signal: AbortSignal.timeout(4000) });
}
// The dashboard (functions/stats-page.js). /stats needs ?key=STATS_KEY (an env var set at deploy), reads only the last
// 120 days and is cached 10 minutes per instance, so a public URL can't run up Firestore reads (bug hunt 2026-10-26).
let statsMemo = null;
/* Every instance shows the same snapshot (2026-11-14, Sevaan: 10 players out on the computer, 8 on the phone). Each of
   the up to 3 instances used to cache its own render for 10 minutes, taken whenever it happened to be asked, so two
   devices could see different counts. Now the page is the events up to the last 10-minute mark (9:40, 9:50…), rendered
   as of that mark, so any instance gives the same numbers until the next mark. */
const SLOT = 10 * 60e3;
async function stats(all, before = false) {
  const at = Math.floor(Date.now() / SLOT) * SLOT;
  if (statsMemo && statsMemo.all === all && statsMemo.before === before && statsMemo.at === at) return statsMemo.html;
  const snap = await db.collection('sc_events').where('ts', '>', at - 120 * 86400e3).get();
  /* the daily catalogue: when it was made and the new cards it brought (data/new-cards.json, 2026-11-12) */
  let newCards = null, catalogAt = 0;
  try { const t = await repoFile('data/new-cards.json'); if (t) newCards = JSON.parse(t); } catch {} /* { cards, backlog } */
  try { const t = await repoFile('data/catalog.json'); catalogAt = Date.parse(/"generated"\s*:\s*"([^"]+)"/.exec(t?.slice(0, 200) ?? '')?.[1] ?? '') || 0; } catch {}
  const rows = snap.docs.map((doc) => doc.data()).filter((e) => e.ts <= at);
  const html = statsHtml(rows, { all, before, now: at, keyQs: `key=${encodeURIComponent(process.env.STATS_KEY ?? '')}`, newCards, catalogAt });
  statsMemo = { at, all, before, html }; return html;
}

// Send cards (2026-11-07, Sevaan: "a link to a lot of cards [must] be sent by text normally"): the pack lives here under
// a random 7-character id, so every link is short (spacecollector.app/c/<id>). The code is what the app would have put in
// the link: card keys, times, places rounded to ~10 km; no names, no accounts.
const PACK_ABC = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', PACK_DAYS = 90, PACK_MAX = 300000;
const packId = () => { let s = ''; const b = new Uint8Array(7); crypto.getRandomValues(b); for (const x of b) s += PACK_ABC[x % PACK_ABC.length]; return s; };
async function savePack(code) {
  for (let i = 0; i < 4; i++) { const id = packId(); try { await db.collection('sc_packs').doc(id).create({ c: code, at: Date.now(), exp: new Date(Date.now() + PACK_DAYS * 86400e3) }); return id; } catch (e) { if (e?.code !== 6) throw e; } } // 6 = already exists
  throw new Error('no id');
}

functions.http('api', async (req, res) => {
  const origin = req.get('Origin') ?? '', ok = ALLOWED.some((re) => re.test(origin));
  if (ok) { res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin'); }
  if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'GET, POST'); res.set('Access-Control-Allow-Headers', 'Content-Type'); return res.status(204).send(''); }
  const path = req.path.replace(/^\/api/, '').replace(/\/$/, '') || '/';
  const json = (body, sMax) => { if (body == null) return res.status(502).send('unavailable'); res.set('Content-Type', 'application/json'); res.set('Cache-Control', `public, max-age=${Math.min(sMax, 300)}, s-maxage=${sMax}`); return res.send(body); };
  try {
    if (path === '/stats' && req.method === 'GET') { if (!process.env.STATS_KEY || req.query.key !== process.env.STATS_KEY) return res.status(404).send('not found'); res.set('Content-Type', 'text/html; charset=utf-8'); res.set('Cache-Control', 'private, no-store'); return res.send(await stats(req.query.all === '1', req.query.before === '1')); }
    if (path === '/t' && req.method === 'POST') { if (!ok) return res.status(403).send('Forbidden'); if (limited(req, 't', 20)) return res.status(429).send('slow down'); return res.status(await report(typeof req.body === 'string' ? req.body : req.rawBody?.toString() ?? JSON.stringify(req.body))).send(''); }
    if (path === '/pack' && req.method === 'POST') { if (!ok) return res.status(403).send('Forbidden'); if (limited(req, 'pk', 20)) return res.status(429).send('slow down');
      const code = String(typeof req.body === 'string' ? req.body : req.rawBody?.toString() ?? '').trim();
      if (code.length > PACK_MAX || !/^g\d[A-Za-z0-9_~-]+$/.test(code)) return res.status(400).send('bad pack');
      res.set('Content-Type', 'application/json'); return res.send(JSON.stringify({ id: await savePack(code) })); }
    { const m = /^\/pack\/([A-Za-z0-9]{7})$/.exec(path); if (m && req.method === 'GET') { if (limited(req, 'pg', 60)) return res.status(429).send('slow down');
      const doc = await db.collection('sc_packs').doc(m[1]).get(), d = doc.exists ? doc.data() : null;
      if (!d || (d.exp?.toMillis?.() ?? 0) < Date.now()) return res.status(404).send('not found');
      res.set('Access-Control-Allow-Origin', '*'); res.set('Content-Type', 'application/json'); /* '*': the CDN caches one copy for every origin, so a per-origin header blocked the apps (2026-11-07) */ res.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
      return res.send(JSON.stringify({ c: d.c })); } }
    if (!ok && origin) return res.status(403).send('Forbidden');
    if ((path === '/wx' || path === '/planes' || path === '/route') && limited(req, 'q', 60)) return res.status(429).send('slow down');
    if (path === '/route') { const cs = String(req.query.cs ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); return /^[A-Z]{3}\d/.test(cs) ? json(await route(cs), 86400) : res.status(400).send('bad callsign'); }
    if (path === '/wx') { const p = coord(req.query); return p ? json(await weather(p), 1800) : res.status(400).send('bad lat/lon'); }
    if (path === '/planes') { const p = coord(req.query), d = Math.min(100, Math.max(1, Math.round(Number(req.query.dist ?? 40)))); return p ? json(await planes(p, d), 8) : res.status(400).send('bad lat/lon'); }
    if (path === '/catalog') { res.set('Access-Control-Allow-Origin', '*'); return json(await repoFile('data/catalog.json'), 3 * 3600); }
    if (path === '/comets') { res.set('Access-Control-Allow-Origin', '*'); return json(await repoFile('data/comets.json'), 3 * 3600); }
    return res.status(404).send('not found');
  } catch (e) { return res.status(502).send(`error: ${String(e?.message ?? e).slice(0, 200)}`); }
});

// Flight routes (2026-10-28, Sevaan): Virtual Radar Server's standing data, CC0 (github.com/vradarserver/standing-data).
// One CSV per airline (routes/schema-01/A/ACA-all.csv: Callsign,…,AirportCodes "CYYZ-RJTT") and one per two-letter
// ICAO prefix for airports. Fetched on demand and kept a day per instance; only the callsign is ever asked about.
const SD = 'https://raw.githubusercontent.com/vradarserver/standing-data/main/';
const sdMem = new Map();
async function sdCsv(file) {
  const h = sdMem.get(file); if (h && Date.now() - h.at < 864e5) return h.rows;
  let rows = new Map();
  try {
    const r = await fetch(SD + file, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (r.ok) { const lines = (await r.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean), head = lines.shift().split(',');
      for (const l of lines) { const v = l.split(','); const o = {}; head.forEach((k, i) => (o[k] = v[i])); rows.set(v[0], o); } }
    else if (r.status !== 404) return h?.rows ?? new Map();
  } catch { return h?.rows ?? new Map(); }
  sdMem.set(file, { at: Date.now(), rows }); if (sdMem.size > 400) sdMem.delete(sdMem.keys().next().value);
  return rows;
}
async function route(cs) {
  const code = cs.slice(0, 3), row = (await sdCsv(`routes/schema-01/${code[0]}/${code}-all.csv`)).get(cs);
  if (!row?.AirportCodes) return JSON.stringify({ cs, route: null });
  const stops = await Promise.all(row.AirportCodes.split('-').filter(Boolean).slice(0, 6).map(async (c) => {
    const a = (await sdCsv(`airports/schema-01/${c[0]}/${c.slice(0, 2)}.csv`)).get(c);
    return { icao: c, iata: a?.IATA || null, name: a?.Name || null, city: a?.Location || null, cc: a?.CountryISO2 || null };
  }));
  return JSON.stringify({ cs, route: stops });
}
