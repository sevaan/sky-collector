"""Small and tiny copies of every plane photo (2026-11-16, Collection scroll gap: tiles decoded 1280 px photos and ran a
live blur on a second copy; Space Collector's tiles use 440 px art). sm/ (480 px wide) for card faces in grids and
minis; tiny/ (32 px) for the soft sides behind a contained photo, stretched so it reads as a blur with no CSS filter.
Usage: python3 -I scripts/photos/make-sizes.py  (only makes what's missing or older than its source)"""
import os
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'photos')
n = 0
for kind in ('house', 'types', 'airlines', 'gap'):
    d = os.path.join(ROOT, kind)
    for size, w, q in (('sm', 480, 76), ('tiny', 32, 60)):
        os.makedirs(os.path.join(d, size), exist_ok=True)
    for f in os.listdir(d):
        if not f.endswith('.webp'): continue
        src = os.path.join(d, f); im = None
        for size, w, q in (('sm', 480, 76), ('tiny', 32, 60)):
            out = os.path.join(d, size, f)
            if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src): continue
            im = im or Image.open(src).convert('RGB')
            h = max(1, round(im.height * w / im.width))
            im.resize((w, h), Image.LANCZOS).save(out, quality=q, method=6); n += 1
print('made', n)
