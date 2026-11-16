#!/usr/bin/env python3
"""Real photos for Planes cards, like Space Collector's card art (2026-11-15). For each aircraft type in
scripts/photos/types.json, search Wikimedia Commons for freely licensed in-flight photos, keep only PD / CC0 / CC BY /
CC BY-SA, score them (landscape, big, "in flight" in the title, no "cockpit/interior/engine/model/museum"), and write
the best few per type to scripts/photos/candidates.json plus a contact sheet for a human pick.
Then scripts/photos/apply-type-photos.py downloads the picks into assets/photos/types/<ICAO>.webp with credits.
Usage: python3 -I scripts/photos/find-type-photos.py [ICAO ...]"""
import json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'SkyCollectorResearch/0.1 (https://github.com/sevaan/sky-collector)'
API = 'https://commons.wikimedia.org/w/api.php'
OK_LIC = re.compile(r'^(public domain|pd|cc0|cc by(-sa)? ?[1-4]\.0|cc-by(-sa)?-[1-4]\.0|cc by(-sa)?)', re.I)
BAD = re.compile(r'cockpit|interior|cabin|engine|model|museum|mock|toy|crash|wreck|seat|galley|landing gear|tail only|detail|nose', re.I)

def api(**q):
    q.update(format='json'); req = urllib.request.Request(API + '?' + urllib.parse.urlencode(q), headers={'User-Agent': UA})
    return json.load(urllib.request.urlopen(req, timeout=40))

def search(name, n=24):
    r = api(action='query', generator='search', gsrnamespace=6, gsrsearch=f'{name} in flight filetype:bitmap', gsrlimit=n,
            prop='imageinfo', iiprop='url|size|extmetadata|mime', iiurlwidth=640)
    out = []
    for p in (r.get('query', {}).get('pages', {}) or {}).values():
        ii = (p.get('imageinfo') or [{}])[0]; m = ii.get('extmetadata', {})
        lic = (m.get('LicenseShortName', {}).get('value') or '').strip()
        if not OK_LIC.match(lic) or ii.get('mime') not in ('image/jpeg', 'image/png'): continue
        title = p['title']; w, h = ii.get('width', 0), ii.get('height', 0)
        if w < 1600 or w < h * 1.2 or BAD.search(title): continue
        artist = re.sub('<[^>]+>', '', m.get('Artist', {}).get('value', '')).strip()[:80]
        score = min(w, 4000) / 1000 + (3 if re.search(r'in flight|flying|airborne|approach|take ?off|departing|landing', title, re.I) else 0) + (1 if name.split()[-1].lower() in title.lower() else 0)
        out.append({'title': title, 'thumb': ii.get('thumburl'), 'url': ii.get('url'), 'page': ii.get('descriptionurl'), 'w': w, 'h': h,
                    'licence': lic, 'artist': artist or 'Unknown', 'score': round(score, 2)})
    return sorted(out, key=lambda x: -x['score'])[:4]

types = json.load(open(os.path.join(HERE, 'types.json')))
want = set(sys.argv[1:])
cand_path = os.path.join(HERE, 'candidates.json')
cands = json.load(open(cand_path)) if os.path.exists(cand_path) else {}
for code, name in types.items():
    if want and code not in want: continue
    try: cands[code] = {'name': name, 'options': search(name)}
    except Exception as e: print(code, 'failed', e); continue
    print(code, name, len(cands[code]['options'])); time.sleep(0.5)
json.dump(cands, open(cand_path, 'w'), indent=1)
