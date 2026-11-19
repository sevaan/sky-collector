// The card viewer's gestures in the Collection (2026-11-18, Sevaan: "the swipe away animation of a card on the collection
// in sky collector was janky"): open a card from a tile, swipe to the next card, and flick the card away. Real touch input
// (Chromium: DevTools touch events; WebKit: Playwright's touch has no drag, so pointer events from the mouse), CPU slowed
// (Chromium only: WebKit has no throttle), frames recorded inside the Collection's frame where the viewer lives.
//   PERF_SKY=1 PERF_URL=http://localhost:8768/ node scripts/perf/viewer-swipe.mjs [webkit|chromium] [cpu=4] [--budget]
// Reports each gesture's worst frame, frames over 33 ms and long tasks; --budget exits 1 if any worst frame is 33 ms or more
// or there is a long task. Headless has no GPU: raster and compositing aren't measured, so a phone is the real check.
import { open, URL0 } from './harness.mjs';
const eng = process.argv[2] || 'webkit', cpu = +(process.argv.find((a) => /^\d+$/.test(a)) ?? 4), BUDGET = process.argv.includes('--budget');
const { b, p, errs, W, hud, throttle, seed } = await open(eng, { size: '393x852', dsf: 3 });
await p.goto(URL0); await hud().catch(() => {}); await seed(120); await p.reload(); await hud().catch(() => {}); await W(3000);
await p.evaluate(() => [...document.querySelectorAll('.sc-switch__item, button')].find((e) => /collection/i.test(e.textContent))?.click()); await W(4000);
const f = p.frames().find((x) => /cards\.html/.test(x.url())); if (!f) { console.log('no Collection frame'); process.exit(2); }
await f.evaluate(() => { window.__g = []; window.__t = []; let last = performance.now(); const loop = (t) => { window.__g.push(t - last); window.__t.push(t); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  addEventListener('pointerup', () => { window.__up = performance.now(); }, true);
  window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); } catch {} });
const cdp = eng === 'chromium' ? await p.context().newCDPSession(p) : null; if (cdp) await cdp.send('Performance.enable');
const touch = cdp ? (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] }) : null;
const drag = async (x0, y0, x1, y1, steps = 8) => { // real touch in Chromium; pointer events in WebKit
  if (touch) { await touch('touchStart', x0, y0); for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await W(12); } await touch('touchEnd'); }
  else { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= steps; i++) { await p.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await W(12); } await p.mouse.up(); } };
const state = () => f.evaluate(() => ({ open: document.getElementById('viewer')?.open ?? null, pos: document.getElementById('v-position')?.textContent ?? '' }));
const met = async () => (cdp ? Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value])) : null);
const measure = async (name, fn, ms = 1200) => { await f.evaluate(() => { window.__g.length = 0; window.__t.length = 0; window.__lt.length = 0; window.__up = 0; }); const s0 = await state(), m0 = await met(); await throttle(cpu); await fn(); await W(ms); await throttle(1); const s1 = await state(), m1 = await met();
  const cpuMs = m0 ? ['ScriptDuration', 'RecalcStyleDuration', 'LayoutDuration'].map((k) => `${k.replace('Duration', '').replace('Recalc', '')} ${Math.round((m1[k] - m0[k]) * 1000)}`).join(' ') : '';
  const r = await f.evaluate(() => { const g = window.__g.slice(1).map(Math.round), s = [...g].sort((a, b) => a - b); const wi = g.indexOf(s.at(-1)) + 1; return { at: window.__up ? Math.round(window.__t[wi] - window.__up) : null, n: g.length, worst: s.at(-1) ?? 0, p95: s[Math.floor(s.length * .95)] ?? 0, over33: g.filter((x) => x > 33).length, lt: window.__lt.slice(), top: [...g].sort((a, b) => b - a).slice(0, 5) }; });
  console.log(`${eng} cpu${cdp ? cpu : 1}x ${name.padEnd(22)} frames ${String(r.n).padStart(3)} worst ${String(r.worst).padStart(4)} ms (ends ${r.at} ms after lift)  p95 ${String(r.p95).padStart(3)}  >33ms ${r.over33}  long tasks ${r.lt.length ? r.lt.join(',') : 'none'}  top ${r.top.join(',')}  | ${JSON.stringify(s0)} -> ${JSON.stringify(s1)} ${cpuMs}`); return r; };
const results = [];
for (const kind of ['plane', 'flight']) {
  if (await f.evaluate(() => document.getElementById('viewer')?.open)) { await drag(200, 600, 205, 180, 6); await W(1500); } /* close the last one */
  const t = await f.$(`.tile-slot[data-key^="${kind === 'flight' ? 'F:' : 'P:'}"] .card-tile`) ?? await f.$('.tile-slot .card-tile');
  await t.scrollIntoViewIfNeeded(); await t.tap(); /* a tap opens it (a scripted click doesn't reach the tile's handler in this state) */
  await W(2000);
  results.push(await measure(`${kind}: next card`, () => drag(330, 470, 60, 480, 8)));
  await W(800);
  results.push(await measure(`${kind}: flick away`, () => drag(200, 600, 205, 180, 6)));
  await W(1500);
}
console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
await b.close();
if (BUDGET && results.some((r) => r.worst >= 33 || r.lt.length)) process.exit(1);
