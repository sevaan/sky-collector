// Collection open + grid scroll, as budget.mjs measures them (2026-11-16 scroll pass). PERF_URL / PERF_SKY. Runs 3 times.
import { open, URL0 } from './harness.mjs';
const T = await open('webkit', { at: '2026-11-10T19:40:00-05:00', wx: 'clear' });
const { p, W, hud, seed, window_, report } = T;
await p.goto(URL0); await W(2500); await seed(2000);
for (let run = 0; run < (+process.env.RUNS || 3); run++) {
  await p.goto(URL0); await hud(); await W(6000);
  let s = await window_(); await p.evaluate(() => document.getElementById('nav-collection').click()); await W(2500); const o = await report(s, 4);
  await W(1000); const f = p.frames().find((x) => /cards\.html/.test(x.url()));
  s = await window_(); await f.evaluate(async () => { const e = document.scrollingElement; for (let i = 0; i < 90; i++) { e.scrollTop += 120; await new Promise((q) => requestAnimationFrame(q)); } }); await W(300); const q = await report(s, 4);
  const filt = await f.evaluate(() => { const m = {}; for (const e of document.querySelectorAll('.card-tile *')) { const v = getComputedStyle(e).filter; if (v !== 'none') { const k = `${e.tagName}.${[...e.classList].join('.')} ${v.slice(0, 60)}`; m[k] = (m[k] || 0) + 1; } } return JSON.stringify(m); });
  console.log(`run ${run}: open worst ${o.max} ms | scroll p50 ${q.p50} p95 ${q.p95} max ${q.max} >33:${q.over33} | filtered els ${filt}`); if (q.max > 200) console.log('  long:', (q.longF ?? []).slice(0, 5).join(' | '), '\n  cbs:', JSON.stringify(q.cbs.slice(0, 5)));
}
await T.b.close();
