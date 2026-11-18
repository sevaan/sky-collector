// The Patches tab in Sky (2026-11-17). PERF_URL / PERF_SKY.
import { mkdirSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const DIR = fileURLToPath(new URL('./out/albums/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const T = await open('webkit', { at: '2026-11-10T13:10:00-05:00', wx: 'clear' }); const { p, W, hud, seed, errs } = T;
await p.goto(URL0); await W(2500); await seed(300); await p.goto(URL0); await hud(); await W(4000);
await p.evaluate(() => { document.querySelector('#recap:not([hidden]) .rc-go')?.click(); }); await W(600);
await p.evaluate(() => document.getElementById('nav-collection').click()); await W(4000);
await p.evaluate(() => document.querySelectorAll('#toasts .ticket__x').forEach((x) => x.click())); await W(600);
const f = p.frames().find((x) => /cards\.html/.test(x.url()));
await f.locator('#tab-patches').click(); await W(1800); await p.screenshot({ path: `${DIR}patches.png` });
await f.evaluate(() => window.scrollBy(0, 620)); await W(700); await p.screenshot({ path: `${DIR}patches2.png` });
console.log(await f.evaluate(() => document.querySelectorAll('#patch-wall .patch, #patch-wall [class*=patch]').length), errs.slice(0, 3));
await T.b.close();
