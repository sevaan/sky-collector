#!/usr/bin/env python3
"""Contact sheets for the human check of airline logos (2026-11-15): every kept logo (assets/logos/*.webp via js/airline-logos.js)
on a white tile and a navy (#0d2238) tile, with its ICAO code, airline name and a '!' where several Wikidata items shared the
code (tiebreak) -> OUT_DIR/logos-NN.png (24 logos per sheet). Look at them, then list wrong ones in rejects.json
({ICAO: reason}) and white-on-transparent ones in dark-overrides.json, and re-run apply-airline-logos.py.
Usage: python3 -I scripts/logos/make-logo-sheet.py OUT_DIR"""
import json, os, re, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
M = json.loads(re.search(r'AIRLINE_LOGOS = (\{.*?\n\});', open(os.path.join(ROOT, 'js', 'airline-logos.js')).read(), re.S).group(1))
C = json.load(open(os.path.join(HERE, 'candidates.json')))
NAMES = dict(re.findall(r'\b([A-Z0-9]{3}):"([^"]*)"', open(os.path.join(ROOT, 'js', 'airlines.js')).read()))
F = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 16); FS = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 13)
TW, TH, COLS, PER = 190, 110, 4, 24   # per logo: two tiles side by side + caption row
GAP = 8; CAP = 38; CW = TW * 2 + GAP; CH = TH + CAP
codes = sorted(M)
for s in range(0, len(codes), PER):
    ch = codes[s:s + PER]; rows = (len(ch) + COLS - 1) // COLS
    sh = Image.new('RGB', (COLS * (CW + 14), rows * (CH + 10)), (120, 120, 120)); d = ImageDraw.Draw(sh)
    for n, c in enumerate(ch):
        x, y = (n % COLS) * (CW + 14) + 4, (n // COLS) * (CH + 10) + 4
        im = Image.open(os.path.join(ROOT, 'assets', 'logos', c + '.webp')).convert('RGBA')
        for k, bg in enumerate(((255, 255, 255), (13, 34, 56))):
            tx = x + k * (TW + GAP); d.rectangle((tx, y, tx + TW - 1, y + TH - 1), fill=bg)
            t = im.copy(); t.thumbnail((TW - 24, TH - 24)); sh.paste(t, (tx + (TW - t.width) // 2, y + (TH - t.height) // 2), t)
        tb = '!' if C[c].get('tiebreak') else ''; dk = ' DARK' if M[c].get('dark') else ''
        d.text((x, y + TH + 2), f'{c}{tb}{dk}  {NAMES.get(c, "")[:28]}', fill=(255, 255, 0), font=F)
        d.text((x, y + TH + 20), C[c]['label'][:34] + ' | ' + C[c]['file'][:34], fill=(230, 230, 230), font=FS)
    sh.save(os.path.join(OUT, f'logos-{s // PER + 1:02d}.png'))
print(len(codes), 'logos,', (len(codes) + PER - 1) // PER, 'sheets')
