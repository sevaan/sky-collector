// TikTok video kit, v2 (2026-11-14, after a creative-director, a motion-design and a sound-design review of v1:
// "they look basic"). Three parts:
//   1 · rec(): the real app recorded in Chromium (DevTools screencast) at 3× so the edit can punch in without going soft.
//   2 · compose(): every output frame drawn by a browser page we control: a virtual camera over the recorded frames
//       (push-ins, punch-ins, speed ramps through a time map), a 3D card (the real card art, spun, tilted, with a
//       specular sweep and sparkles), a textured globe, flashes, shockwave rings, tap ripples, light leaks, parallax
//       stars, and TikTok-native text (white, black outline, lowercase, word by word). Graded in ffmpeg (deep
//       blue-black floor, warm highlights, bloom, vignette, grain).
//   3 · mix(): a sound kit synthesized in ffmpeg (sub booms, impacts, risers, whooshes, ticks, shimmer, twinkles),
//       the app's own sounds, and "Permafrost" (Scott Buckley, CC BY 4.0) cut to picture: muffled under the build, a
//       150 ms drop-out, full on the payoff, ducked under every hit. Two-pass loudnorm. A no-music cut too, for a
//       trending sound on top (sound design only, no pitched beds, -16 LUFS).
// Safe zones (1080×1920): text inside x 80–900, y 220–1340 (TikTok's caption sits at the bottom, its buttons right).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DEVICES, setup, hideNoise, storeExtras, storeStorage } from '../store/common.mjs';

export const W = 1080, H = 1920, FPS = 30, VW = 432, VH = 768;
export const OUT = join(ROOT, 'store/social/tiktok'); mkdirSync(OUT, { recursive: true });
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 }).toString();

/* ───────────── 1 · recording ───────────── */
DEVICES.tt2 = { ...DEVICES.phone, viewport: { width: VW, height: VH }, deviceScaleFactor: 3, safeTop: 14, safeBottom: 10 };
export async function rec({ when, place, extra = [], storage = {}, heroIss = true, catalog = null, hide = '' }) {
  const b = await chromium.launch(), tmp = join(ROOT, 'scripts/.cache/tt2-' + Math.random().toString(36).slice(2, 7)); mkdirSync(tmp, { recursive: true });
  const night = new Date(when), { p, ctx, errs } = await setup(b, 'tt2', { when, heroIss, clear: true, extra: [...storeExtras(night), ...extra], storage: { ...storeStorage(night), ...storage }, place: place ?? undefined, catalog });
  await hideNoise(p);
  await p.addStyleTag({ content: `
    body.rec #sky-header, body.rec #nav, body.rec .sc-switch, body.rec #skybar, body.rec #tab-fade, body.rec #radar, body.rec #radar-up, body.rec #radar-new, body.rec #nextpass, body.rec #event-banner, body.rec #sky-plus-line, body.rec #until-dark, body.rec #guidance { visibility: hidden !important; opacity: 0 !important; }
    body.quiet #discover, body.quiet #plane { visibility: hidden !important; } ${hide}` });
  await p.evaluate(() => document.body.classList.add('rec'));
  const w = (ms) => p.waitForTimeout(ms), now = () => Date.now() / 1000;
  await p.evaluate(() => { const st = window.__store.state; st.drag.on = true; st.pinnedId = null; window.__pan = 0; window.__aim = null;
    const step = () => { const s = window.__store.state, e = window.__ease ?? 0.06; let az = null, el = null;
      if (window.__aim != null) { const it = s.items.find((x) => x.obj.id === window.__aim) ?? (s.naturals ?? []).find((x) => x.obj.key === window.__aim); if (it) { az = it.look.az; el = it.look.el; } }
      if (az != null) { const da = ((az - s.drag.az + 540) % 360) - 180; s.drag.az = (s.drag.az + da * e + 360) % 360; s.drag.el += (Math.max(el, 12) - s.drag.el) * e; }
      else s.drag.az = (s.drag.az + window.__pan + 360) % 360;
      requestAnimationFrame(step); };
    st.drag.el = 38; requestAnimationFrame(step); });
  const cdp = await ctx.newCDPSession(p); let frames = null, nf = 0;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => { if (frames) { const f = `f${String(nf++).padStart(5, '0')}.jpg`; writeFileSync(join(tmp, f), Buffer.from(data, 'base64')); frames.push({ f, t: metadata.timestamp }); } await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
  const sfx = []; await p.exposeFunction('__sfxReal', (n, delay = 0) => { sfx.push([n, now() + delay]); });
  const take = async (fn) => { frames = []; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 93, maxWidth: VW * 3, maxHeight: VH * 3, everyNthFrame: 1 }); const marks = {}; const t0 = now();
    await fn((k) => { marks[k] = now(); }); await cdp.send('Page.stopScreencast'); await w(150); const tk = { frames, marks, t0 }; frames = null; return tk; };
  /* where something is on screen, in output pixels (1080 × 1920) */
  const box = async (sel) => { const r = await p.locator(sel).first().boundingBox().catch(() => null); return r && { x: (r.x + r.width / 2) * W / VW, y: (r.y + r.height / 2) * H / VH, w: r.width * W / VW, h: r.height * H / VH }; };
  const project = (id) => p.evaluate((id) => { const s = window.__store.state, it = s.items.find((x) => String(x.obj.id) === String(id)); if (!it) return null; const q = window.__store.sky.project?.(it.enu ?? null); return q ? { x: q.x, y: q.y } : null; }, id);
  /* the card on screen in the reveal, turned face up, flat, on a transparent background: exactly the in-game card */
  const cardShot = async (path) => {
    for (let i = 0; i < 16; i++) { if (await p.evaluate(() => document.getElementById('rv-back')?.style.visibility === 'hidden')) break; await p.locator('#rv-holder').click({ timeout: 600 }).catch(() => {}); await w(200); }
    await p.mouse.move(2, 2); await w(1200);
    await p.evaluate(() => { const st = document.createElement('style'); st.id = 'shoot'; st.textContent = '#reveal { background: transparent !important; } #reveal > :not(#rv-holder), #reveal .starfield, #rv-glow { visibility: hidden !important; } html, body { background: transparent !important; } #sky, #hud { visibility: hidden !important; } .card__glare, .card__shine { opacity: 0 !important; }'; document.head.append(st); });
    await w(200);
    const r = await p.evaluate(() => { const c = document.querySelector('#reveal-card .card') ?? document.getElementById('reveal-card'), b = c.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
    await p.screenshot({ path, omitBackground: true, clip: r });
    await p.evaluate(() => document.getElementById('shoot')?.remove());
  };
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__store.state.tonight)); i++) await w(1000);
  return { cardShot, b, p, ctx, errs, tmp, w, now, take, box, project, sfx, at: (t) => p.clock.setSystemTime(new Date(t)), close: () => b.close() };
}

/* Real cards, crisp: the app's own renderCard (design/card-render.html), screenshotted at 4× on a transparent page. */
export async function cards(keys, dir) {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 4, locale: 'en-CA' })).newPage();
  await p.goto(`http://localhost:8765/design/card-render.html#${keys.join(',')}`); await p.reload();
  await p.waitForFunction(() => document.body.dataset.ready, null, { timeout: 60000 });
  await p.addStyleTag({ content: '.card__glare, .card__shine { opacity: 0 !important; } .card { box-shadow: none !important; }' });
  const out = {};
  for (const k of keys) { const el = await p.$(`#stage > [data-key="${k}"] .card`); if (!el) { console.log('cards: no', k); continue; } const f = join(dir, `card-${String(k).replace(/[^\w]/g, '_')}.png`); await el.screenshot({ path: f, omitBackground: true }); out[k] = basename(f); }
  await b.close(); return out;
}

/* ───────────── 2 · the compositor ───────────── */
const PAGE = String.raw`<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'TT'; src: url('Inter-latin.woff2') format('woff2'); font-weight: 400 800; }
@font-face { font-family: 'SC Display'; src: url('RussoOne-Regular.woff2') format('woff2'); }
html, body { margin: 0; width: ${VW}px; height: ${VH}px; overflow: hidden; background: #04070d; }
#stage { position: absolute; inset: 0; overflow: hidden; background: #04070d; }
#stars, #globe, #vid, .ghost { position: absolute; left: 0; top: 0; width: ${VW}px; height: ${VH}px; }
#cam, #cam2 { position: absolute; inset: 0; transform-origin: 0 0; }
.ghost { opacity: 0; }
#dim { position: absolute; inset: 0; background: #04070d; opacity: 0; }
#c3 { position: absolute; left: 0; top: 0; width: 0; height: 0; perspective: 1100px; }
#c3 .card { position: absolute; transform-style: preserve-3d; }
#c3 img.face { position: absolute; inset: 0; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 6%; }
#c3 img.back { transform: rotateY(180deg); }
#c3 .sheen { position: absolute; inset: 0; border-radius: 6%; backface-visibility: hidden; mix-blend-mode: screen; pointer-events: none;
  background: linear-gradient(115deg, transparent 30%, rgba(255,250,230,.0) 38%, rgba(255,246,214,.55) 47%, rgba(255,255,255,.85) 50%, rgba(255,214,140,.45) 53%, transparent 62%) no-repeat; background-size: 300% 100%; }
#c3 .shadow { position: absolute; left: 8%; right: 8%; bottom: -9%; height: 10%; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.65), transparent); filter: blur(6px); }
.spark { position: absolute; width: 12px; height: 12px; margin: -6px; background: radial-gradient(closest-side, #fff, rgba(255,240,200,.6) 40%, transparent);
  clip-path: polygon(50% 0, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0 50%, 42% 42%); }
#flash { position: absolute; inset: -20%; opacity: 0; mix-blend-mode: screen; }
#leak { position: absolute; inset: -30%; opacity: 0; mix-blend-mode: screen; background: radial-gradient(40% 35% at 30% 40%, rgba(255,150,60,.55), transparent 70%), radial-gradient(35% 30% at 75% 70%, rgba(255,90,140,.35), transparent 70%); }
.ring { position: absolute; border-radius: 50%; border: 2.5px solid #ffd59a; box-shadow: 0 0 14px #fa8127, inset 0 0 10px #fa8127; opacity: 0; }
.ripple { position: absolute; border-radius: 50%; background: radial-gradient(closest-side, rgba(255,255,255,.55), rgba(255,255,255,.15) 60%, transparent); opacity: 0; }
.tx { position: absolute; left: 30px; right: 64px; text-align: center; font: 800 25px/1.18 'TT', sans-serif; color: #fff; letter-spacing: -.005em;
  -webkit-text-stroke: 5.5px #000; paint-order: stroke fill; text-wrap: balance; }
.tx span { display: inline-block; white-space: pre; }
.tx span.hl { color: #ffd23f; }
.tx.big { font-size: 31px; }
.tx.small { font-size: 19px; -webkit-text-stroke: 4.5px #000; }
.tag { position: absolute; left: 26px; top: 46px; padding: 5px 10px 6px; border-radius: 7px; background: #fff; color: #000; font: 800 15px/1 'TT', sans-serif; }
.sticker { position: absolute; padding: 7px 11px 8px; border-radius: 9px; background: #fff; color: #000; font: 800 17px/1.1 'TT', sans-serif; transform-origin: 50% 50%; box-shadow: 0 6px 16px rgba(0,0,0,.4); white-space: nowrap; }
.sticker.dark { background: #000; color: #fff; }
.callout { position: absolute; font: 800 17px/1 'TT', sans-serif; color: #fff; -webkit-text-stroke: 4px #000; paint-order: stroke fill; white-space: nowrap; }
.callout::before { content: ''; position: absolute; right: 100%; top: 50%; width: var(--len, 30px); height: 2px; margin-right: 6px; background: #fff; box-shadow: 0 0 0 1px #000; }
</style></head><body><div id="stage">
<canvas id="stars" width="${VW * 2.5}" height="${VH * 2.5}"></canvas>
<canvas id="globe" width="${VW * 2.5}" height="${VH * 2.5}"></canvas>
<div id="cam"><img id="vid"><img class="ghost" id="g1"><img class="ghost" id="g2"></div>
<div id="dim"></div>
<div id="c3"><div class="card"><div class="shadow"></div><img class="face front"><img class="face back"><div class="sheen"></div></div></div>
<div id="sparks"></div><div id="rings"></div><div id="leak"></div><div id="flash"></div>
<div id="texts"></div></div>
<script>
const S = window.SCENE, $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const E = { lin: (x) => x, out: (x) => 1 - Math.pow(1 - x, 3), in: (x) => x * x * x, io: (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)), back: (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2) };
/* keyframes: [[t, v0, v1, ..., ease?], ...] → values at t */
function kf(keys, t) { if (!keys?.length) return null; if (t <= keys[0][0]) return keys[0].slice(1).filter((v) => typeof v === 'number');
  for (let i = 0; i < keys.length - 1; i++) { const a = keys[i], b = keys[i + 1]; if (t <= b[0]) { const ease = E[typeof b.at(-1) === 'string' ? b.at(-1) : 'io'], u = ease(clamp((t - a[0]) / (b[0] - a[0] || 1))); const av = a.slice(1).filter((v) => typeof v === 'number'), bv = b.slice(1).filter((v) => typeof v === 'number'); return av.map((v, k) => v + (bv[k] - v) * u); } }
  return keys.at(-1).slice(1).filter((v) => typeof v === 'number'); }
/* stars: three parallax layers, fixed seeds */
const STARS = [0.3, 0.6, 1.2].map((sp, L) => { let s = 9 + L * 101; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; return { sp, pts: Array.from({ length: [260, 120, 40][L] }, () => [r(), r(), [0.5, 0.9, 1.6][L] * (0.6 + r() * 0.8), r()]) }; });
function drawStars(t, px, py, alpha) { const c = $('stars'), g = c.getContext('2d'), k = c.width / ${VW}; g.clearRect(0, 0, c.width, c.height); if (alpha <= 0) return; g.globalAlpha = alpha;
  const bg = g.createRadialGradient(c.width * .5, c.height * .38, 10, c.width * .5, c.height * .45, c.height * .8); bg.addColorStop(0, '#0d1a2e'); bg.addColorStop(1, '#03060c'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  for (const L of STARS) for (const [x, y, r, ph] of L.pts) { const X = ((x * c.width + px * L.sp * k) % c.width + c.width) % c.width, Y = ((y * c.height + py * L.sp * k) % c.height + c.height) % c.height, tw = .55 + .45 * Math.sin(t * 2.2 + ph * 40);
    g.fillStyle = 'rgba(255,248,225,' + (0.35 + 0.65 * tw) + ')'; g.beginPath(); g.arc(X, Y, r * k * .5, 0, 6.283); g.fill(); }
  g.globalAlpha = 1; }
/* globe: orthographic, textured, lit */
let EARTH = null;
function drawGlobe(st) { const c = $('globe'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); if (!st || !EARTH) return;
  const k = c.width / ${VW}, cx = st.x * k, cy = st.y * k, R = st.r * k, lat0 = st.lat * Math.PI / 180, lon0 = st.lon * Math.PI / 180;
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(c.width, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(c.height, Math.ceil(cy + R));
  if (x1 > x0 && y1 > y0) { const img = g.createImageData(x1 - x0, y1 - y0), d = img.data, tx = EARTH.data, TW = EARTH.width, TH = EARTH.height, sl = Math.sin(lat0), cl = Math.cos(lat0);
    const sun = st.sun ?? [-0.55, 0.35, 0.76];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const u = (x - cx) / R, v = -(y - cy) / R, rr = u * u + v * v; if (rr > 1) continue; const z = Math.sqrt(1 - rr);
      const lat = Math.asin(v * cl + z * sl), lon = lon0 + Math.atan2(u, z * cl - v * sl);
      let tu = ((lon / (2 * Math.PI) + 0.5) % 1 + 1) % 1, tv = 0.5 - lat / Math.PI; const ti = (Math.min(TH - 1, (tv * TH) | 0) * TW + ((tu * TW) | 0)) * 4;
      const lit = clamp(0.18 + 0.95 * (u * sun[0] + v * sun[1] + z * sun[2]), 0.12, 1.15), rim = Math.pow(1 - z, 3);
      const o = ((y - y0) * (x1 - x0) + (x - x0)) * 4; d[o] = tx[ti] * lit + 60 * rim; d[o + 1] = tx[ti + 1] * lit + 110 * rim; d[o + 2] = tx[ti + 2] * lit + 200 * rim; d[o + 3] = 255; }
    g.putImageData(img, x0, y0); }
  const atm = g.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.12); atm.addColorStop(0, 'rgba(110,170,255,.55)'); atm.addColorStop(1, 'rgba(110,170,255,0)'); g.fillStyle = atm; g.beginPath(); g.arc(cx, cy, R * 1.12, 0, 6.283); g.fill();
  const P = ([la, lo]) => { const f = la * Math.PI / 180, l = lo * Math.PI / 180 - lon0, cz = Math.sin(lat0) * Math.sin(f) + Math.cos(lat0) * Math.cos(f) * Math.cos(l); return cz < 0 ? null : [cx + R * Math.cos(f) * Math.sin(l), cy - R * (Math.cos(lat0) * Math.sin(f) - Math.sin(lat0) * Math.cos(f) * Math.cos(l))]; };
  if (st.track) { const n = Math.floor(st.track.length * clamp(st.trackP ?? 1)); g.lineCap = 'round'; for (const [wd, col] of [[9, 'rgba(250,129,39,.25)'], [3.5, '#fa8127']]) { g.lineWidth = wd * k / 2.5; g.strokeStyle = col; g.beginPath(); let on = false; for (let i = 0; i < n; i++) { const q = P(st.track[i]); if (!q) { on = false; continue; } on ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); on = true; } g.stroke(); }
    const h = n > 0 && P(st.track[n - 1]); if (h) { g.fillStyle = '#fff'; g.shadowColor = '#fa8127'; g.shadowBlur = 18 * k / 2.5; g.beginPath(); g.arc(h[0], h[1], 5 * k / 2.5, 0, 6.283); g.fill(); g.shadowBlur = 0; } }
  if (st.pin) { const q = P(st.pin); if (q) { const pu = (st.t * 1.4) % 1; g.strokeStyle = 'rgba(255,210,63,' + (1 - pu) + ')'; g.lineWidth = 2 * k; g.beginPath(); g.arc(q[0], q[1], (6 + 26 * pu) * k / 2.5, 0, 6.283); g.stroke(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(q[0], q[1], 5 * k / 2.5, 0, 6.283); g.fill(); } }
}
const textEls = {};
async function render(t) {
  /* video shot */
  const shot = S.shots.find((s) => t >= s.from && t < s.to) ?? S.shots.at(-1);
  const vid = $('vid'); let src = null;
  if (shot.take != null) { const fr = S.takes[shot.take]; const st = kf(shot.map, t)[0]; let lo = 0, hi = fr.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (fr[m].t <= st) lo = m; else hi = m - 1; } src = 'takes/' + fr[lo].f; }
  else if (shot.still) src = shot.still;
  if (src && vid.getAttribute('src') !== src) { vid.src = src; await vid.decode().catch(() => {}); }
  vid.style.visibility = src ? 'visible' : 'hidden';
  const cam = kf(shot.cam ?? [[0, 1, 0.5, 0.5, 0]], t) ?? [1, 0.5, 0.5, 0]; /* scale, focus x, focus y (0..1 of frame), rotation */
  const sc = cam[0], fx = cam[1] * ${VW}, fy = cam[2] * ${VH}, sk = shot.shake ? kf(shot.shake, t)[0] : 0;
  const jx = sk * Math.sin(t * 61) * 6, jy = sk * Math.cos(t * 47) * 6;
  $('cam').style.transform = 'translate(' + (${VW} / 2 - fx * sc + jx) + 'px,' + (${VH} / 2 - fy * sc + jy) + 'px) scale(' + sc + ') rotate(' + (cam[3] || 0) + 'deg)';
  $('cam').style.filter = shot.camFilter ? shot.camFilter(t) : (shot.blur ? 'blur(' + kf(shot.blur, t)[0] + 'px)' : 'none');
  /* zoom-blur ghosts */
  const zb = S.zoomBlur ? S.zoomBlur.find((z) => t >= z.from && t < z.to) : null;
  for (const [id, m] of [['g1', 1.04], ['g2', 1.09]]) { const g = $(id); if (zb && src) { const u = (t - zb.from) / (zb.to - zb.from); if (g.getAttribute('src') !== src) { g.src = src; await g.decode().catch(() => {}); } g.style.opacity = (0.35 * Math.sin(Math.PI * u)).toFixed(3); g.style.transformOrigin = (zb.x * 100) + '% ' + (zb.y * 100) + '%'; g.style.transform = 'scale(' + (1 + (m - 1) * Math.sin(Math.PI * u)) + ')'; } else g.style.opacity = 0; }
  const dimv = S.dim ? kf(S.dim, t)[0] : 0; $('dim').style.opacity = dimv; $('dim').style.backdropFilter = dimv > 0.01 ? 'blur(' + (dimv * 10).toFixed(1) + 'px)' : 'none';
  /* stars and globe */
  const sa = S.stars ? kf(S.stars, t) : [0, 0, 0]; drawStars(t, sa[1] ?? 0, sa[2] ?? 0, sa[0] ?? 0);
  const gs = S.globe && t >= S.globe.from && t < S.globe.to ? S.globe : null;
  if (gs) { const v = kf(gs.keys, t); drawGlobe({ t, x: v[0], y: v[1], r: v[2], lat: v[3], lon: v[4], track: gs.track, trackP: gs.trackKeys ? kf(gs.trackKeys, t)[0] : 1, pin: gs.pin }); } else drawGlobe(null);
  $('globe').style.opacity = gs && gs.fade ? kf(gs.fade, t)[0] : 1;
  /* 3D card */
  const cs = S.card3d?.find((c) => t >= c.from && t < c.to);
  const c3 = $('c3'), card = c3.querySelector('.card');
  if (cs) { c3.style.display = 'block'; const fr = card.querySelector('.front'), bk = card.querySelector('.back');
    if (fr.getAttribute('src') !== cs.front) { fr.src = cs.front; await fr.decode().catch(() => {}); } if (bk.getAttribute('src') !== cs.back) { bk.src = cs.back; await bk.decode().catch(() => {}); }
    const v = kf(cs.keys, t); /* x, y (centre, px), width (px), rotY, rotX, rotZ, opacity */
    const wpx = v[2], hpx = wpx * cs.ratio; card.style.width = wpx + 'px'; card.style.height = hpx + 'px'; card.style.left = (v[0] - wpx / 2) + 'px'; card.style.top = (v[1] - hpx / 2) + 'px';
    card.style.transform = 'rotateY(' + v[3] + 'deg) rotateX(' + v[4] + 'deg) rotateZ(' + (v[5] || 0) + 'deg)'; card.style.opacity = v[6] ?? 1;
    const sh = card.querySelector('.sheen'), sp = cs.sheen ? kf(cs.sheen, t)[0] : -1; sh.style.opacity = sp < 0 ? 0 : 1; sh.style.backgroundPosition = (100 - sp * 100) + '% 0'; sh.style.transform = 'translateZ(1px)';
    card.style.filter = 'drop-shadow(0 18px 30px rgba(0,0,0,.6)) drop-shadow(0 0 ' + (cs.glow ? kf(cs.glow, t)[0] : 0) + 'px ' + (cs.glowColor ?? '#fa8127') + ')';
  } else c3.style.display = 'none';
  /* sparkles */
  const spk = $('sparks'); spk.innerHTML = '';
  for (const s of S.sparkles ?? []) { if (t < s.from || t > s.to) continue; for (let i = 0; i < s.n; i++) { const ph = (i * 0.618 + 0.13) % 1, life = 1.1, u = ((t - s.from) / life + ph) % 1, a = i * 2.399;
    const el = document.createElement('div'); el.className = 'spark'; const r0 = s.r * (0.55 + 0.45 * ((i * 0.37) % 1)); el.style.left = (s.x + Math.cos(a) * r0 * (0.8 + u * 0.4)) + 'px'; el.style.top = (s.y + Math.sin(a) * r0 * 1.35 * (0.8 + u * 0.4)) + 'px'; el.style.transform = 'scale(' + (Math.sin(Math.PI * u) * (0.6 + (i % 3) * 0.35)) + ') rotate(' + (u * 90) + 'deg)'; el.style.opacity = Math.sin(Math.PI * u); spk.append(el); } }
  /* rings, ripples, flash, leak */
  const rg = $('rings'); rg.innerHTML = '';
  for (const r of S.rings ?? []) { const u = (t - r.at) / (r.dur ?? 0.55); if (u < 0 || u > 1) continue; const el = document.createElement('div'); el.className = r.type === 'ripple' ? 'ripple' : 'ring'; const rad = (r.r0 ?? 20) + ((r.r1 ?? 140) - (r.r0 ?? 20)) * E.out(u); el.style.left = (r.x - rad) + 'px'; el.style.top = (r.y - rad) + 'px'; el.style.width = el.style.height = 2 * rad + 'px'; el.style.opacity = (1 - u) * (r.type === 'ripple' ? 1 : 0.95); el.style.borderWidth = (3 * (1 - u) + 0.5) + 'px'; rg.append(el); }
  const fl = (S.flashes ?? []).map((f) => { const u = (t - f.at) / (f.dur ?? 0.27); return u < 0 || u > 1 ? null : { f, a: u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 }; }).find(Boolean);
  $('flash').style.opacity = fl ? fl.a.toFixed(3) : 0; if (fl) $('flash').style.background = 'radial-gradient(60% 45% at ' + (fl.f.x ?? 50) + '% ' + (fl.f.y ?? 45) + '%, #fff 0%, #fff4dc 25%, rgba(250,129,39,.85) 55%, rgba(250,129,39,0) 85%)';
  $('leak').style.opacity = S.leak ? kf(S.leak, t)[0] : 0; $('leak').style.transform = 'translate(' + Math.sin(t * .7) * 20 + 'px,' + Math.cos(t * .5) * 30 + 'px)';
  /* text */
  const live = new Set();
  for (const [i, x] of (S.texts ?? []).entries()) { if (t < x.from || t >= x.to) continue; live.add(i);
    let el = textEls[i]; if (!el) { el = document.createElement('div'); el.className = x.kind === 'tag' ? 'tag' : x.kind === 'sticker' ? 'sticker' + (x.dark ? ' dark' : '') : x.kind === 'callout' ? 'callout' : 'tx ' + (x.size ?? '');
      if (x.kind === 'tx' || !x.kind) { let hl = false; el.innerHTML = x.text.split(/(\*)/).map((part) => { if (part === '*') { hl = !hl; return ''; } return part.split(/(\s+)/).filter((w) => w.length).map((w) => '<span' + (hl && w.trim() ? ' class="hl"' : '') + '>' + w + '</span>').join(''); }).join(''); } else el.textContent = x.text; /* *phrase* = yellow, across words */
      if (x.left != null) { el.style.left = x.left + 'px'; el.style.right = 'auto'; } el.style.top = x.y + 'px'; if (x.len) el.style.setProperty('--len', x.len + 'px'); $('texts').append(el); textEls[i] = el; }
    const age = t - x.from, out = clamp((x.to - t) / 0.17);
    if (x.kind === 'tx' || !x.kind) { const words = [...el.querySelectorAll('span')]; let k = 0; for (const s of words) { if (!s.textContent.trim()) continue; const u = x.instant ? 1 : clamp((age - k * 0.1) / 0.23), e = E.expo(u); s.style.opacity = Math.min(u * 3, 1) * out; s.style.transform = 'translateY(' + ((1 - e) * 14 - (1 - out) * 8) + 'px) scale(' + (1 + 0.12 * (1 - e)) + ')'; k++; } }
    else { const u = x.instant ? 1 : clamp(age / 0.22); el.style.opacity = Math.min(1, u * 2) * out; el.style.transform = 'scale(' + (E.back(u) * 0.3 + 0.7 * (u > 0 ? 1 : 0)) + ') rotate(' + (x.rot ?? 0) + 'deg)'; } }
  for (const [i, el] of Object.entries(textEls)) if (!live.has(Number(i))) { el.remove(); delete textEls[i]; }
}
window.render = render;
window.loadEarth = async (src) => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); EARTH = g.getImageData(0, 0, c.width, c.height); };
</script></body></html>`;

/* Render a scene to a graded, silent mp4 at 1080 × 1920 / 30 fps. scene.takes: [take, ...] from rec(); every take's frames
   are copied (by reference) into one folder the page can read. */
export async function compose(name, scene, dir) {
  const work = join(dir, 'comp-' + name); rmSync(work, { recursive: true, force: true }); mkdirSync(join(work, 'takes'), { recursive: true }); mkdirSync(join(work, 'f'), { recursive: true });
  for (const f of ['Inter-latin.woff2', 'RussoOne-Regular.woff2']) copyFileSync(join(ROOT, 'fonts', f), join(work, f));
  const takes = (scene.takes ?? []).map((tk) => tk.frames.map((x) => { const to = join(work, 'takes', basename(tk.dir) + '-' + x.f); if (!existsSync(to)) copyFileSync(join(tk.dir, x.f), to); return { f: basename(tk.dir) + '-' + x.f, t: x.t }; }));
  for (const a of scene.assets ?? []) copyFileSync(a, join(work, basename(a)));
  const json = JSON.stringify({ ...scene, takes }, (k, v) => (k === 'dir' ? undefined : v));
  writeFileSync(join(work, 'comp.html'), PAGE.replace('<script>', `<script>window.SCENE = ${json};</script><script>`));
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: W / VW })).newPage();
  p.on('pageerror', (e) => console.log(name, 'page error', e.message));
  await p.goto('file://' + join(work, 'comp.html')); await p.evaluate(() => document.fonts.ready);
  if (scene.earth) { const uri = 'data:image/webp;base64,' + readFileSync(join(ROOT, 'assets/sky/earth.webp')).toString('base64'); await p.evaluate((u) => window.loadEarth(u), uri); } /* a data URL: a file:// image taints the canvas */
  const N = Math.round(scene.dur * FPS);
  for (let i = 0; i < N; i++) { await p.evaluate((t) => window.render(t), i / FPS); await p.screenshot({ path: join(work, 'f', `${String(i).padStart(4, '0')}.png`) }); if (i % 60 === 0) process.stdout.write(`${name} ${i}/${N}\r`); }
  await b.close();
  /* the grade: deep blue-black floor, warm highlights, a touch more colour, bloom on the bright things, vignette, grain */
  const out = join(work, 'graded.mp4');
  const grade = `format=gbrp,split[a][b];[b]curves=all='0/0 0.62/0 1/1',gblur=sigma=22,format=gbrp[bl];[a]curves=master='0/0 0.08/0.025 0.5/0.5 1/1',colorbalance=bs=.06:rs=-.03:rh=.05:bh=-.04,eq=saturation=1.12,format=gbrp[base];[base][bl]blend=all_mode=screen:all_opacity=.42,vignette=PI/5,noise=alls=4:allf=t,format=yuv420p` /* in RGB: a screen blend on YUV chroma turned everything purple */;
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(work, 'f', '%04d.png'), '-vf', grade, '-c:v', 'libx264', '-crf', '18', '-maxrate', '20M', '-bufsize', '40M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'slow', out]);
  return out;
}

/* ───────────── 3 · sound ───────────── */
const KIT = join(ROOT, 'scripts/.cache/tt-sfx'); mkdirSync(KIT, { recursive: true });
const SYNTH = {
  boom: ['aevalsrc=exprs=0.95*sin(2*PI*(80*t-30*t*t))*exp(-4.5*t):d=0.9:s=48000', ''],
  impact: ['aevalsrc=exprs=0.85*sin(2*PI*58*t)*exp(-6*t)+0.55*(random(0)*2-1)*exp(-90*t):d=0.6:s=48000', ',highpass=f=30'],
  crack: ['aevalsrc=exprs=(random(0)*2-1)*exp(-110*t):d=0.08:s=48000', ',highpass=f=3000'],
  riser: ['aevalsrc=exprs=pow(t/1.5\\,2.2)*((random(0)*2-1)*0.55+0.25*sin(2*PI*(200*t+200*t*t))):d=1.5:s=48000', ',highpass=f=900,lowpass=f=9000'],
  whoosh: ['aevalsrc=exprs=(random(0)*2-1)*sin(PI*t/0.42)*sin(PI*t/0.42)*(1-t/0.42)|(random(1)*2-1)*sin(PI*t/0.42)*sin(PI*t/0.42)*(t/0.42):d=0.42:s=48000', ',bandpass=f=1400:width_type=o:w=2.2'],
  tick: ['aevalsrc=exprs=(random(0)*2-1)*exp(-80*t):d=0.05:s=48000', ',highpass=f=5000'],
  swell: ['aevalsrc=exprs=pow(t/0.8\\,3)*(random(0)*2-1):d=0.8:s=48000', ',highpass=f=4000'],
  shimmer: ['aevalsrc=exprs=(random(0)*2-1)*(0.6+0.4*sin(2*PI*3*t))|(random(1)*2-1)*(0.6+0.4*sin(2*PI*3*t+1.5)):d=3:s=48000', ',bandpass=f=8500:width_type=h:w=5000,afade=t=in:d=0.4,afade=t=out:st=2.4:d=0.6'],
  twinkle: ['aevalsrc=exprs=0.5*sin(2*PI*4200*t)*exp(-14*t)+0.4*sin(2*PI*5600*(t-0.9))*exp(-14*(t-0.9))*gte(t\\,0.9)+0.35*sin(2*PI*3300*(t-1.7))*exp(-14*(t-1.7))*gte(t\\,1.7):d=2.4:s=48000', ''],
  sub: ['aevalsrc=exprs=0.9*sin(2*PI*50*t)*exp(-9*t):d=0.35:s=48000', ''],
  pop: ['aevalsrc=exprs=0.6*sin(2*PI*(900*t-700*t*t))*exp(-30*t):d=0.12:s=48000', ''],
};
function kit(name) { const f = join(KIT, name + '.wav'); if (existsSync(f)) return f; const [src, post] = SYNTH[name]; sh('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', src, '-af', `aformat=channel_layouts=stereo${post}`, '-ar', '48000', f]); return f; }
const APP = (n) => join(ROOT, 'assets/audio/sfx', n + '.mp3');
/* cues: [[name, at (s), gain (dB)], ...]; name 'app:xyz' = the app's own sound. drop: when the payoff lands (music opens). */
export function mix(name, video, { dur, drop, cues, music = true, musicFrom = 109.6 }) {
  const inputs = [], fc = [];
  const add = (f) => { inputs.push('-i', f); return inputs.length / 2 - 1; };
  const v = add(video); void v;
  const sfxLabels = [];
  cues.forEach(([n, at, db = 0], i) => { if (at < 0 || at >= dur) return; const f = n.startsWith('app:') ? APP(n.slice(4)) : kit(n); const k = add(f), ms = Math.round(at * 1000);
    fc.push(`[${k}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${db}dB,adelay=${ms}|${ms},apad[s${i}]`); sfxLabels.push(`[s${i}]`); });
  fc.push(`${sfxLabels.join('')}amix=inputs=${sfxLabels.length}:normalize=0:duration=longest,atrim=0:${dur},aecho=0.6:0.4:25|40:0.2|0.15,asplit=2[sfx][key]`);
  let last = '[sfx]';
  if (music) { const m = add(join(ROOT, 'assets/audio/permafrost.m4a'));
    const pre = Math.max(0.1, drop - 0.18);
    fc.push(`[${m}:a]atrim=${musicFrom}:${musicFrom + dur + 1},asetpts=N/SR/TB,aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[ma][mb]`);
    fc.push(`[ma]lowpass=f=520,volume=0.75,atrim=0:${pre},afade=t=in:d=0.05,afade=t=out:st=${(pre - 0.08).toFixed(3)}:d=0.08[m1]`); /* muffled under the build, then a short drop-out */
    fc.push(`[mb]atrim=${drop}:${dur + 1},asetpts=N/SR/TB,volume=1.15,afade=t=in:d=0.03,afade=t=out:st=${(dur - drop - 0.35).toFixed(3)}:d=0.35,adelay=${Math.round(drop * 1000)}|${Math.round(drop * 1000)}[m2]`);
    fc.push(`[m1][m2]amix=inputs=2:normalize=0:duration=longest,atrim=0:${dur}[mus]`);
    fc.push(`[mus][key]sidechaincompress=threshold=0.05:ratio=6:attack=5:release=250[duck]`);
    fc.push(`[duck]${last}amix=inputs=2:normalize=0:duration=first[bus]`); last = '[bus]'; }
  else fc.push(`[key]anullsink`);
  fc.push(`${last}acompressor=threshold=-18dB:ratio=2:attack=10:release=180,bass=g=2:f=60,atrim=0:${dur}[pre]`);
  const target = music ? '-14' : '-16';
  /* two-pass loudnorm */
  const g = fc.join(';');
  let m = null;
  try { const out = execFileSync('bash', ['-c', `ffmpeg -hide_banner -nostats ${inputs.map((x) => `'${x}'`).join(' ')} -filter_complex "${g};[pre]loudnorm=I=${target}:TP=-1.5:LRA=8:print_format=json[o]" -map "[o]" -f null - 2>&1 | sed -n '/^{/,/^}/p'`], { maxBuffer: 1 << 26 }).toString(); m = JSON.parse(out); } catch (e) { console.log(name, 'loudnorm measure failed', e.message.slice(0, 120)); }
  const ln = m ? `loudnorm=I=${target}:TP=-1.5:LRA=8:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true` : `loudnorm=I=${target}:TP=-1.5:LRA=8`;
  const out = join(OUT, `${name}${music ? '' : '-nomusic'}.mp4`);
  sh('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', g + `;[pre]${ln},aresample=48000[o]`, '-map', '0:v', '-map', '[o]', '-t', String(dur), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
  return out;
}
/* The app's own sounds that played during a take, placed on the output timeline through a shot's time map. */
export function appCues(take, shot, keep, db = 0) {
  const out = []; const m = shot.map; if (!m) return out;
  for (const [n, ts] of take.sfx ?? []) { if (!keep.includes(n)) continue; for (let i = 0; i < m.length - 1; i++) { const [ta, sa] = m[i], [tb, sb] = m[i + 1]; if (ts >= sa && ts <= sb) { out.push(['app:' + n, ta + (ts - sa) / (sb - sa || 1) * (tb - ta), db]); break; } } }
  return out;
}
