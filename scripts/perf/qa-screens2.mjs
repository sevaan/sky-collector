// QA 2026-11-17 (Task M): the screens the first pass missed. ARGS: label size.  Writes out/qa/<label>-<size>-<name>.png
//   PERF_URL=http://localhost:8767/ node scripts/perf/qa-screens2.mjs space 390x844
//   PERF_URL=http://localhost:8766/ PERF_SKY=1 node scripts/perf/qa-screens2.mjs sky 390x844
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, URL0, SKY } from './harness.mjs';
const [label = 'app', size = '390x844'] = process.argv.slice(2);
const DIR = fileURLToPath(new URL('./out/qa/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const T = await open('webkit', { at: SKY ? '2026-11-10T13:10:00-05:00' : '2026-11-10T19:40:00-05:00', size, wx: 'clear' });
const { p, W, hud, seed, errs } = T;
const shot = async (n, ms = 700) => { await W(ms); await p.screenshot({ path: `${DIR}${label}-${size}-${n}.png` }); };
const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const clear = async () => { for (let i = 0; i < 3; i++) { await p.evaluate(() => { const r = document.getElementById('recap'); if (r && !r.hidden) r.querySelector('.rc-go')?.click(); document.querySelectorAll('#toasts .ticket__x').forEach((b) => b.click()); }); await W(600); } };
await p.goto(URL0); await W(2500); await seed(300); await p.goto(URL0); await hud(); await W(9000); await clear();
// (a, b) Collection viewer front and back
await click('#nav-collection'); await W(3500); await clear();
const f = p.frames().find((x) => /cards\.html/.test(x.url()));
if (f) {
  await f.locator('.card-tile').first().scrollIntoViewIfNeeded(); await f.locator('.card-tile').first().click({ force: true }); await shot('viewer-front', 1800);
  await f.evaluate(() => { const c = [...document.querySelectorAll('#viewer .card')].find((e) => e.getBoundingClientRect().width > 150 && e.querySelector('.card__back')); c?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }); await shot('viewer-back', 1600);
  await f.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); await W(900);
} else console.log('no cards frame');
await click('#nav-explore'); await W(1500);
// (e) card back picker, (f) How to play
await click('#nav-more'); await W(1200); await clear();
if (await click('#set-back-open')) { await shot('backs', 1500); await p.evaluate(() => { const s = document.querySelector('.set-sheet:not([hidden]) .set-sheet-card'); if (s) { const sc = [...s.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (sc) sc.scrollTop = 9999; } }); await shot('backs-scrolled', 800); await p.keyboard.press('Escape'); await W(800); }
if (await click('#set-howto')) {
  await W(1200);
  for (let i = 1; i <= 12; i++) {
    await shot(`howto-${String(i).padStart(2, '0')}`, 900);
    const more = await p.evaluate(() => { const b = document.getElementById('ht-next'); const t = b?.textContent.trim(); if (!b || !b.offsetParent) return null; const last = /^(done|got it|finish|close|save)/i.test(t); if (!last) b.click(); return last ? 'last:' + t : t; });
    if (!more || String(more).startsWith('last')) { console.log('howto slides', i, more); break; }
    await W(500);
  }
  await p.keyboard.press('Escape'); await W(800);
}
// (c) the reveal after a catch
await p.evaluate(() => document.querySelectorAll('.set-sheet').forEach((s) => s.hidden = true)); await click('[data-close="debug"]'); await W(800); await click('#nav-explore'); await W(1500); await clear();
const aimed = () => p.evaluate(() => { const d = document.getElementById('discover'); const c = document.getElementById('d-cta'); return !!d && !d.hidden && !d.classList.contains('owned') && !!c && c.getBoundingClientRect().width > 0 && !c.hidden; });
let ok = false;
if (SKY) {
  await click('#nav-sky'); await W(2000); await clear();
  for (let k = 0; k < 40 && !ok; k++) { await p.evaluate(({ k }) => { const S = window.__sky; const it = (S.planeItems ?? []).filter((x) => x.el > 8).sort((a, b) => b.el - a.el); const a = it[k % Math.max(1, it.length)]; if (!a) return; S.planeGuide = null; S.drag.on = true; S.drag.az = a.az; S.drag.el = a.el; }, { k }); await W(1300); ok = await aimed(); }
  await click('#nav-explore'); await W(1500); ok = false; for (let i = 0; i < 8 && !ok; i++) { await W(700); ok = await aimed(); }
} else { for (let i = 0; i < 12; i++) { const a = await p.evaluate(() => window.__aim?.()); if (typeof a === 'string') break; await W(1000); } for (let i = 0; i < 10 && !ok; i++) { await W(800); ok = await aimed(); } }
await W(2500); await shot('aimed', 300);
if (ok) {
  await p.evaluate(() => document.getElementById('d-cta').click());
  await shot('reveal-mid', 650); await shot('reveal-mid2', 900); await shot('reveal-done', 4500);
  await p.evaluate(() => { const r = document.getElementById('reveal'); r.scrollTop = 99999; }); await shot('reveal-done-scrolled', 600);
} else console.log('could not aim');
console.log(label, size, errs.slice(0, 3));
await T.b.close();
