// Performance budget (2026-11-10 performance pass): run before every build. Fails (exit 1) on any breach.
//
//   export PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH
//   python3 -m http.server 8765 &        # from the repo root
//   node scripts/perf/budget.mjs          # ~4 min; add --cr for the Chromium 4x pass (script/style/layout split)
//
// WebKit (Safari's engine, what iOS ships) at 390x844 with 2,000 seeded cards, a fixed evening and a routed forecast, once
// clear and once cloudy. The numbers are desktop numbers: an iPhone is roughly 2x slower, which the limits allow for.
// Headless browsers have no GPU, so raster and compositing aren't measured; check the feel on a phone too.
// The card viewer's swipe and flick have their own check: scripts/perf/viewer-swipe.mjs --budget (2026-11-18).
import { open, URL0 } from './harness.mjs';

const AT = '2026-11-10T19:40:00-05:00', N = 2000, CR = process.argv.includes('--cr');
const LIMITS = {
  skyIdleMs: 4, skyPanMs: 5, // sky loop: mean script per drawn frame
  warmFrameMax: 100, // the first 45 s after start: one-time loads (the Collection, cloud pictures, the first Tonight draw)
  idleFrameMax: 50, idleCallbackMax: 16, // then 60 s sitting on Explore: anything here repeats
  flowFrameMax: 50, flowOver33: 2, // every open/close, the reveal included
  gridP95: 25, // Collection grid scroll
  hudReadyMs: 2000, bootCallbackMax: 60, // start with a cached plan
  heapGrowMB: 3, listenerGrow: 10, // 20 open/close cycles (Chromium)
  idleAnimations: 10, // running CSS/SVG animations on an idle Explore
  crScriptMs: 150, // Chromium 4x: script per transition
};
const fails = [], rows = [];
const check = (name, v, max, unit = 'ms', why = null) => { const ok = v <= max; rows.push(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(42)} ${String(Math.round(v * 10) / 10).padStart(7)} ${unit} (max ${max})`); if (!ok) { fails.push(name); if (why) rows.push(`       why: ${why}`); } };
const why = (r) => [...(r.longF ?? []).slice(0, 4), ...r.cbs.filter((c) => c[3] > 12).slice(0, 4).map((c) => `${c[0]} max ${c[3]}`)].join(' | ').slice(0, 600);
const skyRaf = (r) => r.cbs.filter(([k]) => /^raf main\.js/.test(k)).sort((a, b) => b[1] - a[1])[0]; // the sky loop: the busiest rAF in main.js

async function webkitPass(wx) {
  const T = await open('webkit', { at: AT, wx });
  const { p, W, hud, seed, window_, report, errs } = T;
  await p.goto(URL0); await W(2500); await seed(N);
  // boot with a cached plan: load once so the plan is saved, then measure the second start
  await p.goto(URL0); await hud(); await W(8000);
  await p.goto(URL0); const t0 = Date.now(); await hud(); const hudMs = Date.now() - t0;
  const [bootLong, bootWhy] = await p.evaluate(() => { const l = [...window.__long].sort((a, b) => b[1] - a[1]); return [l[0]?.[1] ?? 0, l.slice(0, 4).map((x) => `${x[2]} ${Math.round(x[1])}`).join(' | ')]; });
  let st = await window_(); await W(45000); let r = await report(st, 30);
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  const tag = `[${wx}]`;
  check(`${tag} warm-up 45 s: worst frame`, r.max, LIMITS.warmFrameMax, 'ms', why(r));
  if (wx === 'clear') { check(`${tag} hud-ready (cached plan)`, hudMs, LIMITS.hudReadyMs); check(`${tag} longest boot callback`, bootLong, LIMITS.bootCallbackMax, 'ms', bootWhy); }
  // idle: 60 s still on Explore after the warm-up (catches periodic background work: the 40 s Tonight redraw, stalls)
  st = await window_(); await W(60000); r = await report(st, 30);
  const sk = skyRaf(r); check(`${tag} sky script per frame, idle`, sk ? sk[2] / sk[1] : 0, LIMITS.skyIdleMs);
  check(`${tag} idle 60 s: worst frame`, r.max, LIMITS.idleFrameMax, 'ms', why(r));
  const worstCb = r.cbs.filter(([k]) => k !== sk?.[0] && !/ harness$/.test(k)).reduce((m, c) => Math.max(m, c[3]), 0);
  check(`${tag} idle 60 s: longest other callback`, worstCb, LIMITS.idleCallbackMax, 'ms', why(r));
  const anims = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  check(`${tag} running animations on idle Explore`, anims, LIMITS.idleAnimations, '');
  // pan
  st = await window_();
  await p.evaluate(async () => { const c = document.getElementById('sky'); const r = c.getBoundingClientRect(); let x = r.width / 2, y = r.height * 0.35; const ev = (t) => new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true }); c.dispatchEvent(ev('pointerdown')); for (let i = 0; i < 180; i++) { x += 3; c.dispatchEvent(ev('pointermove')); await new Promise((q) => requestAnimationFrame(q)); } c.dispatchEvent(ev('pointerup')); });
  r = await report(st, 30); const pk = skyRaf(r); check(`${tag} sky script per frame, panning`, pk ? pk[2] / pk[1] : 0, LIMITS.skyPanMs);
  // flows
  const once = async (js, ms) => { const s = await window_(); await p.evaluate(js); await W(ms); return report(s, 8); };
  const judge = (name, qs) => { const m = [...qs].sort((a, b) => a.max - b.max)[Math.floor(qs.length / 2)]; check(`${tag} ${name}: worst frame${qs.length > 1 ? ' (median of 3)' : ''}`, m.max, LIMITS.flowFrameMax, 'ms', why(m)); check(`${tag} ${name}: frames over 33 ms`, m.over33, LIMITS.flowOver33, ''); };
  const flow = async (name, js, ms = 1500) => judge(name, [await once(js, ms)]);
  const pair = async (a, ja, b, jb, ms = 1500) => { const qa = [], qb = []; for (let i = 0; i < 3; i++) { qa.push(await once(ja, ms)); await W(600); qb.push(await once(jb, 1200)); await W(900); } judge(a, qa); judge(b, qb); };
  await pair('Tonight open', "document.getElementById('nav-sky').click()", 'Tonight close', "document.getElementById('nav-explore').click()");
  await pair('Settings open', "document.getElementById('nav-more').click()", 'Settings close', "document.getElementById('nav-more').click()", 1200);
  if (wx === 'clear') {
    await flow('Collection open', "document.getElementById('nav-collection').click()", 2500); await W(1000);
    const f = p.frames().find((x) => x.url().includes('cards.html'));
    if (f) { const s = await window_(); await f.evaluate(async () => { const e = document.scrollingElement; for (let i = 0; i < 90; i++) { e.scrollTop += 120; await new Promise((q) => requestAnimationFrame(q)); } }); await W(300); const q = await report(s, 8); check(`${tag} Collection grid scroll p95`, q.p95, LIMITS.gridP95, 'ms', why(q)); }
    await flow('Collection close', "document.getElementById('nav-explore').click()", 1500); await W(1500);
    let a; for (let i = 0; i < 12; i++) { a = await p.evaluate(() => window.__aim?.()); if (typeof a === 'string') break; await W(1000); }
    await W(2500);
    const cta = await p.evaluate(() => { const e = document.getElementById('d-cta'); return !!e && e.getBoundingClientRect().width > 0; });
    if (typeof a === 'string') { await flow('Collect -> reveal', `document.getElementById('${cta ? 'd-cta' : 'd-hit'}').click()`, 4000); await flow('Reveal close', "document.querySelector('#reveal .x-close')?.click()", 2500); }
    else rows.push(`skip [${wx}] collect/reveal: nothing new to aim at (${JSON.stringify(a)})`);
  }
  for (const e of errs) { rows.push(`FAIL ${tag} page error: ${e}`); fails.push('page error'); }
  await T.b.close();
}

async function chromiumPass() {
  const T = await open('chromium', { at: AT, wx: 'partial' });
  const { p, W, hud, seed, window_, report, throttle, metrics } = T;
  await p.goto(URL0); await W(2500); await seed(600);
  await p.goto(URL0); await hud(); await W(12000);
  await throttle(4);
  for (const [name, js, ms] of [['Tonight open', "document.getElementById('nav-sky').click()", 1500], ['Tonight close', "document.getElementById('nav-explore').click()", 1200], ['Settings open', "document.getElementById('nav-more').click()", 1200], ['Settings close', "document.getElementById('nav-more').click()", 1200], ['Collection open', "document.getElementById('nav-collection').click()", 2500], ['Collection close', "document.getElementById('nav-explore').click()", 1500]]) {
    const s = await window_(); await p.evaluate(js); await W(ms); const q = await report(s, 8); const sk = skyRaf(q); check(`[cr 4x] ${name}: script (sky loop excluded)`, (q.cpu?.script ?? 0) - (sk?.[2] ?? 0), LIMITS.crScriptMs, 'ms', `style ${q.cpu?.style} layout ${q.cpu?.layout} | ${why(q)}`);
  }
  await throttle(1);
  // memory: 20 open/close cycles
  const gc = () => p.evaluate(() => globalThis.gc?.());
  const cycle = async () => { for (const js of ["document.getElementById('nav-sky').click()", "document.getElementById('nav-explore').click()", "document.getElementById('nav-more').click()", "document.getElementById('nav-more').click()", "window.__showRecap?.()", "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))"]) { await p.evaluate(js); await W(450); } };
  for (let i = 0; i < 3; i++) await cycle(); /* warm-up: first-use listeners and caches aren't leaks */
  await gc(); const m0 = await metrics();
  for (let i = 0; i < 20; i++) { for (const js of ["document.getElementById('nav-sky').click()", "document.getElementById('nav-explore').click()", "document.getElementById('nav-more').click()", "document.getElementById('nav-more').click()", "window.__showRecap?.()", "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))"]) { await p.evaluate(js); await W(450); } }
  await W(2000); await gc(); const m1 = await metrics();
  check('[cr] heap growth over 20 cycles', (m1.JSHeapUsedSize - m0.JSHeapUsedSize) / 1e6, LIMITS.heapGrowMB, 'MB');
  check('[cr] listener growth over 20 cycles', m1.JSEventListeners - m0.JSEventListeners, LIMITS.listenerGrow, '');
  await T.b.close();
}

await webkitPass('clear');
await webkitPass('cloudy');
if (CR) await chromiumPass();
console.log(rows.join('\n'));
console.log(fails.length ? `\nBUDGET FAILED: ${fails.length} breach${fails.length === 1 ? '' : 'es'}` : '\nBudget OK');
process.exit(fails.length ? 1 : 0);
