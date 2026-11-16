"""Register a Sky card back onto Space Collector's Mission Control layout (2026-11-16, Sevaan: "I want them to line up
and overlay perfectly"). A thin-plate spline moves matched landmarks (frame and header rules, the four corner circles,
the compass ring's axis dots and diagonals, the title pill) from where the Sky art has them to where Mission Control
has them, and resamples the art smoothly in between.

Usage: python3 -I scripts/art/register-back.py SRC.png OUT.webp
SRC is the art cropped inside its outer frame (970x1416, see the Flight Plan note in js/card-backs.js); landmark
coordinates below are in the 900x1359 frame of the first fit (SRC scaled by SX/SY and offset by OX/OY).
"""
import sys, math
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
SX = 861 / 950; SY = SX * 1.02; OX, OY = 11, 25   # the first fit: 900-frame coords = src * S + O
W, H = 900, 1359; SS = 2                          # render at 2x, then downsample
CREAM = (253, 246, 233)

pairs = []  # (Space Collector x, y) -> (Sky x, y), both in the 900x1359 frame; measured 2026-11-16 (line profiles, circle fits)
def P(a, b): pairs.append((a, b))
def ring(c_sc, r_sc, c_sky, r_sky, angles):
    for a in angles:
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        P((c_sc[0] + r_sc * c, c_sc[1] + r_sc * s), (c_sky[0] + r_sky * c, c_sky[1] + r_sky * s))
XS = (20, 60, 120, 200, 300, 450, 600, 700, 780, 840, 878.5)
def sky_x(x): return 19 if x == 20 else 880 if x == 878.5 else x
# frame rule and the two header rules, top and bottom (straight across the width in both)
for y_sc, y_sky in ((19, 32.5), (49.5, 63), (77.5, 90), (1276, 1265.5), (1307, 1294.5), (1338, 1324)):
    for x in XS: P((x, y_sc), (sky_x(x), y_sky))
# frame sides
for y_sc, y_sky in ((50, 63.5), (110, 123), (175.4, 192.1), (300, 314), (654.2, 669.4), (1000, 1013), (1142, 1148), (1220, 1222), (1300, 1288)):
    P((20, y_sc), (19, y_sky)); P((878.5, y_sc), (880, y_sky))
# corner circles: fitted centre and outline (Space Collector r 86-87, Sky r 90.4)
for (c_sc, r_sc), (c_sky, r_sky) in ((((124.1, 175.4), 85.9), ((121.9, 192.1), 90.3)), (((774.9, 175.4), 85.9), ((776.7, 192.2), 90.4)),
                                     (((123.7, 1142.1), 87.1), ((121.9, 1147.8), 90.5)), (((774.9, 1141.9), 87.0), ((777.1, 1148.0), 90.5))):
    P(c_sc, c_sky); ring(c_sc, r_sc, c_sky, r_sky, range(0, 360, 45))
# compass ring: fitted centre, the outer circle (365.5 / 366.4) and the inner rule (323.9 / 325.7)
RC_SC, RC_SKY = (449.0, 654.2), (447.65, 669.4)
ring(RC_SC, 365.5, RC_SKY, 366.4, [a for a in range(0, 360, 30) if a % 90])
# the four axis dots (Sky's top dot sits 9px outside its circle, so the dots are matched themselves)
P((449, 289), (451, 294)); P((449, 1019), (451, 1038)); P((85, 653), (78, 671)); P((814, 653), (817, 671))
ring(RC_SC, 323.9, RC_SKY, 325.7, range(15, 360, 30))
# title pill edges and the COLLECTOR word (strokes already line up across; it sits 16-17px lower)
for x in (300, 449, 600):
    P((x, 564), (x, 581)); P((x, 745.5), (x, 763))
P((193, 698), (192, 714)); P((704, 698), (704, 714)); P((449, 669), (449, 686)); P((449, 727), (449, 743))

A = np.array([p[0] for p in pairs], float); B = np.array([p[1] for p in pairs], float)
n = len(A)
def U(r2): return np.where(r2 > 0, 0.5 * r2 * np.log(r2 + 1e-12), 0.0)  # r^2 log r
K = U(((A[:, None, :] - A[None, :, :]) ** 2).sum(-1))
Pm = np.hstack([np.ones((n, 1)), A])
L = np.zeros((n + 3, n + 3)); L[:n, :n] = K + 1e-6 * np.eye(n); L[:n, n:] = Pm; L[n:, :n] = Pm.T
coef = np.linalg.solve(L, np.vstack([B, np.zeros((3, 2))]))
print('max landmark error', np.abs((np.hstack([K, Pm]) @ coef) - B).max())

src = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32); sh, sw, _ = src.shape
out = np.empty((H * SS, W * SS, 3), np.float32)
xs = (np.arange(W * SS) + 0.5) / SS - 0.5
for y0 in range(0, H * SS, 64):
    ys = (np.arange(y0, min(y0 + 64, H * SS)) + 0.5) / SS - 0.5
    gx, gy = np.meshgrid(xs, ys); pts = np.stack([gx.ravel(), gy.ravel()], 1)
    r2 = ((pts[:, None, :] - A[None, :, :]) ** 2).sum(-1)
    q = U(r2) @ coef[:n] + coef[n] + pts @ coef[n + 1:]
    u = (q[:, 0] - OX) / SX; v = (q[:, 1] - OY) / SY          # back into the source's pixels
    x0 = np.floor(u).astype(int); y0i = np.floor(v).astype(int); fx = (u - x0)[:, None]; fy = (v - y0i)[:, None]
    inside = (x0 >= 0) & (y0i >= 0) & (x0 < sw - 1) & (y0i < sh - 1)
    xc = np.clip(x0, 0, sw - 2); yc = np.clip(y0i, 0, sh - 2)
    c = (src[yc, xc] * (1 - fx) * (1 - fy) + src[yc, xc + 1] * fx * (1 - fy) + src[yc + 1, xc] * (1 - fx) * fy + src[yc + 1, xc + 1] * fx * fy)
    c[~inside] = CREAM
    out[y0:y0 + len(ys)] = c.reshape(len(ys), W * SS, 3)
img = Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
img.save(OUT, quality=90, method=6)
print('wrote', OUT, img.size)
