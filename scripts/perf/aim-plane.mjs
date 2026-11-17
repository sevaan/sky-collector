// Does a plane show in the circle when you aim at it? (2026-11-17, Sevaan outdoors: Space Collector showed a plane, Sky
// didn't.) Today's Show me aims at the best plane; screenshot Explore and report the target ticket. ARG: day|eve.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const DIR = fileURLToPath(new URL('./out/aim/', import.meta.url)); mkdirSync(DIR, { recursive: true });
for (const [when, at] of [['day', '2026-11-10T13:10:00-05:00'], ['eve', '2026-11-10T21:23:00-05:00']]) {
  const T = await open('webkit', { at, wx: 'clear' }); const { p, W, hud, seed, errs } = T;
  await p.goto(URL0); await W(2500); await seed(20); await p.evaluate(() => localStorage.setItem('recapWeek', '9e15'));
  await p.goto(URL0); await hud(); await W(12000);
  await p.evaluate(() => document.getElementById('nav-sky').click()); await W(2500);
  const rows = await p.evaluate(() => document.querySelectorAll('#sky-today .td-row[data-hex]').length);
  const had = await p.evaluate(() => { const b = document.querySelector('#sky-today .td-show'); if (!b) return false; b.click(); return true; });
  await W(5000); await p.screenshot({ path: `${DIR}aim-${when}.png` });
  console.log(when, { todayRows: rows, showMe: had, overhead: await p.evaluate(() => document.body.innerText.match(/\d+ OVERHEAD/i)?.[0]), ticket: await p.evaluate(() => { const d = document.getElementById('discover'); return d && !d.hidden ? d.innerText.replace(/\s+/g, ' ').slice(0, 120) : null; }), errs: errs.slice(0, 3) });
  await T.b.close();
}
