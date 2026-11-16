#!/usr/bin/env python3
"""Download the picked airline-livery photos for Flight cards (2026-11-15): scripts/photos/airline-candidates.json +
airline-picks.json ({"ACA-A321": option index, or -1 for none}; a pair with options but no pick is skipped, since
every photo here was checked by eye) -> assets/photos/airlines/<AIRLINE>-<TYPE>.webp (UNCROPPED, longest side 1280, webp q80) and js/airline-photos.js (credit, licence, source page, w/h and the detected
aircraft box per photo; box-overrides.json ("airlines/<KEY>") wins).
Usage: python3 -I scripts/photos/apply-airline-photos.py [--force]  (--force re-downloads every photo)"""
import io, json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import photo_common as pc
from PIL import Image, PngImagePlugin
PngImagePlugin.MAX_TEXT_CHUNK = 64 * 1024 * 1024

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'assets', 'photos', 'airlines'); os.makedirs(OUT, exist_ok=True)
UA = 'SkyCollectorResearch/0.1 (https://github.com/sevaan/sky-collector)'
C = json.load(open(os.path.join(HERE, 'airline-candidates.json')))
picks = json.load(open(os.path.join(HERE, 'airline-picks.json')))
# Photos already applied (js/airline-photos.js): only download a pair again when its picked file changed.
try: OLD = json.loads(re.search(r'AIRLINE_PHOTOS = (\{.*?\n\});', open(os.path.join(ROOT, 'js', 'airline-photos.js')).read(), re.S).group(1))
except Exception: OLD = {}
credits = {}; OV = pc.load_overrides(); FORCE = '--force' in sys.argv
for key in sorted(C):
    c = C[key]; i = picks.get(key)
    if i is None or i < 0 or i >= len(c['options']): continue
    o = c['options'][i]; dest = os.path.join(OUT, f'{key}.webp')
    if FORCE or not os.path.exists(dest) or OLD.get(key, {}).get('title') != o['title']:
        url = re.sub(r'/\d+px-', '/1280px-', o['thumb'])
        try: data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()
        except Exception as e: print(key, 'download failed', e); continue
        try: pc.save_uncropped(data, dest)
        except Exception as e: print(key, 'unreadable', e); continue
        time.sleep(0.3)
    w, h = Image.open(dest).size
    credits[key] = {'credit': o['artist'], 'licence': o['licence'], 'source': o['page'], 'title': o['title'], 'w': w, 'h': h,
                   'box': pc.box_for('airlines/' + key, dest, OV)}
    print(key, 'ok')
for f in os.listdir(OUT):  # drop photos that are no longer picked
    if f.endswith('.webp') and f[:-5] not in credits: os.remove(os.path.join(OUT, f)); print('removed', f)
js = ('// Airline-livery photos for Flight cards (scripts/photos/apply-airline-photos.py, Wikimedia Commons, free licences). Generated.\n'
      '// Key: callsign airline prefix + ICAO type. Flight cards try airlinePhoto() first, then the type photo (js/type-photos.js).\n'
      f'export const AIRLINE_PHOTOS = {json.dumps(credits, ensure_ascii=False, indent=0)};\n'
      '// A close sibling of the same airline when the exact pair has no photo: same paint, near-identical aircraft.\n'
      "const SIBLING = { A20N: 'A320', A320: 'A20N', A21N: 'A321', A321: 'A21N', A19N: 'A319', B38M: 'B738', B738: 'B38M', B39M: 'B739', B739: 'B39M',\n"
      "  B737: 'B738', B3XM: 'B739', B78X: 'B789', B789: 'B788', B788: 'B789', A339: 'A333', A338: 'A332', A333: 'A332', A332: 'A333', A35K: 'A359',\n"
      "  BCS1: 'BCS3', BCS3: 'BCS1', E295: 'E195', E195: 'E190', E190: 'E195', E290: 'E190', E75L: 'E170', E75S: 'E170', E170: 'E75L',\n"
      "  CRJ9: 'CRJ7', CRJ7: 'CRJ9', B764: 'B763', B763: 'B764', B753: 'B752', B772: 'B77W', B77W: 'B772', B744: 'B748', B748: 'B744', AT72: 'AT76' };\n"
      'const hit = (k) => (AIRLINE_PHOTOS[k] ? { url: `assets/photos/airlines/${k}.webp`, ...AIRLINE_PHOTOS[k] } : null);\n'
      "export function airlinePhoto(airline, type) {\n"
      "  const a = String(airline || '').toUpperCase(), t = String(type || '').toUpperCase();\n"
      "  if (!/^[A-Z]{3}$/.test(a) || !t) return null;\n"
      "  return hit(`${a}-${t}`) || (SIBLING[t] ? hit(`${a}-${SIBLING[t]}`) : null);\n"
      "}\n")
open(os.path.join(ROOT, 'js', 'airline-photos.js'), 'w').write(js)
print(len(credits), 'photos')
