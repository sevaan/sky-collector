// Soft cloud pictures for small skies (2026-11-22, Sevaan: the rank card's clouds "could be better"; the technique is Space
// Collector's Tonight cloud, as Space Max described it): no shapes, only noise. Value noise summed over five octaves, stretched
// sideways so it reads as cloud bands, cut off at a threshold set by how much cover; one flat colour with all the shading in
// alpha; drawn small and shown big, so scaling does the softening. Made once per look and kept as a PNG data URL.
const cache = new Map();
function vnoise(x, y, s) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }
function fbm(x, y, s) { let v = 0, amp = 0.5, f = 1; for (let o = 0; o < 5; o++) { v += amp * vnoise(x * f, y * f, s + o * 131); amp *= 0.5; f *= 2; } return v; }
// -> a PNG data URL, or '' where there's no canvas. amount 0..1 (cover), rgb the colour, seed picks the pattern.
export function cloudPic(amount, { W = 180, H = 98, seed = 4, rgb = [255, 255, 255], scale = 1 } = {}) {
  const key = `${amount}|${W}|${H}|${seed}|${rgb}|${scale}`; if (cache.has(key)) return cache.get(key);
  let url = '';
  try {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), px = img.data;
    const fx = 0.006 * scale * 600 / W, fy = 0.014 * scale * 320 / H, k = -1.24 + amount * 0.95;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = Math.max(0, Math.min(1, 2.4 * fbm(x * fx, y * fy, seed) + k)), i = (y * W + x) * 4; px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = a * 255; }
    ctx.putImageData(img, 0, 0); url = cv.toDataURL('image/png');
  } catch { url = ''; }
  cache.set(key, url); return url;
}
