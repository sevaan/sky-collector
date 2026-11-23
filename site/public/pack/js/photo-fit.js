// How to show an aircraft photo in a frame without cutting the plane off (2026-11-15).
// box = [x0, y0, x1, y1] normalised 0-1 (the detected aircraft plus padding, from js/type-photos.js / js/airline-photos.js).
// The padding (PAD, 0.04 a side in scripts/photos/photo_common.py, overrides included) is a safety margin, not plane, so
// a cover crop may trim into it (Sevaan, 2026-11-16: fill the card wherever no part of the plane is cut off). A side at
// the photo's edge keeps its full extent: the plane may run right to that edge.
// Returns { mode: 'cover', objectPosition: 'X% Y%' } when an object-fit: cover crop of the frame's aspect can hold the
// whole box (position centres the box, clamped to the photo), else { mode: 'contain' }: the caller shows the whole photo
// over a blurred copy of itself.
const EPS = 1e-3;
const TRIM = 0.035; // of the 0.04 padding, leaving a sliver of air round the plane
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
export function fitStyle(box, imgW, imgH, frameW, frameH, { fill = false } = {}) {
  const ok = [imgW, imgH, frameW, frameH].every((n) => Number.isFinite(n) && n > 0);
  const b = Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) ? box : [0, 0, 1, 1];
  // A side at exactly 0 or 1 is a detected box clamped at the photo edge (the plane may run right to it): no trim there.
  // Hand-drawn boxes keep their margin past the edge (e.g. -0.02), so they trim and then clamp. (2026-11-16)
  let x0 = Math.min(b[0], b[2]), x1 = Math.max(b[0], b[2]);
  let y0 = Math.min(b[1], b[3]), y1 = Math.max(b[1], b[3]);
  if (!ok) return { mode: 'contain' };
  const edge = (v) => Math.abs(v) < EPS || Math.abs(v - 1) < EPS;
  if (x1 - x0 > 2 * TRIM + 0.05) { if (!edge(x0)) x0 += TRIM; if (!edge(x1)) x1 -= TRIM; }
  if (y1 - y0 > 2 * TRIM + 0.05) { if (!edge(y0)) y0 += TRIM; if (!edge(y1)) y1 -= TRIM; }
  x0 = Math.max(0, x0); x1 = Math.min(1, x1); y0 = Math.max(0, y0); y1 = Math.min(1, y1);
  const ia = imgW / imgH, fa = frameW / frameH;
  const vx = fa > ia ? 1 : fa / ia, vy = fa > ia ? ia / fa : 1; // visible fraction of the photo under cover
  /* fill (the plane card's photo window, 2026-11-22, Sevaan: "make the image just slightly bigger so that it takes up 100%
     height"): always a cover crop, centred on the plane, even when a wingtip or tail runs past the edge, never the blurred view */
  if (!fill && (x1 - x0 > vx + EPS || y1 - y0 > vy + EPS)) return { mode: 'contain' };
  const pos = (lo, hi, v) => {
    if (v >= 1 - EPS) return 0.5;
    const start = Math.max(0, Math.min(1 - v, (lo + hi) / 2 - v / 2));
    return start / (1 - v);
  };
  return { mode: 'cover', objectPosition: `${pct(pos(x0, x1, vx))} ${pct(pos(y0, y1, vy))}` };
}
