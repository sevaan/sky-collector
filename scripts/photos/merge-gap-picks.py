#!/usr/bin/env python3
"""Merge hand-picked gap photos (gap-candidates.json + gap-picks.json {KEY: option index}) into the files the apply scripts read
(2026-11-17): house keys -> house-candidates.json / house-picks.json; airline keys (AAA-TYPE) -> airline-candidates.json /
airline-picks.json (the pick is appended as a new option, so a replacement leaves the old option in place but unpicked).
Then run apply-house-photos.py / apply-airline-photos.py. Usage: python3 -I scripts/photos/merge-gap-picks.py"""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
L = lambda n: json.load(open(os.path.join(HERE, n)))
S = lambda n, d: json.dump(d, open(os.path.join(HERE, n), 'w'), indent=1)
cands, picks = L('gap-candidates.json'), L('gap-picks.json')
hc, hp, ac, ap = L('house-candidates.json'), L('house-picks.json'), L('airline-candidates.json'), L('airline-picks.json')
for key, i in picks.items():
    if i is None or i < 0: continue
    o = {k: v for k, v in cands[key]['options'][i].items() if k not in ('box', 'fit290', 'fit460', 'score', 'desc')}
    if re.fullmatch(r'[A-Z]{3}-[A-Z0-9]+', key):
        c = ac.setdefault(key, {'airline': cands[key]['name'], 'type': key.split('-')[1], 'options': []})
        for n, x in enumerate(c['options']):
            if x['title'] == o['title']: ap[key] = n; break
        else: c['options'].append(o); ap[key] = len(c['options']) - 1
    else:
        hc[key] = {'name': cands[key]['name'], 'options': [o]}; hp[key] = 0
S('house-candidates.json', hc); S('house-picks.json', hp); S('airline-candidates.json', ac); S('airline-picks.json', ap)
print('merged', len(picks))
