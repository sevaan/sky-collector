// Release sweep (2026-11-17, Sevaan: "make sure you QA"): opens every main screen of Space Collector in WebKit and
// Chromium at two phone sizes, as a returning player with a seeded collection at a fixed evening, plus a brand-new
// player and a set of cities around the world, and fails on: page errors, console errors, a page wider than the screen,
// a screen that never appears, and the specific regressions listed under CHECKS. Screenshots go to scripts/qa/out/
// (git-ignored) for a quick look. Run before every build, with the local server up (python3 -m http.server 8765):
//
//   export PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH
//   node scripts/qa/sweep.mjs            # everything, ~6 min
//   node scripts/qa/sweep.mjs quick      # WebKit at one size, no cities, ~2 min
//
// Exits 1 if anything failed and prints one line per check. Built on scripts/perf/harness.mjs (seeding, fixed time,
// forecast stubs). Add a screen: one entry in SCREENS. Add a regression check: one entry in CHECKS.
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, routeWx, URL0 } from '../perf/harness.mjs';
import { webkit } from '../../node_modules/playwright/index.mjs';

const OUT = fileURLToPath(new URL('./out', import.meta.url)); /* not .pathname: the folder name has a space */ rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const QUICK = process.argv.includes('quick');
const AT = '2026-11-18T00:30:00Z'; // 7:30 PM in Toronto, dark, during the Leonids
const fails = [], line = (ok, name, why = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${why ? ' · ' + why : ''}`); if (!ok) fails.push(`${name} · ${why}`); };
const quiet = () => { try { localStorage.setItem('music', '0'); localStorage.setItem('sound', '0'); localStorage.setItem('haptics', '0'); } catch {} };

// What every screen is checked for, in the page.
const audit = () => {
  const vw = document.documentElement.clientWidth, wide = [];
  if (document.documentElement.scrollWidth > vw + 1) wide.push(`page ${document.documentElement.scrollWidth}px wide`);
  for (const el of document.querySelectorAll('button, .d-cta, .tn-btn, .ticket, .set-row, .n2-b, h1, h2, .panel-head')) {
    if (!el.offsetParent) continue; const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    if (r.right <= 0 || r.left >= vw) continue; /* parked off screen on purpose (a closed panel) */
    if (r.right > vw + 2 || r.left < -2) { if (el.closest('.tn-run, .mc-rail, [class*=scroll], .gp-fan, #ob-deck, .tabs, .pw-chips, .vm-rot, #tonight-list')) continue; wide.push(`${el.id || el.className.toString().slice(0, 30)} runs off screen (${Math.round(r.left)}…${Math.round(r.right)})`); }
  }
  return wide.slice(0, 4);
};

// Screens for a returning player: [name, how to get there, how to know it is up, how to leave].
const SCREENS = [
  ['explore', null, () => !!document.getElementById('sky') && document.body.classList.contains('hud-ready')],
  ['tonight', () => document.getElementById('nav-sky').click(), () => { const v = document.getElementById('visible'); return !!v && !v.hidden && v.innerText.length > 80; }],
  ['settings', () => { document.getElementById('nav-explore').click(); document.getElementById('nav-more').click(); }, () => { const d = document.getElementById('debug'); return !!d && !d.hidden; }],
  ['plus', () => document.getElementById('set-plus-open').click(), () => { const s = document.getElementById('set-plus-sheet'); return !!s && !s.hidden; }, () => document.getElementById('plus-x')?.click()],
  ['collection', () => { document.getElementById('nav-more').click(); document.getElementById('nav-collection').click(); }, () => document.body.classList.contains('col-open')],
];
const COL_TABS = ['tab-owned', 'tab-albums', 'tab-patches', 'tab-discover'];

async function returning(eng, size, wx) {
  const tag = `${eng} ${size} ${wx}`;
  const h = await open(eng, { size, at: AT, wx, attrib: false, dsf: 1 }); const { p, W } = h; const cons = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::|adsb|wx\?|favicon|CORS|access control/i.test(m.text())) cons.push(m.text().slice(0, 140)); });
  await p.addInitScript(quiet); await p.addInitScript(() => { try { for (const k of ['started', 'tourDone']) localStorage.setItem(k, '1'); } catch {} });
  /* count how often each chat bubble of the daily note starts its entrance from the beginning */
  await p.addInitScript(() => { window.__n2 = []; document.addEventListener('animationstart', (e) => { if (e.animationName === 'n2-pop' && e.elapsedTime < 0.05) window.__n2.push(e.target.textContent.slice(0, 24)); }, true); });
  try {
    await p.goto(URL0); await W(2500); await h.seed(60); await p.goto(URL0); await h.hud(); await W(2500); /* seed first: the sightings make it a returning player */
    for (const [name, go, up, leave] of SCREENS) {
      if (go) await p.evaluate(go); let ok = false;
      for (let i = 0; i < 40 && !ok; i++) { await W(250); ok = await p.evaluate(up).catch(() => false); }
      await W(name === 'tonight' ? 6000 : 900); /* Tonight redraws as the plan and forecast come in */
      const wide = ok ? await p.evaluate(audit) : [];
      await p.screenshot({ path: `${OUT}/${eng}-${size}-${wx}-${name}.png` });
      line(ok && !wide.length, `${tag} · ${name}`, !ok ? 'never appeared' : wide.join('; '));
      if (leave) { await p.evaluate(leave); await W(500); }
    }
    /* the Collection runs in a frame */
    const f = p.frames().find((x) => /cards\.html/.test(x.url()));
    if (!f) line(false, `${tag} · collection frame`, 'not found');
    else for (const t of COL_TABS) {
      const had = await f.evaluate((id) => { const b = document.getElementById(id); if (!b || !b.offsetParent) return false; b.click(); return true; }, t); if (!had) continue;
      await W(900); const wide = await f.evaluate(audit); await p.screenshot({ path: `${OUT}/${eng}-${size}-${wx}-col-${t}.png` });
      line(!wide.length, `${tag} · collection ${t.slice(4)}`, wide.join('; '));
    }
    if (f) { /* open the first card */
      await f.evaluate(() => document.getElementById('tab-owned')?.click()); await W(600);
      const opened = await f.locator('#grid .card-tile').first().tap({ timeout: 8000 }).then(() => true, () => false); await W(2200); /* a real tap: tiles ignore a bare click() */
      const up = opened && await f.evaluate(() => { const v = document.getElementById('viewer'); return !!v && v.open && !!v.querySelector('.card'); });
      await p.screenshot({ path: `${OUT}/${eng}-${size}-${wx}-card.png` }); line(!!up, `${tag} · card viewer`, up ? '' : 'did not open');
    }
    for (const c of CHECKS) { const r = await c.run(p, f).catch((e) => `threw ${e.message}`); line(r === true, `${tag} · ${c.name}`, r === true ? '' : String(r)); }
    line(!h.errs.length && !cons.length, `${tag} · no errors`, [...h.errs, ...cons].slice(0, 3).join(' | '));
  } catch (e) { line(false, `${tag} · run`, e.message.split('\n')[0]); }
  await h.b.close();
}

// Regressions worth a named check (each returns true or a reason).
const CHECKS = [
  { name: 'daily note types in once', run: (p) => p.evaluate(() => { const n = window.__n2 ?? [], seen = new Map(); for (const t of n) seen.set(t, (seen.get(t) ?? 0) + 1); const twice = [...seen].filter(([, c]) => c > 1); return twice.length ? `typed again: ${twice.map(([t, c]) => `"${t}" ×${c}`).join(', ')}` : true; }) },
  { name: 'daily note has no label', run: (p) => p.evaluate(() => (document.querySelector('.n2-who') ? 'the SPACE COLLECTOR label is back' : true)) },
  { name: 'cards inside the night summary keep their own type', run: (p) => p.evaluate(async () => { /* css/gift.css: the summary's p/h2 rules must not reach a card's fact */
      const g = document.createElement('div'); g.id = 'gift'; g.style.cssText = 'position:fixed;left:-9999px;top:0'; g.innerHTML = '<div class="gp-haul"><div class="gp-sum"><p class="own">x</p><div class="mini-face"><div class="card"><div class="card__fact"><p>fact</p></div></div></div></div></div>'; document.body.appendChild(g);
      const own = getComputedStyle(g.querySelector('p.own')).fontFamily, fact = getComputedStyle(g.querySelector('.card__fact p')).fontFamily; g.remove();
      return own === fact ? `card fact uses the summary font (${fact.slice(0, 30)})` : true; }) },
  { name: 'main buttons share the raised look', run: (p) => p.evaluate(() => { const b = document.createElement('button'); b.className = 'd-cta o'; b.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(b); const s = getComputedStyle(b), ok = /inset/.test(s.boxShadow) && /gradient/.test(s.backgroundImage); b.remove(); return ok || 'a .d-cta.o button is flat again'; }) },
  { name: 'Match the sky turns green when done', run: (p) => p.evaluate(() => { const w = document.createElement('div'); w.id = 'sky-match'; w.className = 'done'; w.style.cssText = 'position:fixed;left:-9999px'; w.innerHTML = '<button id="sm-done">x</button>'; const real = document.getElementById('sky-match'), realBtn = document.getElementById('sm-done'); if (real) real.id = 'sky-match-x'; if (realBtn) realBtn.id = 'sm-done-x'; document.body.appendChild(w); const c = getComputedStyle(w.firstChild).color; w.remove(); if (real) real.id = 'sky-match'; if (realBtn) realBtn.id = 'sm-done'; return /79, 209, 139/.test(c) || `Matched button is ${c}, not green`; }) },
  { name: 'gifted cards do not count toward the review ask', run: (p) => p.evaluate(async () => { const t = await (await fetch('/js/main.js')).text(); const m = /function reviewReady\(\) \{\n[^\n]*/.exec(t); return m && /via !== 'gift'/.test(m[0]) ? true : 'reviewReady counts gifts again'; }) },
  { name: 'no fact uses Canada as a yardstick', run: (p) => p.evaluate(async () => { const t = await (await fetch('/js/lore.js')).text(); return /Toronto to Montreal|cross Canada/.test(t) ? 'lore.js mentions Toronto to Montreal / cross Canada' : true; }) },
];

// A brand-new player: the loader, the first pack / welcome card, then the tour's first card.
async function newPlayer(eng, size) {
  const tag = `${eng} ${size} new player`;
  const h = await open(eng, { size, at: AT, wx: 'clear', attrib: false, returning: false, dsf: 1 }); const { p, W } = h;
  await p.addInitScript(quiet);
  try {
    await p.goto(URL0); await W(700);
    const loader = await p.evaluate(() => ({ ring: !!document.querySelector('#ld-ring circle'), ticks: document.querySelectorAll('#ld-ring path').length })); /* the etched-glass dial */
    line(loader.ring && loader.ticks >= 3, `${tag} · loader target`, loader.ring ? '' : 'no dial drawn');
    let tour = false;
    for (let i = 0; i < 30 && !tour; i++) { await p.evaluate(() => { const b = document.getElementById('btn-start'); if (b && b.offsetParent && !b.disabled) b.click(); document.querySelector('.gp-pillow')?.click(); document.getElementById('wc-holder')?.click(); }); await p.mouse.click(Number(size.split('x')[0]) / 2, Number(size.split('x')[1]) / 2); await W(1200); tour = await p.evaluate(() => document.querySelectorAll('.tc .acts .yes').length > 0); }
    await W(1200); await p.screenshot({ path: `${OUT}/${eng}-${size}-tour.png` });
    const t = tour ? await p.evaluate(() => { const y = [...document.querySelectorAll('.tc .acts .yes')].find((e) => e.offsetParent), n = [...document.querySelectorAll('.tc .acts .no')].find((e) => e.offsetParent); if (!y) return null; const a = y.getBoundingClientRect(), b = n?.getBoundingClientRect(); return { yh: a.height, nh: b?.height ?? 0, yf: parseFloat(getComputedStyle(y).fontSize), nf: n ? parseFloat(getComputedStyle(n).fontSize) : 0, fits: y.scrollWidth <= y.clientWidth + 1 }; }) : null;
    line(!!t, `${tag} · reaches the tour`, t ? '' : 'the first tour card never showed');
    if (t) line(t.yh >= 56 && t.yh > t.nh && t.yf > t.nf && t.fits, `${tag} · tour button is the bigger choice`, `main ${Math.round(t.yh)}px/${t.yf}px text, second ${Math.round(t.nh)}px/${t.nf}px${t.fits ? '' : ', label clipped'}`);
    line(!h.errs.length, `${tag} · no errors`, h.errs.slice(0, 3).join(' | '));
  } catch (e) { line(false, `${tag} · run`, e.message.split('\n')[0]); }
  await h.b.close();
}

// Around the world: the sky and the Tonight page at a local evening, set with a saved location and that place's time zone.
const CITIES = [['Sydney', -33.87, 151.21, 'Australia/Sydney', '2026-11-18T10:30:00Z'], ['London', 51.51, -0.13, 'Europe/London', '2026-11-18T19:00:00Z'], ['Singapore', 1.35, 103.82, 'Asia/Singapore', '2026-11-18T12:30:00Z'],
  ['Cape Town', -33.92, 18.42, 'Africa/Johannesburg', '2026-11-18T19:00:00Z'], ['São Paulo', -23.55, -46.63, 'America/Sao_Paulo', '2026-11-19T00:00:00Z'], ['Tromsø, midnight sun', 69.65, 18.96, 'Europe/Oslo', '2026-06-21T21:30:00Z']];
async function world() {
  const b = await webkit.launch();
  for (const [name, lat, lon, tz, iso] of CITIES) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, timezoneId: tz, locale: 'en-GB', serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
    await routeWx(p, 'clear', iso); await p.route(/adsb|planes\?/, (r) => r.abort());
    await p.clock.setFixedTime(new Date(iso));
    await p.addInitScript(([lat, lon, name]) => { try { for (const [k, v] of [['started', '1'], ['tourDone', '1'], ['radarTip', '1'], ['music', '0'], ['sound', '0']]) localStorage.setItem(k, v); localStorage.setItem('observer', JSON.stringify({ lat, lon, label: name, place: name, manual: true })); } catch {} }, [lat, lon, name]);
    try {
      await p.goto(URL0); await p.waitForFunction(() => document.body.classList.contains('hud-ready'), null, { timeout: 60000 }); await p.waitForTimeout(6000);
      await p.evaluate(() => document.getElementById('nav-sky').click()); await p.waitForTimeout(7000);
      const text = await p.evaluate(() => document.getElementById('visible')?.innerText.replace(/\s+/g, ' ').slice(0, 400) ?? '');
      await p.screenshot({ path: `${OUT}/world-${name.replace(/\W+/g, '-')}.png` });
      const sun = /midnight sun/i.test(name);
      line(text.length > 80 && !errs.length && (!sun || /too bright|no dark/i.test(text)), `world · ${name}`, errs[0] ?? (text.length > 80 ? (sun ? 'the midnight-sun page did not show' : '') : 'Tonight page is empty'));
    } catch (e) { line(false, `world · ${name}`, e.message.split('\n')[0]); }
    await ctx.close();
  }
  await b.close();
}

const ENGINES = QUICK ? ['webkit'] : ['webkit', 'chromium'], SIZES = QUICK ? ['393x852'] : ['393x852', '375x667'];
for (const eng of ENGINES) for (const size of SIZES) { await returning(eng, size, 'clear'); if (!QUICK && size === '393x852') await returning(eng, size, 'rain'); await newPlayer(eng, size); }
if (!QUICK) await world();
console.log(fails.length ? `\n${fails.length} FAILED\n${fails.map((f) => '  ' + f).join('\n')}` : '\nAll checks passed.');
process.exit(fails.length ? 1 : 0);
