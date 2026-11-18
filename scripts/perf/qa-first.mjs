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
console.log(await p.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => `${b.id || b.className}:${b.textContent.trim().slice(0, 30)}`)));
await T.b.close();
