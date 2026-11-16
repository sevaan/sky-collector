#!/usr/bin/env python3
"""Phase 0 sample study (docs/RESEARCH-PLAN.md), the light version: sample the live adsb.lol feed around 30 places on
every continent, one request per place every 10 minutes, for a set number of hours. Each sample is appended to
data/research/samples-<date>.jsonl.gz (one line per place per round: place, time, aircraft [hex, flight, type, reg,
alt, lat, lon, gs, track, category]). Analyse with scripts/research/analyse-study.py.
Usage: python3 -I scripts/research/sample-study.py [hours=24] [minutes=10]
Polite: ~3 requests a minute in total, a fixed User-Agent, and it backs off on errors."""
import gzip, json, os, sys, time, urllib.request

PLACES = [  # name, lat, lon, kind (busy = near a hub, medium, rural/remote)
  ('Toronto', 43.68, -79.62, 'busy'), ('Peterborough ON', 44.30, -78.32, 'medium'), ('Rural Saskatchewan', 51.20, -106.50, 'rural'),
  ('Vancouver', 49.19, -123.18, 'busy'), ('New York', 40.64, -73.78, 'busy'), ('Dallas', 32.90, -97.04, 'busy'),
  ('Kansas farmland', 38.50, -98.50, 'rural'), ('Mexico City', 19.44, -99.07, 'busy'), ('Sao Paulo', -23.43, -46.47, 'busy'),
  ('Patagonia', -45.0, -70.0, 'rural'), ('London', 51.47, -0.45, 'busy'), ('Frankfurt', 50.04, 8.56, 'busy'),
  ('Rural Spain', 39.5, -4.5, 'medium'), ('Istanbul', 41.26, 28.74, 'busy'), ('Reykjavik', 63.98, -22.60, 'medium'),
  ('Dubai', 25.25, 55.36, 'busy'), ('Lagos', 6.58, 3.32, 'busy'), ('Nairobi', -1.32, 36.93, 'busy'),
  ('Johannesburg', -26.14, 28.24, 'busy'), ('Delhi', 28.56, 77.10, 'busy'), ('Singapore', 1.36, 103.99, 'busy'),
  ('Jakarta', -6.13, 106.66, 'busy'), ('Tokyo', 35.55, 139.78, 'busy'), ('Seoul', 37.46, 126.44, 'busy'),
  ('Sydney', -33.95, 151.18, 'busy'), ('Central Australia', -23.8, 133.9, 'rural'), ('Auckland', -37.01, 174.79, 'medium'),
  ('Honolulu', 21.32, -157.92, 'medium'), ('Anchorage', 61.17, -149.99, 'medium'), ('Northern Canada', 62.45, -114.37, 'rural'),
]
UA = 'SkyCollectorResearch/0.1 (+https://github.com/sevaan/sky-collector)'
hours = float(sys.argv[1]) if len(sys.argv) > 1 else 24
every = float(sys.argv[2]) if len(sys.argv) > 2 else 10
root = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'research'); os.makedirs(root, exist_ok=True)
end = time.time() + hours * 3600
gap = every * 60 / len(PLACES)  # spread the round evenly across the interval

def fetch(lat, lon):
    req = urllib.request.Request(f'https://api.adsb.lol/v2/point/{lat:.2f}/{lon:.2f}/40', headers={'User-Agent': UA})
    return json.load(urllib.request.urlopen(req, timeout=20))

rounds = 0
while time.time() < end:
    out = gzip.open(os.path.join(root, f'samples-{time.strftime("%Y-%m-%d")}.jsonl.gz'), 'at')
    for name, lat, lon, kind in PLACES:
        t0 = time.time()
        for attempt in range(3):
            try:
                j = fetch(lat, lon)
                ac = [[a.get('hex'), (a.get('flight') or '').strip(), a.get('t', ''), a.get('r', ''), a.get('alt_baro'), a.get('lat'), a.get('lon'),
                       a.get('gs'), a.get('track'), a.get('category', '')] for a in j.get('ac', [])]
                out.write(json.dumps({'place': name, 'kind': kind, 'lat': lat, 'lon': lon, 't': int(t0), 'ac': ac}) + '\n'); break
            except Exception as e:
                time.sleep(20 * (attempt + 1))
        time.sleep(max(0, gap - (time.time() - t0)))
    out.close(); rounds += 1
    print(time.strftime('%H:%M'), 'round', rounds, flush=True)
