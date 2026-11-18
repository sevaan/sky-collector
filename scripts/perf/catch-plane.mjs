// Plane catch timing (QA 2026-11-17): Collect -> reveal and Reveal close, 3 runs, WebKit 390x844, 2,000 seeded cards.
//   PERF_URL=http://localhost:8766/ PERF_SKY=1 node scripts/perf/catch-plane.mjs      (Sky: Show me steers a plane into the circle)
//   PERF_URL=http://localhost:8767/ node scripts/perf/catch-plane.mjs                  (Space Collector: __aim() a satellite, like budget.mjs)
// Limits (budget.mjs): worst frame <= 50 ms, at most 2 frames over 33 ms.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, URL0, SKY } from './harness.mjs';
const DIR = fileURLToPath(new URL('./out/catch/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const AT = SKY ? '2026-11-10T13:10:00-05:00' : '2026-11-10T19:40:00-05:00', N = 2000, RUNS = +(process.env.RUNS || 3);
const T = await open('webkit', { at: AT, wx: 'clear' });
const { p, W, hud, seed, window_, report, fmt, errs } = T;
await p.goto(URL0); await W(2500); await seed(N); await p.evaluate(() => localStorage.setItem('recapWeek', '9e15'));
await p.goto(URL0); await hud(); await W(12000);
const out = [];
const clear = async () => { for (let i = 0; i < 3; i++) { await p.evaluate(() => { const r = document.getElementById('recap'); if (r && !r.hidden) r.querySelector('.rc-go')?.click(); document.querySelectorAll('#toasts .ticket__x').forEach((b) => b.click()); }); await W(700); } };
await clear();
const aimed = () => p.evaluate(() => { const d = document.getElementById('discover'); const c = document.getElementById('d-cta'); return !!d && !d.hidden && !d.classList.contains('owned') && !!c && c.getBoundingClientRect().width > 0 && !c.hidden; });
const aimOnce = async () => {
  if (SKY) {
    await p.evaluate(() => document.getElementById('nav-sky').click()); await W(2000);
    const rows = await p.evaluate(() => { const rs = [...document.querySelectorAll('#sky-today .td-row[data-hex]')]; return rs.length; });
    // Show me on a plane we don't own yet: the hero button targets the best one; rows' own buttons are tried if it is owned
    const had = await p.evaluate(() => { const b = document.querySelector('#sky-today .td-show'); if (!b) return false; b.click(); return true; });
    // steer the view straight onto planes (state is exposed on localhost as window.__sky), trying each until one is collectable
    const tried = [];
    for (let k = 0; k < 40; k++) {
      const r = await p.evaluate(({ k }) => { const S = window.__sky; const it = (S.planeItems ?? []).filter((x) => x.el > 8).sort((a, b) => b.el - a.el); const a = it[k % Math.max(1, it.length)]; if (!a) return null; S.planeGuide = null; S.drag.on = true; S.drag.az = a.az; S.drag.el = a.el; return a.plane.callsign || a.plane.hex; }, { k });
      await W(1300); if (await aimed()) return { rows, had, plane: r, tried: k + 1 };
    }
    return { rows, had, tried: 40 };
  }
  let a; for (let i = 0; i < 12; i++) { a = await p.evaluate(() => window.__aim?.()); if (typeof a === 'string') break; await W(1000); } return a;
};
for (let run = 1; run <= RUNS; run++) {
  await clear(); const info = await aimOnce(); await clear(); let ok = false;
  for (let i = 0; i < 20 && !(ok = await aimed()); i++) await W(1000);
  await W(2500);
  const ticket = await p.evaluate(() => document.getElementById('discover')?.innerText.replace(/\s+/g, ' ').slice(0, 100));
  await p.screenshot({ path: `${DIR}${SKY ? 'sky' : 'space'}-run${run}-aimed.png` });
  if (!ok) { console.log(`run ${run}: no collectable target`, info, ticket); out.push({ run, skipped: true }); continue; }
  const dpr = await p.evaluate(() => document.querySelectorAll('.card').length);
  let st = await window_(); await p.evaluate(() => document.getElementById('d-cta').click()); await W(4000); const rc = await report(st, 8);
  await p.screenshot({ path: `${DIR}${SKY ? 'sky' : 'space'}-run${run}-reveal.png` });
  console.log(`run ${run} target: ${ticket}`); console.log(fmt(`run ${run} Collect -> reveal`, rc));
  st = await window_(); await p.evaluate(() => document.querySelector('#reveal .x-close')?.click()); await W(2500); const rx = await report(st, 8);
  console.log(fmt(`run ${run} Reveal close`, rx));
  out.push({ run, ticket, collect: { max: rc.max, over33: rc.over33, over50: rc.over50, frames: rc.frames, longF: rc.longF, cbs: rc.cbs.filter((c) => c[3] > 12) }, close: { max: rx.max, over33: rx.over33, over50: rx.over50, frames: rx.frames, longF: rx.longF, cbs: rx.cbs.filter((c) => c[3] > 12) } });
  await p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); }); await W(1500);
  if (SKY) { await p.evaluate(() => document.getElementById('nav-explore')?.click()); await W(1500); }
}
console.log('SUMMARY', JSON.stringify(out)); if (errs.length) console.log('page errors', errs);
await T.b.close();
