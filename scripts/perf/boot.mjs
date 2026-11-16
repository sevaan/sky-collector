// Startup marks (main.js bt()) on a warm second start, with 2,000 seeded cards like budget.mjs. PERF_URL / PERF_SKY.
import { open, URL0 } from './harness.mjs';
const T = await open('webkit', { at: '2026-11-10T19:40:00-05:00', wx: 'clear' });
const { p, W, hud, seed } = T;
await p.goto(URL0); await W(2500); await seed(2000);
await p.goto(URL0); await hud(); await W(8000);
await p.goto(URL0); const t0 = Date.now(); await hud(); console.log('hud-ready', Date.now() - t0, 'ms');
let prev = 0; for (const [n, t] of await p.evaluate(() => globalThis.__bt ?? [])) { console.log(String(t).padStart(6), `+${t - prev}`.padStart(6), n); prev = t; }
await T.b.close();
