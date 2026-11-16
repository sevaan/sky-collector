#!/usr/bin/env python3
"""Analyse the sample study (scripts/research/sample-study.py) into docs/research/sample-study.md.
Per place: planes overhead per round (above 8° from the place, as the game would show them), the share with an airline
callsign, the share whose route Virtual Radar Server's free data knows (the data js/routes.js uses), helicopters.
Worldwide: which aircraft types and airlines make up 90 / 99 / 99.9% of sightings (unique aircraft per place per day).
Usage: python3 -I scripts/research/analyse-study.py [data/research/samples-*.jsonl.gz ...]"""
import collections, glob, gzip, json, math, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, 'data', 'research', 'samples-*.jsonl.gz')))
CACHE = os.path.join(ROOT, 'scripts', '.cache', 'vrs'); os.makedirs(CACHE, exist_ok=True)
SD = 'https://raw.githubusercontent.com/vradarserver/standing-data/main/'

def vrs_routes(code):
    p = os.path.join(CACHE, f'{code}.csv')
    if not os.path.exists(p):
        try: data = urllib.request.urlopen(f'{SD}routes/schema-01/{code[0]}/{code}-all.csv', timeout=20).read().decode('utf-8-sig')
        except Exception: data = ''
        open(p, 'w').write(data)
    rows = {}
    for line in open(p).read().splitlines()[1:]:
        v = line.split(',')
        if len(v) >= 5 and v[4]: rows[v[0]] = v[4]
    return rows

def elevation(lat0, lon0, lat, lon, alt_ft):
    if lat is None or lon is None or not isinstance(alt_ft, (int, float)): return -90
    R = 6371.0; p1, p2 = math.radians(lat0), math.radians(lat); dl = math.radians(lon - lon0)
    d = 2 * R * math.asin(math.sqrt(math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))
    h = alt_ft * 0.0003048
    return math.degrees(math.atan2(h - d * d / (2 * R), max(d, 0.01)))

HELI = ('A1', 'AS3', 'AS5', 'AS6', 'AW', 'B06', 'B4', 'BK17', 'EC', 'H1', 'H2', 'H5', 'H6', 'R22', 'R44', 'R66', 'S76', 'S92', 'UH', 'NH90', 'EXPL', 'A109', 'A139', 'A169', 'A189')
places = collections.OrderedDict(); types = collections.Counter(); airlines = collections.Counter()
for f in files:
    for line in gzip.open(f, 'rt'):
        r = json.loads(line); P = places.setdefault(r['place'], {'kind': r['kind'], 'rounds': 0, 'up': 0, 'seen': {}, 'hours': collections.Counter()})
        P['rounds'] += 1
        for hex_, flight, t, reg, alt, lat, lon, gs, trk, cat in r['ac']:
            if alt == 'ground': continue
            el = elevation(r['lat'], r['lon'], lat, lon, alt)
            if el > 8: P['up'] += 1; P['hours'][(r['t'] // 3600) % 24] += 1
            if hex_ and hex_ not in P['seen']: P['seen'][hex_] = (flight, t or '?', cat)

route_cache = {}
def has_route(cs):
    if len(cs) < 4 or not cs[:3].isalpha() or not cs[3].isdigit(): return None
    code = cs[:3].upper(); route_cache.setdefault(code, vrs_routes(code)); return cs in route_cache[code]

rows = []
for name, P in places.items():
    seen = P['seen'].values(); n = len(P['seen'])
    for flight, t, cat in seen:
        types[t] += 1
        if len(flight) > 3 and flight[:3].isalpha() and flight[3].isdigit(): airlines[flight[:3]] += 1
    airline_cs = [f for f, t, c in seen if len(f) > 3 and f[:3].isalpha() and f[3].isdigit()]
    known = [f for f in airline_cs if has_route(f)]
    heli = sum(1 for f, t, c in seen if c == 'A7' or t.startswith(HELI))
    rows.append((name, P['kind'], P['rounds'], P['up'] / max(1, P['rounds']), n, len(airline_cs) / max(1, n), len(known) / max(1, len(airline_cs)), heli))

def cover(counter, share):
    total = sum(counter.values()); run = 0
    for i, (k, v) in enumerate(counter.most_common(), 1):
        run += v
        if run >= share * total: return i
    return len(counter)

out = ['# Sky sample study', '', f'Files: {len(files)}. Rounds are 10-minute samples of a 40 nm circle; "up" is above 8° from the place.', '',
       '| Place | Kind | Rounds | Up per sample | Aircraft seen | Airline callsign | Route known | Helicopters |', '|---|---|---|---|---|---|---|---|']
for r in rows: out.append(f'| {r[0]} | {r[1]} | {r[2]} | {r[3]:.1f} | {r[4]} | {r[5]:.0%} | {r[6]:.0%} | {r[7]} |')
out += ['', f'Aircraft types for 90% of sightings: **{cover(types, .9)}**; 99%: **{cover(types, .99)}**; 99.9%: **{cover(types, .999)}** (of {len(types)}).',
        f'Airlines for 90%: **{cover(airlines, .9)}**; 99%: **{cover(airlines, .99)}** (of {len(airlines)}).', '',
        '## Top 40 types', '', ', '.join(f'{k} {v}' for k, v in types.most_common(40)), '', '## Top 40 airlines (ICAO prefix)', '', ', '.join(f'{k} {v}' for k, v in airlines.most_common(40))]
os.makedirs(os.path.join(ROOT, 'docs', 'research'), exist_ok=True)
open(os.path.join(ROOT, 'docs', 'research', 'sample-study.md'), 'w').write('\n'.join(out) + '\n')
print('\n'.join(out[:len(rows) + 8]))
