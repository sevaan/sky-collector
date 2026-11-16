// The pack screen in Sky (2026-11-16): opens a gift pack and the first-run opener, screenshots both, and two frames of
// the gift pack a few seconds apart to show the clouds drift. PERF_URL / PERF_SKY as budget.mjs.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, URL0 } from './harness.mjs';
const DIR = fileURLToPath(new URL('./out/pack/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const T = await open('webkit', { at: '2026-11-10T13:10:00-05:00', size: '390x844', wx: 'clear' });
const { p, W, hud, seed, errs } = T;
await p.goto(URL0); await W(2500); await seed(40); await p.goto(URL0); await hud(); await W(4000);
await p.evaluate(async () => { const { playPack } = await import('/js/gift-pack.js'); window.__pk = playPack({ kicker: 'Cards for you', from: 'a friend', count: 3, newCount: 3, highlights: [], tiles: [], tail: [], stats: [], tierColor: () => '#0d2238', renderCard: () => document.createElement('div'), rowHtml: () => '', artImage: () => '' }); });
await W(1500); await p.screenshot({ path: `${DIR}gift-a.png` });
await W(6000); await p.screenshot({ path: `${DIR}gift-b.png` });
console.log(await p.evaluate(() => ({ clouds: document.querySelectorAll('#gift .gp-cl .wx-layer').length, imgs: document.querySelectorAll('#gift .gp-cl img').length, mask: getComputedStyle(document.querySelector('#gift .gp-art')).webkitMaskImage?.slice(0, 80) })));
console.log(errs.slice(0, 4)); await T.b.close();
