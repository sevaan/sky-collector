#!/usr/bin/env python3
"""Contact sheets for picking airline-livery photos (2026-11-15). Reads scripts/photos/airline-candidates.json and draws
sheets of 10 pairs x up to 4 options (pair key and option number on each tile) into OUT_DIR/sheet-NN.jpg; look at
them, then write scripts/photos/airline-picks.json ({"ACA-A321": option index, or -1 for none}).
--kept draws one tile per picked photo instead (OUT_DIR/kept-NN.jpg; the applied 4:3 crop once apply-airline-photos.py
has run), for a final check.
Usage: python3 -I scripts/photos/make-airline-sheet.py OUT_DIR [--kept]"""
import io, json, os, sys, time, urllib.request
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'SkyCollectorResearch/0.1 (https://github.com/sevaan/sky-collector)'
OUT = sys.argv[1]; KEPT = '--kept' in sys.argv
CACHE = os.path.join(OUT, 'thumbs'); os.makedirs(CACHE, exist_ok=True)
C = json.load(open(os.path.join(HERE, 'airline-candidates.json')))
TW, TH, LW, ROWS = 300, 200, 130, 10
try: FONT = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
except Exception: FONT = ImageFont.load_default()

def thumb(key, i, o):
    path = os.path.join(CACHE, f'{key}-{i}.jpg')
    if not os.path.exists(path):
        try:
            data = urllib.request.urlopen(urllib.request.Request(o['thumb'], headers={'User-Agent': UA}), timeout=40).read()
            Image.open(io.BytesIO(data)).convert('RGB').save(path, quality=85); time.sleep(0.2)
        except Exception as e: print(key, i, 'thumb failed', e); return None
    im = Image.open(path); im.thumbnail((TW, TH)); return im

def label(d, xy, text):
    x, y = xy; d.rectangle((x, y, x + 9 * len(text) + 10, y + 24), fill=(0, 0, 0)); d.text((x + 5, y + 2), text, fill=(255, 255, 0), font=FONT)

if KEPT:
    picks = json.load(open(os.path.join(HERE, 'airline-picks.json')))
    items = [(k, picks.get(k, 0)) for k, c in C.items() if c['options'] and 0 <= picks.get(k, 0) < len(c['options'])]
    COLS, PER = 5, 40
    for s in range(0, len(items), PER):
        chunk = items[s:s + PER]; rows = (len(chunk) + COLS - 1) // COLS
        sheet = Image.new('RGB', (COLS * TW, rows * TH), (40, 40, 40)); d = ImageDraw.Draw(sheet)
        for n, (k, i) in enumerate(chunk):
            x, y = (n % COLS) * TW, (n // COLS) * TH
            final = os.path.join(HERE, '..', '..', 'assets', 'photos', 'airlines', f'{k}.webp')  # the applied 4:3 crop, when it exists
            if os.path.exists(final): im = Image.open(final).convert('RGB'); im.thumbnail((TW, TH))
            else: im = thumb(k, i, C[k]['options'][i])
            if im: sheet.paste(im, (x + (TW - im.width) // 2, y + (TH - im.height) // 2))
            label(d, (x + 2, y + 2), k)
        sheet.save(os.path.join(OUT, f'kept-{s // PER + 1:02d}.jpg'), quality=80)
    print(len(items), 'kept')
else:
    keys = [k for k, c in C.items() if c['options']]
    for s in range(0, len(keys), ROWS):
        chunk = keys[s:s + ROWS]
        sheet = Image.new('RGB', (LW + 4 * TW, len(chunk) * TH), (40, 40, 40)); d = ImageDraw.Draw(sheet)
        for r, k in enumerate(chunk):
            y = r * TH; d.text((6, y + 10), k, fill=(255, 255, 255), font=FONT)
            d.text((6, y + 36), C[k]['airline'][:14], fill=(200, 200, 200), font=FONT); d.text((6, y + 60), C[k]['type'][:14], fill=(200, 200, 200), font=FONT)
            for i, o in enumerate(C[k]['options']):
                im = thumb(k, i, o)
                if im: sheet.paste(im, (LW + i * TW + (TW - im.width) // 2, y + (TH - im.height) // 2))
                label(d, (LW + i * TW + 2, y + 2), str(i))
        sheet.save(os.path.join(OUT, f'sheet-{s // ROWS + 1:02d}.jpg'), quality=80)
    print(len(keys), 'pairs with options')
