// One Web Audio context for the page, shared by the music (js/music.js) and sound effects (js/sfx.js): iPhones
// allow only a few contexts, and one context means one volume world. The page’s audio session is "ambient", so
// the ring/silent switch mutes everything and the player’s own music keeps playing.
let ctx = null;
try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {}
/* is there a context yet (a sound that's only decoration skips making one: ~130 ms, 2026-11-11 jank audit) */
export const audioMade = () => !!ctx;

/* Leaving the app without a tone (2026-11-12, Sevaan: "swipe up from the bottom… a high pitch tone for a moment"; it had been
   fixed for the music on 2026-10-21, but sound effects went straight to the speakers). Every sound goes through one master
   volume (audioOut). On leaving it fades to silence in 30 ms, sounds still playing are stopped, then the context is
   suspended, so iOS never freezes the app mid-wave (a cut-off running context repeats its last few milliseconds as a short
   tone). Nothing resumes the context between leaving and coming back (the deep review, 2026-11-12): audioCtx() doesn't,
   and a resume that lands late is suspended again (onstatechange). */
let out = null, leaving = false, awayT = 0;
const live = new Set(); /* sounds that can be stopped on leaving, so they don't finish an hour later on return */
const gone = () => leaving || (typeof document !== 'undefined' && document.hidden);
export const audioIfAny = () => ctx;
/* true from leaving until back */
export const audioLeaving = () => leaving;
export function audioCtx() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    try { ctx.addEventListener('statechange', () => { if (gone() && ctx.state === 'running') ctx.suspend().catch(() => {}); }); } catch {} }
  if (!gone() && (ctx.state === 'suspended' || ctx.state === 'interrupted')) ctx.resume().catch(() => {}); // iPhone reports 'interrupted' after the app was in the background
  return ctx;
}
export function audioOut() {
  const c = audioCtx(); if (!c) return null;
  if (!out) { out = c.createGain(); out.gain.value = gone() ? 0 : 1; out.connect(c.destination); }
  return out;
}
/* a playing source (buffer or oscillator) registers here; it's stopped if the app leaves before it ends */
export function audioTrack(src) { try { live.add(src); src.addEventListener('ended', () => live.delete(src), { once: true }); } catch {} }
/* now: silence and suspend inside the caller's own event handler, no timers (2026-11-18, Sevaan: "when I swiped out of Sky
   Collector [Safari], there was a high-pitched beep"). Swiping Safari away can freeze the page before a 40-120 ms timer
   runs, so the context was still running at the freeze. The gentle fade stays for the native app (its appStateChange
   'inactive' comes early enough; the fade is what stopped the click of 2026-10-21) and for the way back. */
function silenceNow() {
  leaving = true; clearTimeout(awayT);
  if (!ctx) return;
  try { if (out) { const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(0, t); out.gain.value = 0; } } catch {}
  for (const s of live) { try { s.stop(); } catch {} } live.clear();
  try { if (ctx.state === 'running') ctx.suspend().catch(() => {}); } catch {}
}
export function audioAway(hidden, { now = false } = {}) {
  if (hidden && now) return silenceNow();
  if (hidden && leaving && ctx && ctx.state !== 'running') return; /* already silenced and suspended by silenceNow */
  leaving = !!hidden; clearTimeout(awayT);
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    /* coming back to a suspended context: the fade-in waits for resume (below). Scheduled on the stopped clock, then again
       after resume, the two ramps overlapped and both browsers held the volume part way (the pack page came back at 13-27%,
       2026-11-18). */
    if (out && (hidden || ctx.state === 'running')) { out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(hidden ? 0 : 1, t + (hidden ? 0.03 : 0.02)); }
    if (hidden) { /* after the fade (plus the output's own delay, e.g. Bluetooth), stop what's left and suspend */
      const wait = Math.min(120, 40 + 1000 * ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)));
      awayT = setTimeout(() => { if (!leaving) return; for (const s of live) { try { s.stop(); } catch {} } live.clear(); if (ctx.state === 'running') ctx.suspend().catch(() => {}); }, wait);
    } else if (ctx.state !== 'running') ctx.resume().then(() => { /* the fade-in again, on a running clock: one scheduled on the stopped clock could stick part way (the pack page came back at 13% volume, 2026-11-18) */
      if (leaving || !out) return; try { const t2 = ctx.currentTime; out.gain.cancelScheduledValues(t2); out.gain.setValueAtTime(out.gain.value, t2); out.gain.linearRampToValueAtTime(1, t2 + 0.02); } catch {} }).catch(() => {});
  } catch {}
}
/* The trigger lives here, with the context, so every page that makes one is covered without music.js (the sample pack
   page never imported it, so nothing silenced it at all). On the web only: the native app keeps its fade, driven by
   appStateChange in main.js. */
const nativeApp = () => { try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; } };
if (typeof document !== 'undefined' && !nativeApp()) {
  const leave = () => audioAway(true, { now: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); else audioAway(false); });
  addEventListener('pagehide', leave);
  document.addEventListener('freeze', leave);
  addEventListener('pageshow', (e) => { if (e.persisted && !document.hidden) audioAway(false); }); /* back from the back/forward cache */
  document.addEventListener('resume', () => { if (!document.hidden) audioAway(false); }); /* unfrozen */
}
