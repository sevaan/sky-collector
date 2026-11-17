// Explore says why the sky is empty (2026-11-17): the relay refused, then answering. PERF_URL / PERF_SKY.
import { fileURLToPath } from 'node:url'; import { mkdirSync } from 'node:fs';
import { open, URL0 } from './harness.mjs';
const DIR = fileURLToPath(new URL('./out/aim/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const T = await open('webkit', { at: '2026-11-10T21:23:00-05:00', wx: 'clear' }); const { p, W, hud, seed } = T;
let down = true; await p.route(/web\.val\.run/, (r) => (down ? r.fulfill({ status: 502, body: 'planes unavailable' }) : r.fallback()));
await p.goto(URL0); await W(2500); await seed(10); await p.evaluate(() => localStorage.setItem('recapWeek', '9e15'));
await p.goto(URL0); await hud(); await W(26000);
const why = () => p.evaluate(() => ({ why: document.getElementById('radar-why')?.hidden ? '' : document.getElementById('radar-why')?.textContent, up: document.getElementById('radar-up').hidden ? '' : document.getElementById('radar-up').textContent, peak: document.getElementById('peak-toggle').hidden }));
console.log('feed refused:', await why()); await p.screenshot({ path: `${DIR}feed-down.png`, clip: { x: 0, y: 0, width: 390, height: 260 } });
down = false; await W(45000); console.log('feed back:', await why());
console.log(await p.evaluate(() => JSON.parse(localStorage.getItem('planeFeedLog') || '[]').slice(-4)));
await T.b.close();
