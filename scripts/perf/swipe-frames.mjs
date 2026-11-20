// Ten sideways swipes in the card viewer (2026-11-20, Sevaan: "if I view a card and swipe sideways between cards the
// animation is janky. It's much more responsive in space collector"). Opens cards.html directly, seeds ~20 cards, opens
// the first tile, then swipes left ten times. Chromium: real touch (CDP) at 4x CPU; WebKit: mouse pointer events.
//   node scripts/perf/swipe-frames.mjs sky|space [chromium|webkit] [cpu=4]
//   SKY_URL (default http://localhost:8781/cards.html?sky), SPACE_URL (default http://localhost:8782/cards.html)
// Reports frames over 20 ms, the longest frame, and finger-down -> first frame with the card moved (median / max).
import { chromium, webkit } from '../../node_modules/playwright/index.mjs';
const app = process.argv[2] || 'sky', eng = process.argv[3] || 'chromium', cpu = +(process.argv[4] ?? 4), SWIPES = 10;
const url = app === 'sky' ? (process.env.SKY_URL || 'http://localhost:8781/cards.html?sky') : (process.env.SPACE_URL || 'http://localhost:8782/cards.html');
const origin = new URL(url).origin;
const b = await (eng === 'webkit' ? webkit : chromium).launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: eng !== 'webkit', serviceWorkers: 'block', geolocation: { latitude: 43.66, longitude: -79.58 }, permissions: ['geolocation'] });
await ctx.addInitScript(() => { for (const [k, v] of [['started', '1'], ['tourDone', '1'], ['fingerChosen', '1'], ['radarTip', '1']]) if (!localStorage.getItem(k)) localStorage.setItem(k, v); });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
const W = (ms) => p.waitForTimeout(ms);
await p.goto(url); await W(1500);
const ver = (await (await fetch(origin + '/version.json')).json()).version;
const n = await p.evaluate(async ({ app, ver }) => {
  const { addSightings } = await import(`/js/store.js?v=${ver}`);
  if (app === 'sky') {
    const { cardsFor } = await import(`/js/flights.js?v=${ver}`); const { catchSightings } = await import(`/js/sky-cards.js?v=${ver}`);
    const AP = [['CYYZ', 'Toronto', 'CA', 43.68, -79.63], ['KJFK', 'New York', 'US', 40.64, -73.78], ['EGLL', 'London', 'GB', 51.47, -0.45], ['LFPG', 'Paris', 'FR', 49.01, 2.55], ['CYVR', 'Vancouver', 'CA', 49.19, -123.18], ['KLAX', 'Los Angeles', 'US', 33.94, -118.41]].map(([icao, city, cc, lat, lon]) => ({ icao, iata: icao.slice(1), city, cc, lat, lon, name: city }));
    const P = [['c0ffee', 'ACA101', 'C-FGKP', 'B38M'], ['c0ffe1', 'WJA455', 'C-GWSZ', 'B737'], ['abc123', 'DAL22', 'N123DL', 'A321'], ['abc124', 'UAL900', 'N77012', 'B77W'], ['4006a1', 'BAW92', 'G-XWBA', 'A35K'], ['3944e1', 'AFR356', 'F-HPJA', 'A388'], ['abc125', 'AAL1', 'N101NN', 'A21N'], ['c0ffe2', 'JZA8100', 'C-GKQC', 'DH8D'], ['abc126', 'N172SP', 'N172SP', 'C172'], ['c0ffe3', 'POE231', 'C-FPKT', 'DH8D']];
    const list = [], t0 = Date.now() - 5 * 86400e3;
    P.forEach(([hex, cs, reg, type], i) => { const from = AP[i % AP.length], to = AP[(i + 2) % AP.length]; const pl = { hex, callsign: cs, reg, type, desc: '', category: 'A3' }; const { flight, plane } = cardsFor(pl, { from, to, callsign: cs }, ''); const t = t0 + i * 3600e3; list.push(...catchSightings({ time: t, hex, callsign: cs, reg, type, altFt: 30000, gsKt: 450, rangeKm: 20, lat: 43.66, lon: -79.58, flight, plane }).map((s) => ({ ...s, loggedAt: t, sim: false }))); });
    await addSightings(list); return list.length;
  }
  const { cardKeyFor, stampKeyFor } = await import(`/js/card-model.js?v=${ver}`); const cat = await (await fetch('/data/catalog.json')).json(); const objs = cat.objects.filter((o) => o.tier); const list = [], t0 = Date.now() - 5 * 86400e3;
  for (let i = 0; i < 20; i++) { const o = objs[(i * 13) % objs.length], t = t0 + i * 3600e3; const s = { objectId: o.id, cardKey: cardKeyFor(o), name: o.name, type: o.type, time: t, loggedAt: t, lat: 44.3, lon: -78.3, az: 100, el: 40, mag: 3, sim: false }; const sk = stampKeyFor(o, t); if (sk) s.stampKey = sk; list.push(s); }
  await addSightings(list); return list.length;
}, { app, ver });
await p.reload(); await W(3000);
const tiles = await p.$$('.tile-slot .card-tile'); if (!tiles.length) { console.log('no tiles'); process.exit(2); }
await tiles[0].tap(); await W(2500);
if (!(await p.evaluate(() => document.getElementById('viewer')?.open))) { console.log('viewer did not open'); process.exit(2); }
await p.evaluate(() => {
  window.__fr = []; const loop = (t) => { window.__fr.push(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  window.__dn = []; window.__mv = []; const slot = document.getElementById('slot'); let waiting = false;
  slot.addEventListener('pointerdown', (e) => { window.__dn.push(e.timeStamp); waiting = true; }, true);
  const watch = (t) => { if (waiting && slot.style.transform) { waiting = false; window.__mv.push(t); } requestAnimationFrame(watch); }; requestAnimationFrame(watch);
  window.__lt = []; try { new PerformanceObserver((l) => { for (const x of l.getEntries()) window.__lt.push(Math.round(x.duration)); }).observe({ type: 'longtask' }); } catch {}
});
const cdp = eng === 'chromium' ? await ctx.newCDPSession(p) : null;
if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
const touch = cdp ? (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] }) : null;
const drag = async (x0, y0, x1, y1, steps = 10) => {
  if (touch) { await touch('touchStart', x0, y0); for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await W(16); } await touch('touchEnd'); }
  else { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= steps; i++) { await p.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await W(16); } await p.mouse.up(); } };
const TRACE = process.env.TRACE; if (TRACE && eng === 'chromium') await b.startTracing(p, { path: TRACE, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'viz', 'blink', 'disabled-by-default-devtools.timeline.frame'] });
if (process.env.PROBE && cdp) { // which composited layers repaint while the finger drags the card (paint counts before/after one drag)
  if (process.env.CSS) await p.addStyleTag({ content: process.env.CSS });
  await cdp.send('DOM.enable'); await cdp.send('LayerTree.enable'); let layers = []; cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) layers = e.layers; });
  await p.evaluate(() => { window.__os = []; const c = document.getElementById('slot').firstElementChild; new MutationObserver(() => window.__os.push(c.style.getPropertyValue('--o'))).observe(c, { attributes: true, attributeFilter: ['style'] }); });
  await W(1500); const before = new Map(layers.map((l) => [l.layerId, l.paintCount ?? 0]));
  await touch('touchStart', 320, 420); for (let i = 1; i <= 12; i++) { await touch('touchMove', 320 - i * 15, 422); await W(30); } await W(200);
  let tot = 0; console.log('card style writes during drag:', await p.evaluate(() => window.__os.length + ' --o: ' + window.__os.filter((x, i, a) => x !== a[i - 1]).slice(0, 12).join(' ')));
  for (const l of layers) { const d = (l.paintCount ?? 0) - (before.get(l.layerId) ?? 0); if (d < 2) continue; let why = []; try { why = (await cdp.send('LayerTree.compositingReasons', { layerId: l.layerId })).compositingReasonIds; } catch {} let desc = ''; if (l.backendNodeId) { try { const n = (await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId })).node; const a = n.attributes ?? []; desc = n.localName + '.' + (a[a.indexOf('class') + 1] ?? ''); } catch {} } tot += d * l.width * l.height; console.log(`repaints ${String(d).padStart(3)}  ${Math.round(l.width)}x${Math.round(l.height)} ${desc.slice(0, 60)} [${why.join(',')}]`); }
  console.log(`layers ${layers.length}, repainted px over 12 moves: ${(tot / 1e6).toFixed(1)} M (CSS px)`);
  await touch('touchEnd'); await b.close(); process.exit(0); }
const f0 = await p.evaluate(() => window.__fr.length);
if (process.env.CSS) await p.addStyleTag({ content: process.env.CSS });
for (let i = 0; i < SWIPES; i++) { if (process.env.IDLE) await W(1100); else await drag(320, 420, 70, 430); await W(900); }
if (TRACE && eng === 'chromium') await b.stopTracing();
if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const r = await p.evaluate((f0) => { const f = window.__fr.slice(f0), g = []; for (let i = 1; i < f.length; i++) g.push(f[i] - f[i - 1]); const lat = window.__mv.map((t, i) => t - window.__dn[i]).sort((a, b) => a - b); return { frames: g.length, over20: g.filter((x) => x > 20).length, longest: Math.round(Math.max(...g)), top: [...g].sort((a, b) => b - a).slice(0, 8).map(Math.round), latMed: Math.round(lat[lat.length >> 1]), latMax: Math.round(lat.at(-1)), swipes: lat.length, lt: window.__lt, pos: document.getElementById('v-position')?.textContent, nodes: document.getElementById('slot').querySelectorAll('*').length }; }, f0);
console.log(`${app} ${eng} cpu${cdp ? cpu : 1}x  seeded ${n}  frames ${r.frames}  >20ms ${r.over20}  longest ${r.longest}  top ${r.top.join(',')}  down->move med ${r.latMed} max ${r.latMax} (${r.swipes})  longtasks ${r.lt.length ? r.lt.join(',') : 'none'}  pos ${r.pos}  slot nodes ${r.nodes}  errors ${errs.length ? errs.slice(0, 2).join(' | ') : 'none'}`);
await drag(200, 600, 205, 180, 6); await W(1500); console.log('flick up closes the viewer:', !(await p.evaluate(() => document.getElementById('viewer')?.open)));
await b.close();
