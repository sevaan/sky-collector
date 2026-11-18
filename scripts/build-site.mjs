// Builds skycollector.app's coming-soon page into site/public (2026-11-17, Sevaan: "the card to flip over and some
// legendary card. Basically the above the fold stuff of Space Collector's page"). The legendary card is the game's own
// card markup (js/flight-card.js), so the page and the game can't drift. Run: node scripts/build-site.mjs
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
globalThis.localStorage = { getItem: (k) => (k === 'units' ? 'metric' : null), setItem() {} }; // the page shows km
const ROOT = fileURLToPath(new URL('..', import.meta.url)), OUT = `${ROOT}site/public/`, J = (f) => import(`${ROOT}js/${f}`);
const { planeCardHtml } = await J('flight-card.js'); const { cardsFor, retier } = await J('flights.js'); const { skyModel } = await J('sky-cards.js');
const { HOUSE_PHOTOS } = await J('house-photos.js'); const { fitStyle } = await J('photo-fit.js'); const { VERSION } = await J('version.js').catch(() => ({ VERSION: '' }));
const TYPE = 'A337'; // Airbus BelugaXL: Legendary, and its photo fills the frame
const card = retier(skyModel(cardsFor({ type: TYPE, callsign: 'BGA114', reg: '' }, null, '').plane, 'plane'));
let face = planeCardHtml({ ...card, type: TYPE }, { caughtAt: new Date(2026, 10, 12, 14, 5), heightFt: 24000, speedKmh: 720, awayKm: 9, sightings: 1, eager: true, stampInfo: { count: 1, level: 'bronze', toNext: 9, stamps: [{ key: 'HEX:1', t: Date.now() }], liveries: [], liveryCount: 0, kind: 'plane' }, callsign: 'BGA114' });
const ph = HOUSE_PHOTOS[TYPE], fit = fitStyle(ph.box, ph.w, ph.h, 290, 200);
face = face.replaceAll('assets/photos/', '/assets/photos/').replace('class="fc-photo"', `class="fc-photo" style="object-fit:${fit.mode === 'cover' ? 'cover' : 'contain'};object-position:${fit.objectPosition ?? '50% 50%'}"`);
rmSync(OUT, { recursive: true, force: true });
for (const d of ['', 'assets/photos/house/tiny', 'assets/art/backs', 'fonts', 'css', 'js']) mkdirSync(OUT + d, { recursive: true });
const cp = (f, to = f) => copyFileSync(ROOT + f, OUT + to);
cp(`assets/photos/house/${TYPE}.webp`); cp(`assets/photos/house/tiny/${TYPE}.webp`); cp('assets/art/backs/back-flight-plan.webp'); /* no Sky logo is chosen yet (the repo's icons are still Space Collector's): a placeholder mark, also in the page */
/* the app icon (icons/, exported from icons/icon.svg by scripts/export-icons.mjs): favicons, the home-screen icon, the
   share preview and the hero's icon (2026-11-18, it replaced the placeholder plane-in-a-reticle) */
for (const [f, to] of [['favicon.ico'], ['favicon-32.png'], ['icon-180.png', 'apple-touch-icon.png'], ['icon-512.png'], ['icon.svg']]) cp(`icons/${f}`, to ?? f);
cp('css/fonts.css'); cp('css/sky-cards.css'); cp('js/weather-art.js'); cpSync(ROOT + 'fonts', OUT + 'fonts', { recursive: true });
writeFileSync(OUT + 'privacy.html', readFileSync(ROOT + 'privacy.html', 'utf8').replaceAll("url('fonts/", "url('/fonts/").replaceAll('href="icons/favicon', 'href="/favicon').replace('href="icons/icon-180.png"', 'href="/apple-touch-icon.png"'));
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sky Collector: collect what flies over you</title>
<meta name="description" content="Point your phone at the sky, line up a plane in the circle, and collect it. Sky Collector is coming soon to iPhone and Android.">
<meta property="og:type" content="website"><meta property="og:site_name" content="Sky Collector"><meta property="og:title" content="Sky Collector"><meta property="og:description" content="Collect what flies over you. Coming soon to iPhone and Android."><meta property="og:url" content="https://skycollector.app/"><meta property="og:image" content="https://skycollector.app/icon-512.png"><meta name="twitter:card" content="summary">
<meta name="theme-color" content="#5d97cf">
<link rel="canonical" href="https://skycollector.app/">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/css/fonts.css"><link rel="stylesheet" href="/css/sky-cards.css">
<style>
  :root { --gold:#d7362b; --ink:#0d2238; --muted:#23405c; --red-ink:#b42a20; }
  * { box-sizing:border-box; }
  html, body { margin:0; min-height:100%; }
  body { color:var(--ink); font:500 17px/1.5 'SC Label','Barlow Condensed','Arial Narrow',sans-serif; background:linear-gradient(180deg,#5d97cf 0%,#86b6e0 40%,#b9d5ee 75%,#e3eef8 100%) fixed; overflow-x:hidden; }
  .sky { position:fixed; inset:0; overflow:hidden; pointer-events:none; z-index:0; }
  .sky .deck { position:absolute; left:0; right:0; }
  .sky .hi { top:-2%; height:46%; } .sky .mid { top:30%; height:42%; opacity:.5; -webkit-mask:linear-gradient(transparent,#000 35%,#000 65%,transparent); mask:linear-gradient(transparent,#000 35%,#000 65%,transparent); } .sky .lo { bottom:-2%; height:46%; transform:scaleY(-1); }
  .wx-clouds { position:absolute; left:-45%; right:-45%; top:0; height:100%; -webkit-mask:linear-gradient(#000 30%,transparent 95%); mask:linear-gradient(#000 30%,transparent 95%); }
  .wx-layer { position:absolute; inset:0; animation:wx-drift var(--d,30s) ease-in-out infinite alternate; will-change:transform; }
  @keyframes wx-drift { from { transform:translateX(-14%); } to { transform:translateX(14%); } }
  main { position:relative; z-index:1; min-height:100svh; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:clamp(24px,6vw,96px); max-width:1120px; margin:0 auto; padding:clamp(28px,6vh,72px) clamp(20px,5vw,56px); }
  .hero .icon { width:76px; height:76px; border-radius:18px; box-shadow:0 10px 24px rgba(13,34,56,.28); display:block; }
  h1 { margin:18px 0 6px; font:400 clamp(44px,7vw,68px)/.98 'SC Display','Russo One',sans-serif; letter-spacing:.005em; color:var(--ink); }
  .tag { margin:0 0 16px; font-weight:600; font-size:14px; letter-spacing:.24em; text-transform:uppercase; color:var(--red-ink); }
  .pitch { margin:0 0 22px; max-width:30em; font:400 18px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#16314c; text-wrap:pretty; }
  .soon { display:inline-flex; align-items:center; gap:10px; margin:0 0 20px; padding:11px 18px 10px; border-radius:999px; background:#fffdf6; box-shadow:0 0 0 1px #c9b98a, 0 8px 20px rgba(13,34,56,.16); font-weight:600; font-size:13.5px; letter-spacing:.2em; text-transform:uppercase; }
  .soon i { width:8px; height:8px; border-radius:50%; background:var(--gold); animation:blip 2.4s ease-in-out infinite; } @keyframes blip { 50% { opacity:.25; } }
  .links { display:flex; gap:22px; font-weight:600; font-size:13.5px; letter-spacing:.18em; text-transform:uppercase; }
  .links a { color:var(--ink); text-decoration:none; border-bottom:1.5px solid var(--red-ink); padding-bottom:2px; }
  .stage { --fc-u:min(11.8px, calc((100vw - 48px) / 28)); display:grid; justify-items:center; gap:14px; perspective:1400px; }
  /* The flip is done as the game does it (js/card.js turnCard): turn edge-on, swap the face, turn the rest of the way.
     CSS back-face hiding showed the back mirrored in Safari's engine. */
  .flip { position:relative; display:block; cursor:pointer; outline-offset:6px; animation:sway 7s ease-in-out infinite; -webkit-tap-highlight-color:transparent; }
  .flip.busy, .flip.on { animation:none; }
  @keyframes sway { 0%,100% { transform:rotateY(-7deg) rotateX(3deg); } 50% { transform:rotateY(7deg) rotateX(-2deg); } }
  .flip .front { display:block; text-align:left; visibility:hidden; }
  .flip.on .front { visibility:visible; } .flip.on .back { visibility:hidden; }
  .flip .back { position:absolute; inset:0; border-radius:calc(var(--fc-u) * 1.45); background:#fdf6e9 url('/assets/art/backs/back-flight-plan.webp') center / cover no-repeat; box-shadow:inset 0 0 0 calc(var(--fc-u) * .28) #f2b632, 0 22px 48px rgba(13,34,56,.34), 0 3px 8px rgba(13,34,56,.22); display:grid; align-items:end; justify-items:center; }
  .flip .back span { margin-bottom:9%; padding:8px 16px 7px; border-radius:999px; background:#0d2238e6; color:#fffdf6; font-weight:600; font-size:12.5px; letter-spacing:.22em; text-transform:uppercase; }
  .hint { margin:0; font-weight:600; font-size:12.5px; letter-spacing:.24em; text-transform:uppercase; color:var(--muted); }
  .fc .ph-blur { display:none; }
  footer { position:relative; z-index:1; padding:0 20px 26px; text-align:center; font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; color:#23405c; }
  @media (max-width:380px) { .soon { font-size:11.5px; letter-spacing:.14em; padding-inline:14px; white-space:nowrap; } }
  @media (max-width:820px) { main { grid-template-columns:1fr; justify-items:center; text-align:center; gap:34px; } .hero { display:grid; justify-items:center; } .pitch { max-width:26em; } .links { justify-content:center; } }
  @media (prefers-reduced-motion:reduce) { .flip, .wx-layer, .soon i { animation:none; } .flip { transition:none; } }
</style>
</head>
<body>
<div class="sky" aria-hidden="true"><div class="deck hi" id="deck-hi"></div><div class="deck mid" id="deck-mid"></div><div class="deck lo" id="deck-lo"></div></div>
<main>
  <section class="hero">
    <img class="icon" src="/apple-touch-icon.png" width="76" height="76" alt="">
    <h1>Sky Collector</h1>
    <p class="tag">Collect what flies over you</p>
    <p class="pitch">Find out what’s really up there. Point your phone at the sky, line up a plane in the circle, and collect it: where it’s going, who’s flying it, and what it is.</p>
    <p class="soon"><i></i>Coming soon to iPhone and Android</p>
    <nav class="links"><a href="/privacy">Privacy</a></nav>
  </section>
  <section class="stage">
    <div class="flip" id="flip" role="button" tabindex="0" aria-label="A Sky Collector card, face down. Tap to turn it over." aria-pressed="false">
      <div class="front">${face}</div>
      <div class="back"><span>Tap to reveal</span></div>
    </div>
    <p class="hint" id="hint">Tap the card</p>
  </section>
</main>
<footer>© 2026 Sky Collector</footer>
<script type="module">
  import { cloudsHtml } from '/js/weather-art.js';
  const put = (id, amount, tint) => { document.getElementById(id).innerHTML = cloudsHtml(amount, { tint }); };
  put('deck-hi', 0.75, [255, 255, 255]); put('deck-mid', 0.5, [250, 252, 255]); put('deck-lo', 0.8, [255, 255, 255]);
  const f = document.getElementById('flip'), h = document.getElementById('hint');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; let busy = false;
  const label = (on) => { f.setAttribute('aria-pressed', String(on)); f.setAttribute('aria-label', on ? 'Airbus BelugaXL, a Legendary card. Tap to turn it back.' : 'A Sky Collector card, face down. Tap to turn it over.'); h.textContent = on ? 'Tap to turn it back' : 'Tap the card'; };
  const turn = async () => {
    if (busy) return; busy = true; f.classList.add('busy'); const on = !f.classList.contains('on');
    if (!reduced) await f.animate([{ transform: 'rotateY(0deg) scale(1)' }, { transform: 'rotateY(90deg) scale(1.04)' }], { duration: 330, easing: 'cubic-bezier(.45,0,.9,.6)' }).finished;
    f.classList.toggle('on', on); label(on);
    if (!reduced) await f.animate([{ transform: 'rotateY(-90deg) scale(1.04)' }, { transform: 'rotateY(0deg) scale(1)' }], { duration: 420, easing: 'cubic-bezier(.1,.4,.55,1)' }).finished;
    f.classList.remove('busy'); busy = false;
  };
  f.addEventListener('click', turn); f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); turn(); } });
</script>
</body>
</html>
`;
writeFileSync(OUT + 'index.html', html);
// robots.txt and sitemap.xml (2026-11-18): every page may be indexed; the sitemap lists the three pages people land on.
const SITE = 'https://skycollector.app', PAGES = ['/', '/pack', '/privacy'];
writeFileSync(OUT + 'robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(OUT + 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log('built site/public', card.name, card.tier, fit.mode);

// The sample pack page (skycollector.app/pack) lives under site/public too, which this script wipes: rebuild it last.
await import('./build-site-pack.mjs');
