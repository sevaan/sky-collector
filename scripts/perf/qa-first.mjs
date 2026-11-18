// QA 2026-11-17: first-run flow screenshots (sealed pack, tear, welcome card, each tour step). ARGS: label size
//   PERF_URL=http://localhost:8766/ PERF_SKY=1 node scripts/perf/qa-first.mjs sky 390x844
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const [label = 'app', size = '390x844'] = process.argv.slice(2);
const DIR = fileURLToPath(new URL('./out/qa/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const T = await open('webkit', { at: '2026-11-10T13:10:00-05:00', size, wx: 'clear', returning: false });
const { p, W, errs } = T;
const shot = async (n) => { await W(600); await p.screenshot({ path: `${DIR}${label}-${size}-first-${n}.png` }); };
await p.goto(URL0); await W(4500); await shot('0-pack');
await p.keyboard.press('Enter'); await W(1200); await shot('1-tearing');
await W(5000); await shot('2-welcome');
await p.evaluate(() => document.getElementById('btn-start').click()); await W(2500);
for (let i = 1; i <= 6; i++) {
  const has = await p.evaluate(() => [...document.querySelectorAll('#ob-deck button.yes')].some((b) => b.offsetParent));
  if (!has) break;
  await shot(`3-tour${i}`);
  const act = await p.evaluate(() => { const bs = [...document.querySelectorAll('#ob-deck button.yes')].filter((b) => b.offsetParent); const b = bs.at(-1); const t = b.textContent.trim(); b.click(); return t; });
  console.log('step', i, 'clicked', act); await W(3000);
}
await shot('4-after-tour');
console.log(errs.slice(0,3));
await T.b.close();
