// The pack's swipe-to-tear can never be left stuck (2026-11-18, Sevaan: "it freezes the first time I try to open it ... I
// swiped to open when it froze", iPhone, cold load). Drives js/gift-pack.js's tear on the sample pack page with REAL touch
// input (Chrome DevTools touch events, iPhone 13 profile, cache off), each swipe as the very first touch of a fresh page,
// and checks that every case ends in an open pack, or a sealed pack that the next swipe opens:
//   normal (12 moves) · sparse (2 moves) · main thread blocked 1.5 s after the touch starts · cancelled at 40% and 70%
//   (iOS taking the gesture) · released at 40% · finger goes quiet mid-tear with no end, at 40% and 70% (the watchdog).
// Playwright's WebKit can't drag a touch, so WebKit gets the same swipes as mouse pointer events (normal, sparse, short).
// Needs the site built and served:  node scripts/build-site.mjs && python3 -m http.server 8790 --directory site/public
//   node scripts/qa/pack-swipe.mjs [url]     (default http://localhost:8790/pack/; exits 1 if any case is stuck)
const url = process.argv[2] ?? 'http://localhost:8790/pack/';
const { chromium, webkit, devices } = await import(process.env.PW ?? 'playwright');

const state = (p) => p.evaluate(() => { const pk = document.querySelector('#gift .gp-pk'); return !pk ? 'gone' : /opened/.test(pk.className) ? 'open' : /idle/.test(pk.className) ? 'sealed' : 'stuck:' + pk.className; });
let failed = 0;
async function run(name, browser, drive) {
  const b = await browser.launch(), ctx = await b.newContext(browser === chromium ? { ...devices['iPhone 13'] } : { viewport: { width: 393, height: 852 }, hasTouch: true }), p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let cdp = null; if (browser === chromium) { cdp = await ctx.newCDPSession(p); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }); }
  if (name.startsWith('blocked')) await p.addInitScript(() => addEventListener('pointerdown', () => { const t = performance.now(); while (performance.now() - t < 1500); }, { capture: true, once: true }));
  await p.goto(url); await p.waitForSelector('#gift .gp-pk'); await p.waitForTimeout(1200);
  const r = await p.locator('#gift .gp-pk').boundingBox(), y = r.y + r.height * 0.1, x0 = r.x + 15, w = r.width - 30;
  const touch = cdp ? (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }] }) : null;
  const swipe = async (steps, upto = 1, end = 'end') => {
    if (touch) { await touch('touchStart', x0); for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + w * upto * i / steps); await p.waitForTimeout(16); } if (end === 'end') await touch('touchEnd'); if (end === 'cancel') await touch('touchCancel'); }
    else { await p.mouse.move(x0, y); await p.mouse.down(); for (let i = 1; i <= steps; i++) { await p.mouse.move(x0 + w * upto * i / steps, y); await p.waitForTimeout(16); } if (end === 'end') await p.mouse.up(); }
  };
  await drive(swipe, touch, p);
  await p.waitForTimeout(2600);
  let s = await state(p), second = '';
  if (s === 'sealed') { if (touch && name.startsWith('quiet')) await touch('touchEnd').catch(() => {}); /* a late lift after the watchdog must do nothing */ await p.waitForTimeout(300); await swipe(12); await p.waitForTimeout(2600); second = await state(p); }
  const ok = (s === 'open' || (s === 'sealed' && second === 'open')) && !errs.length;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${(browser === chromium ? 'chromium touch' : 'webkit mouse').padEnd(15)} ${name.padEnd(12)} ${s}${second ? ' → next swipe: ' + second : ''}${errs.length ? ' errors: ' + errs.join(' | ') : ''}`);
  await b.close();
}
const CASES = {
  normal: (swipe) => swipe(12), sparse: (swipe) => swipe(2), 'blocked1.5s': (swipe) => swipe(12),
  cancel40: (swipe) => swipe(6, 0.4, 'cancel'), cancel70: (swipe) => swipe(6, 0.7, 'cancel'), short40: (swipe) => swipe(6, 0.4),
  quiet40: (swipe) => swipe(6, 0.4, 'none'), quiet70: (swipe) => swipe(6, 0.7, 'none'),
};
for (const [name, drive] of Object.entries(CASES)) await run(name, chromium, drive);
for (const name of ['normal', 'sparse', 'short40']) await run(name, webkit, CASES[name]);
console.log(failed ? `${failed} stuck` : 'every tear ended open or cleanly sealed');
process.exit(failed ? 1 : 0);
