#!/usr/bin/env python3
"""Photos for the aircraft types that had none (2026-11-18, Sevaan: "everything should have an image, no generics").
Picks made by hand (four agents, checked by eye on the thumbnails) in scripts/photos/missing-type-picks.json:
  {ICAO: {title, page, url, w, h, licence, credit, box [x0,y0,x1,y1 fractions], livery, why, backup?}}  ({none: ...} = nothing found)
Wikimedia Commons, PD / CC0 / CC BY / CC BY-SA only. Kept apart from house-photos.js because some of these old airliners
only exist in an airline's paint ("livery" says whose). -> assets/photos/gap/<ICAO>.webp (longest side 1280, webp q80, uncropped)
and js/gap-photos.js (GAP_PHOTOS + gapPhoto(code), the same shape as housePhoto). Then run make-sizes.py for sm/ and tiny/.
Usage: python3 scripts/photos/apply-gap-photos.py [--force]"""
import io, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'assets', 'photos', 'gap'); os.makedirs(OUT, exist_ok=True)
UA = 'SkyCollectorPhotos/0.1 (+https://github.com/sevaan/sky-collector)'
picks = json.load(open(os.path.join(HERE, 'missing-type-picks.json')))
def fetch(p):
    title = p['title'].replace('File:', '', 1)
    url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(title.replace(' ', '_')) + '?width=1280'
    for t in range(5):
        try: return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()
        except Exception as e: print(' retry', e); time.sleep(4 + 4 * t)
meta = {}
for code in sorted(picks):
    p = picks[code]
    if not p or p.get('none') or not p.get('title'): continue
    dest = os.path.join(OUT, code + '.webp')
    if '--force' in sys.argv or not os.path.exists(dest):
        data = fetch(p)
        if not data: print(code, 'download failed'); continue
        im = Image.open(io.BytesIO(data)).convert('RGB')
        if max(im.size) > 1280: im.thumbnail((1280, 1280), Image.LANCZOS)
        im.save(dest, quality=80, method=6); time.sleep(0.6)
    w, h = Image.open(dest).size
    box = [round(max(0, min(1, v)), 3) for v in (p.get('box') or [0, 0, 1, 1])]
    meta[code] = {'credit': re.sub(r'<[^>]+>', '', p.get('credit') or 'Wikimedia Commons').strip()[:120], 'licence': p.get('licence', ''),
                  'source': p.get('page', ''), 'title': p['title'].replace('File:', 'File:', 1), 'w': w, 'h': h, 'box': box, 'livery': p.get('livery', '')}
    print(code, 'ok', w, h, flush=True)
js = ('// Photos for the aircraft types that had none (scripts/photos/apply-gap-photos.py, Wikimedia Commons, free licences;\n'
      '// picked and framed by eye 2026-11-18). "livery" says whose paint it is when it is an airline\'s. Generated.\n'
      f'export const GAP_PHOTOS = {json.dumps(meta, ensure_ascii=False, indent=0)};\n'
      "export const gapPhoto = (code) => (GAP_PHOTOS[code] ? { url: `assets/photos/gap/${code}.webp`, ...GAP_PHOTOS[code] } : null);\n")
open(os.path.join(ROOT, 'js', 'gap-photos.js'), 'w').write(js)
print(len(meta), 'photos')
