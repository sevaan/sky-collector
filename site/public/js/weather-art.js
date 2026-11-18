// Weather backdrops for full-screen pages (2026-10-08, design/tonight-weather.html): soft drifting cloud made from
// fractal noise (no visible shapes), and animated rain. Styles in css/ui.css (.wx-clouds, .wx-rain).
//
// The cloud was two live SVG feTurbulence filters (5 octaves + blur) stretched over the page. WebKit rasterises those at
// device resolution every time the page is shown, which was the 200 ms hitch opening Tonight (perf review 2026-11-07,
// from a tester's "lag clicking tonight"). Now the same noise is computed once in JS at a small size, kept as a PNG per
// look, and shown as a plain picture; the CSS drift is unchanged. The SVG stays as the fallback without a canvas.
let cid = 0;
const pics = new Map();
// Value noise on an integer lattice, summed over 5 octaves like feTurbulence's fractalNoise (mean about 0.5).
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x, y, seed) { let v = 0, amp = 0.5, f = 1; for (let o = 0; o < 5; o++) { v += amp * vnoise(x * f, y * f, seed + o * 131); amp *= 0.5; f *= 2; } return v; }
// One cloud layer as a PNG data URL (240 × 128; it's shown blurred-soft by scaling up). null without a canvas.
function cloudPic(amount, dark, scale, seed, tint = null) {
  const key = `${Math.round(amount * 20)}|${dark ? 1 : 0}|${scale}|${seed}${tint ? `|${tint}` : ''}`;
  if (pics.has(key)) return pics.get(key);
  let url = null;
  try {
    const W = 240, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), px = img.data;
    const [r, g, b] = tint ?? (dark ? [43, 51, 64] : [64, 77, 97]), slope = 2.4, intercept = -1.24 + amount * 0.95; /* a touch denser than the SVG's -1.3: value noise sits a little lower than feTurbulence (checked side by side 2026-11-07) */
    const fx = 0.006 * scale * 600 / W, fy = 0.014 * scale * 320 / H; // the SVG's base frequencies, in our pixels
    for (let y = 0; y < H; y++) { const yy = y / H, mask = yy < 0.55 ? 1 : 1 - (yy - 0.55) / 0.45 * 1; // the SVG's vertical mask: full to 55 %, gone at the bottom
      for (let x = 0; x < W; x++) { const n = fbm(x * fx, y * fy, seed), a = Math.max(0, Math.min(1, slope * n + intercept)) * mask, i = (y * W + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = Math.round(a * 255); } }
    ctx.putImageData(img, 0, 0); url = cv.toDataURL('image/png');
  } catch { url = null; }
  pics.set(key, url); return url;
}
function layer(amount, dark, scale, seed, op, tint = null) {
  const pic = cloudPic(amount, dark, scale, seed, tint);
  if (pic) return `<img src="${pic}" alt="" decoding="async" draggable="false" style="position:absolute;inset:0;width:100%;height:100%;opacity:${op}">`;
  const id = `wxc${cid++}`, slope = 2.4, intercept = -1.3 + amount * 0.95;
  const [r, g, b] = dark ? [0.17, 0.2, 0.25] : [0.25, 0.3, 0.38];
  return `<svg viewBox="0 0 600 320" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;opacity:${op}">
    <defs><filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${0.006 * scale} ${0.014 * scale}" numOctaves="5" seed="${seed}"/>
      <feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  1 0 0 0 0"/><feComponentTransfer><feFuncA type="linear" slope="${slope}" intercept="${intercept}"/></feComponentTransfer><feGaussianBlur stdDeviation="1.2"/></filter>
      <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="${id}k"><rect width="600" height="320" fill="url(#${id}m)"/></mask></defs>
    <g mask="url(#${id}k)"><rect width="600" height="320" filter="url(#${id})"/></g></svg>`;
}
// amount 0..1 cloud cover; side: 'right' to have it creep in from one side (clouding over).
// tint [r, g, b] (2026-11-16, Sky Collector's daytime pack sky): the cloud colour, white for a sunny sky; without it the
// night-sky grey. Same noise, same drift.
export function cloudsHtml(amount, { dark = false, side = null, tint = null } = {}) {
  const inner = `<div class="wx-clouds"><div class="wx-layer" style="--d:34s">${layer(amount, dark, 1, 4, 0.75, tint)}</div><div class="wx-layer" style="--d:22s;animation-direction:alternate-reverse">${layer(amount * 0.8, dark, 1.8, 11, 0.6, tint)}</div></div>`;
  return side ? `<div class="wx-side">${inner}</div>` : inner;
}
// Draw the cloud pictures ahead of time, so a Tonight open doesn't pay for them. Only the looks this forecast will
// show (perf pass 2026-11-10: warming all 28 levels cost 14-67 ms each through the first seconds of sky), one at a
// time, and only when `gate()` says now is a good moment (main.js: the view is still and nothing is open).
const warmTodo = []; let warming = false, warmGate = () => true;
const picKey = (t) => `${Math.round(t[0] * 20)}|${t[1] ? 1 : 0}|${t[2]}|${t[3]}`;
export function warmClouds(amounts = [], gate) {
  if (gate) warmGate = gate;
  const want = amounts.filter((a) => a >= 0.35).map((a) => Math.min(1, a));
  if (want.length) want.push(0.85, 1); /* the Tonight page's own cloud deck on a bad night */
  const queued = new Set(warmTodo.map(picKey));
  for (const a of want) for (const t of [[a, true, 1, 4], [a * 0.8, true, 1.8, 11]]) { const k = picKey(t); if (!queued.has(k) && !pics.has(k)) { queued.add(k); warmTodo.push(t); } }
  if (warming) return; warming = true;
  const step = () => { const t = warmTodo[0]; if (!t) { warming = false; return; } if (warmGate()) { warmTodo.shift(); const pm = globalThis.__pm; if (pm) pm.span('cloud picture', () => cloudPic(...t)); else cloudPic(...t); } setTimeout(step, 250); };
  step();
}
export function rainHtml(n = 90) {
  let s = ''; for (let i = 0; i < n; i++) s += `<i style="left:${(Math.random() * 120).toFixed(1)}%;--t:${(0.55 + Math.random() * 0.35).toFixed(2)}s;--dl:${(-Math.random()).toFixed(2)}s;--h:${(12 + Math.random() * 10).toFixed(0)}px"></i>`;
  return `<div class="wx-rain">${s}</div>`;
}
