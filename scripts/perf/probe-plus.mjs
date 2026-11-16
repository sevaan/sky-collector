import { open, URL0 } from './harness.mjs';
const T = await open('webkit', { at: '2026-11-10T19:40:00-05:00', wx: 'clear' }); const { p, W, hud, seed } = T;
await p.goto(URL0); await W(2500); await seed(50); await p.goto(URL0); await hud(); await W(3000);
await p.keyboard.press('Escape'); await W(500);
await p.evaluate(() => document.getElementById('nav-more').click()); await W(1200);
console.log(await p.evaluate(() => { const x = document.querySelector('#debug .x-close'); const cs = getComputedStyle(x); return { x: x.outerHTML.slice(0, 200), color: cs.color, svg: x.querySelector('svg') ? getComputedStyle(x.querySelector('svg')).stroke : null }; }));
await p.evaluate(() => document.getElementById('set-plus-open').click()); await W(1200);
console.log(await p.evaluate(() => { const out = []; const card = document.querySelector('#set-plus-sheet .set-sheet-card'); for (const e of card.querySelectorAll('*')) { const b = getComputedStyle(e).backgroundColor; if (/rgb\((\d+), (\d+), (\d+)\)/.test(b)) { const [r, g, bb] = b.match(/\d+/g).map(Number); if (r + g + bb < 150) out.push(`${e.tagName}.${[...e.classList].join('.')}#${e.id} ${b}`); } } const lead = card.querySelector('#plus-body, .plus-body, p'); return { dark: [...new Set(out)].slice(0, 12), lead: lead && `${lead.id}.${lead.className} ${getComputedStyle(lead).color}`, x: getComputedStyle(document.querySelector('#plus-x')).color }; }));
await T.b.close();
