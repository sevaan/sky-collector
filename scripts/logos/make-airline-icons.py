#!/usr/bin/env python3
"""Airline icons for the radar strip (2026-11-18, Sevaan: "instead of the full logos, what about like the favicon versions"):
a square mark per airline, made from the free logos already in assets/logos/ (no new artwork, same licences):
  symbol   the logo's own symbol, cut out where it stands apart from the wordmark (Air Canada's roundel, Delta's widget):
           the first or last blob of columns, separated from the rest by a clear gap, roughly square and nearly full height
  icon     a Wikidata "small logo or icon" (P8972) from icon-candidates.json, when it is a square mark (not a wordmark)
  letter   otherwise: the wordmark's first letter (its first blob of columns), when that is a lone, roughly square glyph
  colour   otherwise: none here; the app draws a disc in the logo's main colour with the airline's first letter
Writes assets/logos/icons/<ICAO>.webp (96 px square, transparent) and scripts/logos/icons.json
({ICAO: {kind, colour, bg}}), which apply writes into js/airline-logos.js as AIRLINE_ICONS. Overrides in
icon-overrides.json ({ICAO: 'symbol-left' | 'symbol-right' | 'letter' | 'colour'}) win after a look at the contact sheet
(scripts/logos/sheets/icons.png). Usage: python3 -I scripts/logos/make-airline-icons.py"""
import json, os, collections
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
LOGOS = os.path.join(ROOT, 'assets', 'logos'); OUT = os.path.join(LOGOS, 'icons'); os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(HERE, 'sheets'), exist_ok=True)
def jl(n):
    try: return json.load(open(os.path.join(HERE, n)))
    except Exception: return {}
OVR = {k: v for k, v in jl('icon-overrides.json').items() if not k.startswith('_')}
def blobs(im):
    """Runs of columns that have ink, as [x0, x1)"""
    a = im.getchannel('A'); w, h = im.size; px = a.load()
    cols = [sum(1 for y in range(h) if px[x, y] > 60) for x in range(w)]
    runs, x = [], 0
    while x < w:
        if cols[x] > 0:
            x0 = x
            while x < w and cols[x] > 0: x += 1
            runs.append([x0, x])
        else: x += 1
    return runs
def merge(runs, gap):
    out = []
    for r in runs:
        if out and r[0] - out[-1][1] <= gap: out[-1][1] = r[1]
        else: out.append(list(r))
    return out
def ink_box(im, x0, x1):
    c = im.crop((x0, 0, x1, im.height)); bb = c.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()
    return (x0 + bb[0], bb[1], x0 + bb[2], bb[3]) if bb else None
def main_colour(im):
    cnt = collections.Counter()
    for p in im.getdata():
        if p[3] < 200: continue
        r, g, b = p[:3]
        if min(r, g, b) > 225 or max(r, g, b) < 30 and False: continue   # white is background on most logos
        cnt[(r // 24 * 24, g // 24 * 24, b // 24 * 24)] += 1
    if not cnt: return '#0d2238'
    (r, g, b), _ = cnt.most_common(1)[0]; return '#%02x%02x%02x' % (min(255, r + 12), min(255, g + 12), min(255, b + 12))
def square(im, box, pad=.08):
    c = im.crop(box); s = int(max(c.size) * (1 + 2 * pad)); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.paste(c, ((s - c.width) // 2, (s - c.height) // 2)); return sq.resize((96, 96), Image.LANCZOS)
def pick(code, im):
    h = im.height; gap = max(3, round(h * .18))
    parts = merge(blobs(im), gap)
    if len(parts) < 2: parts = merge(blobs(im), max(2, round(h * .06)))
    def ok(r, minh=.72):
        b = ink_box(im, *r);
        if not b: return None
        bw, bh = b[2] - b[0], b[3] - b[1]
        return b if .55 <= bw / max(1, bh) <= 1.7 and bh >= h * minh else None
    o = OVR.get(code)
    if isinstance(o, dict) and 'crop' in o:   # a symbol above or inside the name (KLM's crown): this box, as fractions
        x0, y0, x1, y1 = o['crop']; c = im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)))
        bb = c.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()
        if bb: return 'symbol', (round(x0 * im.width) + bb[0], round(y0 * im.height) + bb[1], round(x0 * im.width) + bb[2], round(y0 * im.height) + bb[3])
    if isinstance(o, list):   # a look at the sheet: the symbol sits in this slice of the logo's width
        b = ink_box(im, round(o[0] * im.width), round(o[1] * im.width))
        if b: return 'symbol', b
    if len(parts) >= 2:
        if o is None and ok(parts[0]) and (parts[1][0] - parts[0][1]) >= gap: return 'symbol', ok(parts[0])
        if o is None and ok(parts[-1]) and (parts[-1][0] - parts[-2][1]) >= gap: return 'symbol', ok(parts[-1])
    if o == 'colour': return 'colour', None
    first = merge(blobs(im), 1)
    if first and o in (None, 'letter'):
        b = ok(first[0], .6)
        if b: return 'letter', b
    return 'colour', None
import re
from PIL import ImageFont
NAMES = dict(re.findall(r'([A-Z0-9]{3}):"([^"]*)"', open(os.path.join(ROOT, 'js', 'airlines.js')).read()))
FONT = os.path.join(ROOT, 'fonts', 'RussoOne-Regular.ttf')
SKIP = {'AIR', 'AIRLINES', 'AIRLINE', 'AIRWAYS', 'CARGO', 'EXPRESS', 'INTERNATIONAL', 'AVIATION', 'THE', 'OF', 'LINES', 'COMPANY', 'LTD', 'INC', 'GROUP'}
def initials(code):
    """The airline's own short name: an acronym name as it is (KLM, LOT, SAS), else the first letter of its first real word"""
    words = [w for w in re.split(r'[^A-Za-z0-9]+', NAMES.get(code, code)) if w]
    if words and words[0].isupper() and 2 <= len(words[0]) <= 3: return words[0]
    real = [w for w in words if w.upper() not in SKIP] or words or [code]
    return real[0][0].upper()
def light(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5)); return .299 * r + .587 * g + .114 * b > 170
def disc(code, colour):
    """No symbol in the logo (2026-11-18, Sevaan: "everything needs something in it"): the airline's initials, white (navy on a
    pale colour), on its logo's main colour, filling the square; the app clips it to a circle"""
    S = 192; im = Image.new('RGBA', (S, S), colour); d = ImageDraw.Draw(im); t = initials(code)
    size = {1: 112, 2: 92, 3: 70}.get(len(t), 64); f = ImageFont.truetype(FONT, size)
    bb = d.textbbox((0, 0), t, font=f); d.text(((S - (bb[2] - bb[0])) / 2 - bb[0], (S - (bb[3] - bb[1])) / 2 - bb[1]), t, font=f, fill='#0d2238' if light(colour) else '#ffffff')
    return im.resize((96, 96), Image.LANCZOS)
# Regionals painted as their parent (Jazz and Encore fly in Air Canada's and WestJet's colours): the parent's mark
PARENT = {'JZA': 'ACA', 'WEN': 'WJA', 'SWG': 'WJA', 'EDV': 'DAL', 'ENY': 'AAL', 'PDT': 'AAL', 'JIA': 'AAL', 'GJS': 'UAL', 'ASH': 'UAL', 'QXE': 'ASA', 'CLH': 'DLH', 'KLC': 'KLM', 'HOP': 'AFR', 'CFE': 'BAW'}
meta = {}
for f in sorted(os.listdir(LOGOS)):
    if not f.endswith('.webp'): continue
    code = f[:-5]; im = Image.open(os.path.join(LOGOS, f)).convert('RGBA')
    kind, box = pick(code, im); colour = main_colour(im)
    dest = os.path.join(OUT, code + '.webp')
    if box: square(im, box).save(dest, 'WEBP', lossless=True, method=6)
    else: disc(code, colour).save(dest, 'WEBP', lossless=True, method=6); kind = 'initials'
    meta[code] = {'kind': kind, 'colour': colour}
# second pass: a regional whose parent has a symbol takes the parent's
import shutil
for code, par in PARENT.items():
    if code in meta and meta.get(par, {}).get('kind') == 'symbol' and meta[code]['kind'] != 'symbol':
        shutil.copyfile(os.path.join(OUT, par + '.webp'), os.path.join(OUT, code + '.webp')); meta[code] = {**meta[par], 'kind': 'parent', 'parent': par}
json.dump(meta, open(os.path.join(HERE, 'icons.json'), 'w'), indent=1, sort_keys=True)
open(os.path.join(ROOT, 'js', 'airline-icons.js'), 'w').write('''// GENERATED by scripts/logos/make-airline-icons.py, do not edit. Each airline's square mark for the radar strip, cut from its
// free logo in assets/logos/ (same source and licence): 'symbol' its own symbol, 'letter' its wordmark's first letter, both
// 'parent' a regional painted as its parent (Jazz: Air Canada's leaf); 'initials' a logo with no symbol: the airline's initials
// on its main colour, filling the square (clip it to a circle). All as assets/logos/icons/<ICAO>.webp.
export const AIRLINE_ICONS = ''' + json.dumps(meta, sort_keys=True, separators=(',', ':')) + ''';
/** ICAO -> { kind, colour, url, full, tail } or null; full = the image is the whole disc (initials), else a mark for a white
    disc; tail = the airline as a tail fin (assets/logos/tails/), what the radar strip shows */
export function airlineIcon(icao) {
  const k = String(icao || '').toUpperCase(), m = AIRLINE_ICONS[k]; if (!m) return null;
  return { ...m, full: m.kind === 'initials', url: new URL('../assets/logos/icons/' + k + '.webp', import.meta.url).href, tail: new URL('../assets/logos/tails/' + k + '.webp', import.meta.url).href };
}
''')
print(collections.Counter(m['kind'] for m in meta.values()))
# contact sheet: each airline's logo above what the strip will show
codes = sorted(meta); cols = 10; cw, ch = 128, 132; sheet = Image.new('RGB', (cols * cw, (len(codes) + cols - 1) // cols * ch), (93, 151, 207)); d = ImageDraw.Draw(sheet)
for i, c in enumerate(codes):
    x, y = i % cols * cw, i // cols * ch; lg = Image.open(os.path.join(LOGOS, c + '.webp')).convert('RGBA'); lg.thumbnail((118, 30))
    bg = Image.new('RGBA', (120, 34), (255, 255, 255, 255)); bg.alpha_composite(lg, ((120 - lg.width) // 2, (34 - lg.height) // 2)); sheet.paste(bg.convert('RGB'), (x + 4, y + 4))
    p = os.path.join(OUT, c + '.webp')
    if meta[c]['kind'] == 'initials':   # the disc is the icon itself
        ic = Image.open(p).convert('RGBA').resize((60, 60), Image.LANCZOS); m = Image.new('L', (60, 60), 0); ImageDraw.Draw(m).ellipse((0, 0, 59, 59), fill=255); sheet.paste(ic, (x + 34, y + 44), m)
    else:
        d.ellipse((x + 34, y + 44, x + 94, y + 104), fill=(255, 255, 255)); ic = Image.open(p).convert('RGBA').resize((44, 44), Image.LANCZOS); sheet.paste(ic, (x + 42, y + 52), ic)
    d.text((x + 6, y + 110), f"{c} {meta[c]['kind']}", fill=(255, 255, 255))
sheet.save(os.path.join(HERE, 'sheets', 'icons.png'))

# ---- Tails (2026-11-18, Sevaan: "instead of being in circles, we use like plane tails, so it's like the tail of the plane") ----
# Each airline as an aircraft's tail fin: the fin in the logo's main colour, its mark on it the way airlines paint their
# tails. A mark that shows up against that colour keeps its own colours (Air Canada's red leaf on black); one that would
# vanish into it (same colour) is painted white, or navy on a pale fin. Initials are white (navy on pale). Written to
# assets/logos/tails/<ICAO>.webp (96 x 112, transparent around the fin) and listed in js/airline-icons.js as kind's tail.
import colorsys
TAILS = os.path.join(LOGOS, 'tails'); os.makedirs(TAILS, exist_ok=True)
TW, TH = 192, 224
FIN = [(0.06, 0.98), (0.47, 0.06), (0.6, 0.0), (0.8, 0.0), (0.86, 0.04), (0.98, 0.98)]   # swept leading edge, rounded tip, raked trailing edge
def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def mark_colours(im):
    px = [p[:3] for p in im.getdata() if p[3] > 160]
    return px
def dist(a, b): return sum((x - y) ** 2 for x, y in zip(a, b)) ** .5
def tail(code, kind, colour):
    fin = rgb(colour); img = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
    mask = Image.new('L', (TW, TH), 0); ImageDraw.Draw(mask).polygon([(x * TW, y * TH) for x, y in FIN], fill=255)
    body = Image.new('RGBA', (TW, TH), fin + (255,))
    # a soft light down the leading edge, as paint catches the sun
    sh = Image.new('RGBA', (TW, TH), (0, 0, 0, 0)); ImageDraw.Draw(sh).polygon([(0.06 * TW, 0.98 * TH), (0.47 * TW, 0.06 * TH), (0.56 * TW, 0.06 * TH), (0.2 * TW, 0.98 * TH)], fill=(255, 255, 255, 40))
    body.alpha_composite(sh); img.paste(body, (0, 0), mask)
    pale = light(colour)
    if kind == 'initials':
        d = ImageDraw.Draw(img); t = initials(code); f = ImageFont.truetype(FONT, {1: 92, 2: 72, 3: 54}.get(len(t), 48))
        bb = d.textbbox((0, 0), t, font=f); cx, cy = TW * 0.58, TH * 0.56
        d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], cy - (bb[3] - bb[1]) / 2 - bb[1]), t, font=f, fill='#0d2238' if pale else '#ffffff')
    else:
        m = Image.open(os.path.join(OUT, code + '.webp')).convert('RGBA')
        bb = m.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox(); m = m.crop(bb) if bb else m
        px = mark_colours(m)
        if px:
            avg = tuple(sum(c[i] for c in px) / len(px) for i in range(3))
            close = sum(1 for c in px if dist(c, fin) < 90) / len(px)
            cover = len(px) / max(1, m.width * m.height)   # a solid badge (AirAsia's red disc with white writing) keeps its colours: painting it one colour hides the writing
            if cover < .5 and (close > .35 or dist(avg, fin) < 80):   # it would vanish into the fin: paint it
                ink = (13, 34, 56) if pale else (255, 255, 255)
                a = m.getchannel('A'); m = Image.new('RGBA', m.size, ink + (0,)); m.putalpha(a)
        s = min(TW * 0.5 / m.width, TH * 0.42 / m.height); m = m.resize((max(1, round(m.width * s)), max(1, round(m.height * s))), Image.LANCZOS)
        cx, cy = TW * 0.6, TH * 0.5; layer = Image.new('RGBA', (TW, TH), (0, 0, 0, 0)); layer.alpha_composite(m, (round(cx - m.width / 2), round(cy - m.height / 2)))
        clipped = Image.new('RGBA', (TW, TH), (0, 0, 0, 0)); clipped.paste(layer, (0, 0), Image.composite(layer.getchannel('A'), Image.new('L', (TW, TH), 0), mask))
        img.alpha_composite(clipped)
    img.resize((96, 112), Image.LANCZOS).save(os.path.join(TAILS, code + '.webp'), 'WEBP', lossless=True, method=6)
for code, m in meta.items(): tail(code, m['kind'], m['colour'])
codes = sorted(meta); cols = 12; cw, ch = 104, 150
sheet = Image.new('RGB', (cols * cw, (len(codes) + cols - 1) // cols * ch), (140, 190, 232)); d = ImageDraw.Draw(sheet)
for i, c in enumerate(codes):
    x, y = i % cols * cw, i // cols * ch; lg = Image.open(os.path.join(LOGOS, c + '.webp')).convert('RGBA'); lg.thumbnail((96, 22))
    bg = Image.new('RGBA', (98, 26), (255, 255, 255, 255)); bg.alpha_composite(lg, ((98 - lg.width) // 2, (26 - lg.height) // 2)); sheet.paste(bg.convert('RGB'), (x + 3, y + 3))
    t = Image.open(os.path.join(TAILS, c + '.webp')).convert('RGBA'); sheet.paste(t, (x + 4, y + 32), t); d.text((x + 6, y + 136), c, fill=(13, 34, 56))
sheet.save(os.path.join(HERE, 'sheets', 'tails.png'))
