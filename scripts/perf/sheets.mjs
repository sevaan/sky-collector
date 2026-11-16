// Targeted screenshots of Sky's sheets (2026-11-16 screen check). PERF_URL / PERF_SKY; arg: label.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const label = process.argv[2] || 'app', DIR = fileURLToPath(new URL('./out/sheets/', import.meta.url)); mkdirSync(DIR, { recursive: true });
for (const [when, at] of [['day', '2026-11-10T13:10:00-05:00'], ['eve', '2026-11-10T19:40:00-05:00']]) {
  const T = await open('webkit', { at, wx: 'partial' }); const { p, W, hud, seed } = T;
  const shot = async (n) => { await W(1000); await p.screenshot({ path: `${DIR}${label}-${when}-${n}.png` }); };
  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return false; e.click(); return true; }, sel);
  const closeAll = async () => { for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await W(400); } };
  await p.goto(URL0); await W(2500); await seed(300); await p.evaluate(() => localStorage.setItem('recapWeek', '9e15'));
  await p.goto(URL0); await hud(); await W(6000); await closeAll();
  await shot('explore');
  await click('#nav-sky'); await W(1500); await shot('today'); await click('#nav-explore'); await W(1200);
  await click('#nav-collection'); await W(3500); await shot('collection'); await click('#nav-explore'); await W(1500);
  await click('#nav-more'); await shot('settings');
  if (await click('#set-plus-open')) { await shot('plus'); await closeAll(); await click('#nav-more'); }
  if (await click('#set-howto')) { await shot('howto'); await closeAll(); }
  await closeAll();
  await p.evaluate(() => localStorage.removeItem('recapWeek')); await p.goto(URL0); await hud(); await W(6000); await shot('recap');
  await T.b.close();
}
