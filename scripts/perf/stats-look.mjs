// Observer stats in Sky, opened from Settings (2026-11-17). PERF_URL / PERF_SKY.
import { mkdirSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const DIR = fileURLToPath(new URL('./out/stats/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const T = await open('webkit', { at: '2026-11-10T13:10:00-05:00', wx: 'clear' }); const { p, W, hud, seed, errs } = T;
await p.goto(URL0); await W(2500); await seed(300); await p.evaluate(() => localStorage.setItem('recapWeek', '9e15'));
await p.goto(URL0); await hud(); await W(4000);
await p.evaluate(() => document.querySelectorAll('#toasts .ticket__x').forEach((x) => x.click())); await W(500);
await p.evaluate(() => document.getElementById('nav-more').click()); await W(1200);
console.log('row shown:', await p.evaluate(() => { const b = document.getElementById('set-stats-open'); return !!b && getComputedStyle(b).display !== 'none'; }));
await p.evaluate(() => document.getElementById('set-stats-open').click()); await W(4500); await p.screenshot({ path: `${DIR}stats-1.png` });
const f = p.frames().find((x) => /cards\.html/.test(x.url()));
console.log(await f.evaluate(() => document.getElementById('stats-body')?.innerText.replace(/\s+/g, ' ').slice(0, 600)));
await f.evaluate(() => { const d = document.getElementById('stats-view'); (d.querySelector('.st-scroll, #stats-body')?.parentElement ?? d).scrollBy?.(0, 700); d.scrollTop += 700; document.getElementById('stats-body').parentElement.scrollTop += 700; }); await W(700); await p.screenshot({ path: `${DIR}stats-2.png` });
console.log(errs.slice(0, 4)); await T.b.close();
