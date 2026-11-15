import { webkit } from 'playwright';
const b = await webkit.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:8765/'); await p.evaluate(async () => { localStorage.setItem('fingerChosen', '1');
  const { addSighting } = await import('/js/store.js'); const { cardKeyFor } = await import('/js/card-model.js'); const cat = await (await fetch('/data/catalog.json')).json(); const objs = cat.objects.filter((o) => o.tier).slice(0, 50);
  for (let i = 0; i < 3; i++) { const o = objs[i * 7], t = Date.now() - 86400e3 * (3 - i); await addSighting({ objectId: o.id, cardKey: cardKeyFor(o), name: o.name, type: o.type, time: t, loggedAt: t, lat: 44.3, lon: -78.3, az: 100, el: 40, mag: 3, sim: false }); } });
await p.goto('http://localhost:8765/'); await p.waitForFunction(() => document.body.classList.contains('hud-ready'), null, { timeout: 60000 }); await p.waitForTimeout(12000);
const open = () => p.evaluate(async () => { const gaps = []; let last = performance.now(); document.getElementById('nextpass').click(); for (let i = 0; i < 12; i++) { await new Promise((r) => requestAnimationFrame(r)); const n = performance.now(); gaps.push(Math.round(n - last)); last = n; } return gaps; });
const close = async () => { await p.evaluate(() => document.querySelector('#visible [data-close]').click()); await p.waitForTimeout(900); };
const variants = [['baseline', ''], ['no mini cards on the sky window', '.sw-card'], ['no sky window canvas + stars', '.sw-sky canvas, .sw-sky .starfield'], ['no whole sky window', '#tn-strip'], ['no timeline', '#tn-timeline'], ['no run (tn-run)', '#tn-run'], ['no missions', '#tn-missions'], ['no tonight list', '#tonight-list'], ['no Now tab', '#vtab-now'], ['no sky window + no run', '#tn-strip, #tn-run']];
for (const [label, sel] of variants) {
  await open(); await close(); // warm render within the 45 s cache window
  if (sel) await p.evaluate((sel) => document.querySelectorAll(sel).forEach((n) => n.remove()), sel);
  const g1 = await open(); await close(); const g2 = await open(); await close();
  console.log(label.padEnd(36), 'max frame', Math.max(...g1), '/', Math.max(...g2), ' gaps', JSON.stringify(g1.slice(0, 5)));
  await p.evaluate(() => { try { location.hash = ''; } catch {} });
  await p.reload(); await p.waitForFunction(() => document.body.classList.contains('hud-ready'), null, { timeout: 60000 }); await p.waitForTimeout(9000);
}
await b.close();
