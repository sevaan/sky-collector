#!/usr/bin/env python3
"""Gap-filling + better-framed photo finder (2026-11-17). Reads scripts/photos/gap-jobs.json (written by make-gap-jobs.py):
  {KEY: {kind: 'house'|'airline', name, queries[], rx (regex the title/categories must match), match? (airline regex), not?, has_old?}}
For every job it searches Wikimedia Commons (PD / CC0 / CC BY / CC BY-SA only, >= 1280 px wide, landscape), downloads 640 px
thumbnails of the best few, detects the aircraft box (photo_common.detect_box) and works out whether the photo would be 'cover'
at the 290x200 and 460x200 card frames (same maths as js/photo-fit.js). Writes scripts/photos/gap-candidates.json
({KEY: {options: [{title, thumb, page, url, w, h, licence, artist, year, score, box, fit290, fit460}]}}) in the same option shape the
apply scripts read, plus contact sheets with the boxes drawn (--sheet OUT_DIR).
Usage: python3 -I scripts/photos/find-gap-photos.py CACHE_DIR [KEY ...]      search (skips keys already in gap-candidates.json unless named)
       python3 -I scripts/photos/find-gap-photos.py CACHE_DIR --sheet OUT_DIR [KEY ...]   contact sheets (8 jobs per sheet)"""
import io, json, os, re, sys, time, urllib.parse, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import photo_common as pc
from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
PngImagePlugin.MAX_TEXT_CHUNK = 64 * 1024 * 1024

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'SkyCollectorPhotos/0.1 (+https://github.com/sevaan/sky-collector)'
API = 'https://commons.wikimedia.org/w/api.php'
OK_LIC = re.compile(r'^(public domain|pd|cc0|cc by(-sa)? ?[1-4]\.0|cc-by(-sa)?-[1-4]\.0|cc by(-sa)?)', re.I)
BAD = re.compile(r'cockpit|interior|cabin|engine|model|museum interior|mock|toy|crash|wreck|accident|incident|seat|galley|landing gear|\btail\b|winglet|detail|'
                 r'\bnose\b|logo|lounge|check-?in|scrapp|stored|retired|graveyard|boneyard|simulator|lego|drawing|diagram|cutaway|blueprint|poster|stamp|painting|'
                 r'crew|passenger|pilots?\b|loading|unloading|maintenance|hangar|assembly|production line|wing tip|flap', re.I)
AIRLINE_CAT = re.compile(r'airlines?\b|airways|\bair (?!show|force|base|traffic|museum|national|guard|tanker|display|racing|ambulance)\w+|\bjet\b|aviation|cargo|express|lines\b|ryanair|easyjet|lufthansa|swiss|klm|iberia|qantas|emirates|etihad|delta|united|american|southwest|alaska|spirit|frontier|allegiant|jetblue|westjet|volaris|flybe|virgin|norwegian|wizz|tui|condor|eurowings|flyone|sunexpress|pegasus|turkish|saudia|aeroflot|fedex|ups\b|dhl|netjets|flexjet|vistajet|charter|operator', re.I)
HOUSE = re.compile(r'F-W[A-Z]{3}\b|D-AV[A-Z]{2}\b|N\d{3,4}B\b|airbus industries|everett|toulouse|hamburg|mirabel|boeing field|f-w[a-z]{3}|house| colou?rs?|prototype|demonstrator|demo\b|test flight|first flight|rollout|'
                   r'roll-out|farnborough|paris air show|le bourget|ila |berlin air|airshow|test|unpainted|factory|delivery|bbj', re.I)
FLY = re.compile(r'in flight|flying|airborne|approach|final|take ?off|takeoff|departing|departure|climb|landing|arriving|over\b|rotat', re.I)
GROUND = re.compile(r'taxi|gate|parked|stand\b|apron|ramp|pushback|static|display|museum', re.I)
try:
    AIRLINE_NAMES = sorted({v['name'] for k, v in json.load(open(os.path.join(HERE, 'airlines.json'))).items() if isinstance(v, dict) and v.get('name')})
except Exception: AIRLINE_NAMES = []
AIRLINE_RE = re.compile(r'\b(' + '|'.join(re.escape(a.strip()) for a in AIRLINE_NAMES + ['Lufthansa', 'Swiss', 'Delta', 'United', 'Qantas', 'Emirates', 'KLM', 'Air France']) + r')\b', re.I)

def api(**q):
    q.update(format='json'); req = urllib.request.Request(API + '?' + urllib.parse.urlencode(q), headers={'User-Agent': UA})
    for a in range(5):
        try: return json.load(urllib.request.urlopen(req, timeout=40))
        except urllib.error.HTTPError as e:
            time.sleep(8 * (a + 1) if e.code in (429, 503) else 3)
        except Exception: time.sleep(3 * (a + 1))
    return {}

def fetch(url):
    for a in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()
        except urllib.error.HTTPError as e: time.sleep(10 * (a + 1) if e.code in (429, 503) else 3)
        except Exception: time.sleep(3 * (a + 1))
    return None

def fit(box, W, H, fw, fh):
    """Port of fitStyle() in js/photo-fit.js: True when a cover crop at the frame holds the whole box."""
    EPS, TRIM = 1e-3, 0.035
    x0, x1 = min(box[0], box[2]), max(box[0], box[2]); y0, y1 = min(box[1], box[3]), max(box[1], box[3])
    edge = lambda v: abs(v) < EPS or abs(v - 1) < EPS
    if x1 - x0 > 2 * TRIM + 0.05:
        if not edge(x0): x0 += TRIM
        if not edge(x1): x1 -= TRIM
    if y1 - y0 > 2 * TRIM + 0.05:
        if not edge(y0): y0 += TRIM
        if not edge(y1): y1 -= TRIM
    x0, x1, y0, y1 = max(0, x0), min(1, x1), max(0, y0), min(1, y1)
    ia, fa = W / H, fw / fh
    vx = 1 if fa > ia else fa / ia; vy = ia / fa if fa > ia else 1
    return not (x1 - x0 > vx + EPS or y1 - y0 > vy + EPS)

def judge(p, job):
    ii = (p.get('imageinfo') or [{}])[0]; m = ii.get('extmetadata', {})
    lic = (m.get('LicenseShortName', {}).get('value') or '').strip()
    if not OK_LIC.match(lic) or ii.get('mime') not in ('image/jpeg', 'image/png'): return None
    title = p['title']; w, h = ii.get('width', 0), ii.get('height', 0)
    if w < 1280 or w < h * 1.15 or BAD.search(title): return None
    cats = ' | '.join(c['title'] for c in p.get('categories', []))
    text = f'{title} | {cats}'
    fl = 0 if job.get('cs') else re.I
    if job.get('match') and not re.search(job['match'], text, fl): return None
    if job.get('not') and re.search(job['not'], text, fl): return None
    if not re.search(job['rx'], text, re.I): return None
    date = re.sub('<[^>]+>', '', m.get('DateTimeOriginal', {}).get('value', '') or m.get('DateTime', {}).get('value', ''))
    yr = int(re.search(r'(19|20)\d\d', date).group(0)) if re.search(r'(19|20)\d\d', date) else 0
    artist = re.sub('<[^>]+>', '', m.get('Artist', {}).get('value', '')).strip()[:80]
    desc = re.sub('<[^>]+>', '', m.get('ImageDescription', {}).get('value', ''))[:200]
    s = min(w, 4000) / 1000 + (2 if FLY.search(title) else 0) - (1 if GROUND.search(title) else 0)
    if job['kind'] == 'house':
        s += (6 if HOUSE.search(title + ' ' + desc + ' ' + cats) else 0)
        if not job.get('mil') and (AIRLINE_CAT.search(cats) or AIRLINE_RE.search(title)): s -= 7  # probably an airline's livery: never in house/ unless eyeballed
    else: s += (1.5 if yr >= 2018 else 0.75 if yr >= 2012 else 0)
    return {'title': title, 'thumb': ii.get('thumburl'), 'url': ii.get('url'), 'page': ii.get('descriptionurl'), 'w': w, 'h': h,
            'licence': lic, 'artist': artist or 'Unknown', 'year': yr, 'score': round(s, 2), 'desc': desc}

def search(q, n=50):
    if q.startswith('Category:'):
        r = api(action='query', generator='categorymembers', gcmtitle=q, gcmtype='file', gcmlimit=n, prop='imageinfo|categories', clshow='!hidden',
                cllimit='max', iiprop='url|size|extmetadata|mime', iiurlwidth=640)
    else:
        r = api(action='query', generator='search', gsrnamespace=6, gsrsearch=f'{q} filetype:bitmap', gsrlimit=n, prop='imageinfo|categories',
                clshow='!hidden', cllimit='max', iiprop='url|size|extmetadata|mime', iiurlwidth=640)
    return list((r.get('query', {}).get('pages', {}) or {}).values())

def thumb_path(cache, key, o): return os.path.join(cache, re.sub(r'[^A-Za-z0-9_.-]', '_', key) + '-' + re.sub(r'[^A-Za-z0-9]', '', o['title'])[-40:] + '.jpg')

def get_thumb(cache, key, o):
    p = thumb_path(cache, key, o)
    if not os.path.exists(p):
        d = fetch(o['thumb'])
        if not d: return None
        try: Image.open(io.BytesIO(d)).convert('RGB').save(p, quality=85)
        except Exception: return None
        time.sleep(0.4)
    return p

def run_search(cache, jobs, cands, keys, top=9):
    for key in keys:
        job = jobs[key]; pool = {}
        for q in job['queries']:
            for p in search(q):
                j = judge(p, job)
                if j: pool.setdefault(j['title'], j)
            time.sleep(1.0)
            if len(pool) >= 14 and job['kind'] == 'airline': break
        for t in job.get('skip', []): pool.pop(t, None)  # the photo being replaced
        ranked = sorted(pool.values(), key=lambda x: -x['score'])[:top + 3 + (4 if job.get('only_fit') else 0)]
        out = []
        for o in ranked:
            tp = get_thumb(cache, key, o)
            if not tp: continue
            o['box'] = pc.detect_box(tp)
            o['fit290'] = fit(o['box'], o['w'], o['h'], 290, 200); o['fit460'] = fit(o['box'], o['w'], o['h'], 460, 200)
            out.append(o)
        # fitting photos first within near-equal scores: cover290 gets +2 so the sheet leads with usable framings
        if job.get('only_fit'): out = [o for o in out if o['fit290']]  # replacement jobs: only photos that fill a card frame
        out.sort(key=lambda o: -(o['score'] + (2 if o['fit290'] else 0)))
        cands[key] = {'name': job['name'], 'options': out[:top]}
        print(key, len(pool), 'found,', sum(o['fit290'] for o in out[:top]), 'fit290', flush=True)
        json.dump(cands, open(os.path.join(HERE, 'gap-candidates.json'), 'w'), indent=1)

def run_sheet(cache, outdir, cands, keys):
    os.makedirs(outdir, exist_ok=True)
    TW, TH, COLS, ROWS, LW = 300, 200, 6, 6, 70
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 17)
    keys = [k for k in keys if k in cands and cands[k]['options']]
    for s in range(0, len(keys), ROWS):
        chunk = keys[s:s + ROWS]; sheet = Image.new('RGB', (LW + COLS * TW, len(chunk) * TH), (40, 40, 40)); d = ImageDraw.Draw(sheet)
        for r, k in enumerate(chunk):
            y = r * TH; d.text((4, y + 8), k, fill=(255, 255, 255), font=font)
            for i, o in enumerate(cands[k]['options'][:COLS]):
                tp = thumb_path(cache, k, o)
                if not os.path.exists(tp): continue
                im = Image.open(tp).convert('RGB'); im.thumbnail((TW - 4, TH - 4)); x = LW + i * TW + 2
                sheet.paste(im, (x, y + 2)); b = o['box']
                d.rectangle((x + b[0] * im.width, y + 2 + b[1] * im.height, x + b[2] * im.width - 1, y + 2 + b[3] * im.height - 1), outline=(255, 40, 40), width=2)
                d.rectangle((x, y + 2, x + 40, y + 24), fill=(0, 0, 0)); d.text((x + 3, y + 3), str(i), fill=(0, 255, 0) if o['fit290'] else (255, 255, 0), font=font)
        sheet.save(os.path.join(outdir, f'gap-{s // ROWS + 1:02d}-{chunk[0]}.jpg'), quality=82)
    print(len(keys), 'jobs sheeted')

if __name__ == '__main__':
    cache = sys.argv[1]; os.makedirs(cache, exist_ok=True); args = sys.argv[2:]
    outdir = None
    if '--sheet' in args: i = args.index('--sheet'); outdir = args[i + 1]; args = args[:i] + args[i + 2:]
    jobs = json.load(open(os.path.join(HERE, 'gap-jobs.json')))
    cp = os.path.join(HERE, 'gap-candidates.json'); cands = json.load(open(cp)) if os.path.exists(cp) else {}
    named = [a for a in args if a in jobs]
    if outdir: run_sheet(cache, outdir, cands, named or list(jobs))
    else: run_search(cache, jobs, cands, named or [k for k in jobs if k not in cands])
