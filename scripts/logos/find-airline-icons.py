#!/usr/bin/env python3
"""Find airline ICONS (2026-11-18, Sevaan: "instead of the full logos, what about like the favicon versions"): the square
mark an airline uses as its app icon or favicon (Air Canada's roundel, Delta's widget, United's globe), for the radar strip.
For every airline item found by find-airline-logos.py (candidates.json, any status with a qid), Wikidata P8972 "small logo
or icon" first, then any other P154 logo of that airline whose file name says symbol/icon/emblem/tail/roundel. Same licence
rule as the logos: public domain / PD-textlogo / CC0 only. Writes scripts/logos/icon-candidates.json.
Usage: python3 -I scripts/logos/find-airline-icons.py"""
import json, os, re, time, urllib.parse, urllib.request, collections
HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'SkyCollectorResearch/0.1 (https://github.com/sevaan/sky-collector)'
OK_LIC = re.compile(r'^(public domain|pd\b|pd-|cc0|cc-zero)', re.I)
SYMBOL = re.compile(r'(symbol|icon|emblem|tail|roundel|logomark|mark\b|favicon|monogram|bird|leaf|globe|widget)', re.I)
def get(url):
    for t in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=90))
        except Exception as e: print('retry', e); time.sleep(5 + 5 * t)
    return {}
def sparql(q): return get('https://query.wikidata.org/sparql?format=json&query=' + urllib.parse.quote(q)).get('results', {}).get('bindings', [])
C = json.load(open(os.path.join(HERE, 'candidates.json')))
qid = {c: r['qid'] for c, r in C.items() if r.get('qid')}
by_q = collections.defaultdict(list)
for c, q in qid.items(): by_q[q].append(c)
found = collections.defaultdict(list)  # code -> [(kind, file)]
qs = sorted(by_q)
for i in range(0, len(qs), 40):
    vals = ' '.join('wd:' + q for q in qs[i:i + 40])
    rows = sparql('''SELECT ?item ?icon ?logo WHERE { VALUES ?item { %s } OPTIONAL { ?item wdt:P8972 ?icon } OPTIONAL { ?item wdt:P154 ?logo } }''' % vals)
    for b in rows:
        q = b['item']['value'].rsplit('/', 1)[1]
        for c in by_q[q]:
            if 'icon' in b: found[c].append(('icon', urllib.parse.unquote(b['icon']['value'].rsplit('/', 1)[1])))
            if 'logo' in b:
                f = urllib.parse.unquote(b['logo']['value'].rsplit('/', 1)[1])
                if SYMBOL.search(f): found[c].append(('symbol', f))
    time.sleep(0.5)
files = sorted({f for v in found.values() for _, f in v})
lic = {}
for i in range(0, len(files), 40):
    d = get('https://commons.wikimedia.org/w/api.php?format=json&' + urllib.parse.urlencode({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'extmetadata|url|size', 'iiextmetadatafilter': 'LicenseShortName', 'titles': '|'.join('File:' + f for f in files[i:i + 40]), 'redirects': 1}))
    redir = {r['to']: r['from'] for r in d.get('query', {}).get('redirects', [])}; norm = {n['to']: n['from'] for n in d.get('query', {}).get('normalized', [])}
    for p in d.get('query', {}).get('pages', {}).values():
        t = p['title']; o = norm.get(redir.get(t, t), redir.get(t, t)); ii = (p.get('imageinfo') or [{}])[0]
        lic[o[5:].replace('_', ' ')] = {'title': t[5:], 'licence': ii.get('extmetadata', {}).get('LicenseShortName', {}).get('value', ''), 'url': ii.get('descriptionurl', ''), 'w': ii.get('width'), 'h': ii.get('height')}
    time.sleep(0.5)
res = {}
for c in sorted(qid):
    opts = []
    for kind, f in dict.fromkeys(found.get(c, [])):
        l = lic.get(f.replace('_', ' ')) or {}
        opts.append({'kind': kind, 'file': f, 'licence': l.get('licence', ''), 'source': l.get('url', ''), 'title': l.get('title', f), 'w': l.get('w'), 'h': l.get('h'), 'ok': bool(OK_LIC.match(l.get('licence') or ''))})
    ok = [o for o in opts if o['ok']]; ok.sort(key=lambda o: o['kind'] != 'icon')
    res[c] = {'status': 'icon' if ok else ('licence' if opts else 'none'), 'pick': ok[0] if ok else None, 'options': opts}
json.dump(res, open(os.path.join(HERE, 'icon-candidates.json'), 'w'), indent=1, ensure_ascii=False)
print(collections.Counter(r['status'] for r in res.values()))
