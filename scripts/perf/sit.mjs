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
await p.goto('http://localhost:8765/'); await p.waitForTimeout(22000);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await p.waitForTimeout(8000);
const { profile } = await cdp.send('Profiler.stop');
const dt = profile.timeDeltas, byId = new Map(profile.nodes.map((n) => [n.id, n])), kids = new Map(profile.nodes.map((n) => [n.id, n.children || []]));
const selfT = new Map(); profile.samples.forEach((id, i) => selfT.set(id, (selfT.get(id) ?? 0) + (dt[i] ?? 0) / 1000));
const incl = new Map(), self = new Map(); const key = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`;
const tot = (id, stack) => { const n = byId.get(id); let t = selfT.get(id) ?? 0; const k = key(n); for (const c of kids.get(id)) t += tot(c, stack.concat(k)); if (n.callFrame.url.includes('/js/') && !stack.includes(k)) incl.set(k, (incl.get(k) ?? 0) + t); self.set(k, (self.get(k) ?? 0) + (selfT.get(id) ?? 0)); return t; };
tot(profile.nodes[0].id, []);
console.log('N', N, 'INCLUSIVE ms over 8 s idle (4x throttle)'); console.log([...incl].sort((a, b) => b[1] - a[1]).slice(0, 28).map(([k, v]) => `${v.toFixed(0).padStart(6)}  ${k}`).join('\n'));
console.log('SELF'); console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${v.toFixed(0).padStart(6)}  ${k}`).join('\n'));
await b.close();
