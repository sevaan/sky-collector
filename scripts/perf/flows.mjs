// Click-to-paint latency of the main flows, in WebKit (Safari's engine) and Chromium, with N sightings.
import { chromium, webkit } from 'playwright';
const N = Number(process.argv[2] ?? 1700), eng = process.argv[3] ?? 'webkit';
const b = await (eng === 'webkit' ? webkit : chromium).launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:8765/');
await p.evaluate(async (N) => {
  const { addSighting } = await import('/js/store.js'); const { cardKeyFor, stampKeyFor } = await import('/js/card-model.js');
  const cat = await (await fetch('/data/catalog.json')).json(); const objs = cat.objects.filter((o) => o.tier).slice(0, 4000);
  const t0 = Date.now() - 40 * 86400e3;
  for (let i = 0; i < N; i++) { const o = objs[(i * 7) % objs.length], t = t0 + Math.floor(i / (N / 40)) * 86400e3 + 7200e3 + i * 1000;
    const s = { objectId: o.id, cardKey: cardKeyFor(o), name: o.name, type: o.type, time: t, loggedAt: t, lat: 44.3, lon: -78.3, az: 100, el: 40, mag: 3, sim: false }; const sk = stampKeyFor(o, t); if (sk) s.stampKey = sk; await addSighting(s); }
  localStorage.setItem('fingerChosen', '1');
}, N);
const T0 = Date.now();
await p.goto('http://localhost:8765/');
await p.waitForFunction(() => document.body.classList.contains('hud-ready'), null, { timeout: 60000 });
const boot = Date.now() - T0;
await p.waitForTimeout(12000); // let the plan + collection preload settle
// latency: time from the click until two frames have painted after it
const lat = async (label, fn) => { const r = await p.evaluate(async (fn) => { const a = performance.now(); (0, eval)(fn)(); const t1 = await new Promise((r) => requestAnimationFrame(() => r(performance.now()))); const t2 = await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))); return [Math.round(t1 - a), Math.round(t2 - a)]; }, fn); console.log(`${label.padEnd(34)} first frame ${String(r[0]).padStart(5)} ms   second ${String(r[1]).padStart(5)} ms`); await p.waitForTimeout(1500); return r; };
console.log(`== ${eng} N=${N}  boot to hud-ready ${boot} ms`);
await lat('open radar (Now)', "() => document.getElementById('radar').click()");
await lat('tab: Tonight', "() => (document.querySelector('[data-vtab=\"tonight\"], #vt-tonight, .vtab-tonight') ?? document.querySelector('#visible [role=tab]:last-child') ?? document.getElementById('sky-tonight-head'))?.click()");
await lat('close panel', "() => document.querySelector('#visible [data-close]').click()");
await lat('next-pass chip → Tonight', "() => document.getElementById('nextpass').click()");
await lat('close panel again', "() => document.querySelector('#visible [data-close]').click()");
await lat('next-pass chip again (warm)', "() => document.getElementById('nextpass').click()");
await lat('tap first pass row', "() => (document.querySelector('#tonight-list .b-row .b-face, #tn-run .run-row, #tonight-list .tn-pass, #tonight-list button') )?.click()");
await lat('close card/panel', "() => (document.querySelector('#reveal:not([hidden]) .x-close') ?? document.querySelector('#visible [data-close]'))?.click()");
await lat('switcher → Collection', "() => document.querySelector('.sc-switch__item:last-child, .sc-switch [data-side=right], #nav .sc-switch__item:nth-child(2)')?.click()");
await p.waitForTimeout(2500);
await lat('switcher → Explore', "() => document.querySelector('.sc-switch__item:first-child')?.click()");
await b.close();
