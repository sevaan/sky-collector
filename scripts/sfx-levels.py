#!/usr/bin/env python3
"""Set every sound effect's level from how loud it actually sounds (2026-10-18).

Measures each assets/audio/sfx/*.mp3 with EBU R128 (max momentary loudness, padded with silence so short clicks get
full 400 ms windows), then writes js/sfx.js NORM so each one lands on its target below: big payoffs loudest, rarer
louder, small taps and ticks quietest. Gains are capped so nothing can clip at full volume (after sfx.js LEVEL).
For reference: the music plays at about -36.5 LUFS (permafrost.m4a at -20 LUFS x music LEVEL 0.15); sfx get LEVEL 0.25
(-12 dB) on top of these targets, so payoffs sit ~8 dB over the music and ticks just under it.
Run after swapping any sound file:  python3 scripts/sfx-levels.py
"""
import glob, json, math, os, re, subprocess

TARGET = {  # max momentary LUFS before LEVEL
    'r_legend': -16, 'r_epic': -17, 'shiny': -17, 'rankup': -17, 'r_rare': -18, 'complete': -18, 'secret': -18, 'ufo': -18, 'fossil': -18,
    'r_uncommon': -19, 'levelup': -19, 'mission': -19, 'r_common': -20, 'welcome': -20, 'collect': -20,
    'patch': -21, 'arrive': -27, 'stamp': -22, 'seen': -23, 'toast': -23, 'flip': -24, 'plane': -24, 'coinroll': -24,
    'lock': -47, 'swipe': -26, 'rattle': -26, 'page': -27, 'step': -27, 'toggle': -28, 'xp': -34, # xp half as loud (2026-10-20), lock halved again 2026-10-21 (Sevaan), reveal whoosh (arrive) -5 dB 2026-10-22 (Sevaan: "a bit quieter")
}
LEVEL_DB = 20 * math.log10(0.25)
# Sevaan's by-ear mix of 2026-11-19 (the mixer artifact): dB on top of the measured levels. The NORM table in js/sfx.js
# is now that mix, so by default this script KEEPS every sound already in NORM and only levels new files. Pass
# --remeasure to level everything from scratch; the trims below are then applied on top (the result will be close to,
# not exactly, today's NORM, since several files were last set by hand rather than by this script).
MIX_2026_11_19 = {"lock": 0.5, "collect": -2.5, "plane": -2.5, "arrive": -3, "flip": -7.5, "seen": -4.5, "stamp": -5.5, "swipe": -6.5, "r_common": -0.5, "r_uncommon": -0.5, "r_rare": -0.5, "r_epic": -0.5, "r_legend": -0.5, "shiny": -0.5, "xp": -3.5, "levelup": -2.5, "rankup": -1, "mission": -0.5, "complete": -0.5, "patch": -0.5, "coinroll": -5, "tear": -2.5, "step": -1.5, "rattle": -3.5, "welcome": -4.5, "toggle": -11.5, "toast": -4.5, "page": -5, "secret": -2.5, "fossil": -7, "ufo": -0.5}
TARGET.setdefault('tear', -26)
import sys
REMEASURE = '--remeasure' in sys.argv

def ff(f, af, verbose=False):
    cmd = ['ffmpeg', '-hide_banner', '-nostats'] + (['-v', 'verbose'] if verbose else []) + ['-i', f, '-af', af, '-f', 'null', '-']
    return subprocess.run(cmd, capture_output=True, text=True).stderr

src = open('js/sfx.js').read()
norm = {} if REMEASURE else json.loads(re.search(r'const NORM = (\{[^}]*\});', src).group(1))
for f in sorted(glob.glob('assets/audio/sfx/*.mp3')):
    k = os.path.basename(f)[:-4]
    if k in norm: continue  # kept: Sevaan's mix (rerun with --remeasure to level it again)
    if k not in TARGET: print('no target for', k); continue
    m = max(float(x) for x in re.findall(r' M:\s*(-?[\d.]+)', ff(f, 'apad=pad_dur=1,ebur128=framelog=verbose', True)))
    pk = float(re.search(r'max_volume: (-?[\d.]+) dB', ff(f, 'volumedetect')).group(1))
    g = min(10 ** ((TARGET[k] - m) / 20), 10 ** ((-1 - pk - LEVEL_DB) / 20))
    if REMEASURE: g *= 10 ** (MIX_2026_11_19.get(k, 0) / 20)
    norm[k] = round(g, 2)
    print(f'{k:11} {m:6.1f} LUFS -> {TARGET[k]:4}  gain {g:.2f}')

src = re.sub(r'const NORM = \{[^}]*\};', 'const NORM = ' + json.dumps(dict(sorted(norm.items()))) + ';', src)
open('js/sfx.js', 'w').write(src)
print('js/sfx.js NORM updated')
