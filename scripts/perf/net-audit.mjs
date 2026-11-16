// Every host Sky talks to (2026-11-16, Sevaan: "make sure testing this doesn't affect my Space Collector stats"): a
// session through Explore, Today, Collection, Settings and Plus, listing each outside host and the paths it was sent.
import { open, URL0 } from './harness.mjs';
const T = await open('webkit', { at: '2026-11-10T13:10:00-05:00', wx: 'clear' }); const { p, W, hud, seed } = T;
const hosts = new Map(); p.on('request', (r) => { const u = new URL(r.url()); if (/^(localhost|127\.)/.test(u.hostname) || u.protocol === 'data:') return; const k = u.hostname; if (!hosts.has(k)) hosts.set(k, new Set()); hosts.get(k).add(`${r.method()} ${u.pathname.slice(0, 40)}`); });
for (const f of p.frames()) void f;
await p.goto(URL0); await W(2500); await seed(60); await p.goto(URL0); await hud(); await W(8000);
const click = (s) => p.evaluate((x) => document.querySelector(x)?.click(), s);
await click('#recap:not([hidden]) .rc-go'); await W(600);
for (const s of ['#nav-sky', '#nav-collection', '#nav-explore', '#nav-more', '#set-plus-open']) { await click(s); await W(2500); }
await p.keyboard.press('Escape'); await W(500); await p.keyboard.press('Escape'); await W(500);
console.log(JSON.stringify(Object.fromEntries([...hosts].map(([k, v]) => [k, [...v].slice(0, 6)])), null, 1));
await T.b.close();
