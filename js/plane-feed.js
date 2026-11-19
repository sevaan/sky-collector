// Where the planes come from, and how often (2026-11-18, Sevaan: "it's just a free game", so planes must cost nothing).
// Pure rules, no DOM, no network: js/planes.js asks them what to do; tests/plane-feed.test.mjs runs a whole day.
// - Phone first: in the apps each phone asks adsb.lol itself (free; adsb.lol allows about 500 requests a day for each
//   internet address without a key, and says how many are left in x-ratelimit-remaining).
// - Frugal: every 30 s when nothing depends on it, every 10 s while a plane is near the circle or something is being
//   steered to; slower as the day's allowance runs low; none in the background (planes.js).
// - Backup: when the phone's allowance is nearly gone, on a 429, or after two failures in a row, the app's own relay
//   (our server, FlyItalyADSB) for the rest of that day; adsb.lol again the next day. The website only has the relay.
// - The dial: the numbers come from spacecollector.app/dial/planes.json when it can be fetched (clampDial), else DEFAULTS.
// Sky Collector (2026-11-19, the native app): this file is Space Collector's, unchanged, so fixes port both ways. Sky has
// no dial yet (js/planes.js DIAL is empty), so DEFAULTS stand.

export const DEFAULTS = {
  idleS: 30,      // seconds between asks when nothing depends on it
  nearS: 10,      // while a plane is near the circle, pinned, or something is being steered to
  lowAt: 120,     // remaining requests at which the phone starts to slow down
  slowS: 60,      // the idle gap once low (near: idle gap)
  switchAt: 25,   // remaining at which the phone hands over to the relay for the day
  maxFails: 2,    // failures in a row before the phone hands over for the day
  relayDownS: 300,// after the relay failed twice, how long before it's tried again
  maxBackoff: 6,  // failures stretch the gap up to this many times
};
const BOUNDS = { idleS: [5, 300], nearS: [5, 120], lowAt: [0, 2000], slowS: [5, 600], switchAt: [0, 500], maxFails: [1, 10], relayDownS: [30, 3600], maxBackoff: [1, 20] };

/** The dial from the server, kept to sane numbers; anything missing or odd keeps the default. */
export function clampDial(j) {
  const out = { ...DEFAULTS };
  if (!j || typeof j !== 'object') return out;
  for (const [k, [lo, hi]] of Object.entries(BOUNDS)) { const v = Number(j[k]); if (Number.isFinite(v)) out[k] = Math.min(hi, Math.max(lo, v)); }
  if (out.nearS > out.idleS) out.nearS = out.idleS;
  return out;
}

/** The UTC day, as a key ('2026-11-18'): adsb.lol's daily allowance resets at 00:00 UTC (its API page, 2026-11-19), so
 *  the phone's allowance and the switch to the relay last until then, not until local midnight. */
export function dayKey(ms) { const d = new Date(ms); return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`; }

/** A fresh state (kept in localStorage 'planeFeed' by planes.js). */
export const freshFeed = () => ({ day: '', phoneOff: '', phoneOffUntil: 0, phoneFails: 0, netFails: 0, remaining: null, relayFails: 0, relayDownUntil: 0, failures: 0 });

/** Which source to ask now: 'phone' (adsb.lol from the phone), 'relay' (our server), or 'none' (both down for now).
 *  phoneOk: this is the app (CapacitorHttp). relayOk: a relay URL is configured. */
export function pickSource(st, { phoneOk, relayOk, now }) {
  const today = dayKey(now);
  if (phoneOk && st.phoneOff !== today && now >= (st.phoneOffUntil || 0)) return 'phone';
  if (relayOk && now >= st.relayDownUntil) return 'relay';
  return 'none';
}

/** Seconds until the next ask. near: something on screen depends on fresh planes. */
export function nextGap(st, src, { near }, cfg = DEFAULTS) {
  if (src === 'none') return cfg.relayDownS;
  let s = near ? cfg.nearS : cfg.idleS;
  if (src === 'phone' && st.remaining != null && st.remaining < cfg.lowAt) {
    /* low: the idle gap stretches, and near drops to the idle pace, so the rest of the day's allowance lasts */
    s = near ? cfg.idleS : cfg.slowS;
    if (st.remaining < cfg.lowAt / 2) s *= 2;
  }
  return s * Math.min(cfg.maxBackoff, 2 ** st.failures);
}

/** The state after an answer. r: { src, ok, status, remaining, retryAfter (seconds, from a 429), net, online } (remaining from adsb.lol's header, if any;
 *  net: the request never got an answer (no signal, couldn't connect); online: navigator.onLine at the time). */
export function afterAnswer(st, r, now, cfg = DEFAULTS) {
  const today = dayKey(now), s = { ...st };
  if (s.day !== today) { s.day = today; s.phoneFails = 0; s.remaining = null; } /* a new day: adsb.lol again */
  /* No answer at all is not adsb.lol saying no (Fable 2026-11-19: a phone opened with no signal handed the whole day to the
     relay). Offline it only backs off; online, six in a row rest that source for half an hour, never the day. */
  if (r.net) {
    s.failures++;
    if (r.online !== false && ++s.netFails >= cfg.maxFails * 3) { s.netFails = 0; s.failures = 0; if (r.src === 'phone') s.phoneOffUntil = now + 30 * 60e3; else s.relayDownUntil = now + cfg.relayDownS * 1000; }
    return s;
  }
  s.netFails = 0;
  if (r.src === 'phone') {
    if (Number.isFinite(r.remaining)) s.remaining = r.remaining;
    if (r.ok) { s.phoneFails = 0; s.failures = 0; if (s.remaining != null && s.remaining <= cfg.switchAt) s.phoneOff = today; }
    else {
      s.phoneFails++;
      if (r.status === 429 && Number.isFinite(r.retryAfter) && r.retryAfter > 0) { s.phoneOffUntil = now + Math.min(r.retryAfter, 86400) * 1000; s.phoneFails = 0; s.failures = 0; } /* over quota with a Retry-After: rest exactly that long, then adsb.lol again */
      else if (r.status === 429 || s.phoneFails >= cfg.maxFails) { s.phoneOff = today; s.failures = 0; } /* the relay takes over at once, until the UTC day turns */
      else s.failures++;
    }
  } else if (r.src === 'relay') {
    if (r.ok) { s.relayFails = 0; s.failures = 0; }
    else { s.relayFails++; s.failures++; if (s.relayFails >= cfg.maxFails) { s.relayDownUntil = now + cfg.relayDownS * 1000; s.relayFails = 0; s.failures = 0; } }
  }
  return s;
}

/** Both sources down for now: the only time the player is told planes are off. */
export function feedDown(st, { phoneOk, relayOk, now }) { return pickSource(st, { phoneOk, relayOk, now }) === 'none'; }

/** How long a plane may go unheard before it's dropped: two gaps, never under a minute (planes move along their
 *  track between answers, so a 30 s gap still looks right). */
export function maxAgeS(gapS) { return Math.max(60, Math.min(240, gapS * 2 + 10)); }

/** Easing a correction: a fresh answer that puts a plane somewhere other than where it was drawn slides it there over
 *  EASE_MS instead of jumping. Returns the share of the old offset still applied at t. */
export const EASE_MS = 1500;
export function easeLeft(t0, t) { const k = (t - t0) / EASE_MS; return k >= 1 ? 0 : k <= 0 ? 1 : 1 - k * k * (3 - 2 * k); }
