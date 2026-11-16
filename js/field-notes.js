// Anonymous usage and error reports (2026-10-24, Sevaan: "how do I know if people are coming back on other nights?").
// A few game events (the install, each open, each night with a catch, the end of a session, the tour, motion, Line up,
// Plus) and uncaught errors, tied only to a random ID made on this phone. No location, no names, no device IDs. They go in
// small batches to our server (functions/index.js, POST /api/t); its /stats page shows the first-night catch rate and how many come
// back. Settings → Help → "Share anonymous usage" (pref 'share', on by default) stops them. File named to stay clear of
// content blockers' lists (see CLAUDE.md: avoid push / ads / track / analytics / beacon in js/ file names).
import { VERSION } from './version.js?v=0.1.1595';
import { isNative } from './native.js?v=0.1.1595';
import { TESTER } from './build-flavor.js?v=0.1.1595';

import { SERVER } from './server.js?v=0.1.1595';
const URL_ = SERVER ? `${SERVER}/t` : ''; // our server (2026-10-25)
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const on = () => !TESTER && ls.get('share') !== '0'; /* SC Tester never sends anything (2026-10-31, Sevaan: "Don't include SC Tester in those stats ever") */
const platform = () => (isNative() ? (globalThis.Capacitor?.getPlatform?.() === 'android' ? 'android' : 'ios') : 'web');
// Test builds and the website (the test build) are marked, so the dashboard can leave them out.
/* The native apps load from localhost too (capacitor://localhost, https://localhost), so the localhost check marked every
   store install as a test build and the players-only stats were empty (2026-11-06). The website is always a test build. */
/* Android emulators count as tests too (their model is sdk_gphone…, "Android SDK built for…"); iOS simulators can't be told apart (2026-11-06). */
const emulator = /sdk_gphone|Android SDK built for|google_sdk|Emulator|; generic/i.test(navigator.userAgent);
const testing = () => TESTER || !isNative() || ls.get('dev') === '1' || emulator;
let id = ls.get('tid'), fresh = false;
if (!id) { const a = new Uint8Array(12); crypto.getRandomValues(a); id = [...a].map((b) => b.toString(16).padStart(2, '0')).join(''); ls.set('tid', id); ls.set('tidAt', String(Date.now())); fresh = true; }
const installedAt = () => Number(ls.get('tidAt')) || Date.now();
export const daysSinceInstall = () => Math.floor((Date.now() - installedAt()) / 864e5);
export const isInstallNight = (nightKeyOfNow, nightKeyOfInstall) => nightKeyOfNow === nightKeyOfInstall;

let queue = []; try { queue = JSON.parse(ls.get('noteQ') ?? '[]'); } catch {}
const keep = () => ls.set('noteQ', JSON.stringify(queue.slice(-80)));
export function note(name, data = {}) {
  if (!on()) return;
  queue.push([name, Date.now(), data]); if (queue.length > 80) queue = queue.slice(-80); keep();
  if (queue.length >= 20) send();
}
export function send() {
  if (!on() || !URL_ || !queue.length) return;
  const body = JSON.stringify({ i: id, v: VERSION, p: platform(), x: testing() ? 1 : 0, e: queue.slice(0, 60) });
  const sent = queue.length; let ok = false;
  try { ok = navigator.sendBeacon?.(URL_, new Blob([body], { type: 'text/plain' })) ?? false; } catch {}
  if (!ok) fetch(URL_, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {});
  queue = queue.slice(Math.min(sent, 60)); keep();
}
if (fresh) note('install', {});
setInterval(send, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(); });

// Errors: uncaught ones and rejected promises, a few per session, each message once.
const seen = new Set(); let errs = 0;
export function noteError(m, src = '', line = 0, col = 0) {
  const msg = String(m ?? '').slice(0, 200); if (!msg || msg === 'Script error.' /* another site's script; the browser hides what went wrong */ || seen.has(msg) || errs >= 8) return; seen.add(msg); errs++;
  note('err', { m: msg, s: String(src ?? '').replace(/^.*\/(js\/)?/, '').replace(/\?.*$/, '').slice(0, 60), l: line | 0, c: col | 0 });
}
addEventListener('error', (e) => { if (e?.message) noteError(e.message, e.filename, e.lineno, e.colno); });
addEventListener('unhandledrejection', (e) => { const r = e?.reason; noteError(r?.message ?? String(r), r?.stack?.split('\n')[1] ?? '', 0, 0); });
