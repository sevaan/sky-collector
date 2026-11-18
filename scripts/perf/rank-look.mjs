// The Collection's rank card at 390 and 320 wide, by day (2026-11-17). PERF_URL / PERF_SKY.
import { mkdirSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const DIR = fileURLToPath(new URL('./out/rank/', import.meta.url)); mkdirSync(DIR, { recursive: true });
for (const size of ['390x844', '320x640']) {
  const T = await open('webkit', { at: '2026-11-10T13:10:00-05:00', wx: 'clear', size }); const { p, W, hud, seed, errs } = T;
  await p.goto(URL0); await W(2500); await seed(300); await p.evaluate(() => localStorage.setItem('recapWeek', '9e15'));
  await p.goto(URL0); await hud(); await W(4000);
  await p.evaluate(() => document.getElementById('nav-collection').click()); await W(4000);
  await p.evaluate(() => document.querySelectorAll('#toasts .ticket__x').forEach((x) => x.click())); await W(700);
  await p.screenshot({ path: `${DIR}rank-${size}.png` }); console.log(size, errs.slice(0, 3));
  await T.b.close();
}
