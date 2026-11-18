// The Albums tab in Sky (2026-11-17): the album list, then one album open. PERF_URL / PERF_SKY.
import { mkdirSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const DIR = fileURLToPath(new URL('./out/albums/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const T = await open('webkit', { at: '2026-11-10T13:10:00-05:00', wx: 'clear' }); const { p, W, hud, seed, errs } = T;
await p.goto(URL0); await W(2500); await seed(300); await p.evaluate(() => localStorage.setItem('recapWeek', '9e15'));
await p.goto(URL0); await hud(); await W(4000);
await p.evaluate(() => document.getElementById('nav-collection').click()); await W(4000);
await p.evaluate(() => document.querySelectorAll('#toasts .ticket__x').forEach((x) => x.click())); await W(600);
const f = p.frames().find((x) => /cards\.html/.test(x.url()));
await p.screenshot({ path: `${DIR}mine.png` });
await f.locator('#tab-albums').click(); await W(1500); await p.screenshot({ path: `${DIR}albums.png` });
await f.evaluate(() => window.scrollBy(0, 500)); await W(600); await p.screenshot({ path: `${DIR}albums2.png` });
console.log(await f.evaluate(() => [...document.querySelectorAll('.album')].map((a) => a.innerText.replace(/\s+/g, ' ').slice(0, 70))));
await f.evaluate(() => window.scrollTo(0, 0)); await W(400); await f.locator('.album').first().click(); await W(2000); await p.screenshot({ path: `${DIR}album-open.png` });
console.log(errs.slice(0, 4)); await T.b.close();
