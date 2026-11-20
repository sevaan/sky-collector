import { chromium } from '/Users/sevaan/code/sky-collector/node_modules/playwright/index.mjs';
const OUT = '/Users/sevaan/code/sky-collector/design/patch-colours/live-B';
const EARNED = ['sky-world', 'sky-livery10', 'sky-rush', 'ambassador', 'epic', 'sky-globetrotter', 'week-sky-airlines', 'album-b737', 'sky-trijet', 'compass', 'legend', 'hattrick', 'sky-passport10', 'gold', 'sky-golden'];
const NEW = ['sky-world', 'sky-livery10', 'sky-rush', 'ambassador', 'epic'];
const KEEP = ['sky-airlines25', 'sky-seven', 'sky-redeye', 'album-props', 'sky-star', 'sky-snow'];
const b = await chromium.launch();
for (const w of (process.argv[2] || '360,390,430').split(',').map(Number)) for (const night of [false, true]) {
  const p = await b.newPage({ viewport: { width: w, height: 1300 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('pageerror', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
  await p.addInitScript(([e, n]) => { localStorage.setItem('dev', '1'); localStorage.setItem('patchSeen', JSON.stringify(e.filter((x) => !n.includes(x)))); }, [EARNED, NEW]);
  await p.route('**/js/cards-page.js*', async (r) => { const res = await r.fetch(); let t = await res.text();
    t = t.replace("const wall = $('patch-wall'), { all, dates } = patchWall();", "const wall = $('patch-wall'), { all, dates } = window.__wallHook ? window.__wallHook(patchWall()) : patchWall();");
    await r.fulfill({ response: res, body: t }); });
  await p.goto('http://localhost:8781/cards.html?sky'); await p.waitForTimeout(1800);
  await p.evaluate(([e, k, night]) => { if (night) document.documentElement.classList.add('sky-night');
    window.__wallHook = (wl) => { const now = Date.now(); wl.all = wl.all.filter((a) => e.includes(a.id) || k.includes(a.id));
      wl.all.forEach((a) => { const i = e.indexOf(a.id); if (i >= 0) { a.done = true; wl.dates[a.id] = now - i * 6e4; } else a.done = false; }); return wl; }; }, [EARNED, KEEP, night]);
  await p.click('#tab-patches'); await p.waitForTimeout(800);
  await p.evaluate(() => { const t = document.querySelector('.collection-tabs'); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 20); });
  await p.waitForTimeout(1500);
  const tag = `${w}-${night ? 'night' : 'day'}`;
  await p.screenshot({ path: `${OUT}/wall-${tag}.png` });
  if (w === 390) { // patch detail
    await p.click('.pw-item[data-id="sky-world"]'); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/detail-${tag}.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    await p.click('.pw-item[data-id="album-b737"]').catch(() => {}); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/detail-gold-${tag}.png` });
  }
  await p.close();
}
await b.close();
