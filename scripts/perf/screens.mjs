// Side-by-side screens (2026-11-16, rebuild check): the same screens from Space Collector's base and Sky Collector, at
// 390x844 and 320x640, by day and in the evening, with a seeded collection. Run with PERF_URL / PERF_SKY like budget.mjs:
//   PERF_URL=http://localhost:8767/ node scripts/perf/screens.mjs space
//   PERF_URL=http://localhost:8766/ PERF_SKY=1 node scripts/perf/screens.mjs sky
// Writes scripts/perf/out/screens/<label>-<size>-<when>-<screen>.png
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';

const label = process.argv[2] || 'app', DIR = fileURLToPath(new URL('./out/screens/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const WHEN = { day: '2026-11-10T13:10:00-05:00', eve: '2026-11-10T19:40:00-05:00' };
const SIZES = (process.env.SIZES || '390x844,320x640').split(',');

async function run(size, when) {
  const T = await open('webkit', { at: WHEN[when], size, wx: 'clear' });
  const { p, W, hud, seed, errs } = T;
  const shot = async (name) => { await W(900); await p.screenshot({ path: `${DIR}${label}-${size}-${when}-${name}.png` }); };
  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  const esc = async () => { await p.keyboard.press('Escape'); await W(700); };
  await p.goto(URL0); await W(2500); await seed(300);
  await p.goto(URL0); await hud(); await W(9000);
  await shot('01-explore');
  if (await click('#nav-sky')) { await W(1500); await shot('02-today'); await p.evaluate(() => { const s = document.querySelector('#sky-tonight, #tonight, .tn-scroll, [data-page="sky"] .panel-scroll') ?? document.scrollingElement; s.scrollTop += 700; }); await shot('03-today-scrolled'); }
  if (await click('#nav-collection')) {
    await W(3500); await shot('04-collection');
    const f = p.frames().find((x) => /cards\.html/.test(x.url()));
    if (f) {
      await f.evaluate(() => document.querySelector('.card-tile')?.click()); await W(1800); await shot('05-viewer');
      await f.evaluate(() => { const c = [...document.querySelectorAll('.card')].find((e) => e.getBoundingClientRect().width > 150 && e.querySelector('.card__back')); c?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }); await W(1600); await shot('06-viewer-back');
      await f.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); await W(800);
    }
    await click('#nav-explore'); await W(1500);
  }
  if (await click('#nav-more')) {
    await W(1200); await shot('07-settings');
    if (await click('#set-back-open')) { await W(1200); await shot('08-backs'); await esc(); }
    if (await click('#set-plus-open')) { await W(1200); await shot('09-plus'); await esc(); }
    if (await click('#set-howto')) { await W(1200); await shot('10-howto'); await esc(); }
    await esc();
  }
  if (await click('#recap, [data-act="recap"], .recap-chip')) { await W(1500); await shot('11-recap'); await esc(); }
  console.log(label, size, when, errs.length ? errs.slice(0, 3) : 'no page errors');
  await T.b.close();
}

async function firstRun(size) {
  const T = await open('webkit', { at: WHEN.day, size, wx: 'clear', returning: false });
  const { p, W } = T;
  await p.goto(URL0); await W(9000); await p.screenshot({ path: `${DIR}${label}-${size}-first-0.png` });
  for (let i = 1; i <= 4; i++) { await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(next|continue|let’s go|start|got it|ok)/i.test(e.textContent.trim())); b?.click(); }); await W(1500); await p.screenshot({ path: `${DIR}${label}-${size}-first-${i}.png` }); }
  await T.b.close();
}

for (const size of SIZES) { for (const when of ['day', 'eve']) await run(size, when); await firstRun(size); }
