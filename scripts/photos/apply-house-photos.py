#!/usr/bin/env python3
"""Download the picked "house livery" photos (2026-11-15): scripts/photos/house-candidates.json + house-picks.json
({ICAO: option index | "OTHER_ICAO:index" to borrow another type's candidate | null for none}) ->
assets/photos/house/<ICAO>.webp (UNCROPPED, longest side 1280, webp q80) and js/house-photos.js (HOUSE_PHOTOS + housePhoto(code),
same shape as typePhoto: {url, credit, licence, source, title, w, h, box}). Boxes come from photo_common.py (box-overrides.json key "house/<ICAO>" wins).
Usage: python3 -I scripts/photos/apply-house-photos.py [--force]"""
import json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import photo_common as pc
from PIL import Image, PngImagePlugin
PngImagePlugin.MAX_TEXT_CHUNK = 64 * 1024 * 1024

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'assets', 'photos', 'house'); os.makedirs(OUT, exist_ok=True)
UA = 'SkyCollectorResearch/0.1 (https://github.com/sevaan/sky-collector)'
C = json.load(open(os.path.join(HERE, 'house-candidates.json')))
picks = json.load(open(os.path.join(HERE, 'house-picks.json')))
credits = {}; OV = pc.load_overrides()
for code, p in picks.items():
    if p is None: continue
    src, i = (p.split(':')[0], int(p.split(':')[1])) if isinstance(p, str) else (code, p)
    o = C[src]['options'][i]
    dest = os.path.join(OUT, f'{code}.webp')
    if '--force' in sys.argv or not os.path.exists(dest):
        url = re.sub(r'/\d+px-', '/1280px-', o['thumb'])
        try: data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()
        except Exception as e: print(code, 'download failed', e); continue
        try: pc.save_uncropped(data, dest)
        except Exception as e: print(code, 'unreadable', e); continue
        time.sleep(0.4)
    w, h = Image.open(dest).size
    credits[code] = {'credit': o['artist'], 'licence': o['licence'], 'source': o['page'], 'title': o['title'], 'w': w, 'h': h,
                     'box': pc.box_for('house/' + code, dest, OV)}
    print(code, 'ok', flush=True)
js = ('// House-livery photos for Planes cards: the type in its manufacturer\'s colours or unbranded, never another airline\'s paint\n'
      '// (scripts/photos/apply-house-photos.py, Wikimedia Commons, free licences). Generated.\n'
      f'export const HOUSE_PHOTOS = {json.dumps(credits, ensure_ascii=False, indent=0)};\n'
      "export const housePhoto = (code) => (HOUSE_PHOTOS[code] ? { url: `assets/photos/house/${code}.webp`, ...HOUSE_PHOTOS[code] } : null);\n")
open(os.path.join(ROOT, 'js', 'house-photos.js'), 'w').write(js)
print(len(credits), 'photos')
