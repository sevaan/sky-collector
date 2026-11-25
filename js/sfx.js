// Sound effects (2026-10-11, Sevaan’s picks from the v2 sound board). All but one are the designed set: glass bells,
// soft mallets, kalimba and airy breaths, all in G major so they sit inside the music ("Permafrost"). The toast is
// "Notification Sound 2" by deadrobotmusic (Freesound, CC0), softened. Files: assets/audio/sfx/<name>.mp3.
// Decoded once into memory after the first tap, played through the shared context (js/audio-ctx.js) so they’re instant.
// Off with Settings → Sounds and vibration (localStorage sound = '0').
import { audioCtx, audioOut, audioLeaving, audioTrack } from './audio-ctx.js?v=0.1.1921';
import { VERSION } from './version.js?v=0.1.1921';
export const SFX = ['lock', 'collect', 'arrive', 'flip', 'r_common', 'r_uncommon', 'r_rare', 'r_epic', 'r_legend', 'shiny', 'seen', 'stamp', 'levelup', 'xp',
  'mission', 'rankup', 'patch', 'coinroll', 'complete', 'secret', 'fossil', 'ufo', 'welcome', 'swipe', 'step', 'toggle', 'toast', 'page', 'rattle', 'plane', 'tear'];
const BASE = new URL('../assets/audio/sfx/', import.meta.url).href;
const bufs = new Map(), last = new Map();
let loading = null, failedAt = -1e9;
/* The Collection runs in a frame, which would get its own audio context, volume and decoded files, none of them faded or
   suspended when the app leaves (the deep review, 2026-11-12). Framed, every sound is played by the app's window instead. */
const host = () => { try { return typeof window !== 'undefined' && window.top !== window && window.top.scAudio ? window.top.scAudio : null; } catch { return null; } }; /* asked each time: the frame can load before or after the app's own modules */
// Everything plays at a quarter of the files' level (2026-10-11, Sevaan halved it twice), times the Settings volume (0–1).
const LEVEL = 0.25; // halved again 2026-10-11
export const sfxVolume = () => { try { const v = parseFloat(localStorage.getItem('sfxVol')); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5; } catch { return 0.5; } } /* 50% by default (2026-10-28, Sevaan) */; // default 75% (2026-10-19, Sevaan)
const soundOff = () => { try { return localStorage.getItem('sound') === '0'; } catch { return false; } };
/* One file, fetched and decoded once however many ask for it at the same time. */
const inflight = new Map();
function loadOne(ctx, n) {
  if (bufs.has(n)) return Promise.resolve(bufs.get(n));
  if (inflight.has(n)) return inflight.get(n);
  let sig; try { sig = AbortSignal.timeout(8000); } catch {} /* a fetch that never settles no longer blocks every later load */
  const p = fetch(`${BASE}${n}.mp3?v=${VERSION}`, sig ? { signal: sig } : undefined).then((r) => { if (!r.ok && r.status !== 0) throw 0; return r.arrayBuffer(); }) /* status 0: an app serves its bundled mp3 files with no HTTP status (Capacitor), so ok is false though the file is there (Space Collector 65f05e01; Sky's future app would have had no sound effects) */
    .then((a) => new Promise((ok, no) => ctx.decodeAudioData(a, ok, no))).then((b) => { bufs.set(n, b); audible.set(n, audibleLength(b)); return b; })
    .catch(() => null).finally(() => inflight.delete(n));
  inflight.set(n, p); return p;
}
/* first: sounds to fetch and decode ahead of the rest (the welcome pack's tear, 2026-11-18: Sevaan tore the opener on his
   first touch and heard nothing, because its file was still waiting in the queue of 31). */
/* Sky's sample pack page (skycollector.app/pack, 2026-11-18) plays only a few of these: sfxOnly(names) limits every load to
   them, so a first touch there no longer fetches and decodes all 31 (on a cold iPhone that could read as a freeze). */
let only = null;
export function sfxOnly(names) { only = names ? new Set(names) : null; }
export function loadSfx(first = [], { rest = true } = {}) {
  { const h = host(); if (h) return h.loadSfx(first, { rest }); }
  const ctx = audioCtx(); if (!ctx) return loading;
  for (const n of first) if (SFX.includes(n)) loadOne(ctx, n);
  if (!rest) return null; /* only these now (a new player's pack sounds under the loader); the rest later, in idle time */
  if (only) return Promise.all([...only].filter((n) => SFX.includes(n)).map((n) => loadOne(ctx, n)));
  if (loading) return loading;
  const need = SFX.filter((n) => !bufs.has(n)); if (!need.length || performance.now() - failedAt < 10000) return null; /* only what's missing, and not again within 10 s of a failed round (a missing file refetched all 30 on every play) */
  return (loading = Promise.all(need.map((n) => loadOne(ctx, n))).then(() => { loading = null; if (bufs.size < SFX.length) failedAt = performance.now(); })); // some failed (offline): try again on a later tap (bug hunt 2026-10-20)
}
// name: one of SFX. gain: 0–1 on top of the file’s own level. gap: skip if the same sound played less than gap ms ago.
// delay: seconds from now (scheduled on the audio clock, so it stays in time with animations).
// Sounds: Sevaan’s picks from the sound board (design/sound-board.html, 2026-10-18): mostly the original designed set
// ("old", scripts/sfx-synth.py / sfx-round.py), plus a few UI SFX cues (uisfx.com, CC0): lock zen snap, flip zen forward,
// seen zen select, stamp zen check, levelup zen streak, xp mechanical progress-step,
// secret soft wake, rattle zen drag-start. NORM is written by scripts/sfx-levels.py from each file’s measured
// loudness (EBU R128) and a target per event: payoffs loudest, taps and ticks quietest. Rerun it after changing a file.
const NORM = {"arrive": 0.85, "coinroll": 0.93, "collect": 0.85, "complete": 1.32, "flip": 0.52, "fossil": 1.16, "levelup": 1.18, "lock": 0.75, "mission": 1.05, "page": 1.88, "patch": 1.1, "plane": 0.76, "r_common": 0.9, "r_epic": 1.28, "r_legend": 1.25, "r_rare": 1.37, "r_uncommon": 0.9, "rankup": 1.12, "rattle": 0.9, "secret": 0.89, "seen": 1.15, "shiny": 2.27, "stamp": 1.23, "step": 1.46, "swipe": 0.84, "tear": 0.75, "toast": 1.58, "toggle": 1.88, "ufo": 1.49, "welcome": 0.61, "xp": 0.41};
// At most two at once: a third small sound is skipped rather than piling on (a Saturn catch stacked four over 5 s).
const STINGERS = new Set(['r_common', 'r_uncommon', 'r_rare', 'r_epic', 'r_legend', 'shiny', 'rankup', 'levelup', 'mission', 'complete', 'secret', 'welcome']);
let playing = 0;
// How long each file is actually audible (2026-10-17 haptics playtest: the cap counted silent tails, e.g. lock is heard
// for 0.22 s of 1.05 s, so lock + collect filled both slots and the reveal’s whoosh was dropped). Measured once on load:
// the last sample louder than 2% of the file’s peak.
const audible = new Map();
function audibleLength(b) {
  const d = b.getChannelData(0); let peak = 0; for (let i = 0; i < d.length; i += 4) peak = Math.max(peak, Math.abs(d[i]));
  const th = peak * 0.02; let end = d.length - 1; while (end > 0 && Math.abs(d[end]) < th) end -= 8;
  return Math.max(0.05, end / b.sampleRate);
}
const UNCAPPED = new Set(['arrive', 'tear']); // the reveal’s whoosh and the pack's tear always play
function start(ctx, name, b, gain, delay, dur = 0) {
  try { const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = b; g.gain.value = gain * (NORM[name] ?? 1) * LEVEL * sfxVolume(); src.connect(g).connect(audioOut() ?? ctx.destination); playing++;
    if (dur > 0) { const t1 = ctx.currentTime + delay + dur / 1000; g.gain.setValueAtTime(g.gain.value, Math.max(ctx.currentTime, t1 - 0.06)); g.gain.linearRampToValueAtTime(0.0001, t1); src.stop(t1 + 0.01); } /* dur (ms): trimmed, with a 60 ms fade (the pack reveal's short tear, 2026-11-20) */ let freed = false; const free = () => { if (!freed) { freed = true; playing = Math.max(0, playing - 1); } }; setTimeout(free, (delay + Math.min(1.2 /* a long sound (the 5.6 s secret) must not hold a slot and mute the reveal's sounds: Fable hunt 2026-11-17 */, audible.get(name) ?? b.duration)) * 1000 + 30); audioTrack(src); src.start(ctx.currentTime + delay); } catch {}
}
/* wait (2026-11-18, Sevaan tore the welcome pack on his first touch and heard nothing): a sound that must not be lost
   can wait up to `wait` ms for its file to decode and for the context to run, then plays once, or is dropped. Only ever
   one waiting per name, so nothing piles up into a burst. A finger lifting (or a click or key) during the wait resumes
   the context: on iPhone a finger still moving across the pack doesn't count as a gesture that may start audio. */
const waiting = new Map();
const NUDGE = ['pointerup', 'touchend', 'click', 'keydown'];
function later(ctx, name, gain, delay, t0, wait) {
  if (waiting.has(name)) return;
  const tok = {}; waiting.set(name, tok);
  const nudge = () => { if (ctx.state !== 'running' && !document.hidden && !audioLeaving()) ctx.resume().catch(() => {}); };
  for (const e of NUDGE) addEventListener(e, nudge, { capture: true, passive: true });
  const end = () => { if (waiting.get(name) === tok) waiting.delete(name); for (const e of NUDGE) removeEventListener(e, nudge, { capture: true }); };
  loadOne(ctx, name); nudge();
  const tick = () => {
    if (waiting.get(name) !== tok) return end();
    if (performance.now() - t0 > wait || soundOff() || document.hidden || audioLeaving()) return end();
    const b = bufs.get(name);
    if (b && ctx.state === 'running') { end(); return start(ctx, name, b, gain, delay); }
    setTimeout(tick, 25);
  };
  tick();
}
export function sfx(name, { gain = 1, gap = 0, delay = 0, wait = 0, dur = 0 } = {}) {
  { const h = host(); if (h) return h.sfx(name, { gain, gap, delay, wait, dur }); }
  if (soundOff() || document.hidden || audioLeaving()) return; // nothing to hear in the background, and audioCtx() would wake the suspended context (bug hunt 2026-10-22)
  const ctx = audioCtx(); if (!ctx) return;
  const b = bufs.get(name); if (!b && !wait) { loadSfx([name]); return; }
  const now = performance.now(); if (gap && now - (last.get(name) ?? -1e9) < gap) return; last.set(name, now);
  if (playing >= 2 && !STINGERS.has(name) && !UNCAPPED.has(name)) return;
  /* Only on a running context: on a suspended one the clock is frozen, so every sound asked for meanwhile would start
     together on resume (a welcome card left rattling for a minute played eleven rattles at the first tap). A context
     that wakes within a quarter second (the tap that unlocks it) still gets its sound; one asked with `wait`, a little longer. */
  if (b && ctx.state === 'running') start(ctx, name, b, gain, delay, dur);
  else if (wait) later(ctx, name, gain, delay, now, wait);
  else ctx.resume().then(() => { if (ctx.state === 'running' && performance.now() - now < 250 && !document.hidden && !audioLeaving()) start(ctx, name, b, gain, delay); }).catch(() => {});
}
// Load on the first tap (the context can only start from one), so the first real sound is ready.
if (typeof document !== 'undefined') document.addEventListener('pointerdown', () => loadSfx(), { once: true, capture: true });

// A heartbeat thump (2026-10-21, slick idea 05): a low, soft beat drawn on the fly (no file), for the held breath before
// an Epic or Legendary card turns over. Follows the Sounds switch and volume like every other sound.
export function heartbeat(strong = false) {
  { const h = host(); if (h) return h.heartbeat(strong); }
  if (soundOff() || document.hidden || audioLeaving()) return; // nothing to hear in the background, and audioCtx() would wake the suspended context (bug hunt 2026-10-22)
  const ctx = audioCtx(); if (!ctx || ctx.state !== 'running') return;
  try {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sine'; o.frequency.setValueAtTime(strong ? 68 : 60, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.16);
    f.type = 'lowpass'; f.frequency.value = 180;
    const peak = (strong ? 0.9 : 0.6) * LEVEL * 2.4 * sfxVolume();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(f).connect(g).connect(audioOut() ?? ctx.destination); audioTrack(o); o.start(t); o.stop(t + 0.25);
  } catch {}
}
/* the app's own window plays the frame's sounds too (see host above) */
try { if (typeof window !== 'undefined' && window.top === window) window.scAudio = { sfx, heartbeat, loadSfx }; } catch {}
