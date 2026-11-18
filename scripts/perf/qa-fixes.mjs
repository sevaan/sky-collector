// Checks the QA fixes of 2026-11-17: the day ticket, the card back picker (scrolls), How to play, the welcome card at 320.
import { mkdirSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const DIR = fileURLToPath(new URL('./out/fixes/', import.meta.url)); mkdirSync(DIR, { recursive: true });
{ const T = await open('webkit', { at: '2026-11-10T13:10:00-05:00', wx: 'clear' }); const { p, W, hud, seed } = T;
  await p.goto(URL0); await W(2500); await seed(40); await p.goto(URL0); await hud(); await W(9000);
  await p.evaluate(() => { document.querySelector('#recap:not([hidden]) .rc-go')?.click(); document.querySelectorAll('#toasts .ticket__x').forEach((x) => x.click()); }); await W(800);
  for (let k = 0; k < 12; k++) { await p.evaluate((k) => { const S = window.__sky, it = (S.planeItems ?? []).filter((x) => x.el > 8).sort((a, b) => b.el - a.el), a = it[k % Math.max(1, it.length)]; if (!a) return; S.planeGuide = null; S.drag.on = true; S.drag.az = a.az; S.drag.el = a.el; }, k); await W(1400); if (await p.evaluate(() => { const d = document.getElementById('discover'); return d && !d.hidden; })) break; }
  await p.screenshot({ path: `${DIR}ticket-day.png` });
  await p.evaluate(() => document.getElementById('nav-more').click()); await W(1000); await p.evaluate(() => document.getElementById('set-back-open').click()); await W(1200);
  console.log('backs sheet:', await p.evaluate(() => { const c = document.querySelector('#set-back-sheet .set-sheet-card'), r = c.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), scrollable: c.scrollHeight > c.clientHeight, vh: innerHeight }; }));
  await p.screenshot({ path: `${DIR}backs.png` }); await p.keyboard.press('Escape'); await W(600);
  await p.evaluate(() => document.getElementById('set-howto').click()); await W(1200);
  for (let i = 0; i < 3; i++) { await p.screenshot({ path: `${DIR}howto-${i}.png`, clip: { x: 0, y: 380, width: 390, height: 464 } }); await p.evaluate(() => document.getElementById('ht-next').click()); await W(700); }
  await T.b.close(); }
{ const T = await open('webkit', { at: '2026-11-10T13:10:00-05:00', wx: 'clear', size: '320x640', returning: false }); const { p, W } = T;
  await p.goto(URL0); await W(9000); await p.keyboard.press('Enter'); await W(4500); await p.screenshot({ path: `${DIR}welcome-320.png` }); await T.b.close(); }
