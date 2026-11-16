// Today's hero in clear, partly cloudy, overcast and rain (2026-11-16). PERF_URL / PERF_SKY.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const DIR = fileURLToPath(new URL('./out/today/', import.meta.url)); mkdirSync(DIR, { recursive: true });
for (const wx of ['clear', 'partial', 'cloudy', 'rain']) {
  const T = await open('webkit', { at: '2026-11-10T13:10:00-05:00', wx }); const { p, W, hud, seed } = T;
  await p.goto(URL0); await W(2500); await seed(60); await p.evaluate(() => localStorage.setItem('recapWeek', '9e15'));
  await p.goto(URL0); await hud(); await W(4000); await p.evaluate(() => document.querySelector('#recap:not([hidden]) .rc-go')?.click()); await W(900);
  await p.evaluate(() => document.getElementById('nav-sky').click()); await W(2500); await p.screenshot({ path: `${DIR}ticket-${wx}.png`, clip: { x: 0, y: 0, width: 390, height: 200 } }); await p.evaluate(() => document.querySelectorAll('#toasts .ticket__x').forEach((x) => x.click())); await W(900);
  await p.screenshot({ path: `${DIR}today-${wx}.png`, clip: { x: 0, y: 0, width: 390, height: 420 } });
  await T.b.close();
}
