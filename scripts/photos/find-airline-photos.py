#!/usr/bin/env python3
"""Airline-livery photos for Flight cards (2026-11-15). A flight card should show its aircraft type in THAT airline's
paint, not whichever airline happened to be in the type photo. For each airline+type pair in
scripts/photos/airlines.json, search Wikimedia Commons, keep only PD / CC0 / CC BY / CC BY-SA, require the airline
(its `match` regex, minus its sister brands in `not`) AND the exact type in the file title or its categories, score
(in flight, landscape, big, recent, type named in the title) and write the best few per pair to
scripts/photos/airline-candidates.json. Then make-airline-sheet.py draws contact sheets for a human (or Claude) to
pick from (airline-picks.json), and apply-airline-photos.py downloads the picks.
Usage: python3 -I scripts/photos/find-airline-photos.py [AIRLINE[-TYPE] ...]   (no args: every pair not yet searched;
--all: every pair)"""
import json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'SkyCollectorResearch/0.1 (https://github.com/sevaan/sky-collector)'
API = 'https://commons.wikimedia.org/w/api.php'
OK_LIC = re.compile(r'^(public domain|pd|cc0|cc by(-sa)? ?[1-4]\.0|cc-by(-sa)?-[1-4]\.0|cc by(-sa)?)', re.I)
BAD = re.compile(r'cockpit|interior|cabin|engine|model|museum|mock|toy|crash|wreck|accident|incident|seat|galley|landing gear|'
                 r'\btail|winglet|detail|nose|livery detail|logo|lounge|check-?in|terminal building|scrapp|stored|retired|graveyard|boneyard', re.I)
FLYING = re.compile(r'in flight|flying|airborne|approach|final|take ?off|takeoff|departing|departure|climb|landing|arriving|over\b|rotat', re.I)
GROUND = re.compile(r'taxi|gate|parked|stand\b|apron|ramp|pushback|at the gate|hangar|maintenance', re.I)

# ICAO type -> (Commons search words, regex for that exact type). Customer codes are allowed (737-8H4, A321-211).
T = {
 'A319': ('A319', r'A319(?![\s-]?neo)(?!-1\d\dN)'), 'A320': ('A320', r'A320(?![\s-]?neo)(?!-2\d\dN)(?![\s-]?family)'),
 'A321': ('A321', r'A321(?![\s-]?neo)(?!-2\d\dN)(?![\s-]?LR|XLR)'), 'A20N': ('A320neo', r'A320[\s-]?neo|A320-2\d\dN'),
 'A21N': ('A321neo', r'A321[\s-]?neo|A321-2\d\dN|A321 ?X?LR'), 'BCS1': ('A220-100', r'A220-100|A220-1\d\d|CS100|BD-500-1A10'),
 'BCS3': ('A220-300', r'A220-300|A220-3\d\d|CS300|BD-500-1A11'), 'A332': ('A330-200', r'A330-2\d\d'),
 'A333': ('A330-300', r'A330-3\d\d'), 'A339': ('A330-900', r'A330-9\d\d|A330[\s-]?neo'), 'A359': ('A350-900', r'A350-9\d\d|A350(?!-10)(?![\s-]?1000)(?!-1041)'),
 'A35K': ('A350-1000', r'A350-10\d\d|A350-1000'), 'A388': ('A380', r'A380'),
 'B712': ('Boeing 717', r'\b717\b|717-2\w\w'),
 'B737': ('Boeing 737-700', r'737-7[0-9A-Z]{2}\b(?!.*MAX)'), 'B738': ('Boeing 737-800', r'737-8[0-9A-Z]{2}\b(?!.*MAX)'),
 'B739': ('Boeing 737-900', r'737-9[0-9A-Z]{2}\b(?!.*MAX)'), 'B38M': ('Boeing 737 MAX 8', r'737 ?MAX ?8|MAX 8|737-8(?![0-9A-Z])|737-8200|737-8-200'),
 'B39M': ('Boeing 737 MAX 9', r'737 ?MAX ?9|MAX 9|737-9(?![0-9A-Z])'), 'B752': ('Boeing 757-200', r'757-2[0-9A-Z]{2}\b|\b757\b(?!-3)'),
 'B763': ('Boeing 767-300', r'767-3[0-9A-Z]{2}'), 'B764': ('Boeing 767-400', r'767-4[0-9A-Z]{2}'),
 'B772': ('Boeing 777-200', r'777-2[0-9A-Z]{2}(?!LR|F)(?![\s-]?LR)'), 'B77W': ('Boeing 777-300ER', r'777-3[0-9A-Z]{2}'),
 'B77L': ('Boeing 777F', r'777F|777-F|777-2[0-9A-Z]{2}LR|777-200LR|777 Freighter'),
 'B788': ('Boeing 787-8', r'787-8\b|787-8[0-9A-Z]{0,2}\b|Dreamliner 787-8'), 'B789': ('Boeing 787-9', r'787-9\b|787-9[0-9A-Z]{0,2}\b'),
 'B78X': ('Boeing 787-10', r'787-10'), 'B744': ('Boeing 747-400', r'747-4[0-9A-Z]{2}'), 'B748': ('Boeing 747-8', r'747-8'),
 'MD11': ('MD-11', r'MD-?11'), 'CRJ2': ('CRJ200', r'CRJ-?200|CRJ-?100|CL-600-2B19'), 'CRJ7': ('CRJ700', r'CRJ-?700|CL-600-2C10'),
 'CRJ9': ('CRJ900', r'CRJ-?900|CL-600-2D24'), 'DH8D': ('Q400', r'Q400|DHC-8-4\d\d|Dash 8-?400|Dash 8 Q400|Dash-8-400'),
 'E170': ('Embraer 170', r'E-?170\b|ERJ-?170-100|Embraer 170|ERJ-?170\b'), 'E75L': ('Embraer 175', r'E-?175\b|ERJ-?170-200|Embraer 175|ERJ-?175'),
 'E190': ('Embraer 190', r'E-?190\b(?![\s-]?E2)|ERJ-?190-100|Embraer 190(?![\s-]?E2)'),
 'E195': ('Embraer 195', r'E-?195\b(?![\s-]?E2)|ERJ-?190-200|Embraer 195(?![\s-]?E2)'),
 'E295': ('Embraer E195-E2', r'E195[\s-]?E2|ERJ-190-400|E2-195|195-E2'), 'AT76': ('ATR 72-600', r'ATR[\s-]?72-6\d\d|ATR[\s-]?72-212A'),
}

def api(**q):
    q.update(format='json'); req = urllib.request.Request(API + '?' + urllib.parse.urlencode(q), headers={'User-Agent': UA})
    return json.load(urllib.request.urlopen(req, timeout=40))

def search(query, n=40):
    r = api(action='query', generator='search', gsrnamespace=6, gsrsearch=f'{query} filetype:bitmap', gsrlimit=n,
            prop='imageinfo|categories', clshow='!hidden', cllimit='max', iiprop='url|size|extmetadata|mime', iiurlwidth=330)
    return list((r.get('query', {}).get('pages', {}) or {}).values())

def judge(p, al, code):
    ii = (p.get('imageinfo') or [{}])[0]; m = ii.get('extmetadata', {})
    lic = (m.get('LicenseShortName', {}).get('value') or '').strip()
    if not OK_LIC.match(lic) or ii.get('mime') not in ('image/jpeg', 'image/png'): return None
    title = p['title']; w, h = ii.get('width', 0), ii.get('height', 0)
    if w < 1280 or w < h * 1.2 or BAD.search(title): return None
    cats = ' | '.join(c['title'] for c in p.get('categories', []))
    if BAD.search(cats) and re.search(r'accident|incident|crash|wreck|interior|cockpit', cats, re.I): return None
    text = f'{title} | {cats}'
    fl = 0 if al.get('cs') else re.I  # cs: short acronyms (LOT, TAP, ANA...) must match case-sensitively
    if not re.search(al['match'], text, fl): return None
    if al.get('not') and re.search(al['not'], text, fl): return None
    rx = T[code][1]
    in_title = bool(re.search(rx, title, re.I))
    if not in_title:
        if not re.search(rx, cats, re.I): return None
        # The type only shows up in a category: make sure no sibling type is named in the title instead.
        if any(re.search(T[o][1], title, re.I) for o in T if o != code): return None
    date = re.sub('<[^>]+>', '', m.get('DateTimeOriginal', {}).get('value', '') or m.get('DateTime', {}).get('value', ''))
    yr = int(re.search(r'(19|20)\d\d', date).group(0)) if re.search(r'(19|20)\d\d', date) else 0
    artist = re.sub('<[^>]+>', '', m.get('Artist', {}).get('value', '')).strip()[:80]
    score = (min(w, 4000) / 1000 + (3 if FLYING.search(title) else 0) - (1 if GROUND.search(title) else 0) + (1.5 if in_title else 0)
             + (1.5 if yr >= 2018 else 0.75 if yr >= 2012 else 0))
    return {'title': title, 'thumb': ii.get('thumburl'), 'url': ii.get('url'), 'page': ii.get('descriptionurl'), 'w': w, 'h': h,
            'licence': lic, 'artist': artist or 'Unknown', 'year': yr, 'score': round(score, 2)}

def find(al, code):
    words = T[code][0]; seen = {}
    for q in (f'{al["name"]} {words}', f'{al["name"]} {words} in flight'):
        try: pages = search(q)
        except Exception as e: print('  search failed', e); time.sleep(2); continue
        for p in pages:
            j = judge(p, al, code)
            if j and j['title'] not in seen: seen[j['title']] = j
        time.sleep(0.5)
        if len(seen) >= 6: break
    return sorted(seen.values(), key=lambda x: -x['score'])[:4]

airlines = {k: v for k, v in json.load(open(os.path.join(HERE, 'airlines.json'))).items() if not k.startswith('_')}
args = [a for a in sys.argv[1:] if not a.startswith('--')]
cand_path = os.path.join(HERE, 'airline-candidates.json')
cands = json.load(open(cand_path)) if os.path.exists(cand_path) else {}
for icao, al in airlines.items():
    for code in al['types']:
        key = f'{icao}-{code}'
        if args and icao not in args and key not in args: continue
        if not args and '--all' not in sys.argv and key in cands: continue
        if code not in T: print(key, 'no type rule'); continue
        cands[key] = {'airline': al['name'], 'type': T[code][0], 'options': find(al, code)}
        print(key, len(cands[key]['options']), flush=True)
        json.dump(cands, open(cand_path, 'w'), indent=1)
json.dump(cands, open(cand_path, 'w'), indent=1)
print(len(cands), 'pairs,', sum(1 for c in cands.values() if c['options']), 'with candidates')
