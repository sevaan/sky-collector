"""Foil mask for the pack from a light card back (2026-11-16): Space Collector's pack stamps its card back's linework in
foil (assets/art/backs/back-collector-mask.webp); Sky's pack does the same with Flight Plan. Ink becomes alpha: navy
lines and red details fully, the gold ring mostly, the mid-blue swooshes faintly; cream and pale sky drop out.
Usage: python3 -I scripts/art/back-mask.py assets/art/backs/back-flight-plan.webp assets/art/backs/back-flight-plan-mask.webp"""
import sys
import numpy as np
from PIL import Image
A = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
L = 0.3 * r + 0.59 * g + 0.11 * b
mx, mn = A.max(-1), A.min(-1); s = (mx - mn) / np.maximum(mx, 1)
ink = np.clip((172 - L) / 55, 0, 1)                           # navy lines, red
gold = np.clip((s - 0.3) / 0.15, 0, 1) * (r > b + 60) * (r >= g) * 0.85   # the gold ring and other warm ink
a = np.maximum(ink, gold)
out = np.zeros(A.shape[:2] + (4,), np.uint8); out[..., :3] = 255; out[..., 3] = (a * 255).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(sys.argv[2], quality=90, method=6)
