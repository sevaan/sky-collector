#!/usr/bin/env python3
"""Contact sheets with the detected aircraft box drawn on every photo (2026-11-15), to check scripts/photos/photo_common.py.
Reads the boxes from js/type-photos.js and js/airline-photos.js. Usage: python3 -I scripts/photos/make-box-sheet.py OUT_DIR [types|airlines]
Writes OUT_DIR/box-<kind>-NN.jpg (5 columns x 6 rows)."""
import json, os, re, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
KINDS = [k for k in ('types', 'airlines') if len(sys.argv) < 3 or sys.argv[2] == k]
TW, TH, COLS, ROWS = 360, 240, 5, 6
FONT = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 16)
for kind in KINDS:
    mod, name = ('type-photos.js', 'TYPE_PHOTOS') if kind == 'types' else ('airline-photos.js', 'AIRLINE_PHOTOS')
    data = json.loads(re.search(name + r' = (\{.*?\n\});', open(os.path.join(ROOT, 'js', mod)).read(), re.S).group(1))
    keys = sorted(data)
    for s in range(0, len(keys), COLS * ROWS):
        chunk = keys[s:s + COLS * ROWS]; sheet = Image.new('RGB', (COLS * TW, ROWS * TH), (40, 40, 40)); d = ImageDraw.Draw(sheet)
        for n, k in enumerate(chunk):
            im = Image.open(os.path.join(ROOT, 'assets', 'photos', kind, k + '.webp')).convert('RGB'); im.thumbnail((TW - 4, TH - 4))
            x, y = (n % COLS) * TW + 2, (n // COLS) * TH + 2; sheet.paste(im, (x, y)); b = data[k]['box']
            d.rectangle((x + b[0] * im.width, y + b[1] * im.height, x + b[2] * im.width - 1, y + b[3] * im.height - 1), outline=(255, 40, 40), width=2)
            d.rectangle((x, y, x + 10 * len(k) + 6, y + 20), fill=(0, 0, 0)); d.text((x + 3, y + 1), k, fill=(255, 255, 0), font=FONT)
        sheet.save(os.path.join(OUT, f'box-{kind}-{s // (COLS * ROWS) + 1:02d}.jpg'), quality=82)
    print(kind, len(keys))
