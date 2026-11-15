// App Store header, the cinematic take (2026-11-06, Sevaan: "take another stab"; advice: one strong focal point, 3–6
// words, everything near the centre). A painted night sky (Nano Banana Pro, store/raw/header-cinema-*.png: Milky Way,
// pine tree line) with the app's own orange target circle locked onto the ISS as a bright point with a light trail, and
// one line of words above it. Writes store/appstore/header/cinema-3840x1646.png and cinema-5244x2950.png.
// Usage: node scripts/store/header-cinema.mjs
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './common.mjs';
const OUT = join(ROOT, 'store/appstore/header'); mkdirSync(OUT, { recursive: true });
const data = (f, type = 'image/png') => `data:${type};base64,${readFileSync(f).toString('base64')}`;
const font = data(join(ROOT, 'fonts', 'RussoOne-Regular.ttf'), 'font/ttf');
const WORDS = 'Collect the night sky';
// cx, cy: where the circle sits; r: its radius; ty: the words' centre; fs: the words' size (all as fractions of the size).
const SETS = [
  { W: 3840, H: 1646, sky: 'header-cinema-21x9.png', cx: 0.5, cy: 0.6, r: 0.12, ty: 0.3, fs: 0.092 },
  { W: 5244, H: 2950, sky: 'header-cinema-16x9.png', cx: 0.5, cy: 0.5, r: 0.085, ty: 0.27, fs: 0.072 }, // a phone shows the upper middle
];
function page({ W, H, sky, cx, cy, r, ty, fs }) {
  const X = cx * W, Y = cy * H, R = r * H, lw = Math.max(4, R * 0.045), tick = R * 0.22;
  const trail = R * 3.2, ang = -28; // the ISS's light trail runs in from the lower left
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: D; src: url('${font}'); }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #060b15; }
.sky { position: absolute; inset: 0; background: url('${data(join(ROOT, 'store/raw', sky))}') center / cover; }
.dim { position: absolute; inset: 0; background: radial-gradient(ellipse 45% 40% at ${cx * 100}% ${(ty + cy) / 2 * 100}%, rgba(4,8,18,.45), rgba(4,8,18,0) 100%); }
.words { position: absolute; left: 0; right: 0; top: ${ty * H}px; transform: translateY(-50%); text-align: center; font: 400 ${fs * H}px/1 D; color: #fff2b3; letter-spacing: .01em; text-shadow: 0 0 ${fs * H * 0.4}px rgba(0,0,0,.6); }
.trail { position: absolute; left: ${X - trail}px; top: ${Y - lw / 2}px; width: ${trail}px; height: ${lw * 0.9}px; transform-origin: 100% 50%; transform: rotate(${ang}deg); background: linear-gradient(90deg, rgba(255,242,200,0), rgba(255,242,200,.85)); border-radius: ${lw}px; filter: blur(${lw * 0.25}px); }
.iss { position: absolute; left: ${X}px; top: ${Y}px; width: ${R * 0.12}px; height: ${R * 0.12}px; transform: translate(-50%,-50%); border-radius: 50%; background: #fffbe8; box-shadow: 0 0 ${R * 0.12}px ${R * 0.05}px rgba(255,251,232,.9), 0 0 ${R * 0.45}px rgba(255,220,150,.55); }
svg { position: absolute; left: 0; top: 0; }
</style></head><body><div class="sky"></div><div class="dim"></div><div class="words">${WORDS}</div><div class="trail"></div>
<svg width="${W}" height="${H}"><defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${lw * 1.6}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<g filter="url(#g)" stroke="#fa8127" fill="none" stroke-linecap="round">
<circle cx="${X}" cy="${Y}" r="${R}" stroke-width="${lw}"/>
<circle cx="${X}" cy="${Y}" r="${R * 0.3}" stroke-width="${lw * 0.45}" opacity=".9"/>
<line x1="${X}" y1="${Y - R - tick * 0.35}" x2="${X}" y2="${Y - R - tick * 1.35}" stroke-width="${lw * 0.9}"/>
<line x1="${X}" y1="${Y + R + tick * 0.35}" x2="${X}" y2="${Y + R + tick * 1.35}" stroke-width="${lw * 0.9}"/>
<line x1="${X - R - tick * 0.35}" y1="${Y}" x2="${X - R - tick * 1.35}" y2="${Y}" stroke-width="${lw * 0.9}"/>
<line x1="${X + R + tick * 0.35}" y1="${Y}" x2="${X + R + tick * 1.35}" y2="${Y}" stroke-width="${lw * 0.9}"/>
</g></svg><div class="iss"></div></body></html>`;
}
const b = await chromium.launch();
for (const s of SETS) {
  const pg = await b.newPage({ viewport: { width: s.W, height: s.H } });
  await pg.setContent(page(s), { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: join(OUT, `cinema-${s.W}x${s.H}.png`) }); console.log('cinema', s.W, s.H); await pg.close();
}
await b.close();
