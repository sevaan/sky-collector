// Card moments (2026-11-11, design/morning-pack.html "One system"): what every card that turns over shares, so a catch,
// a gift pack and the morning pack feel the same. One rarity table, and the catch reveal's flip (it used to be copied
// into js/gift-pack.js, and the copies drifted: the heartbeats were 100 ms apart). No DOM of its own: callers pass the
// element that turns and a function that shows a face.
import { sfx, heartbeat } from './sfx.js?v=0.1.1907';
import { audioLeaving } from './audio-ctx.js?v=0.1.1907';

// Per tier: the catch reveal's burst, how long it holds its breath before turning, the turn's length and extra spin,
// how much the sky dims, and the stinger that plays when it lands.
export const TIER_FX = {
  common:    { particles: 14,  flip: 520,  spin: 0,   dim: 0,   shock: false, hold: 0,    stinger: 'r_common' },
  uncommon:  { particles: 24,  flip: 560,  spin: 0,   dim: 0,   shock: false, hold: 0,    stinger: 'r_uncommon' },
  rare:      { particles: 50,  flip: 650,  spin: 0,   dim: .25, shock: false, hold: 300,  stinger: 'r_rare' },
  epic:      { particles: 90,  flip: 800,  spin: 360, dim: .45, shock: true,  hold: 600,  stinger: 'r_epic' },
  legendary: { particles: 160, flip: 1100, spin: 0,   dim: .7,  shock: true,  hold: 1100, stinger: 'r_legend' },
};
export const TIERS = Object.keys(TIER_FX);
export const tierKey = (t) => (TIER_FX[t] ? t : 'common');
export const fxFor = (t) => TIER_FX[tierKey(t)];
const reduced = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Epic and Legendary wait face down with two slow double heartbeats (thump-thump, thump-thump). onBeat(strong) draws
// each one (a swell, a dim); the sound and the haptic are here. Returns a cancel function.
export const HEARTBEATS = [[120, false], [330, true], [980, false], [1190, true]];
export function heartbeats(tier, onBeat, still = () => true, { haptic = true } = {}) {
  if (reduced() || !['epic', 'legendary'].includes(tier)) return () => {};
  const ts = HEARTBEATS.map(([ms, strong]) => setTimeout(() => { if (!still()) return; heartbeat(strong); if (haptic && !document.hidden && !audioLeaving()) dispatchEvent(new CustomEvent('sc:heartbeat', { detail: { strong } })); try { onBeat?.(strong); } catch {} }, ms));
  return () => ts.forEach(clearTimeout);
}

// cubic-bezier(x1, y1, x2, y2) as a function of linear time 0..1, so the turn's angle is worked out from the animation's
// clock instead of reading styles back every frame (a style pass a frame: the gift pack's jank, 2026-11-10).
function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => { let t = x; for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-4 || Math.abs(d) < 1e-6) break; t -= e / d; } return Y(Math.max(0, Math.min(1, t))); };
}
const E1 = bez(.5, 0, 1, 1), E2 = bez(0, 0, .4, 1);

// The catch reveal's flip: Rare and up hold their breath (a small rock), then the card turns over, lifting to 1.12× at
// edge-on, Epic spinning a whole extra turn on the way. showFace(true) shows the front, which sits turned 180° inside
// the flipper (Safari ignores backface-visibility on these cards, so faces are swapped by hand, chosen every frame from
// the actual angle). perspective: for a flipper without its own 3D context (the pack's cards). Resolves when it's down;
// the flipper is left at its end angle (fill forwards) unless settle is true.
export async function flipCard(flipper, { tier, showFace, faces = null, alive = () => true, perspective = '', sound = true, settle = false, onTurn = null } = {}) {
  const fx = fxFor(tier), red = reduced(), P = perspective ? `perspective(${perspective}) ` : '';
  if (fx.hold && !red) await Promise.race([flipper.animate([{ transform: `${P}rotate(0)` }, { transform: `${P}rotate(-1.5deg)` }, { transform: `${P}rotate(1.5deg)` }, { transform: `${P}rotate(0)` }], { duration: fx.hold, easing: 'ease-in-out' }).finished.catch(() => {}), new Promise((r) => setTimeout(r, fx.hold + 200))]); /* a timer behind it: a web view that stops sending frames must not leave the card face down for good */
  if (!alive()) return false;
  try { onTurn?.(); } catch {}
  if (sound) sfx('flip');
  const ms = red ? 1 : fx.flip, mid = 90 + fx.spin / 2, end = 180 + fx.spin;
  const a = flipper.animate([
    { transform: `${P}rotateY(0) scale(1)`, easing: 'cubic-bezier(.5,0,1,1)' },
    { transform: `${P}rotateY(${mid}deg) scale(1.12)`, offset: .5, easing: 'cubic-bezier(0,0,.4,1)' },
    { transform: `${P}rotateY(${end}deg) scale(1)` },
  ], { duration: ms, easing: 'linear', fill: 'forwards' }); // per-keyframe easing: edge-on exactly at ms / 2
  const angle = (p) => (p < 0.5 ? mid * E1(p / 0.5) : mid + (end - mid) * E2((p - 0.5) / 0.5));
  /* faces [back, front]: the swap is part of the animation, opacity stepping at the exact moments the card is edge-on, so it
     runs with the turn on the compositor. A swap from a frame callback lagged the turn on a busy phone and showed the back
     mirrored past edge-on (2026-11-11, Sevaan: the pack's flips). */
  let fades = [];
  if (faces && !red) {
    const at = []; for (let c = 90; c < end; c += 180) { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (angle(m) < c) lo = m; else hi = m; } at.push(hi); }
    const steps = (on) => { const k = [{ opacity: on ? 1 : 0, offset: 0 }]; for (const o of at) { k.push({ opacity: on ? 1 : 0, offset: o }); on = !on; k.push({ opacity: on ? 1 : 0, offset: o }); } k.push({ opacity: on ? 1 : 0, offset: 1 }); return k; };
    fades = faces.map((el, i) => { el.style.visibility = 'visible'; return el.animate(steps(i === 0), { duration: ms, easing: 'linear', fill: 'forwards' }); });
  }
  let turning = true, front = false;
  const tick = () => { if (!turning || !alive() || a.playState !== 'running') return; const p = a.effect.getComputedTiming().progress ?? 0, deg = angle(p) % 360, f = deg > 90 && deg < 270; if (f !== front) { front = f; showFace(f); } requestAnimationFrame(tick); };
  if (!fades.length) requestAnimationFrame(tick); /* with faces the animation swaps them; a late per-frame swap would only fight it */
  /* a timer behind it: a WebView that stops sending frames must not leave the card half turned */
  await Promise.race([a.finished.catch(() => {}), new Promise((r) => setTimeout(r, ms + 200))]);
  turning = false;
  for (const f of fades) f.cancel(); if (fades.length) for (const el of faces) el.style.visibility = '';
  showFace(true);
  if (settle) a.cancel();
  return alive();
}

// The payoff when a card lands face up: the tier's stinger, plus the level-up and shiny layers.
export function payoffSound(tier, { fresh = true, newStamp = false, levelUp = false, shiny = false, gain } = {}) {
  sfx(fresh ? fxFor(tier).stinger : newStamp ? 'stamp' : 'seen', gain ? { gain } : undefined);
  if (levelUp) sfx('levelup', { delay: 0.35 });
  if (shiny) sfx('shiny', { delay: 0.25 });
}
