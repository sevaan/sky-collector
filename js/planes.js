// Live aircraft near you, so the app can say "Just a plane" when you line one up by mistake.
// Positions come from adsb.lol (community ADS-B receivers): straight from the phone in the apps, through our server
// on the website, because adsb.lol doesn’t allow browser requests directly. The airline comes from the callsign's prefix.
// No DOM here. Positions are extrapolated between fetches using ground speed, track and climb rate.

import { tagOf } from './sky-secrets.js?v=0.1.1828';
import { GOV_OPS, BIZ_OPS, AIRLINE_CS, MIL_TYPES, isGovOrMil, opOf, anonId } from './plane-privacy.js?v=0.1.1828';
export { GOV_OPS, isGovOrMil, anonId };
import { SERVER } from './server.js?v=0.1.1828';
import { plugin } from './native.js?v=0.1.1828';
import { lookupRoute } from './routes.js?v=0.1.1828';
import { typeName } from './sky-type-names.js?v=0.1.1828';
import { noteFeed } from './sky-local.js?v=0.1.1828';
import { planeSet } from './sky-sets.js?v=0.1.1828';
import { isProp } from './sky-props.js?v=0.1.1828';
import { CARGO_AIRLINES } from './sky-cargo.js?v=0.1.1828';
import { DEFAULTS, clampDial, freshFeed, pickSource, nextGap, afterAnswer, feedDown, maxAgeS, easeLeft } from './plane-feed.js?v=0.1.1828';
// Empty = feature off. localStorage 'planeRelay' overrides it (testing). Our server's /planes (adsb.lol only) once it's
// deployed; until then the Val Town relay (relay/handler.ts).
// Sky Collector (2026-11-15): Space Collector's Val Town relay is turned away by adsb.lol now, so the website needs Sky
// Collector's own relay: relay/planes.ts on Val Town (val sevaan/sky-collector-planes, 2026-11-15). Only the website
// needs it; the phone apps will ask the plane feed directly, like Space Collector's apps.
/* Since 2026-11-19 the website asks Sky's own relay too (server/planes-relay.js on Cloud Run, FlyItalyADSB under its
   commercial terms, one cached answer per 1-degree square); the Val Town relay (relay/planes.ts, adsb.lol + adsb.fi, whose
   terms are non-commercial) is retired. */
const SKY_RELAY = 'https://api-ybymfwdlgq-uc.a.run.app/planes';
// A list, tried in order each poll: the first that answers wins. Add a second relay here (another host) as a fallback.
const RELAYS = SERVER ? [`${SERVER}/planes`] : [SKY_RELAY];
const POLL_MS = 10000;   // the website: every 10 s, as before
const RADIUS_NM = 40;    // ~75 km: an airliner at cruise height is ~8° up at that distance
// The apps (2026-11-19, native/): Space Collector's phone-first feed (js/plane-feed.js). Each phone asks adsb.lol itself
// through CapacitorHttp; Sky's own relay (server/, Cloud Run "api" in sky-collector-app, FlyItalyADSB) is the backup.
// The website keeps the relay list above. No dial yet (Space's is spacecollector.app/dial/planes.json): DEFAULTS.
const APP_RELAY = 'https://api-ybymfwdlgq-uc.a.run.app/planes';
const DIAL = 'https://skycollector.app/dial/planes.json'; /* the plane feed's pacing without a release (js/plane-feed.js clampDial; scripts/build-site.mjs writes it) */
const phoneHttp = () => { let over = null; try { over = localStorage.getItem('planeRelay'); } catch {} return over ? null : plugin('CapacitorHttp'); };
const header = (h, name) => { if (!h) return undefined; for (const k of Object.keys(h)) if (k.toLowerCase() === name) return Number(h[k]); return undefined; };
const jsonOf = (r) => (r?.status === 200 ? (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) : null);

const RAD = Math.PI / 180, A = 6378.137, E2 = 0.00669437999014; // WGS84, km
const FT = 0.0003048, KT = 0.000514444; // feet -> km, knots -> km/s

// localStorage 'planeRelay' (testing) may be one URL, several separated by commas or spaces, or a JSON array.
function relayUrls() {
  let o = null; try { o = localStorage.getItem('planeRelay'); } catch {}
  if (!o) return RELAYS;
  let list = null; try { const j = JSON.parse(o); if (Array.isArray(j)) list = j; } catch {}
  return (list ?? o.split(/[\s,]+/)).map((u) => String(u).trim()).filter(Boolean);
}
export function planesAvailable() { return !!phoneHttp() || relayUrls().length > 0; }
/* What leaves the phone (2026-11-20, privacy with precise location): only a position rounded to a 0.05° grid (~5.5 km
   north-south, less east-west), never the fix itself. The rounded point can be up to half a cell off in each direction,
   at most sqrt(2) x 0.025° x 60 = 2.1 NM, so the radius grows by 3 NM and every plane within RADIUS_NM of the real spot is
   still in the answer. The phone measures distance and height in the sky from its own fix. */
export const FEED_GRID = 0.05, FEED_PAD_NM = 3;
export function feedPoint(obs) {
  const snap = (v, lim) => Math.max(-lim, Math.min(lim, Math.round(v / FEED_GRID) * FEED_GRID)).toFixed(2).replace(/^-(0\.00)$/, '$1');
  const lon = ((((obs.lon + 180) % 360) + 360) % 360) - 180; // -180..180
  return { lat: snap(obs.lat, 90), lon: snap(lon, 180), dist: RADIUS_NM + FEED_PAD_NM };
}
export const adsbUrl = (obs) => { const f = feedPoint(obs); return `https://api.adsb.lol/v2/point/${f.lat}/${f.lon}/${f.dist}`; };
export const relayQuery = (url, obs) => { const f = feedPoint(obs); return `${url.replace(/\/$/, '')}${/\/planes$/.test(url) ? '' : '/'}?lat=${f.lat}&lon=${f.lon}&dist=${f.dist}`; };

function ecef(lat, lon, hKm) {
  const sl = Math.sin(lat * RAD), cl = Math.cos(lat * RAD);
  const n = A / Math.sqrt(1 - E2 * sl * sl);
  return [(n + hKm) * cl * Math.cos(lon * RAD), (n + hKm) * cl * Math.sin(lon * RAD), (n * (1 - E2) + hKm) * sl];
}

// Where a point is in the observer’s sky: { az, el, rangeKm, enu } (enu is a unit East-North-Up vector).
export function skyPosition(obs, lat, lon, hKm) {
  const o = ecef(obs.lat, obs.lon, obs.heightKm ?? 0), p = ecef(lat, lon, hKm);
  const dx = p[0] - o[0], dy = p[1] - o[1], dz = p[2] - o[2];
  const sf = Math.sin(obs.lat * RAD), cf = Math.cos(obs.lat * RAD), sl = Math.sin(obs.lon * RAD), cl = Math.cos(obs.lon * RAD);
  const e = -sl * dx + cl * dy;
  const n = -sf * cl * dx - sf * sl * dy + cf * dz;
  const u = cf * cl * dx + cf * sl * dy + sf * dz;
  const r = Math.hypot(e, n, u);
  return { az: (Math.atan2(e, n) / RAD + 360) % 360, el: Math.asin(u / r) / RAD, rangeKm: r, enu: [e / r, n / r, u / r] };
}

// Move a plane forward `s` seconds along its track (flat-earth step, fine for a few seconds).
/* Where a plane is drawn now: moved along its own track from its own position time, plus what's left of an eased correction (Space Collector 5585f2e5) */
function drawnAt(p, nowMs) {
  const q = extrapolate(p, Math.max(0, (nowMs - p.at) / 1000)), e = p.ease; if (!e) return q;
  const k = easeLeft(e.t0, nowMs); if (!k) { p.ease = null; return q; }
  return { ...q, lat: q.lat + e.lat * k, lon: q.lon + e.lon * k, hKm: q.hKm + e.hKm * k };
}
function extrapolate(p, s) {
  const d = p.gs * KT * s;
  const lat = p.lat + (d * Math.cos(p.track * RAD)) / 111.195;
  const lon = p.lon + (d * Math.sin(p.track * RAD)) / (111.195 * Math.cos(p.lat * RAD));
  return { lat, lon, hKm: Math.max(0, p.hKm + (p.climb * FT / 60) * s) };
}

// Where a plane was and will be, for drawing its path: straight along its current track and climb rate
// from `from` to `to` seconds around now. [{ t, enu, el }] (t in seconds, enu a unit vector).
export function planePath(p, obs, nowMs = Date.now(), from = -60, to = 120, step = 4) {
  const base = (nowMs - p.at) / 1000, out = [];
  for (let t = from; t <= to; t += step) {
    const q = extrapolate(p, base + t);
    const pos = skyPosition(obs, q.lat, q.lon, q.hKm);
    out.push({ t, enu: pos.enu, el: pos.el });
  }
  return out;
}

// Privacy (2026-11-19, docs/PRIVACY-AND-DATA.md): an aircraft that isn't flying an airline flight is anonymous here.
// Private and general-aviation planes (their callsign is their registration), aircraft whose owners asked not to be
// tracked (dbFlags 8 LADD, 4 PIA) and military aircraft (dbFlags 1) keep only their type: no callsign, no registration,
// and their transponder code is replaced by a salted hash that never leaves the phone (different on every phone), so a
// card can count different aircraft without anyone being able to look one up or follow it.
/* Not airlines though their callsigns look like one (aviation-enthusiast playtest 2026-11-19): military, police, coast
   guard and government operators (the airline table's own names: air force, navy, army, police, government, ministry…,
   plus Air Mobility Command RCH, Canadian Forces CFC, the RAF's RRR, the USAF's SAM, the US Army's PAT, France's CTM, the
   UK Home Office UKP) are anonymous (type only since Sevaan's decision 2026-11-19, below; js/planes.js parse); and
   fractional / charter business-jet operators (NetJets, Flexjet, XO, flyExclusive, AirSprint, VistaJet, Executive Jet
   Management) are anonymous like any private plane: type only, no registration or callsign. */
/* military types (whatever the operator says) are anonymous; not the P-3, which NOAA's civil hurricane hunters fly */
/* any gov or military aircraft is anonymous, whatever its callsign looks like (QA 2026-11-19: 'AFR123' on a C130 and 'XYZ123'
   on a KC10 kept their callsign and real hex): isGovOrMil covers the flags, the operators and the military types */
export const isAnonymous = (a) => isGovOrMil(a) || (Number(a?.dbFlags) & 13) !== 0 || !AIRLINE_CS.test(String(a?.flight ?? a?.callsign ?? '').trim().toUpperCase()) || GOV_OPS.has(opOf(a)) || BIZ_OPS.has(opOf(a));
/* What kind of thing it was, per CATCH (2026-11-19, card spike, design/card-spike/team-c-information.html §2): one B763 card
   can be caught as a UPS freighter one day and a charter the next, so the class belongs to the catch, not the type. Decided
   here while the raw callsign is in hand; only the class word is kept (plus the airline's name for an airline callsign,
   which is public). First match wins. Gov / military first: 'mil' or 'gov', never the unit or operator (Sevaan 2026-11-19).
   a: { callsign (raw), category, type, heli, anon, gov, mil, biz }. Returns '' or one of CLASS_WORDS' keys. */
export const CLASS_WORDS = {
  balloon: 'Balloon', airship: 'Airship', glider: 'Glider', ultralight: 'Ultralight', drone: 'Drone', heli: 'Helicopter',
  cargo: 'Cargo airline', airline: 'Airline', biz: 'Business jet', light: 'Light aircraft', turboprop: 'Turboprop',
  airliner: 'Airliner', small: 'Small aircraft', large: 'Large aircraft', heavy: 'Heavy aircraft',
  mil: 'Military', gov: 'Government', /* the band says "Military": what it is, never whose */
};
const AIRLINER_SETS = new Set(['giants', 'b737', 'a320', 'twinaisle', 'regional']);
export function catchClass(a) {
  if (a?.gov) return a?.mil ? 'mil' : 'gov';
  const t = String(a?.type ?? '').toUpperCase(), cat = String(a?.category ?? '').toUpperCase(), cs = String(a?.callsign ?? '').trim().toUpperCase();
  if (t === 'SHIP') return 'airship';
  if (t === 'BALL' || cat === 'B2') return 'balloon';
  if (t === 'GLID' || cat === 'B1') return 'glider';
  if (cat === 'B4') return 'ultralight';
  if (cat === 'B6') return 'drone';
  if (a?.heli) return 'heli';
  const airline = !a?.anon && !a?.biz && AIRLINE_CS.test(cs);
  if (airline) return CARGO_AIRLINES.has(cs.slice(0, 3)) ? 'cargo' : 'airline';
  if (a?.biz) return 'biz';
  const set = t ? planeSet(t, false)?.id : '';
  if (set === 'bizjets') return 'biz';
  if (set === 'light' || cat === 'A1') return set === 'light' && cat === 'A2' && isProp(t) ? 'turboprop' : 'light'; /* a King Air or PC-12 that says it's over 7 t */
  if (set === 'props') return 'turboprop';
  if (AIRLINER_SETS.has(set) || /^A[345]$/.test(cat)) return 'airliner';
  return cat === 'A2' ? 'small' : '';
}
export const parsePlanes = (json) => parse(json); // tests
const typeSeen = new Map(); /* real hex -> { t, desc } seen this session (parse) */
function parse(json) {
  const at = json.now < 1e12 ? json.now * 1000 : json.now;
  const out = [];
  for (let a of json.ac ?? json.aircraft ?? []) {
    if (a.lat == null || a.lon == null || a.alt_baro === 'ground') continue;
    /* not aircraft (playtest 2026-11-20): ADS-B categories C1-C7 are airport vehicles and obstacles, and the feed's
       pseudo-types SERV/EMER/GND/TWR are vehicles too; one reporting a number for its height became an "AIRCRAFT" card */
    if (/^C[1-7]$/i.test(String(a.category ?? '')) || /^(SERV|EMER|GND|TWR|GRND)$/i.test(String(a.t ?? ''))) continue;
    const ft = typeof a.alt_geom === 'number' ? a.alt_geom : a.alt_baro;
    if (typeof ft !== 'number') continue;
    /* an aircraft's type from an earlier answer when this one has none (QA 2026-11-20: a private Cessna 172, CGPZV, came
       out with no type: the feeds' TIS-B records of light aircraft often carry no database fields, and the source answering
       changes between asks). The real hex is only a key in this memory, never kept or shown. */
    if (a.hex && !a.t) { const m = typeSeen.get(a.hex); if (m) a = { ...a, t: m.t, desc: a.desc || m.desc }; }
    else if (a.hex && a.t) { if (typeSeen.size > 4000) typeSeen.clear(); typeSeen.set(a.hex, { t: a.t, desc: a.desc ?? '' }); }
    const anon = isAnonymous(a), gov = isGovOrMil(a);
    /* Military and government aircraft keep their TYPE (Sevaan 2026-11-19: "I should be able to catch a stealth bomber if I
       see it and it's in the api data"): a C-17 or B-2 plane card, never a callsign, registration, real hex, unit or route */
    /* a type that the aircraft can't be (2026-11-19, real records: "BALL" on an H125 helicopter at 63 kt, "GLID" on an
       Air Canada jet at 35,000 ft) is dropped, so it's known by its size category instead */
    const t0 = String(a.t ?? '').toUpperCase(), gs0 = Number(a.gs) || 0, cs0 = String(a.flight ?? '').trim();
    /* slow light aircraft can't make 300 kt over the ground even in a jet stream (avgeek playtest 2026-11-19: a Twin Otter at 589 km/h): the type is wrong */
    const SLOW_T = /^(C15[02]|C17[0-7]|C172|C182|P28A|DA40|DV20|SR20|DHC[26]|PC6T?|AN2|PA18|C140|J3)$/;
    const badType = (SLOW_T.test(t0) && gs0 > 300) || (t0 === 'BALL' && gs0 >= 40) || (t0 === 'SHIP' && gs0 >= 75) || (t0 === 'GLID' && (gs0 >= 130 || ft >= 25000 || /^[A-Z]{3}\d/.test(cs0)));
    out.push({
      hex: anon ? anonId(a.hex) : a.hex, callsign: anon ? '' : (a.flight ?? '').trim(), reg: anon ? '' : a.r ?? '', anon, tag: tagOf(a), year: Number(a.year) || undefined, type: badType ? '' : a.t ?? '', desc: badType ? '' : a.desc ?? '', /* a dropped type takes its description with it */ category: a.category ?? '',
      lat: a.lat, lon: a.lon, hKm: ft * FT, altFt: ft, altBaro: typeof a.alt_baro === 'number' ? a.alt_baro : undefined /* what Flightradar24 and pilots read (alt_geom is GPS height, used for where it is in the sky) */, gs: a.gs ?? 0, track: a.track ?? a.true_heading ?? 0,
      climb: a.geom_rate ?? a.baro_rate ?? 0, climbKnown: typeof (a.geom_rate ?? a.baro_rate) === 'number' /* the feed gave a climb rate (missions: on its way up / down) */, at: at - (a.seen_pos ?? 0) * 1000,
    });
    const q = out[out.length - 1]; q.heli = isHelicopter(q); if (gov) q.gov = true; /* never a flight card (js/flights.js cardsFor) */
    /* the class of this catch, from the raw callsign; the airline's name only for an airline callsign (public) */
    q.cls = catchClass({ callsign: cs0, category: a.category, type: q.type, heli: q.heli, anon, gov, mil: gov && ((Number(a.dbFlags) & 1) !== 0 || MIL_TYPES.test(t0)), biz: BIZ_OPS.has(opOf(a)) });
    if (q.cls === 'cargo' || q.cls === 'airline') { const n = airlineName(cs0.toUpperCase()); if (n) q.clsOp = n; }
  }
  return out;
}

export class PlaneTracker {
  constructor() {
    this.planes = []; this.lastFetch = 0; this.busy = false; this.routes = new Map(); this.failures = 0; this.lastOk = 0; this.sources = null; this.log = (() => { try { return JSON.parse(localStorage.getItem('planeFeedLog') || '[]').slice(-40); } catch { return []; } })();
    /* the apps' feed state (js/plane-feed.js), kept in localStorage 'planeFeed' */
    this.gapS = POLL_MS / 1000; this.down = false; this.src = ''; this.cfg = DEFAULTS; this.feed = freshFeed(); this.counts = { phone: 0, relay: 0 }; this.tally = null;
    try { this.feed = { ...freshFeed(), ...JSON.parse(localStorage.getItem('planeFeed') || '{}') }; } catch {}
    this.loadDial();
  }
  /* the dial: fetched once at start in the apps; the defaults stand if it can't be (as Space Collector's) */
  loadDial() {
    const http = phoneHttp(); if (!http) return;
    http.request({ url: DIAL, method: 'GET', connectTimeout: 6000, readTimeout: 6000 }).then(jsonOf).then((j) => { if (j) this.cfg = clampDial(j); }).catch(() => {});
  }

  // The last 40 fetches (2026-11-17, Sevaan outdoors: Space Collector showed a plane Sky didn't, and nothing said why):
  // [{ t, ok, n, ms, src | err }], newest last; kept in localStorage 'planeFeedLog' so a miss can be read afterwards
  // in Testing tools → Plane positions.
  note(e) { this.log.push(e); if (this.log.length > 40) this.log.shift(); try { localStorage.setItem('planeFeedLog', JSON.stringify(this.log)); } catch {} }
  // Back in front (the page was asleep): ask now, not after the back-off, and forget old failures.
  wake() { this.lastFetch = 0; this.failures = 0; }

  // 'loading' (nothing has loaded yet), 'ok' (the last fetch worked), 'failing' (recent fetches failed). The sky is only
  // known to be quiet when status is 'ok'. lastOk is the time of the last good fetch (0 = never); sources is the relay's
  // per-feed counts {adsblol, adsbfi, airplaneslive, merged}, or null (phone apps ask adsb.lol directly).
  get status() {
    if (this.down) return 'failing'; /* the apps: both sources out for now */
    if (this.failures >= 2 || (this.failures >= 1 && !this.lastOk)) return 'failing';
    return this.lastOk ? 'ok' : 'loading';
  }

  // Call every frame; fetches at most every POLL_MS (backs off after errors). near (the apps): a plane is near the
  // circle or something is pinned, so ask every 10 s rather than 30 (js/plane-feed.js).
  update(obs, { near = false } = {}) {
    const urls = relayUrls();
    loadAirlines();
    if (phoneHttp()) return this.updateApp(obs, near);
    if (!urls.length || this.busy || (typeof document !== 'undefined' && document.hidden)) return; // no polling while the app is in the background
    const wait = POLL_MS * Math.min(6, 2 ** this.failures);
    if (Date.now() - this.lastFetch < wait) return;
    this.busy = true; this.lastFetch = Date.now();
    // In the apps each phone asks adsb.lol itself through Capacitor's native HTTP (no CORS there): adsb.lol turns away
    // cloud servers (Val Town got 429s, our Cloud Run server 502s on every request, 2026-10-26), but not phones.
    let over = null; try { over = localStorage.getItem('planeRelay'); } catch {}
    const http = !over && plugin('CapacitorHttp');
    const get = http
      ? http.request({ url: adsbUrl(obs), method: 'GET', connectTimeout: 8000, readTimeout: 8000 })
        .then((r) => (r?.status === 200 ? (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) : Promise.reject(new Error(r?.status))))
      : urls.reduce((chain, url) => chain.catch(() => fetch(relayQuery(url, obs), { signal: AbortSignal.timeout?.(8000) }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))), Promise.reject(new Error('start')));
    const t0 = Date.now();
    get
      .then((j) => { this.planes = parse(j); this.failures = 0; this.lastOk = Date.now(); this.sources = j.sources ?? null; try { noteFeed((j.ac ?? j.aircraft ?? []).length); } catch {} this.note({ t: t0, ok: 1, n: this.planes.length, ms: Date.now() - t0, src: j.sources ? Object.entries(j.sources).filter(([k, v]) => v && k !== 'merged').map(([k, v]) => `${k} ${v}`).join(' ') : 'direct', at: `${obs.lat.toFixed(1)},${obs.lon.toFixed(1)}` }); })
      .catch((e) => { this.failures++; this.note({ t: t0, ok: 0, ms: Date.now() - t0, err: String(e?.message ?? e).slice(0, 40), at: `${obs.lat.toFixed(1)},${obs.lon.toFixed(1)}` }); })
      .finally(() => { this.busy = false; });
  }

  // The apps (Space Collector 5585f2e5 + 1b496281): adsb.lol from the phone first, Sky's relay as the backup, when
  // and from where as js/plane-feed.js says.
  updateApp(obs, near) {
    if (this.busy || (typeof document !== 'undefined' && document.hidden)) return; // no asking while the app is in the background
    const http = phoneHttp(), now = Date.now(), env = { phoneOk: true, relayOk: true, now };
    const src = pickSource(this.feed, env);
    this.down = feedDown(this.feed, env);
    this.gapS = nextGap(this.feed, src, { near }, this.cfg);
    if (src === 'none' || now - this.lastFetch < this.gapS * 1000) return;
    this.busy = true; this.lastFetch = now; this.src = src; this.counts[src]++;
    const t0 = now;
    const url = src === 'phone' ? adsbUrl(obs) /* adsb.lol turns cloud servers away (2026-10-26), but not phones */
      : relayQuery(APP_RELAY, obs); /* both carry only the rounded point (feedPoint) */
    http.request({ url, method: 'GET', connectTimeout: 8000, readTimeout: 8000 })
      .then((r) => ({ status: r?.status, remaining: src === 'phone' ? header(r?.headers, 'x-ratelimit-remaining') : undefined, retryAfter: src === 'phone' ? header(r?.headers, 'retry-after') : undefined, data: jsonOf(r) }))
      .then((r) => ({ ...r, ok: !!r.data, net: !r?.status }), () => ({ ok: false, status: 0, net: true }))
      .then((r) => {
        const at = `${obs.lat.toFixed(1)},${obs.lon.toFixed(1)}`;
        if (r.ok) {
          this.take(parse(r.data)); this.failures = 0; this.lastOk = Date.now(); this.sources = r.data.sources ?? null;
          try { noteFeed((r.data.ac ?? r.data.aircraft ?? []).length); } catch {}
          this.note({ t: t0, ok: 1, n: this.planes.length, ms: Date.now() - t0, src: src === 'phone' ? `phone${r.remaining != null ? ' ' + r.remaining + ' left' : ''}` : 'relay', at });
        } else { this.failures++; this.note({ t: t0, ok: 0, ms: Date.now() - t0, err: `${src} ${r.net ? 'no answer' : r.status}`, at }); }
        const before = this.feed;
        this.feed = afterAnswer(this.feed, { src, ok: r.ok, status: r.status, remaining: r.remaining, retryAfter: r.retryAfter, net: r.net, online: typeof navigator === 'undefined' ? undefined : navigator.onLine }, Date.now(), this.cfg);
        this.count(src, r, before);
        /* the phone's own ask failed and the relay takes over: not a failure yet, and the relay is asked now, not a gap
           later (iOS simulator 2026-11-19: a 429 on the first ask said "Plane feed down" for 30 s before the relay answered) */
        if (src === 'phone' && !r.ok && pickSource(this.feed, { phoneOk: true, relayOk: true, now: Date.now() }) === 'relay') { this.failures = Math.max(0, this.failures - 1); this.lastFetch = 0; }
        try { localStorage.setItem('planeFeed', JSON.stringify(this.feed)); } catch {}
      })
      .finally(() => { this.busy = false; });
  }

  /* The session's feed numbers for the stats page (2026-11-19, the feed-cost question): asks to each source and how many
     were answered, adsb.lol's 429s, the lowest allowance it reported, and why the phone handed over to the relay. No
     place, no aircraft. main.js sends them as a 'feed' note when the app goes to the background (takeTally). */
  count(src, r, before) {
    const t = (this.tally ??= { ph: 0, phOk: 0, rl: 0, rlOk: 0, q: 0, low: -1, sw: '' });
    if (src === 'phone') { t.ph++; if (r.ok) t.phOk++; if (r.status === 429) { t.q++; t.sw = '429'; } if (Number.isFinite(r.remaining) && (t.low < 0 || r.remaining < t.low)) t.low = r.remaining; }
    else { t.rl++; if (r.ok) t.rlOk++; }
    if (src === 'phone' && !t.sw && this.feed.phoneOff && this.feed.phoneOff !== before.phoneOff) t.sw = Number.isFinite(this.feed.remaining) && this.feed.remaining <= this.cfg.switchAt ? 'low' : 'fails';
  }
  takeTally() { const t = this.tally; this.tally = null; return t && t.ph + t.rl ? t : null; }

  /* A fresh answer: a plane already drawn somewhere else slides to its new place (plane-feed.js easeLeft) instead of jumping */
  take(fresh) {
    const now = Date.now(), old = new Map(this.planes.map((p) => [p.hex, p]));
    for (const p of fresh) {
      const o = old.get(p.hex); if (!o) continue;
      /* how fast it's turning (deg/s, + right), from its last two fixes: js/sky-alerts.js sure() only foretells steady planes */
      const dt = (p.at - o.at) / 1000; if (dt >= 5 && dt <= 180 && p.gs > 50 && o.gs > 50) p.turn = ((((p.track - o.track) % 360) + 540) % 360 - 180) / dt; else if (dt < 5 && Number.isFinite(o.turn)) p.turn = o.turn;
      const a = drawnAt(o, now), b = extrapolate(p, Math.max(0, (now - p.at) / 1000));
      const d = { lat: a.lat - b.lat, lon: a.lon - b.lon, hKm: a.hKm - b.hKm };
      if (Math.abs(d.lat) + Math.abs(d.lon) < 0.2) p.ease = { ...d, t0: now }; /* a big jump (a wrong old fix) just moves */
    }
    this.planes = fresh;
  }

  // Planes above the horizon right now: [{ plane, az, el, rangeKm, enu }]
  positions(obs, nowMs = Date.now()) {
    const out = [];
    for (const p of this.planes) {
      const s = (nowMs - p.at) / 1000;
      if (s > maxAgeS(this.gapS)) continue; /* 60 s on the website (10 s polls), longer between the apps' 30 s asks */
      const q = drawnAt(p, nowMs);
      const pos = skyPosition(obs, q.lat, q.lon, q.hKm);
      if (pos.el > 0) out.push({ plane: p, ...pos });
    }
    return out;
  }

  // Airline + origin/destination for a callsign, or null. Cached; undefined while loading.
  route(callsign, plane = null) {
    if (!callsign || !/^[A-Z]{3}\d/.test(callsign)) return null; // registrations (private planes) have no route
    // The airline from the callsign's prefix, and the usual route from our server (2026-10-28, Sevaan): Virtual Radar
    // Server's standing data (CC0) by callsign. Only the callsign is sent. adsbdb was dropped 2026-10-25 for its licence.
    if (this.routes.has(callsign)) return this.routes.get(callsign);
    // Airlines outside the hand list need js/airlines.js (lazy, ~140 KB): undefined until it has loaded, then it's looked up.
    if (!AIRLINES[callsign.slice(0, 3)] && !airlineTable) { loadAirlines(); return undefined; }
    const airline = airlineFor(callsign, null), r = airline ? { airline, flight: callsign, from: '', to: '' } : null;
    this.routes.set(callsign, r); if (this.routes.size > 300) this.routes.delete(this.routes.keys().next().value);
    // Sky Collector: no server of ours, so the phone reads the same CC0 data straight from GitHub (js/routes.js).
    /* The plane itself goes with the lookup (2026-11-17): a route the plane isn't plausibly flying (Detroit to Detroit, or
       a path it's nowhere near) comes back null and the catch is a plane card with no flight card. */
    const pl = plane ?? this.planes.find((p) => p.callsign === callsign) ?? null;
    /* `wait` (not saved with the route) settles once the lookup is done: the widgets write again then (js/main.js sendSkyWidgets) */
    if (r && !SERVER) Object.defineProperty(r, 'wait', { value: lookupRoute(callsign, pl).then((x) => { if (x) { r.from = x.from.city; r.to = x.to.city; r.full = x; } else r.none = true; }).catch(() => {}) });
    if (r && SERVER) fetch(`${SERVER}/route?cs=${encodeURIComponent(callsign)}`, { signal: AbortSignal.timeout?.(8000) })
      .then((x) => (x.ok ? x.json() : null)).then((j) => { const st = j?.route; if (st?.length >= 2) { const nm = (a) => a.city || a.iata || a.icao; r.from = nm(st[0]); r.to = nm(st[st.length - 1]); } }).catch(() => {});
    return r;
  }
}

// The airline from the callsign's ICAO prefix (playtest 2026-10-22: adsbdb named ROU1908, Air Canada Rouge, as
// "Transportes Aereos I.R. Crusoe"). Common North American and long-haul operators by prefix first; otherwise adsbdb's
// name only when its own ICAO code matches the prefix; otherwise no airline (the flight number still shows).
const AIRLINES = { ACA: 'Air Canada', ROU: 'Air Canada Rouge', JZA: 'Jazz (Air Canada Express)', WJA: 'WestJet', WEN: 'WestJet Encore', POE: 'Porter',
  TSC: 'Air Transat', FLE: 'Flair', SWG: 'Sunwing', CJT: 'Cargojet', PCO: 'Pacific Coastal', AAL: 'American', DAL: 'Delta', UAL: 'United',
  SWA: 'Southwest', JBU: 'JetBlue', ASA: 'Alaska', NKS: 'Spirit', FFT: 'Frontier', AAY: 'Allegiant', SKW: 'SkyWest', RPA: 'Republic',
  ENY: 'Envoy', EDV: 'Endeavor', JIA: 'PSA', PDT: 'Piedmont', GJS: 'GoJet', CPZ: 'Compass', ASH: 'Mesa', QXE: 'Horizon', FDX: 'FedEx',
  UPS: 'UPS', BAW: 'British Airways', VIR: 'Virgin Atlantic', AFR: 'Air France', DLH: 'Lufthansa', KLM: 'KLM', ICE: 'Icelandair',
  UAE: 'Emirates', QTR: 'Qatar Airways', ETD: 'Etihad', THY: 'Turkish Airlines', AMX: 'Aeroméxico', CPA: 'Cathay Pacific', JAL: 'Japan Airlines',
  ANA: 'ANA', KAL: 'Korean Air', EIN: 'Aer Lingus', SAS: 'SAS', IBE: 'Iberia', SWR: 'Swiss', AUA: 'Austrian', TAP: 'TAP Air Portugal',
  KOW: 'Baker Aviation', TWB: 'T’way Air', VIV: 'Viva', UCA: 'CommutAir', ARE: 'LATAM Colombia', LNE: 'LATAM Ecuador' }; /* names the airline facts' research found missing or changed (2026-11-18) */
// Every ICAO airline code -> name (js/airlines.js, built by scripts/build-airlines.mjs), loaded once, lazily.
let airlineTable = null, airlineLoad = null;
export function loadAirlines() {
  return (airlineLoad ??= import('./airlines.js?v=0.1.1828').then((m) => { airlineTable = m.AIRLINE_NAMES; return airlineTable; }).catch(() => { airlineTable = {}; return airlineTable; }));
}
export function airlineName(callsign) { return /^[A-Z]{3}\d/.test(callsign ?? '') ? airlineFor(callsign, null) : ''; }
function airlineFor(callsign, a) {
  const pre = callsign.slice(0, 3).toUpperCase();
  if (AIRLINES[pre]) return AIRLINES[pre];
  if (airlineTable?.[pre]) return airlineTable[pre];
  return a?.name && (a.icao ?? '').toUpperCase() === pre ? a.name : '';
}

// Friendly names for the aircraft you’re most likely to see overhead.
const TYPES = {
  A19N: 'Airbus A319neo', A20N: 'Airbus A320neo', A21N: 'Airbus A321neo', A319: 'Airbus A319', A320: 'Airbus A320', A321: 'Airbus A321',
  A332: 'Airbus A330', A333: 'Airbus A330', A338: 'Airbus A330neo', A339: 'Airbus A330neo', A359: 'Airbus A350', A35K: 'Airbus A350',
  A388: 'Airbus A380', BCS1: 'Airbus A220', BCS3: 'Airbus A220',
  B737: 'Boeing 737', B738: 'Boeing 737', B739: 'Boeing 737', B38M: 'Boeing 737 MAX', B39M: 'Boeing 737 MAX', B3XM: 'Boeing 737 MAX',
  B752: 'Boeing 757', B763: 'Boeing 767', B764: 'Boeing 767', B77W: 'Boeing 777', B772: 'Boeing 777', B77L: 'Boeing 777', B744: 'Boeing 747', B748: 'Boeing 747',
  B788: 'Boeing 787', B789: 'Boeing 787', B78X: 'Boeing 787',
  CRJ2: 'Bombardier CRJ', CRJ7: 'Bombardier CRJ', CRJ9: 'Bombardier CRJ', DH8A: 'Dash 8', DH8B: 'Dash 8', DH8C: 'Dash 8', DH8D: 'Dash 8 Q400',
  E170: 'Embraer 170', E75L: 'Embraer 175', E75S: 'Embraer 175', E190: 'Embraer 190', E195: 'Embraer 195', E290: 'Embraer E2', E295: 'Embraer E2',
  AT72: 'ATR 72', AT76: 'ATR 72', C172: 'Cessna 172', C182: 'Cessna 182', C208: 'Cessna Caravan', PC12: 'Pilatus PC-12', P28A: 'Piper Cherokee', SR22: 'Cirrus SR22',
};
// Sky Collector: the exact type name first (js/sky-type-names.js, 2026-11-17), then the short one, then the feed's own description.
/* The feed's own description, made readable (2026-11-19, Sevaan: "PIPER PA-31-300/310/325/350/425" was cut off): a list of
   variants is dropped ("Piper PA-31"), and only plain words are lower-cased, never a model code ("PA-31", not "Pa-31"). */
export const cleanDesc = (d) => String(d ?? '').trim().replace(/-[A-Z0-9]+(?:\/[A-Z0-9]+)+$/i, '').replace(/\s*\/\s*[A-Z0-9-]+$/i, '').replace(/\b([A-Z])([A-Z]{1,})\b(?![-\d])/g, (m, a, b) => a + b.toLowerCase());
export function aircraftName(p) { return typeName(p.type) ?? TYPES[p.type] ?? (p.desc ? cleanDesc(p.desc) : ''); }
// Helicopters: ADS-B emitter category A7, or an ICAO type designator that is a helicopter (many helicopters don’t
// broadcast a category). Covers the common civil, medical, police and military types.
// QA 2026-11-19: B17 (the B-17 bomber, a Legendary card) was a helicopter; added the H500, H269, MD 500/600/900, AW149,
// Bell 427/430/222/230/47, Cabri, Super Puma and KA32 codes.
const HELI_TYPES = /^(A1(09|19|39|69|89)|AS(32|35|50|55|65)|AW(09|39|69|89)|B(06|06T|105|212|222|230|407|412|427|429|430|47G|505)|B4(07|12|29)|A149|AS3B|G2CA|H(269|500)|MD(52|60|90)|BK17|EC(20|25|30|35|45|55|75|130|135|145|155|175|225)|EH10|EN(28|48)|EXPL|H(12|13|25|46|47|53|60|64|72)|H1(25|30|35|45|55|60|75)|H(215|225)|HUCO|K(32|A32|MAX)|LYNX|MI(2|8|17|24|26)|NH90|PUMA|R(22|44|66)|S(55|58|61|64|70|76|92)|SCHW|TIGR|UH1|UH60|V22|NOTA)$/;
export function isHelicopter(p) { const t = String(p.type ?? '').toUpperCase(); if (/^(BALL|SHIP|GLID)$/.test(t)) return false; /* a real balloon broadcast category A7 (2026-11-19) */ return p.category === 'A7' || HELI_TYPES.test(t); }

/* The rest of the world (2026-11-15, Sevaan: "does it work anywhere?"): major airlines by ICAO code, so flights outside
   North America and Europe get a name even when the route lookup has none. */
Object.assign(AIRLINES, {
  QFA: 'Qantas', JST: 'Jetstar', VOZ: 'Virgin Australia', ANZ: 'Air New Zealand', SIA: 'Singapore Airlines', TGW: 'Scoot',
  MAS: 'Malaysia Airlines', AXM: 'AirAsia', THA: 'Thai Airways', GIA: 'Garuda Indonesia', PAL: 'Philippine Airlines', CEB: 'Cebu Pacific',
  VNA: 'Vietnam Airlines', VJC: 'VietJet', CCA: 'Air China', CES: 'China Eastern', CSN: 'China Southern', CHH: 'Hainan Airlines',
  CXA: 'Xiamen Airlines', CSC: 'Sichuan Airlines', EVA: 'EVA Air', CAL: 'China Airlines', AIC: 'Air India', IGO: 'IndiGo',
  AAR: 'Asiana', JJA: 'Jeju Air', HKE: 'HK Express', APJ: 'Peach', JTA: 'Japan Transocean Air', SVA: 'Saudia', ELY: 'El Al',
  MEA: 'Middle East Airlines', GFA: 'Gulf Air', OMA: 'Oman Air', KAC: 'Kuwait Airways', FDB: 'flydubai', ABY: 'Air Arabia',
  RJA: 'Royal Jordanian', MSR: 'EgyptAir', ETH: 'Ethiopian', KQA: 'Kenya Airways', SAA: 'South African Airways', RAM: 'Royal Air Maroc',
  RYR: 'Ryanair', EZY: 'easyJet', EJU: 'easyJet', EZS: 'easyJet', WZZ: 'Wizz Air', NAX: 'Norwegian', NSZ: 'Norwegian', FIN: 'Finnair',
  LOT: 'LOT Polish Airlines', ITY: 'ITA Airways', VLG: 'Vueling', EWG: 'Eurowings', CFG: 'Condor', TOM: 'TUI', BEL: 'Brussels Airlines',
  AEE: 'Aegean', TVF: 'Transavia', TRA: 'Transavia', CSA: 'Czech Airlines', SXS: 'SunExpress', PGT: 'Pegasus', AFL: 'Aeroflot',
  LOG: 'Loganair', SHT: 'British Airways', CLH: 'Lufthansa CityLine', DLA: 'Air Dolomiti', CLX: 'Cargolux', GEC: 'Lufthansa Cargo',
  BCS: 'DHL', DHK: 'DHL', LAN: 'LATAM', TAM: 'LATAM', LPE: 'LATAM', GLO: 'Gol', AZU: 'Azul', AVA: 'Avianca', CMP: 'Copa Airlines',
  ARG: 'Aerolíneas Argentinas', VIV: 'Viva', VOI: 'Volaris', HAL: 'Hawaiian', SCX: 'Sun Country', MXY: 'Breeze',
  GTI: 'Atlas Air', ABX: 'ABX Air', CKS: 'Kalitta Air',
});
