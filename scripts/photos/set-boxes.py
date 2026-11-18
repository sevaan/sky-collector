#!/usr/bin/env python3
"""Merge hand-drawn tight boxes into box-overrides.json (2026-11-17).
Usage: python3 -I scripts/photos/set-boxes.py KIND 'KEY x0 y0 x1 y1; KEY ...'
KIND = house | airlines | types; coordinates 0-1 over the whole photo, plane tight (nose to tail, wingtip to wingtip, fin to wheels)."""
import json, os, sys
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'box-overrides.json')
o = json.load(open(p))
for part in sys.argv[2].split(';'):
    f = part.split()
    if len(f) == 5: o[f'{sys.argv[1]}/{f[0]}'] = [float(x) for x in f[1:]]
json.dump(o, open(p, 'w'), indent=1)
print(len(o), 'overrides')
