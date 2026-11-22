// Pack opening for a two-card catch (prototype, 2026-11-20, Sevaan: "a pack to show up, auto rip, two cards to come out,
// and then the top one flips"). Behind Settings → Testing tools → Switches → Pack opening (off by default); nothing
// changes for players until a variant is picked. The spike page is design/pack-reveal/.
// The flow is the catch reveal's own (js/reveal.js playReveal): a small flat pack pops in where the card lands, tears
// itself across the top (the gift pack's tear: js/gift-pack.js tearJag and its sound, trimmed), the two card backs rise
// out of it as a held pair while it drops away, settle at the reveal's place, and the top one turns over with the
// reveal's flip. From there it IS the two-card deck (swipe or tap to switch, flick up into the Collection).
// Smoothness rules (2026-11-20): transform and opacity only; the art is drawn once into canvases before it starts and
// the card pictures decoded (at most 150 ms); the cards sit behind the pack by stacking order, so nothing is clipped per
// frame; no tilt and no layout reads while it plays. The pure helpers (timing table, the switch) are tested in
// tests/pack-reveal.test.mjs.
import { TIER_INFO, TIERS } from './rarity.js?v=0.1.1896';

// The beats in ms, from the pack popping in to the top card's face (B is the plan; A quicker; C with a longer tear).
export const PACK_VARIANTS = {
  A: { label: 'A · 1.8 s', pop: 250, tear: 250, rise: 450, settle: 330 },
  B: { label: 'B · 2.1 s', pop: 300, tear: 350, rise: 550, settle: 400 },
  C: { label: 'C · 2.6 s', pop: 300, tear: 650, rise: 600, settle: 520 },
};
export const PACK_FLIP = 520;          // the reveal's flip for a Common card (js/card-moment.js TIER_FX); rarer ones keep their longer turn
export const PACK_SHORT_AFTER = 5;     // after five packs, the short cut: no settle beat, a quicker pop and tear (airline catches give two cards often)
export const PACK_KEY = 'packReveal', PACK_SEEN_KEY = 'packSeen';

/** The Testing switch's value: 'A' | 'B' | 'C' (B, the default since 2026-11-21), or '' (turned off). Turned on without a variant ('on', '1', true), it is
    B (Sevaan picked B, 2026-11-20); A and C stay as choices. */
export const PACK_DEFAULT = 'B';
export function packChoice(raw) { if (raw === true || raw === 'on' || raw === '1') return PACK_DEFAULT; return typeof raw === 'string' && Object.prototype.hasOwnProperty.call(PACK_VARIANTS, raw) /* not Object.hasOwn: iOS 15.4+ only */ ? raw : ''; }
/** The timeline for a variant (null when off). seen: how many packs this player has opened. */
export function packPlan(variant, seen = 0) {
  const v = PACK_VARIANTS[packChoice(variant)]; if (!v) return null;
  const short = seen >= PACK_SHORT_AFTER;
  const pop = short ? Math.round(v.pop * 0.85) : v.pop, tear = short ? Math.round(v.tear * 0.85) : v.tear, rise = v.rise, settle = short ? 0 : v.settle;
  const tearAt = pop, riseAt = tearAt + tear, settleAt = riseAt + rise, flipAt = settleAt + settle;
  return { variant: packChoice(variant), short, pop, tear, rise, settle, tearAt, riseAt, settleAt, flipAt, face: flipAt + PACK_FLIP };
}
/** The pack is a tell: its foil is the best rarity inside, with a glint when either card is shiny. */
export function packFoil(items) {
  let best = 0; for (const it of items ?? []) best = Math.max(best, TIERS.indexOf(it?.tierKey ?? it?.o?.tier));
  return { tier: TIERS[Math.max(0, best)], shiny: (items ?? []).some((it) => !!it?.shiny) };
}
// The switch and the count, on this device.
/* On for everyone (2026-11-21, Sevaan: "let's add it in"): with nothing saved it's B. Turning the Testing switch off saves
   'off'; a timing saves A, B or C. */
export function packSetting(v) {
  try { if (v !== undefined) localStorage.setItem(PACK_KEY, packChoice(v) || 'off'); const raw = localStorage.getItem(PACK_KEY); return raw == null ? PACK_DEFAULT : packChoice(raw); } catch { return PACK_DEFAULT; }
}
export function packSeen(add = 0) { try { const n = (+localStorage.getItem(PACK_SEEN_KEY) || 0) + add; if (add) localStorage.setItem(PACK_SEEN_KEY, String(n)); return n; } catch { return 0; } }

// ---------- the pack art, drawn once per rarity and size ----------
// The Sky pack (css/sky-theme.css --pk-*: Flight Plan's linework in foil on sky blue), flat: one picture for the body, one
// for the strip that tears off. Common and Uncommon keep the sky-blue pack; Rare, Epic and Legendary go dark so their
// foil reads (Legendary is Space Collector's gold on navy).
const FOILS = {
  common:    { base: ['#4f93d4', '#1f5a99'], foil: ['#ffffff', '#d8e7f5', '#ffffff', '#a9c7e3', '#ffffff'], rim: null },
  uncommon:  { base: ['#4f93d4', '#1f5a99'], foil: ['#eafff1', '#5fd08a', '#ffffff', '#3fb06c', '#d9ffe7'], rim: '#5fd08a' },
  rare:      { base: ['#24508c', '#0a1d3d'], foil: ['#cfe8ff', '#4aa8ff', '#ffffff', '#2f7fd8', '#bfe0ff'], rim: '#4aa8ff' },
  epic:      { base: ['#4a2370', '#160b2a'], foil: ['#ffd1f5', '#e46ad6', '#ffffff', '#b8459f', '#ffc2ef'], rim: '#e46ad6' },
  legendary: { base: ['#13243a', '#070d18'], foil: ['#7a5a14', '#f7d77a', '#fff2c2', '#a87d22', '#f0c860'], rim: '#ffc545' },
};
const MASK_URL = new URL('../assets/art/backs/back-flight-plan-mask.webp', import.meta.url).href;
let mask = null, maskReady = null;
/** Starts loading the linework (the pack draws without it if it isn't ready in time). */
export function primePack() { if (!maskReady && typeof Image !== 'undefined') { mask = new Image(); mask.decoding = 'async'; mask.src = MASK_URL; maskReady = mask.decode().then(() => true, () => false); } return maskReady; }
if (typeof window !== 'undefined' && packSetting()) primePack(); /* the switch is on: have the linework ready before the first catch */

const linework = new Map();
const TOP = 0.14; // the tear line, as a share of the pack's height (the gift pack's .gp-cap)
function drawPack(cv, w, h, dpr, tier, jag, part) {
  const f = FOILS[tier] ?? FOILS.common, c = cv.getContext('2d'), ch = part === 'strip' ? Math.ceil(h * 0.22) : h;
  cv.width = Math.round(w * dpr); cv.height = Math.round(ch * dpr); c.scale(dpr, dpr);
  const tooth = Math.max(2.5, w / 64), crimp = h * 0.085, y0 = h * TOP, jy = (y) => y0 + (y - 6) * h * 0.0035;
  // the bag: serrated top and bottom edges
  c.save(); c.beginPath(); c.moveTo(0, tooth);
  for (let x = 0; x < w; x += tooth * 2) { c.lineTo(Math.min(w, x + tooth), 0); c.lineTo(Math.min(w, x + tooth * 2), tooth); }
  c.lineTo(w, h - tooth); for (let x = w; x > 0; x -= tooth * 2) { c.lineTo(Math.max(0, x - tooth), h); c.lineTo(Math.max(0, x - tooth * 2), h - tooth); }
  c.closePath(); c.clip();
  // the strip is everything above the torn line, the body everything below it
  c.beginPath();
  if (part === 'strip') { c.moveTo(0, 0); c.lineTo(w, 0); for (let i = jag.length - 1; i >= 0; i--) c.lineTo(jag[i][0] / 100 * w, jy(jag[i][1])); }
  else { c.moveTo(0, h); c.lineTo(w, h); for (let i = jag.length - 1; i >= 0; i--) c.lineTo(jag[i][0] / 100 * w, jy(jag[i][1])); }
  c.closePath(); c.clip();
  const g = c.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, h * 0.75); g.addColorStop(0, f.base[0]); g.addColorStop(1, f.base[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const foil = () => { const lg = c.createLinearGradient(0, 0, w, h * 0.6); f.foil.forEach((col, i) => lg.addColorStop(i / (f.foil.length - 1), col)); return lg; };
  // the linework, in foil (the mask's alpha), like .gp-art: 118% wide, at 50% 52%
  if (mask?.complete && mask.naturalWidth) {
    const key = `${tier}|${w.toFixed(1)}|${h.toFixed(1)}|${dpr}`; let o = linework.get(key); /* drawn once per rarity and size, shared by the body and the strip */
    if (!o) { const mw = w * 1.18, mh = mw * mask.naturalHeight / mask.naturalWidth; o = document.createElement('canvas'); o.width = Math.round(w * dpr); o.height = Math.round(h * dpr);
      const oc = o.getContext('2d'); oc.scale(dpr, dpr); oc.drawImage(mask, (w - mw) * 0.5, (h - mh) * 0.52, mw, mh); oc.globalCompositeOperation = 'source-in';
      const lg = oc.createLinearGradient(0, 0, w, h * 0.6); f.foil.forEach((col, i) => lg.addColorStop(i / (f.foil.length - 1), col)); oc.fillStyle = lg; oc.fillRect(0, 0, w, h);
      if (linework.size > 6) linework.clear(); linework.set(key, o); }
    c.globalAlpha = tier === 'common' ? 0.9 : 1; c.drawImage(o, 0, 0, w, h); c.globalAlpha = 1;
  }
  c.fillStyle = 'rgba(13,34,56,.025)'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1); // .gp-lines
  // crimped seals, top and bottom (.gp-seal), ridged
  for (const [ya, yb, down] of [[0, crimp, true], [h - crimp, h, false]]) {
    const sg = c.createLinearGradient(0, ya, 0, yb); sg.addColorStop(0, down ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.30)'); sg.addColorStop(1, down ? 'rgba(0,0,0,.30)' : 'rgba(255,255,255,.22)'); c.fillStyle = sg; c.fillRect(0, ya, w, yb - ya);
    for (let x = 0; x < w; x += 4) { c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x, ya, 0.9, yb - ya); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x + 2.2, ya, 1.4, yb - ya); }
    if (f.rim) { c.fillStyle = f.rim; c.globalAlpha = 0.35; c.fillRect(0, ya, w, yb - ya); c.globalAlpha = 1; }
  }
  // the dashed tear line under the top seal (.gp-seam), and the sides' shading (.gp-shade)
  c.strokeStyle = 'rgba(13,34,56,.4)'; c.lineWidth = 1; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(0, y0); c.lineTo(w, y0); c.stroke(); c.setLineDash([]);
  const sh = c.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(13,34,56,.30)'); sh.addColorStop(0.14, 'rgba(13,34,56,0)'); sh.addColorStop(0.86, 'rgba(13,34,56,0)'); sh.addColorStop(1, 'rgba(13,34,56,.30)'); c.fillStyle = sh; c.fillRect(0, 0, w, h);
  if (f.rim) { c.strokeStyle = f.rim; c.lineWidth = 2.5; c.strokeRect(1.25, crimp, w - 2.5, h - crimp * 2); }
  // "2 cards" (.gp-count), in foil
  if (part !== 'strip') {
    /* one line under the linework's compass (the strip review: a big "2" sat on the compass) */
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = `800 ${(h * 0.05).toFixed(1)}px Inter, system-ui, sans-serif`; if ('letterSpacing' in c) c.letterSpacing = `${(h * 0.01).toFixed(1)}px`;
    c.fillStyle = 'rgba(13,34,56,.45)'; c.fillText('2 CARDS', w / 2 + 1, h * 0.865 + 1.5); c.fillStyle = foil(); c.fillText('2 CARDS', w / 2, h * 0.865);
  }
  c.restore();
}
function drawTearLine(cv, w, lh, h, dpr, tier, jag) {
  const c = cv.getContext('2d'); cv.width = Math.round(w * dpr); cv.height = Math.round(lh * dpr); c.scale(dpr, dpr);
  const mid = lh / 2, jy = (y) => mid + (y - 6) * h * 0.0035, glow = (FOILS[tier]?.rim) ?? '#ffe2a0';
  c.beginPath(); jag.forEach(([x, y], i) => (i ? c.lineTo : c.moveTo).call(c, x / 100 * w, jy(y)));
  c.lineJoin = 'round'; c.lineCap = 'round'; c.shadowColor = glow; c.shadowBlur = 10; c.strokeStyle = '#fff6d8'; c.lineWidth = 2.2; c.stroke(); c.shadowBlur = 4; c.stroke();
}

// ---------- the sequence ----------
// ctx: { root (#reveal), holder (#rv-holder), under (the card behind, as a held layer under the holder), items, plan,
//        tier, shiny, jag, sfx, flash (#rv-flash), reduced }. Every number it needs was read before it starts.
// start() returns a promise that resolves 'flip' when the top card should turn over, 'skip' after a tap (the faces at once), 'faces' under Reduce
// Motion (a crossfade, faces already up). stop() takes it all down (the reveal closing).
export function packIntro(ctx) {
  const { root, holder, under, plan: P, tier, shiny, jag, sfx, reduced } = ctx;
  const cf = parseFloat(getComputedStyle(root).getPropertyValue('--cf')) || 12, H = holder.offsetHeight || cf * 42, W = holder.offsetWidth || cf * 28;
  const pk = document.createElement('div'); pk.className = 'pk'; pk.setAttribute('aria-hidden', 'true');
  pk.innerHTML = `<canvas class="pk-body"></canvas>${shiny ? '<div class="pk-glint"><i></i></div>' : ''}<canvas class="pk-strip"></canvas><div class="pk-tw"><div class="pk-ti"><canvas></canvas></div></div><i class="pk-spark"></i>`;
  holder.after(pk);
  const pw = pk.offsetWidth || cf * 24, ph = pk.offsetHeight || H * 0.9, dpr = Math.min(2, devicePixelRatio || 1) /* 2x is plenty for a small moving pack, and under half the pixels of 3x to draw */, lh = Math.max(14, ph * 0.06);
  drawPack(pk.querySelector('.pk-body'), pw, ph, dpr, tier, jag, 'body');
  drawPack(pk.querySelector('.pk-strip'), pw, ph, dpr, tier, jag, 'strip');
  pk.style.setProperty('--y0', `${(ph * TOP).toFixed(1)}px`); pk.style.setProperty('--lh', `${lh.toFixed(1)}px`);
  drawTearLine(pk.querySelector('.pk-ti canvas'), pw, lh, ph, dpr, tier, jag);
  { const r = pk.getBoundingClientRect(); ctx.flash?.style.setProperty('--fx-x', `${(r.left + r.width / 2).toFixed(0)}px`); ctx.flash?.style.setProperty('--fx-y', `${(r.top + ph * TOP).toFixed(0)}px`); }
  const anims = [], A = (el, kf, o) => { if (!el) return null; const a = el.animate(kf, { fill: 'forwards', ...o }); anims.push(a); return a; };
  const T = (x, y, s, r) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s}) rotate(${r}deg)`;
  // poses (the holder's own box; under is the card behind, first held a few px and degrees off, then fanned, then where
  // the deck keeps it: 3 px over, 9 px up, 98.5% and turned 1.2°, as css/reveal.css .dk-back, about its centre)
  const hid = T(0, H * 0.058, 0.7, 0), up = T(0, -H * 0.11, 1.03, -1.5), rest = T(0, 0, 1, 0);
  const uHid = T(4, H * 0.058 + 2, 0.7, -2.5), uUp = T(4, -H * 0.11 - 2, 1.03, -4), uFan = T(W * 0.075, -H * 0.035, 0.96, 5.5), uDeck = T(3, -9, 0.985, 1.2); /* the deck's pose for the card behind (css/reveal.css .dk-back, about its centre) */
  let skipped = false, done = null, timers = [];
  const result = new Promise((r) => { done = r; });
  const stop = () => { timers.forEach(clearTimeout); timers = []; anims.forEach((a) => { try { a.cancel(); } catch {} }); pk.remove(); root.removeEventListener('pointerdown', onTap, true); };
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  // A tap anywhere (not on a button) before the flip skips to the top card's face.
  const onTap = (e) => { if (skipped || e.target.closest?.('button, a, .pill')) return; skipped = true; e.stopPropagation(); finishNow('skip'); };
  const finishNow = (why) => {
    timers.forEach(clearTimeout); timers = []; root.removeEventListener('pointerdown', onTap, true);
    anims.forEach((a) => { try { a.cancel(); } catch {} }); anims.length = 0; pk.remove();
    A(holder, [{ opacity: 1, transform: rest }, { opacity: 1, transform: rest }], { duration: 1 });
    A(under, [{ opacity: 1, transform: uDeck }, { opacity: 1, transform: uDeck }], { duration: 1 });
    done(why);
  };
  /* built and drawn now (while the catch's rush plays: drawing the art at the start of the pop cost a 170 ms frame at
     4x CPU); start() runs it */
  const go = () => {
  if (reduced) { // a crossfade to the faces: the pack shows, then fades as the cards (faces up) fade in
    A(pk, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 900 });
    A(holder, [{ opacity: 0, transform: rest }, { opacity: 0, transform: rest, offset: 0.6 }, { opacity: 1, transform: rest }], { duration: 900 });
    A(under, [{ opacity: 0, transform: uDeck }, { opacity: 0, transform: uDeck, offset: 0.6 }, { opacity: 1, transform: uDeck }], { duration: 900 });
    at(900, () => { pk.remove(); done('faces'); });
    return;
  }
  root.addEventListener('pointerdown', onTap, true);
  const end = P.flipAt, o = (ms) => Math.max(0, Math.min(1, ms / end));
  // 1. the pack pops in (scale .6 to 1, a slight overshoot), then 3. drops away below the cards and fades as it goes
  const dropAt = P.riseAt + P.rise * 0.15, dropEnd = Math.min(end + 200, P.settleAt + 180), total = Math.max(end, dropEnd);
  const q = (ms) => Math.max(0, Math.min(1, ms / total));
  A(pk, [
    { transform: 'translateY(0) scale(.6) rotate(0deg)', opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1.25)' },
    { transform: 'translateY(0) scale(1.03) rotate(0deg)', opacity: 1, offset: q(P.pop * 0.72), easing: 'ease-out' },
    { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: 1, offset: q(P.pop) },
    { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: 1, offset: q(dropAt), easing: 'cubic-bezier(.5,0,.8,.45)' },
    { transform: `translateY(${(ph * 0.75).toFixed(0)}px) scale(.97) rotate(3deg)`, opacity: 1, offset: q(dropAt + (dropEnd - dropAt) * 0.6), easing: 'linear' },
    { transform: `translateY(${(ph * 1.2).toFixed(0)}px) scale(.95) rotate(5deg)`, opacity: 0, offset: q(dropEnd) },
    { transform: `translateY(${(ph * 1.2).toFixed(0)}px) scale(.95) rotate(5deg)`, opacity: 0 },
  ], { duration: total });
  if (shiny) A(pk.querySelector('.pk-glint i'), [{ transform: 'translateX(-120%) skewX(-14deg)' }, { transform: 'translateX(-120%) skewX(-14deg)', offset: 0.2 }, { transform: 'translateX(260%) skewX(-14deg)' }], { duration: P.riseAt, easing: 'cubic-bezier(.4,0,.3,1)' });
  // 2. the tear runs across the top (a window sliding open over a line that stays put: both are transforms), a spark at
  // its front; then the strip flies off
  const draw = Math.round(P.tear * 0.72), stripAt = P.tearAt + Math.round(Math.max(P.tear * 0.68, P.tear - 150)) /* a long tear (C) mustn't leave a still gap before the cards rise (strip review) */, stripMs = Math.max(320, Math.round(P.tear * 0.6));
  A(pk.querySelector('.pk-tw'), [{ transform: 'translateX(-100%)' }, { transform: 'translateX(-100%)', offset: 0, easing: 'cubic-bezier(.3,0,.4,1)' }, { transform: 'translateX(0)' }], { duration: draw, delay: P.tearAt });
  A(pk.querySelector('.pk-ti'), [{ transform: 'translateX(100%)' }, { transform: 'translateX(100%)', offset: 0, easing: 'cubic-bezier(.3,0,.4,1)' }, { transform: 'translateX(0)' }], { duration: draw, delay: P.tearAt });
  A(pk.querySelector('.pk-spark'), [{ transform: `translateX(0) scale(.6)`, opacity: 0, easing: 'cubic-bezier(.3,0,.4,1)' }, { transform: `translateX(${(pw * 0.08).toFixed(0)}px) scale(1)`, opacity: 1, offset: 0.08, easing: 'cubic-bezier(.3,0,.4,1)' }, { transform: `translateX(${pw.toFixed(0)}px) scale(1)`, opacity: 1, offset: 0.92 }, { transform: `translateX(${pw.toFixed(0)}px) scale(1.6)`, opacity: 0 }], { duration: draw + 40, delay: P.tearAt });
  A(pk.querySelector('.pk-strip'), [{ transform: 'translate(0, 0) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(.2,.7,.3,1)' }, { transform: `translate(${(pw * 0.35).toFixed(0)}px, ${(-ph * 0.32).toFixed(0)}px) rotate(26deg)`, opacity: 0 }], { duration: stripMs, delay: stripAt });
  A(pk.querySelector('.pk-tw'), [{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: stripAt + 60 });
  at(P.tearAt, () => { sfx?.('tear', { gain: 0.9, dur: Math.min(420, P.tear + 60) }); dispatchEvent(new CustomEvent('sc:feel', { detail: 'select' })); });
  at(stripAt, () => { sfx?.('swipe', { gain: 0.55 }); ctx.flash?.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.25 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' }); dispatchEvent(new CustomEvent('sc:feel', { detail: 'light' })); });
  // 3-4. the two backs rise out together as a held pair, then settle at the reveal's place, fanned so the second shows
  const hk = [
    { transform: hid, opacity: 0 }, { transform: hid, opacity: 0, offset: o(P.tearAt) }, { transform: hid, opacity: 1, offset: o(P.tearAt) },
    { transform: hid, opacity: 1, offset: o(P.riseAt), easing: 'cubic-bezier(.3,.75,.35,1)' },
  ];
  const uk = [
    { transform: uHid, opacity: 0 }, { transform: uHid, opacity: 0, offset: o(P.tearAt) }, { transform: uHid, opacity: 1, offset: o(P.tearAt) },
    { transform: uHid, opacity: 1, offset: o(P.riseAt), easing: 'cubic-bezier(.3,.75,.35,1)' },
  ];
  if (P.settle) {
    /* the settle is a beat you see (strip review 2026-11-20: a 3% drop read as a pause): the pair comes down from a little
       above with a small overshoot, and the card behind swings out to the right while it does */
    hk.push({ transform: up, opacity: 1, offset: o(P.settleAt), easing: 'cubic-bezier(.35,1.35,.55,1)' }, { transform: rest, opacity: 1 });
    uk.push({ transform: uUp, opacity: 1, offset: o(P.settleAt), easing: 'cubic-bezier(.45,.05,.3,1)' }, { transform: uFan, opacity: 1 }); /* the fan spans the whole beat, so a long settle (C) never sits still */
  } else { hk.push({ transform: rest, opacity: 1 }); uk.push({ transform: uFan, opacity: 1 }); } // the short cut lands straight from the rise
  A(holder, hk, { duration: end }); A(under, uk, { duration: end });
  // 5. the flip is the reveal's (js/card-moment.js flipCard, called by reveal.js); the card behind goes to where the deck keeps it as it turns
  at(end, () => { root.removeEventListener('pointerdown', onTap, true); if (skipped) return;
    A(under, [{ transform: uFan, opacity: 1 }, { transform: uDeck, opacity: 1 }], { duration: PACK_FLIP, easing: 'cubic-bezier(.3,.7,.3,1)' });
    at(Math.max(0, dropEnd - end) + 20, () => pk.remove());
    done('flip'); });
  };
  return { start: () => { go(); return result; }, stop };
}
