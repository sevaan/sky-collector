"""Turn a card back's oranges into Sky Collector's red (2026-11-16, Sevaan: "Replace all oranges with reds").
Pixels in the orange hue band (14-33 deg, fading out by 37 so gold rules at ~40 deg stay gold) move to the red stars'
hue (6 deg), keeping their saturation and brightness so anti-aliased edges blend into the cream as before.
Usage: python3 -I scripts/art/orange-to-red.py IN.webp OUT.webp"""
import sys
import numpy as np
from PIL import Image
A = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
mx, mn = A.max(-1), A.min(-1); d = np.maximum(mx - mn, 1e-6); s = (mx - mn) / np.maximum(mx, 1e-6)
h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
w = np.clip((h - 10) / 4, 0, 1) * np.clip((37 - h) / 4, 0, 1) * np.clip((s - 0.12) / 0.1, 0, 1)
V = mx * 0.93; lo = V * (1 - s)                       # same saturation, hue 6 deg, a touch darker like the red stars
red = np.stack([V, lo + (V - lo) * 0.1, lo], -1)
out = A * (1 - w[..., None]) + red * w[..., None]
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(sys.argv[2], quality=90, method=6)
print('recoloured px (w>0.5):', int((w > 0.5).sum()))
