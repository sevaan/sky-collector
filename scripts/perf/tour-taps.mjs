// Taps through the tour as fast as it allows (or every N ms), then records the first-catch card every 30 ms: its tilt,
// height and class, the Skip pill, and frame gaps during the rise vs before. Usage: PERF_URL=… node scripts/perf/tour-taps.mjs webkit|chromium [gapMs] [cpu]
// (2026-11-18: the first-catch card sat tilted for seconds while the tour waited for tonight's plan; copied from Space Collector. Sky: PERF_SKY=1, and its tour waits for a location fix, motion and notifications.)
import { open } from './harness.mjs';
const eng = process.argv[2] || 'webkit', gapMs = Number(process.argv[3] || 0), cpu = Number(process.argv[4] || 1);
const h = await open(eng, { size: '393x852', at: '2026-11-18T00:30:00Z', wx: 'clear', attrib: false, returning: false, dsf: 2 }); const { p, W } = h;
await p.addInitScript(() => { try { localStorage.setItem('music', '0'); } catch {} });
if (process.env.SLOW_GPS) await p.addInitScript(() => { const g = navigator.geolocation; if (g) { g.getCurrentPosition = () => {}; g.watchPosition = () => 0; } }); /* a location fix that never comes: the tour waits its 4 s, as on a phone indoors */
await p.goto(process.env.PERF_URL); await W(700);
let tour = false;
for (let i = 0; i < 30 && !tour; i++) { await p.evaluate(() => { const b = document.getElementById('btn-start'); if (b && b.offsetParent && !b.disabled) b.click(); document.querySelector('.gp-pillow')?.click(); document.getElementById('wc-holder')?.click(); }); await p.mouse.click(196, 426); await W(1200); tour = await p.evaluate(() => document.querySelectorAll('.tc .acts .yes').length > 0); }
if (!tour) { console.log('no tour'); process.exit(1); }
await h.throttle(cpu);
await W(700);
const r = await p.evaluate(async (gapMs) => {
  const top = () => document.querySelector('#ob-deck .tc:not(.gone):not(.under):not(.under2):not(.waiting)');
  const frames = []; let rec = true; const tb = performance.now(); const loop = (t) => { frames.push(t); if (rec) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  let taps = 0, lastTap = 0;
  for (let i = 0; i < 400 && taps < 3; i++) { const t = top(); const y = t?.querySelector('.acts .yes'); if (y && !/Show me/.test(y.textContent)) { y.click(); taps++; lastTap = performance.now(); await new Promise((r) => setTimeout(r, gapMs)); } else await new Promise((r) => setTimeout(r, 16)); }
  const samples = []; const t0 = lastTap;
  while (performance.now() - t0 < 6000) { const c = [...document.querySelectorAll('#ob-deck .tc:not(.gone)')].pop(); const m = c ? new DOMMatrix(getComputedStyle(c).transform) : null; const ang = m ? Math.atan2(m.b, m.a) * 180 / Math.PI : null; samples.push([Math.round(performance.now() - t0), ang == null ? null : +ang.toFixed(2), m ? Math.round(m.f) : null, c?.className, !document.getElementById('ob-skip').hidden]); await new Promise((r) => setTimeout(r, 30)); }
  rec = false;
  const g = []; for (let i = 1; i < frames.length; i++) if (frames[i] > t0) g.push(frames[i] - frames[i - 1]);
  const tilted = samples.filter((s) => s[1] != null && Math.abs(s[1]) > 0.5); const lastTilt = tilted.length ? tilted.at(-1)[0] : 0;
  const rise = [], base = []; for (let i = 1; i < frames.length; i++) { const d = frames[i] - frames[i - 1]; if (frames[i] > t0 && frames[i] < t0 + 600) rise.push(d); if (frames[i] < t0 - 100 && frames[i] > tb) base.push(d); } const st = (a) => ({ n: a.length, max: Math.round(Math.max(0, ...a)), over50: a.filter((x) => x > 50).length, med: Math.round([...a].sort((x, y) => x - y)[a.length >> 1] ?? 0) });
  return { rise: st(rise), before: st(base), taps, lastTiltedMs: lastTilt, maxGap: Math.round(Math.max(...g)), over50: g.filter((x) => x > 50).length, skipHiddenAt: (samples.find((s) => !s[4]) ?? [null])[0], end: samples.at(-1), mid: samples.filter((_, i) => i % 8 === 0).slice(0, 12) };
}, gapMs);
console.log(eng, `gap ${gapMs}`, `cpu ${cpu}x`, JSON.stringify({ ...r, mid: undefined }));
console.log('  ', JSON.stringify(r.mid));
await h.b.close();
