# Pack tear sounds (2026-11-12, Sevaan: "a crunch sounding tear… has to be a pleasurable sound"). A foil wrapper rip is
# thousands of tiny crackles riding a papery body; it stays pleasant when the crackles are soft-edged, the top end is
# rolled off, and it ends on something that resolves. Renders the options for the sound board:
#   python3 scripts/sfx-tear.py <outdir>   ->  <outdir>/tear/{a,b,c,d}.mp3  and  <outdir>/crinkle/{a,b}.mp3
# Ship a pick by copying it to assets/audio/sfx/<event>.mp3, then rerun scripts/sfx-levels.py.
import numpy as np, wave, os, subprocess, sys
SR = 44100
rng = np.random.default_rng(11)
G = {'G5': 783.99, 'B5': 987.77, 'D6': 1174.66, 'E6': 1318.51, 'G6': 1567.98, 'A6': 1760.0, 'B6': 1975.53, 'D7': 2349.32}

def band(x, lo, hi, soft=0.25):
    """FFT band-pass with soft shoulders (no ringing)."""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.clip((f - lo * (1 - soft)) / (lo * soft * 2 + 1e-9), 0, 1) * np.clip(((hi * (1 + soft)) - f) / (hi * soft * 2 + 1e-9), 0, 1)
    return np.fft.irfft(X * m, len(x))

def tilt(x, fc=4500, db=-18):
    """Roll off the top end gently above fc: the 'not harsh' part."""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = 10 ** ((db / 20) * np.clip((f - fc) / fc, 0, 1)); return np.fft.irfft(X * g, len(x))

def room(x, size=0.18, wet=0.12):
    n = int(SR * size); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * size / 5)); ir = band(ir, 300, 7000); ir /= np.abs(ir).sum() ** .5 * 6
    y = np.fft.irfft(np.fft.rfft(np.pad(x, (0, n))) * np.fft.rfft(np.pad(ir, (0, len(x)))), len(x) + n)
    return np.pad(x, (0, n)) * (1 - wet) + y * wet

def crackles(dur, density, lo=1800, hi=7500, grain=(0.0015, 0.006), amp=1.0, soft=1.0):
    """Tiny crunches: short damped tones at random pitches + a sliver of noise each. density(t) = grains per second."""
    n = int(SR * dur); y = np.zeros(n); tt = 0.0
    while tt < dur:
        d = max(1.0, density(tt / dur)); tt += rng.exponential(1 / d)
        if tt >= dur: break
        L = int(SR * rng.uniform(*grain)); i = int(tt * SR); L = min(L, n - i)
        if L < 8: continue
        k = np.arange(L) / SR; f = rng.uniform(lo, hi); dec = rng.uniform(0.0006, 0.002) * soft
        g = (np.sin(2 * np.pi * f * k + rng.uniform(0, 6.28)) * 0.6 + rng.standard_normal(L) * 0.4) * np.exp(-k / dec)
        g *= np.minimum(1, k / 0.0003)  # soft attack: no hard clicks
        y[i:i + L] += g * amp * rng.uniform(0.35, 1.0) * min(1.0, (1 - tt / dur) / 0.15) ** 1.5
    return band(y, lo * 0.7, hi * 1.15)

def body(dur, shape, lo=350, hi=2600, amp=0.5):
    """The papery rip underneath: band noise, amplitude jittered so it 'tears' rather than hisses."""
    n = int(SR * dur); x = band(rng.standard_normal(n), lo, hi)
    e = np.array([shape(i / n) for i in range(0, n, 64)]); e = np.interp(np.arange(n), np.arange(0, n, 64), e)
    jit = np.interp(np.arange(n), np.arange(0, n, 220), rng.uniform(0.55, 1.0, n // 220 + 1)[: len(range(0, n, 220))])
    tail = np.minimum(1, (1 - np.arange(n) / n) / 0.15) ** 1.5
    return x * e * jit * tail * amp

def bell(f, dur=0.9, decay=0.35, amp=1.0):
    n = int(SR * dur); k = np.arange(n) / SR; x = np.zeros(n)
    for r, a, dk in [(1, 1, 1), (2.0, 0.22, 0.5), (2.76, 0.14, 0.35), (5.4, 0.04, 0.15)]:
        x += a * np.sin(2 * np.pi * f * r * k) * np.minimum(1, k / 0.003) * np.exp(-k / (decay * dk))
    return amp * x * np.minimum(1, (dur - k) / 0.15)

def thump(f=95, dur=0.18, amp=0.6):
    n = int(SR * dur); k = np.arange(n) / SR; fr = f * (1 + 0.6 * np.exp(-k / 0.02))
    return amp * np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.minimum(1, k / 0.002) * np.exp(-k / 0.05) * np.minimum(1, (dur - k) / 0.06)

def put(y, x, at):
    i = int(at * SR); y[i:i + len(x)] += x[: max(0, len(y) - i)]; return y

def finish(x, peak_db=-3, fade=0.04):
    x = tilt(x); x -= x.mean(); n = int(SR * fade); x[-n:] *= np.linspace(1, 0, n)
    return x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)

def save(x, path):
    os.makedirs(os.path.dirname(path), exist_ok=True); tmp = path[:-4] + '.wav'
    s = np.int16(np.clip(x, -1, 1) * 32767); s = np.repeat(s[:, None], 2, 1)
    with wave.open(tmp, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(s.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-b:a', '160k', path], check=True); os.remove(tmp)

def tear_a():   # Foil crunch: quick, dense, crisp, no tail
    D = 0.42; y = np.zeros(int(SR * (D + 0.25)))
    y = put(y, crackles(D, lambda p: 900 + 3200 * np.sin(np.pi * min(1, p * 1.15)) ** .7, amp=0.9), 0)
    y = put(y, body(D, lambda p: np.sin(np.pi * min(1, p * 1.1)) ** .6, amp=0.55), 0)
    return finish(room(y, wet=0.1))

def tear_b():   # Crunch + sparkle: the same rip, then a soft glass shimmer as the pack opens
    D = 0.42; y = np.zeros(int(SR * 1.4))
    y = put(y, crackles(D, lambda p: 900 + 3200 * np.sin(np.pi * min(1, p * 1.15)) ** .7, amp=0.9), 0)
    y = put(y, body(D, lambda p: np.sin(np.pi * min(1, p * 1.1)) ** .6, amp=0.55), 0)
    for j, nt in enumerate(['D6', 'G6', 'B6', 'D7']): y = put(y, bell(G[nt], 0.9, 0.32, 0.16 - j * 0.02), 0.34 + j * 0.055)
    return finish(room(y, size=0.35, wet=0.2))

def tear_c():   # Slow rip: the tear speeds up along the seal and ends with a clean pop
    D = 0.75; y = np.zeros(int(SR * (D + 0.35)))
    y = put(y, crackles(D, lambda p: 250 + 4200 * p ** 1.6, lo=1500, hi=7000, amp=0.85), 0)
    y = put(y, body(D, lambda p: (0.25 + 0.75 * p ** 1.3) * min(1, (1 - p) * 12 + 0.2), lo=300, hi=2200, amp=0.5), 0)
    y = put(y, band(rng.standard_normal(int(SR * 0.03)), 900, 4000) * np.exp(-np.arange(int(SR * 0.03)) / (SR * 0.006)) * 0.9, D - 0.02)
    y = put(y, thump(120, 0.15, 0.35), D - 0.02)
    return finish(room(y, wet=0.12))

def tear_d():   # Snack bag: a crinkly grab, a crisp snap open, a warm low thump; the most "ASMR" of the four
    D = 0.32; y = np.zeros(int(SR * 0.9))
    y = put(y, crackles(0.18, lambda p: 1400, lo=1400, hi=5500, grain=(0.002, 0.008), amp=0.55, soft=1.4), 0)
    y = put(y, crackles(D, lambda p: 2400 + 2600 * p, lo=1800, hi=7000, amp=0.95), 0.14)
    y = put(y, body(D, lambda p: np.sin(np.pi * p) ** .5, lo=400, hi=3000, amp=0.6), 0.14)
    y = put(y, thump(85, 0.22, 0.75), 0.14 + D - 0.04)
    return finish(room(y, size=0.25, wet=0.15))

def crinkle(n_grains, spread, soft):   # one handful of crinkle, for the ticks while the finger drags along the seal
    D = spread + 0.03; y = np.zeros(int(SR * (D + 0.1)))
    y = put(y, crackles(D, lambda p: n_grains / D * np.sin(np.pi * p) ** .5 * 1.6, lo=1600, hi=6500, amp=0.8, soft=soft), 0)
    y = put(y, body(D, lambda p: np.sin(np.pi * p), lo=500, hi=2500, amp=0.25), 0)
    return finish(y, fade=0.02)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'out'
    for k, f in {'a': tear_a, 'b': tear_b, 'c': tear_c, 'd': tear_d}.items(): save(f(), f'{out}/tear/{k}.mp3')
    save(crinkle(28, 0.07, 1.0), f'{out}/crinkle/a.mp3'); save(crinkle(16, 0.05, 1.5), f'{out}/crinkle/b.mp3')
    print('rendered to', out)
