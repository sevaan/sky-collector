#!/usr/bin/env python3
"""Find "house livery" photos per aircraft type (2026-11-15): the type in its manufacturer's own colours, a demonstrator,
prototype / test airframe, or an unbranded airframe, so a flight card never shows another airline's paint.
Searches Wikimedia Commons (PD / CC0 / CC BY / CC BY-SA only) with house-style queries and writes
scripts/photos/house-candidates.json (up to 8 per type). A human then picks into house-picks.json (null = none acceptable);
apply-house-photos.py downloads the picks.
Usage: python3 -I scripts/photos/find-house-photos.py [ICAO ...]"""
import json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'SkyCollectorResearch/0.1 (https://github.com/sevaan/sky-collector)'
API = 'https://commons.wikimedia.org/w/api.php'
OK_LIC = re.compile(r'^(public domain|pd|cc0|cc by(-sa)? ?[1-4]\.0|cc-by(-sa)?-[1-4]\.0|cc by(-sa)?)', re.I)
BAD = re.compile(r'cockpit|interior|cabin|engine|model|museum|mock|toy|crash|wreck|seat|galley|landing gear|tail only|detail|nose|simulator|lego|drawing|diagram', re.I)
HOUSE = re.compile(r'everett|toulouse|hamburg|mirabel|mobile|bfi|f-w[a-z]{3}|d-a[a-z]{3}|house| colou?rs?|prototype|demonstrator|demo\b|test flight|first flight|rollout|roll-out|farnborough|paris air show|le bourget|ila |berlin air|airshow|boeing field|test|unpainted|factory|delivery|green|white', re.I)
try: AIRLINE_NAMES = sorted({v['name'] for k, v in json.load(open(os.path.join(HERE, 'airlines.json'))).items() if isinstance(v, dict) and v.get('name')})
except Exception: AIRLINE_NAMES = []
AIRLINE_NAMES += ['Lufthansa', 'Swiss', 'Air France', 'KLM', 'Delta', 'United', 'American', 'Alaska', 'Qantas', 'Emirates', 'Etihad', 'Qatar', 'Singapore',
                  'Ryanair', 'easyJet', 'Vueling', 'IndiGo', 'Aeroflot', 'Iberia', 'Turkish', 'Cathay', 'ANA', 'JAL', 'Korean', 'Thai', 'Avianca', 'LATAM',
                  'Southwest', 'JetBlue', 'WestJet', 'Air Canada', 'Porter', 'Jetstar', 'Virgin', 'British Airways', 'Air China', 'China Eastern', 'China Southern',
                  'Wizz', 'Norwegian', 'Finnair', 'SAS', 'Eurowings', 'Condor', 'TUI', 'Frontier', 'Spirit', 'Allegiant', 'FedEx', 'UPS', 'DHL', 'Atlas', 'Cargolux',
                  'Mexicana', 'Aeromexico', 'Copa', 'Azul', 'Gol', 'Saudia', 'Air India', 'Pegasus', 'Aer Lingus', 'Flybe', 'Loganair', 'Widere', 'Brussels', 'Austrian', 'Lot ']
AIRLINE_RE = re.compile(r'\b(' + '|'.join(re.escape(a.strip()) for a in AIRLINE_NAMES) + r')\b', re.I)
FLY = re.compile(r'in flight|flying|airborne|approach|take ?off|departing|landing|flight', re.I)
MFR = [('De Havilland Canada', 'De Havilland Canada'), ('Lockheed Martin', 'Lockheed Martin'), ('McDonnell Douglas', 'McDonnell Douglas'),
       ('General Dynamics', 'General Dynamics'), ('AgustaWestland', 'AgustaWestland')]

def mfr(name):
    for k, v in MFR:
        if name.startswith(k): return v
    return name.split()[0]

def api(**q):
    q.update(format='json'); req = urllib.request.Request(API + '?' + urllib.parse.urlencode(q), headers={'User-Agent': UA})
    for a in range(3):
        try: return json.load(urllib.request.urlopen(req, timeout=40))
        except Exception as e: time.sleep(2)
    return {}

def search(q, n=30, minw=1400):
    if q.startswith('Category:'):  # per-airframe Commons categories (e.g. "Category:N7771 (aircraft)") list every photo of one prototype/test airframe
        r = api(action='query', generator='categorymembers', gcmtitle=q, gcmtype='file', gcmlimit=n, prop='imageinfo', iiprop='url|size|extmetadata|mime', iiurlwidth=640)
    else: r = api(action='query', generator='search', gsrnamespace=6, gsrsearch=f'{q} filetype:bitmap', gsrlimit=n,
            prop='imageinfo', iiprop='url|size|extmetadata|mime', iiurlwidth=640)
    out = []
    for p in (r.get('query', {}).get('pages', {}) or {}).values():
        ii = (p.get('imageinfo') or [{}])[0]; m = ii.get('extmetadata', {})
        lic = (m.get('LicenseShortName', {}).get('value') or '').strip()
        if not OK_LIC.match(lic) or ii.get('mime') not in ('image/jpeg', 'image/png'): continue
        title = p['title']; w, h = ii.get('width', 0), ii.get('height', 0)
        if w < minw or w < h * 1.2 or BAD.search(title): continue
        artist = re.sub('<[^>]+>', '', m.get('Artist', {}).get('value', '')).strip()[:80]
        desc = re.sub('<[^>]+>', '', m.get('ImageDescription', {}).get('value', ''))[:200]
        out.append({'title': title, 'thumb': ii.get('thumburl'), 'url': ii.get('url'), 'page': ii.get('descriptionurl'), 'w': w, 'h': h,
                    'licence': lic, 'artist': artist or 'Unknown', 'desc': desc})
    return out

EXTRA = {'Airbus': 'F-WW Toulouse', 'Boeing': 'Boeing Field Everett', 'Embraer': 'Embraer Sao Jose dos Campos', 'Bombardier': 'Mirabel', 'ATR': 'Toulouse F-WW', 'Cessna': 'Textron Aviation', 'Pilatus': 'Stans', 'Gulfstream': 'Savannah', 'De Havilland Canada': 'Downsview Viking'}

def queries(name):
    m = mfr(name)
    return [f'{name} house colors', f'{name} prototype', f'{name} demonstrator', f'{m} {name} test flight', f'{name} first flight',
            f'{name} Farnborough', f'{name} Paris Air Show', f'{name} unpainted white', f'{name} {m} factory', f'{name} {EXTRA.get(m, "rollout")}', f'{m} {name} flight test aircraft']

# Second pass: house-extra-queries.json {ICAO: [extra query, ...]} adds hand-written queries for types the generic ones missed;
# with --extra the results are MERGED into the existing candidates instead of replacing them.
EXTRA_FILE = os.path.join(HERE, os.environ.get('HOUSE_EXTRA', 'house-extra-queries.json'))  # HOUSE_EXTRA=house-extra-queries2.json for another pass
EXTRA_Q = json.load(open(EXTRA_FILE)) if os.path.exists(EXTRA_FILE) else {}
MERGE = '--extra' in sys.argv; sys.argv = [a for a in sys.argv if a != '--extra']
types = json.load(open(os.path.join(HERE, 'types.json')))
want = set(sys.argv[1:])
cand_path = os.path.join(HERE, 'house-candidates.json')
cands = json.load(open(cand_path)) if os.path.exists(cand_path) else {}
for code, name in types.items():
    if want and code not in want: continue
    pool = {}
    last = name.split()[-1].lower()
    for q in (EXTRA_Q.get(code, []) if MERGE else queries(name)):
        try: res = search(q)
        except Exception as e: print(code, q, 'failed', e); res = []
        for o in res:
            e = pool.setdefault(o['title'], dict(o, hits=0)); e['hits'] += 1
        time.sleep(0.5)
    if len(pool) < 8 and not MERGE:  # sparse type: broaden (plain type name, manufacturer, white/test registrations) and accept smaller files
        for q in (name, f'{mfr(name)} {name}', f'{name} in flight', f'{name} white', f'{name} flight test', f'{name} hangar'):
            try: res = search(q, 40, 1100)
            except Exception as e: res = []
            for o in res:
                e = pool.setdefault(o['title'], dict(o, hits=0)); e['hits'] += 0.5
            time.sleep(0.5)
    for o in pool.values():
        t = o['title'] + ' ' + o['desc']
        o['score'] = round(min(o['w'], 4000) / 1000 + o['hits'] * 1.5 + (6 if HOUSE.search(t) else 0) - (8 if AIRLINE_RE.search(o['title']) else 0) + (1 if FLY.search(o['title']) else 0)
                           + (1 if last in o['title'].lower() else 0), 2)
    if MERGE:
        old = {o['title']: o for o in cands.get(code, {}).get('options', [])}
        new = sorted((o for o in pool.values() if o['title'] not in old), key=lambda x: -x['score'])[:8]
        cands[code] = {'name': name, 'options': list(old.values()) + new}; print(code, 'added', [o['title'][5:50] for o in new[:2]]); continue
    cands[code] = {'name': name, 'options': sorted(pool.values(), key=lambda x: -x['score'])[:8]}
    print(code, name, len(pool), flush=True)
json.dump(cands, open(cand_path, 'w'), indent=1)
