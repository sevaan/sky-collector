"""Shared helpers for the photo apply scripts: uncropped save + aircraft bounding-box detection (2026-11-15)."""
import io, json, os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PAD = 0.04

def save_uncropped(data, dest):
    """Decode bytes, keep the original aspect, longest side 1280, webp q80. Returns (w, h) or raises."""
    im = Image.open(io.BytesIO(data)).convert('RGB')
    W, H = im.size; s = 1280 / max(W, H)
    if s < 1: im = im.resize((max(1, round(W * s)), max(1, round(H * s))), Image.LANCZOS)
    im.save(dest, 'WEBP', quality=80)
    return im.size

def _label(mask):
    """4-connected components of a bool array -> (labels, count) via iterative flood fill."""
    h, w = mask.shape; lab = np.zeros((h, w), np.int32); n = 0
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not lab[y, x]:
                n += 1; st = [(y, x)]; lab[y, x] = n
                while st:
                    cy, cx = st.pop()
                    for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; st.append((ny, nx))
    return lab, n

def _box_blur(a, r):
    k = 2 * r + 1; p = np.pad(a, ((r, r), (r, r), (0, 0)) if a.ndim == 3 else r, mode='edge')
    c = p.cumsum(0); c = np.concatenate([np.zeros((1,) + c.shape[1:]), c]); p = (c[k:] - c[:-k]) / k
    c = p.cumsum(1); c = np.concatenate([np.zeros((p.shape[0], 1) + c.shape[2:]), c], 1); return (c[:, k:] - c[:, :-k]) / k

def detect_box(path):
    """Normalised (x0,y0,x1,y1) box around the aircraft; falls back to the whole image when unsure."""
    im = Image.open(path).convert('RGB'); W, H = im.size
    sw = 160; sh = max(1, round(H * sw / W))
    a = np.asarray(im.resize((sw, sh), Image.BILINEAR), np.float32)
    # Background model: per-row median colour of the left and right 12% strips blended + per-column median of top strip.
    # Sky usually varies mostly vertically, so compare each pixel with the row's border colour.
    strip = max(2, int(sw * 0.1))
    rowbg = (np.median(a[:, :strip], 1) + np.median(a[:, -strip:], 1)) / 2  # sh x 3
    d1 = np.sqrt(((a - rowbg[:, None, :]) ** 2).sum(2))
    # Local contrast: distance from a heavily blurred copy
    bl = _box_blur(a, max(6, sw // 8)); d2 = np.sqrt(((a - bl) ** 2).sum(2))
    # Edge energy
    gy, gx = np.gradient(a.mean(2)); g = _box_blur(np.hypot(gx, gy), 1)
    sal = d1 / (d1.max() + 1e-6) * 0.5 + d2 / (d2.max() + 1e-6) * 0.25 + g / (g.max() + 1e-6) * 0.25
    # Mask: pixels well away from the sky colour estimate
    thr = max(20.0, min(34.0, 0.18 * float(np.percentile(d1, 99.5))))
    mask = (d1 > thr) | (d2 > thr * 1.3)
    # Keep only edge-consistent mass: close small gaps
    m = _box_blur(mask.astype(np.float32), 1) > 0.25
    lab, n = _label(m)
    if n == 0: return [0, 0, 1, 1]
    areas = np.bincount(lab.ravel())[1:]; keep = [i + 1 for i, ar in enumerate(areas) if ar >= max(0.06 * areas.max(), 4)]
    sel = np.isin(lab, keep); ys, xs = np.where(sel)
    x0, x1, y0, y1 = xs.min() / sw, (xs.max() + 1) / sw, ys.min() / sh, (ys.max() + 1) / sh
    return [round(max(0, x0 - PAD), 4), round(max(0, y0 - PAD), 4), round(min(1, x1 + PAD), 4), round(min(1, y1 + PAD), 4)]

def box_for(key, path, overrides):
    if key in overrides:  # hand-drawn tight round the plane; padded like a detected box (js/photo-fit.js trims it back)
        x0, y0, x1, y1 = overrides[key]
        # not clamped to 0-1: js/photo-fit.js reads a side at exactly 0 or 1 as "the plane may run to the edge"; a hand-drawn
        # box knows where the plane ends, so its margin may hang past the edge and the card can still trim it (2026-11-16)
        return [round(x0 - PAD, 4), round(y0 - PAD, 4), round(x1 + PAD, 4), round(y1 + PAD, 4)]
    return detect_box(path)

def load_overrides(): 
    p = os.path.join(HERE, 'box-overrides.json')
    return json.load(open(p)) if os.path.exists(p) else {}
