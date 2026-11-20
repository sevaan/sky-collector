# The offline city list for Settings → Location search (2026-10-25: Open-Meteo's geocoding isn't free for an app that sells
# a subscription). From GeoNames (CC BY 4.0, "Data from GeoNames"). 2026-11-20: cities1000 (every place with 1,000+
# people, ~150k) so small dark-sky towns are found (Banff, Tobermory, Moab…), written compact.
#   python3 scripts/build-cities.py <folder with cities1000.txt (or cities15000.txt), admin1CodesASCII.txt, countryInfo.txt> [file]
# Writes data/cities.json: { v: 2, regions: [...], countries: [...], cities: [[name, ascii name or 0, region index,
# country index, lat, lon], …] } sorted biggest first (population isn't stored: the order is the ranking).
import json, sys, os
d = sys.argv[1]; src = sys.argv[2] if len(sys.argv) > 2 else 'cities1000.txt'
country = {}
for line in open(os.path.join(d, 'countryInfo.txt'), encoding='utf-8'):
    if line.startswith('#'): continue
    f = line.rstrip('\n').split('\t')
    if len(f) > 4: country[f[0]] = f[4]
admin1 = {}
for line in open(os.path.join(d, 'admin1CodesASCII.txt'), encoding='utf-8'):
    f = line.rstrip('\n').split('\t')
    admin1[f[0]] = f[1]
rows = []
for line in open(os.path.join(d, src), encoding='utf-8'):
    f = line.rstrip('\n').split('\t')
    name, ascii_, lat, lon, cc, a1, pop = f[1], f[2], float(f[4]), float(f[5]), f[8], f[10], int(f[14] or 0)
    if '(' in name or f[7] in ('PPLX', 'PPLH', 'PPLQ', 'PPLW'): continue  # sections of a city (Paris 15 Vaugirard), historical, abandoned, destroyed
    rows.append((pop, name, ascii_ if ascii_ != name else 0, admin1.get(f'{cc}.{a1}', ''), country.get(cc, cc), round(lat, 2), round(lon, 2)))
rows.sort(key=lambda r: -r[0])
# A city's numbered districts (Paris 15 Vaugirard, Lyon 3e…) aren't places people search for: drop "<bigger city> <digit>…".
import re
big = {(r[1], r[4]) for r in rows if r[0] >= 100000}
rows = [r for r in rows if not (m := re.match(r'^(.+?) \d', r[1])) or (m.group(1), r[4]) not in big]
regions, countries, ri, ci = [], [], {}, {}
def idx(tab, m, v):
    if v not in m: m[v] = len(tab); tab.append(v)
    return m[v]
out = [[r[1], r[2], idx(regions, ri, r[3]), idx(countries, ci, r[4]), r[5], r[6]] for r in rows]
json.dump({'source': f'GeoNames (CC BY 4.0), {src.split(".")[0]}', 'v': 2, 'regions': regions, 'countries': countries, 'cities': out},
          open('data/cities.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), os.path.getsize('data/cities.json'))
