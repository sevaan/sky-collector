// The live test site starts (2026-11-16): a new player sees the opener, a returning one reaches the sky; page errors listed.
import { webkit } from '../../node_modules/playwright/index.mjs';
const b = await webkit.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: { latitude: 43.66, longitude: -79.58 }, permissions: ['geolocation'], serviceWorkers: 'block' });
const p = await ctx.newPage(), errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
const URL0 = 'https://sevaan.github.io/sky-collector/';
await p.goto(URL0); await p.waitForTimeout(8000); await p.screenshot({ path: 'scripts/perf/out/live-new.png' });
await p.evaluate(() => { localStorage.setItem('started', '1'); localStorage.setItem('tourDone', '1'); localStorage.setItem('location', JSON.stringify({ lat: 43.66, lon: -79.58, label: 'Toronto' })); });
await p.goto(URL0); const t0 = Date.now(); const ok = await p.waitForFunction(() => document.body.classList.contains('hud-ready'), null, { timeout: 30000 }).then(() => true, () => false);
await p.waitForTimeout(4000); await p.screenshot({ path: 'scripts/perf/out/live-sky.png' });
console.log({ version: await p.evaluate(() => document.getElementById('set-version')?.textContent?.trim()), hudReady: ok, ms: Date.now() - t0, errs });
await b.close();
