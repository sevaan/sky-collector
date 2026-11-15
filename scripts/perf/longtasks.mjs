import { chromium } from 'playwright';
const N = Number(process.argv[2] ?? 1700);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
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
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.addInitScript(() => { window.__lt = []; const t0 = performance.timeOrigin; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration), (e.attribution?.[0]?.containerSrc || e.attribution?.[0]?.containerType || e.name)]))).observe({ type: 'longtask', buffered: true }); } catch {} });
await p.goto('http://localhost:8765/'); await p.waitForTimeout(30000);
const top = await p.evaluate(() => window.__lt);
const fr = p.frames().find((f) => f.url().includes('cards.html'));
const inFrame = fr ? await fr.evaluate(() => window.__lt ?? null) : null;
console.log('N', N, 'top-level long tasks (start ms, dur ms, who):'); console.log(JSON.stringify(top));
console.log('frame long tasks:', JSON.stringify(inFrame));
// simulate the after-catch refresh
await p.evaluate(() => { window.__lt.length = 0; const f = document.getElementById('collection-frame'); f?.contentWindow?.postMessage({ sc: 'refresh' }, location.origin); });
await p.waitForTimeout(6000);
console.log('after refresh message, top-level:', JSON.stringify(await p.evaluate(() => window.__lt)));
await b.close();
