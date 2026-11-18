// Perf harness (from the 2026-11-10 performance pass): opens Space Collector with in-page instrumentation that works in WebKit AND Chromium.
// - Date-only time shift (Playwright's clock.install fakes rAF/performance too, which makes frame timing meaningless)
// - every setTimeout/setInterval/rAF/rIC callback timed and attributed to its registration site (js/file:line)
// - a frame recorder (rAF timestamps), longtask observer (Chromium), body/#start class transition times
import { chromium, webkit } from '../../node_modules/playwright/index.mjs';
export const OUT = new URL('./out', import.meta.url).pathname; // git-ignored
// Sky Collector (2026-11-16): PERF_URL picks the server (the Space Collector base on :8767, Sky on :8766), and PERF_SKY=1
// runs the Sky pass: Toronto Pearson as the place, a recorded plane feed (fixtures/planes-yyz.json, its clock moved to the
// shifted time) instead of the live relay, and plane cards seeded instead of satellites.
export const URL0 = process.env.PERF_URL || 'http://localhost:8765/';
export const SKY = process.env.PERF_SKY === '1';
import { readFileSync } from 'node:fs';
const FEED = SKY ? JSON.parse(readFileSync(new URL('./fixtures/planes-yyz.json', import.meta.url))) : null;

const instr = ({ at, attrib }) => {
  if (at) {
    const RD = Date, OFF = at - RD.now();
    function D(...a) { if (!new.target) return new RD(RD.now() + OFF).toString(); return a.length ? new RD(...a) : new RD(RD.now() + OFF); }
    D.prototype = RD.prototype; D.now = () => RD.now() + OFF; D.UTC = RD.UTC; D.parse = RD.parse; Object.setPrototypeOf(D, RD);
    globalThis.Date = D;
  }
  const P = performance, now = () => P.now();
  const S = new Map(); window.__cb = S; window.__long = []; window.__cbOn = true;
  const site = () => { const s = new Error().stack || ''; for (const l of s.split('\n')) { const m = l.match(/\/(js\/[\w.-]+?|cards\.html|index\.html)(?:\?v=[\d.]+)?:(\d+)/); if (m) return m[1].replace('js/', '') + ':' + m[2]; } return /web-inspector|__playwright|utilityScript/.test(s) ? 'harness' : '?' + s.split('\n').slice(2, 5).map((l) => l.trim().replace(/https?:\/\/[^/]+\//, '').slice(0, 50)).join(' < '); }; /* 'harness': Playwright's own injected code, not the app */
  const cache = new WeakMap();
  const wrap = (kind, fn) => {
    if (!attrib || typeof fn !== 'function') return fn;
    let k = cache.get(fn); if (!k) { k = kind + ' ' + site(); cache.set(fn, k); }
    return function (...a) { const t = now(); try { return fn.apply(this, a); } finally { const d = now() - t; let s = S.get(k); if (!s) S.set(k, s = { n: 0, t: 0, max: 0, over16: 0 }); s.n++; s.t += d; if (d > s.max) s.max = d; if (d > 16) s.over16++; if (d > 6) { window.__long.push([t, d, k]); if (window.__long.length > 5000) window.__long.splice(0, 2500); } } };
  };
  const oST = setTimeout, oSI = setInterval, oRAF = requestAnimationFrame, oRIC = window.requestIdleCallback;
  window.setTimeout = function (f, ...r) { return oST.call(this, wrap('timeout', f), ...r); };
  window.setInterval = function (f, ...r) { return oSI.call(this, wrap('interval', f), ...r); };
  window.requestAnimationFrame = function (f) { return oRAF.call(this, wrap('raf', f)); };
  if (oRIC) window.requestIdleCallback = function (f, o) { return oRIC.call(this, wrap('idle', f), o); };
  if (attrib) {
    const wm = new WeakMap(); const oAdd = EventTarget.prototype.addEventListener, oRem = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, o) { if (typeof fn !== 'function') return oAdd.call(this, type, fn, o); let m = wm.get(fn); if (!m) { m = new Map(); wm.set(fn, m); } let w = m.get(type); if (!w) { w = wrap('ev:' + type, fn); m.set(type, w); } return oAdd.call(this, type, w, o); };
    EventTarget.prototype.removeEventListener = function (type, fn, o) { const w = typeof fn === 'function' ? wm.get(fn)?.get(type) : null; return oRem.call(this, type, w ?? fn, o); };
    for (const k of ['onmessage']) { const d = Object.getOwnPropertyDescriptor(Worker.prototype, k) ?? Object.getOwnPropertyDescriptor(EventTarget.prototype, k); }
    const wd = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage'); if (wd?.set) Object.defineProperty(Worker.prototype, 'onmessage', { ...wd, set(f) { wd.set.call(this, wrap('worker.onmessage', f)); } });
    for (const C of ['IntersectionObserver', 'MutationObserver', 'ResizeObserver']) { const O = window[C]; if (!O) continue; window[C] = class extends O { constructor(cb, o) { super(wrap(C, cb), o); } }; }
  }
  // live intervals count
  // frame recorder (its own rAF, unwrapped)
  const fr = []; window.__fr = fr; const loop = (t) => { fr.push(now()); if (fr.length > 200000) fr.length = 0; oRAF(loop); }; oRAF(loop);
  window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  window.__marks = {};
  const mark = (k) => { if (!(k in window.__marks)) window.__marks[k] = Math.round(now()); };
  const watch = () => { const st = document.getElementById('start'); const b = document.body;
    const chk = () => { if (st && !st.classList.contains('booting')) mark('startNotBooting'); if (b.classList.contains('hud-ready')) mark('hudReady'); const ld = document.querySelector('.wc-loader, #ld-ret'); if (ld) mark('loaderInDom'); };
    if (!st) return; /* frames (the Collection) have no loader to watch */ const mo = new MutationObserver(() => { chk(); if ('hudReady' in window.__marks) mo.disconnect(); }); chk(); mo.observe(b, { attributes: true, subtree: true, attributeFilter: ['class'] }); }; /* stops once the HUD is up: watching every class change cost measurable time later (2026-11-10) */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { mark('dcl'); watch(); }); else watch();
  addEventListener('load', () => mark('load'));
};

export async function open(eng = 'webkit', o = {}) {
  const [w, h] = (o.size ?? '390x844').split('x').map(Number);
  const args = eng === 'chromium' ? ['--enable-precise-memory-info', '--js-flags=--expose-gc'] : [];
  const b = await (eng === 'webkit' ? webkit : chromium).launch({ args });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: eng !== 'firefox', deviceScaleFactor: o.dsf ?? 2, reducedMotion: o.reduced ? 'reduce' : 'no-preference', geolocation: SKY ? { latitude: 43.66, longitude: -79.58 } : { latitude: 44.3, longitude: -78.3 }, permissions: ['geolocation'], timezoneId: 'America/Toronto', locale: 'en-CA', serviceWorkers: 'block' });
  if (o.returning !== false) await ctx.addInitScript(() => { if (!localStorage.getItem('started')) { localStorage.setItem('started', '1'); localStorage.setItem('tourDone', '1'); /* readPref only takes '1' (was 'true': every run booted as a new player with cards) */ localStorage.setItem('fingerChosen', '1'); localStorage.setItem('dev', '1'); localStorage.setItem('radarTip', '1'); localStorage.setItem('recapWeek', '9e15'); localStorage.setItem('tonightDay', new Date().toDateString()); } });
  await ctx.addInitScript(instr, { at: o.at ? new Date(o.at).getTime() : 0, attrib: o.attrib !== false });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => { if (!/setPointerCapture|NotFoundError|InvalidPointerId|object can not be found here/.test(e.message)) errs.push('PAGEERROR ' + e.message.slice(0, 200)); });
  if (o.wx) await routeWx(p, o.wx, o.at);
  await p.route(/adsb|api\.adsb|val\.run\/.*plane|adsbdb/, (r) => r.abort());
  if (SKY) { const shift = (o.at ? new Date(o.at).getTime() : Date.now()) - Date.now(); await p.route(/web\.val\.run/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ...FEED, now: Date.now() + shift }) })); }
  let cdp = null; if (eng === 'chromium') { cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable'); }
  const W = (ms) => p.waitForTimeout(ms);
  const hud = () => p.waitForFunction(() => document.body.classList.contains('hud-ready'), null, { timeout: 90000 });
  const throttle = async (r) => { if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: r }); };
  const seedSky = (n) => p.evaluate(async ({ n, ac }) => {
    // n sightings from n/2 catches of the recorded planes on varied routes: each catch makes a flight card and a plane card.
    const { addSightings } = await import('/js/store.js'); const { cardsFor } = await import('/js/flights.js'); const { catchSightings } = await import('/js/sky-cards.js');
    const AP = [['CYYZ', 'Toronto', 'CA', 43.68, -79.63], ['CYUL', 'Montreal', 'CA', 45.47, -73.74], ['CYVR', 'Vancouver', 'CA', 49.19, -123.18], ['CYYC', 'Calgary', 'CA', 51.13, -114.01], ['KJFK', 'New York', 'US', 40.64, -73.78], ['KORD', 'Chicago', 'US', 41.98, -87.9], ['KLAX', 'Los Angeles', 'US', 33.94, -118.41], ['KATL', 'Atlanta', 'US', 33.64, -84.43], ['KMIA', 'Miami', 'US', 25.79, -80.29], ['EGLL', 'London', 'GB', 51.47, -0.45], ['LFPG', 'Paris', 'FR', 49.01, 2.55], ['EDDF', 'Frankfurt', 'DE', 50.03, 8.56], ['EHAM', 'Amsterdam', 'NL', 52.31, 4.76], ['LEMD', 'Madrid', 'ES', 40.47, -3.56], ['MMMX', 'Mexico City', 'MX', 19.44, -99.07], ['RJTT', 'Tokyo', 'JP', 35.55, 139.78], ['OMDB', 'Dubai', 'AE', 25.25, 55.36], ['SBGR', 'São Paulo', 'BR', -23.43, -46.47]].map(([icao, city, cc, lat, lon]) => ({ icao, iata: icao.slice(1), city, cc, lat, lon, name: city }));
    const planes = ac.filter((a) => a.t), days = Math.max(12, Math.ceil(n / 50)), t0 = Date.now() - days * 86400e3, list = [];
    for (let i = 0; i < n / 2; i++) {
      const a = planes[i % planes.length], cs = (a.flight || '').trim() || `TST${i}`, from = AP[(i * 5) % AP.length]; let to = AP[(i * 7 + 3) % AP.length]; if (to === from) to = AP[(i * 7 + 4) % AP.length];
      const pl = { hex: a.hex, callsign: cs, reg: a.r || '', type: a.t, desc: a.desc || '', category: a.category || '' };
      const { flight, plane } = cardsFor(pl, { from, to, callsign: cs }, '');
      const t = t0 + Math.floor(i / Math.max(1, n / 2 / days)) * 86400e3 + 7200e3 + (i % 50) * 60e3;
      list.push(...catchSightings({ time: t, hex: i % 3 ? a.hex : `${a.hex}${i}`, callsign: cs, reg: pl.reg, type: pl.type, altFt: 30000, gsKt: 450, rangeKm: 20, lat: 43.66, lon: -79.58, flight, plane }).map((s) => ({ ...s, loggedAt: t, sim: false })));
    }
    await addSightings(list); return list.length;
  }, { n, ac: FEED.ac });
  const seed = SKY ? seedSky : (n) => p.evaluate(async (n) => { const { addSightings } = await import('/js/store.js'); const { cardKeyFor, stampKeyFor } = await import('/js/card-model.js'); const cat = await (await fetch('/data/catalog.json')).json(); const objs = cat.objects.filter((o) => o.tier); const days = Math.max(12, Math.ceil(n / 25)); const t0 = Date.now() - days * 86400e3; const list = []; for (let i = 0; i < n; i++) { const o = objs[(i * 13) % objs.length], t = t0 + Math.floor(i / Math.max(1, n / days)) * 86400e3 + 7200e3 + (i % 50) * 60e3; const s = { objectId: o.id, cardKey: cardKeyFor(o), name: o.name, type: o.type, time: t, loggedAt: t, lat: 44.3, lon: -78.3, az: 100, el: 40, mag: 3, sim: false }; const sk = stampKeyFor(o, t); if (sk) s.stampKey = sk; list.push(s); } for (const k of ['moon', 'planet:jupiter', 'sun']) { const t = Date.now() - 3 * 86400e3; list.push({ objectId: k, cardKey: k, name: k, type: 'planet', time: t, loggedAt: t, lat: 44.3, lon: -78.3, az: 100, el: 40, mag: 2, sim: false }); } await addSightings(list); return list.length; }, n);
  // reset callback stats + frame mark; returns a stop() that reports
  const subs = () => p.frames().filter((f) => f !== p.mainFrame());
  const window_ = async () => { for (const f of subs()) await f.evaluate(() => { window.__cb?.clear(); }).catch(() => {}); const i0 = await p.evaluate(() => { window.__cb.clear(); window.__lt.length = 0; window.__long.length = 0; return window.__fr.length; }); const m0 = cdp ? await metrics() : null; return { i0, m0 }; };
  const metrics = async () => { const r = await cdp.send('Performance.getMetrics'); return Object.fromEntries(r.metrics.map((m) => [m.name, m.value])); };
  const report = async (st, top = 8) => {
    const r = await p.evaluate(({ i0, top }) => { const f = window.__fr.slice(i0); const g = []; for (let i = 1; i < f.length; i++) g.push(f[i] - f[i - 1]); const s = [...g].sort((a, b) => a - b); const q = (x) => s.length ? s[Math.min(s.length - 1, Math.floor(x * s.length))] : 0; const longF = []; for (let i = 1; i < f.length; i++) { const g = f[i] - f[i - 1]; if (g > 40) { const in_ = window.__long.filter((x) => x[0] < f[i] && x[0] + x[1] > f[i - 1]).map((x) => `${x[2]} ${Math.round(x[1])}`); longF.push(`${Math.round(f[i-1]-f[0])}ms:${Math.round(g)}[${in_.join('; ') || 'no callback (style/layout/paint/GC/decode)'}]`); } } const cbs = [...window.__cb].map(([k, v]) => [k, v.n, +v.t.toFixed(1), +v.max.toFixed(1), v.over16]).sort((a, b) => b[2] - a[2]).slice(0, top); return { frames: g.length, span: f.length ? Math.round(f.at(-1) - f[0]) : 0, p50: +q(.5).toFixed(1), p95: +q(.95).toFixed(1), max: Math.round(s.at(-1) ?? 0), over33: g.filter((x) => x > 34).length, over50: g.filter((x) => x > 50).length, gaps: g.map(Math.round), longF, lt: window.__lt.slice(), cbs, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e5) / 10 : null }; }, { i0: st.i0, top });
    for (const f of subs()) { const c = await f.evaluate(() => window.__cb ? [...window.__cb].map(([k, v]) => ['F:' + k, v.n, +v.t.toFixed(1), +v.max.toFixed(1), v.over16]) : []).catch(() => []); r.cbs = [...r.cbs, ...c].sort((a, b) => b[2] - a[2]).slice(0, top); }
    if (cdp && st.m0) { const m1 = await metrics(); r.cpu = { script: Math.round((m1.ScriptDuration - st.m0.ScriptDuration) * 1000), style: Math.round((m1.RecalcStyleDuration - st.m0.RecalcStyleDuration) * 1000), layout: Math.round((m1.LayoutDuration - st.m0.LayoutDuration) * 1000), task: Math.round((m1.TaskDuration - st.m0.TaskDuration) * 1000), layouts: m1.LayoutCount - st.m0.LayoutCount, styles: m1.RecalcStyleCount - st.m0.RecalcStyleCount, nodes: m1.Nodes, listeners: m1.JSEventListeners, heapMB: Math.round(m1.JSHeapUsedSize / 1e5) / 10 }; }
    return r;
  };
  const fmt = (name, r, opts = {}) => { let s = `${name.padEnd(30)} frames ${String(r.frames).padStart(4)} p50 ${String(r.p50).padStart(5)} p95 ${String(r.p95).padStart(5)} max ${String(r.max).padStart(4)} >33:${r.over33} >50:${r.over50}`; if (r.cpu) s += ` | script ${r.cpu.script} style ${r.cpu.style}(${r.cpu.styles}) layout ${r.cpu.layout}(${r.cpu.layouts}) task ${r.cpu.task} heap ${r.cpu.heapMB} nodes ${r.cpu.nodes}`; if (r.lt?.length) s += `\n    longtasks ${r.lt.map((x) => x[1]).join(',')}`; if (r.longF?.length) s += `\n    long frames: ${r.longF.slice(0, 8).join(' | ')}`; if (opts.gaps) s += `\n    gaps ${r.gaps.slice(0, opts.gaps).join(',')}`; if (opts.cbs !== false) s += '\n' + r.cbs.map((c) => `    ${c[0].padEnd(36)} n ${String(c[1]).padStart(5)} tot ${String(c[2]).padStart(7)} max ${String(c[3]).padStart(6)} >16:${c[4]}`).join('\n'); return s; };
  const measure = async (name, fn, ms = 1500, opts = {}) => { const st = await window_(); if (typeof fn === 'string') await p.evaluate(fn); else if (fn) await fn(); await W(ms); const r = await report(st, opts.top ?? 8); console.log(fmt(name, r, opts)); return r; };
  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  return { b, ctx, p, cdp, errs, W, hud, throttle, seed, measure, window_, report, fmt, click, metrics };
}

export async function routeWx(p, wx, at) {
  // Sky Collector has no server, so its forecast comes straight from Open-Meteo: the same hours, in Open-Meteo's shape (2026-11-16).
  await p.route(/api\.open-meteo\.com\/v1\/forecast/, (route) => {
    const base = at ? new Date(at).getTime() : Date.now(); const now = Math.floor(base / 3600e3) * 3600; const time = [], cloud = [], code = [], temp = [], wind = [];
    for (let i = -24; i < 7 * 24; i++) { let c = 0, k = 0; if (wx === 'cloudy') { c = 95; k = 3; } else if (wx === 'rain') { c = 100; k = 61; } else if (wx === 'partial') { c = 50; k = 2; } if (i > 48) { c = 5; k = 0; } time.push(now + i * 3600); cloud.push(c); code.push(k); temp.push(4); wind.push(10); }
    const cur = wx === 'cloudy' ? 95 : wx === 'rain' ? 100 : wx === 'partial' ? 50 : 0;
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ current: { cloud_cover: cur, weather_code: wx === 'rain' ? 61 : cur > 80 ? 3 : 0 }, hourly: { time, cloud_cover: cloud, weather_code: code, temperature_2m: temp, wind_speed_10m: wind } }) });
  });
  await p.route(/\/wx\?lat=/, (route) => {
    const base = at ? new Date(at).getTime() : Date.now(); const now = Math.floor(base / 3600e3) * 3600; const hours = [];
    for (let i = -24; i < 7 * 24; i++) { const t = now + i * 3600; let c = 0, k = 0; if (wx === 'cloudy') { c = 95; k = 3; } else if (wx === 'rain') { c = 100; k = 61; } else if (wx === 'partial') { c = 50; k = 2; } if (i > 48) { c = 5; k = 0; } hours.push({ t: t * 1000, cloud: c, code: k, temp: 2, wind: 8 }); }
    const cur = wx === 'cloudy' ? 95 : wx === 'rain' ? 100 : wx === 'partial' ? 50 : 0;
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ now: { cloud: cur, code: wx === 'rain' ? 61 : cur > 80 ? 3 : 0 }, hours }) });
  });
}

// synthetic finger pan on #sky: vx/vy px per frame for n frames
export const panJs = (vx, vy, n) => `(async () => { const c = document.getElementById('sky'); const r = c.getBoundingClientRect(); let x = r.width / 2, y = r.height * 0.3; const o = (t) => ({ bubbles: true, clientX: x, clientY: y, pointerId: 7, isPrimary: true, pointerType: 'touch' }); c.dispatchEvent(new PointerEvent('pointerdown', o())); for (let i = 0; i < ${n}; i++) { await new Promise((r) => requestAnimationFrame(r)); x += ${vx}; y += ${vy}; if (x > r.width - 10 || x < 10) { c.dispatchEvent(new PointerEvent('pointerup', o())); x = r.width / 2; c.dispatchEvent(new PointerEvent('pointerdown', o())); } c.dispatchEvent(new PointerEvent('pointermove', o())); } c.dispatchEvent(new PointerEvent('pointerup', o())); })()`;
