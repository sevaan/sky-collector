// How to show an aircraft photo in a frame without cutting the plane off (2026-11-15).
// box = [x0, y0, x1, y1] normalised 0-1 (the detected aircraft plus padding, from js/type-photos.js / js/airline-photos.js).
// Returns { mode: 'cover', objectPosition: 'X% Y%' } when an object-fit: cover crop of the frame's aspect can hold the
// whole box (position centres the box, clamped to the photo), else { mode: 'contain' }: the caller shows the whole photo
// over a blurred copy of itself.
const EPS = 1e-3;
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
export function fitStyle(box, imgW, imgH, frameW, frameH) {
  const ok = [imgW, imgH, frameW, frameH].every((n) => Number.isFinite(n) && n > 0);
  const b = Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) ? box : [0, 0, 1, 1];
  const x0 = Math.max(0, Math.min(b[0], b[2])), x1 = Math.min(1, Math.max(b[0], b[2]));
  const y0 = Math.max(0, Math.min(b[1], b[3])), y1 = Math.min(1, Math.max(b[1], b[3]));
  if (!ok) return { mode: 'contain' };
  const ia = imgW / imgH, fa = frameW / frameH;
  const vx = fa > ia ? 1 : fa / ia, vy = fa > ia ? ia / fa : 1; // visible fraction of the photo under cover
  if (x1 - x0 > vx + EPS || y1 - y0 > vy + EPS) return { mode: 'contain' };
  const pos = (lo, hi, v) => {
    if (v >= 1 - EPS) return 0.5;
    const start = Math.max(0, Math.min(1 - v, (lo + hi) / 2 - v / 2));
    return start / (1 - v);
  };
  return { mode: 'cover', objectPosition: `${pct(pos(x0, x1, vx))} ${pct(pos(y0, y1, vy))}` };
}
