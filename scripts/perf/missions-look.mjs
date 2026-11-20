// Sky's missions, round 2 (2026-11-20, design/missions-draft.md): Today's mission cards, the rank card's missions and
// challenge, and the Patches wall's new patches and week badges, at 360 and 430 px. Testing tools on (harness: dev=1),
// so every run marks itself as a test. Saves to design/missions-shots/.
//   PERF_URL=http://localhost:8781/ PERF_SKY=1 node scripts/perf/missions-look.mjs
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const DIR = fileURLToPath(new URL('../../design/missions-shots/', import.meta.url)); mkdirSync(DIR, { recursive: true });
// the longest words the deal can show, then whatever the app deals itself
const DEALS = { long: ['newtype', 'continent', 'three10:3', 'ch:moreaircraft'], long2: ['oldtype', 'bands', 'quick', 'ch:livery2'], own: null };
const ONLY = process.env.ONLY; /* one deal's name, for a quick look */
for (const w of [360, 430]) for (const [name, ids] of Object.entries(DEALS)) { if (ONLY && name !== ONLY) continue;
  const T = await open('webkit', { at: '2026-11-25T13:10:00-05:00', wx: 'clear', size: `${w}x${Math.round(w * 2.16)}` }); const { p, W, hud, seed, errs } = T;
  await p.goto(URL0); await W(2500); await seed(60);
  await p.evaluate(async (ids) => { localStorage.setItem('dev', '1'); localStorage.setItem('lbOpen', '1'); /* the rank card open on its missions */ localStorage.removeItem('missionDeals'); if (!ids) return; const { nightKey, useCalendarDays } = await import('/js/observation.js'); useCalendarDays(true); localStorage.setItem('missionDeals', JSON.stringify({ [nightKey(Date.now())]: ids })); }, ids);
  await p.goto(URL0); await hud(); await W(4000);
  await p.evaluate(() => { document.querySelector('#recap:not([hidden]) .rc-go')?.click(); document.querySelectorAll('#toasts .ticket__x').forEach((x) => x.click()); }); await W(600);
  await p.evaluate(() => document.getElementById('nav-sky').click()); await W(3500);
  await p.evaluate(() => document.querySelectorAll('#toasts .ticket__x').forEach((x) => x.click())); await W(500);
  const deal = await p.evaluate(() => localStorage.getItem('missionDeals'));
  await p.evaluate(() => { const m = document.getElementById('sky-missions'); if (m) { m.scrollIntoView({ block: 'center' }); m.querySelectorAll('.mc.sealed').forEach((c) => c.classList.remove('sealed')); } }); await W(2500);
  await p.screenshot({ path: `${DIR}today-${name}-${w}.png` });
  await p.evaluate(() => document.getElementById('nav-collection').click()); await W(4500);
  await p.evaluate(() => document.querySelectorAll('#toasts .ticket__x').forEach((x) => x.click())); await W(500);
  const f = p.frames().find((x) => /cards\.html/.test(x.url()));
  if (f) {
    await f.evaluate(() => document.querySelector('.lb-mission')?.scrollIntoView({ block: 'center' })); await W(700);
    await p.screenshot({ path: `${DIR}rank-missions-${name}-${w}.png` });
    if (name === 'long') {
      await f.locator('#tab-patches').click(); await W(2000);
      for (const g of ['history', 'week', 'sky', 'collect']) { await f.evaluate((g) => document.querySelector(`.pw-chip[data-g="${g}"]`)?.click(), g); await W(1200); await f.evaluate(() => { const c = document.querySelector('.pw-chips'); if (c) window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 70); }); await W(900); await p.screenshot({ path: `${DIR}patches-${g}-${w}.png` }); }
      const over = await f.evaluate(() => [...document.querySelectorAll('#patch-wall *')].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible' && e.children.length === 0).length);
      console.log(w, 'patch wall leaf overflows:', over);
    }
  }
  console.log(w, name, deal, errs.slice(0, 3));
  await T.b.close();
}
