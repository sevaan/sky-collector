#!/usr/bin/env python3
"""Download the picked Commons photos for Planes cards (2026-11-15): scripts/photos/candidates.json + picks.json
({ICAO: option index, or -1 for none}; anything not listed takes option 0) -> assets/photos/types/<ICAO>.webp
(1024×768, centre-cropped 4:3) and js/type-photos.js (credit, licence, source page per photo, for the card credit line).
Usage: python3 -I scripts/photos/apply-type-photos.py"""
import io, json, os, re, time, urllib.request
from PIL import Image, PngImagePlugin
PngImagePlugin.MAX_TEXT_CHUNK = 64 * 1024 * 1024  # some Commons PNGs carry huge metadata

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'assets', 'photos', 'types'); os.makedirs(OUT, exist_ok=True)
UA = 'SkyCollectorResearch/0.1 (https://github.com/sevaan/sky-collector)'
C = json.load(open(os.path.join(HERE, 'candidates.json')))
picks = json.load(open(os.path.join(HERE, 'picks.json')))
credits = {}
for code, c in C.items():
    i = picks.get(code, 0)
    if i is None or i < 0 or i >= len(c['options']): continue
    o = c['options'][i]
    url = re.sub(r'/\d+px-', '/1280px-', o['thumb'])
    try:
        data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()
    except Exception as e: print(code, 'download failed', e); continue
    try: im = Image.open(io.BytesIO(data)).convert('RGB')
    except Exception as e: print(code, 'unreadable', e); continue
    W, H = im.size; tw, th = (W, round(W * 3 / 4)) if W * 3 / 4 <= H else (round(H * 4 / 3), H)
    im = im.crop(((W - tw) // 2, (H - th) // 2, (W - tw) // 2 + tw, (H - th) // 2 + th)).resize((1024, 768), Image.LANCZOS)
    im.save(os.path.join(OUT, f'{code}.webp'), 'WEBP', quality=82)
    credits[code] = {'credit': o['artist'], 'licence': o['licence'], 'source': o['page'], 'title': o['title']}
    print(code, 'ok'); time.sleep(0.3)
js = ('// Real photos for Planes cards (scripts/photos/apply-type-photos.py, Wikimedia Commons, free licences). Generated.\n'
      f'export const TYPE_PHOTOS = {json.dumps(credits, ensure_ascii=False, indent=0)};\n'
      "export const typePhoto = (code) => (TYPE_PHOTOS[code] ? { url: `assets/photos/types/${code}.webp`, ...TYPE_PHOTOS[code] } : null);\n")
open(os.path.join(ROOT, 'js', 'type-photos.js'), 'w').write(js)
print(len(credits), 'photos')
