// The website's welcome card IS the game's welcome card (2026-11-13, Sevaan: "the cards still look different… the inner
// shadows… the sheen"). This lifts it out of the running app instead of photographing it:
//   · the card's markup, as the app builds it (renderCard + the welcome front, with the ISS mini card), sealed face-down
//     with its "Tap to reveal" pill, the footer reading "✦ Look up tonight" (nothing to swipe on a web page);
//   · every CSS rule from the app's stylesheets that matches the card or anything in it (incl. ::before/::after and media
//     blocks), the keyframes they use, the fonts, and the :root variables they read, scoped to the site's .wc-holder;
//   · attachTilt and turnCard copied word for word from js/card.js, so the gloss, foil and glare follow the pointer
//     through the same spring, and the flip is the same turn;
//   · the pictures it points at (card back, ISS thumbnail) and the font files, copied next to it.
// Writes site/public/home/wc-card.css, home/card-moves.js, home/wc/*, play/fonts/*, and the markup into index.html
// between <!--wc-card--> and <!--/wc-card-->. Re-run whenever the app's welcome card changes.
// Needs the app's local server on :8765 and Playwright. Usage: node scripts/build-site-card.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), SITE = join(ROOT, 'site/public'), HOME = join(SITE, 'home');
mkdirSync(join(HOME, 'wc'), { recursive: true }); mkdirSync(join(SITE, 'play/fonts'), { recursive: true });

const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/Toronto', geolocation: { latitude: 44.3, longitude: -78.3 }, permissions: ['geolocation'], serviceWorkers: 'block' });
await ctx.route(/open-meteo\.com|spacecollector\.app\/api|adsb/, (r) => r.abort());
const p = await ctx.newPage();
await p.goto('http://localhost:8765/'); await p.waitForTimeout(9000);
await p.addStyleTag({ content: '#gift{display:none!important}' }); /* the first-run pack sits over the card */
await p.evaluate(() => { const h = document.getElementById('wc-holder'); h.style.opacity = '1'; h.click(); }); /* the flip fills step 3 with the ISS mini card */
await p.waitForTimeout(3000);
const got = await p.evaluate(() => {
  const card = document.querySelector('#wc-holder .card'), holder = document.getElementById('wc-holder');
  const lv = card.querySelector('#wc-live'); if (lv && !lv.querySelector('.wc-dot')) lv.innerHTML = '<i class="wc-dot"></i>0 overhead'; /* so the live dot's rules are collected */
  const back = card.querySelector('.card__back'); if (!back.querySelector('.tap')) back.insertAdjacentHTML('beforeend', '<div class="tap">Tap to reveal</div>');
  /* the CSS: every rule that matches the card or anything in it */
  const els = [holder, card, ...card.querySelectorAll('*')];
  const strip = (sel) => sel.replace(/::?(before|after|placeholder|selection|marker)\b/g, '').replace(/:(hover|active|focus|focus-visible|focus-within|visited)\b/g, '');
  const holderOnly = (one) => /(^|[\s>+~])[^\s>+~]*(\.wc-holder|#wc-holder)[^\s>+~]*\s*$/.test(strip(one).trim()); /* the holder's own size, shake and place: the site has its own */
  const hits = (sel) => sel.split(',').some((one) => { if (holderOnly(one)) return false; const s = strip(one).trim() || '*'; try { return els.some((e) => e.matches(s)); } catch { return false; } });
  const rules = [], kf = new Map(), anims = new Set(), fonts = [];
  const walk = (list, wrap) => { for (const r of list) {
    if (r instanceof CSSStyleRule) { if (/^\s*(:root|html|body)\s*[,{]?/.test(r.selectorText) && !/\.(card|wc-|wa-|mini|m-chip|back-)/.test(r.selectorText)) continue;
      if (hits(r.selectorText)) { const broken = /:\s*;/.test(r.cssText); /* WebKit drops a var() shorthand that a longhand then overrides (the foil title's background): read that rule from its file instead */
        rules.push(broken ? { sel: r.selectorText, href: r.parentStyleSheet?.href ?? '', wrap } : { sel: r.selectorText, body: r.style.cssText, wrap }); (r.style.animationName || r.style.animation || '').split(/[\s,]+/).forEach((n) => n && anims.add(n)); } }
    else if (r instanceof CSSMediaRule) walk(r.cssRules, `@media ${r.conditionText}`);
    else if (r instanceof CSSSupportsRule) walk(r.cssRules, `@supports ${r.conditionText}`);
    else if (r instanceof CSSKeyframesRule) kf.set(r.name, r.cssText);
    else if (r instanceof CSSFontFaceRule) fonts.push(r.cssText);
  } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules, ''); } catch {} }
  const css = rules.map((r) => r.body ?? '').join('\n'), root = getComputedStyle(document.documentElement);
  const vars = [...new Set(css.match(/var\(\s*--[\w-]+/g)?.map((v) => v.replace(/var\(\s*/, '')) ?? [])].map((v) => [v, root.getPropertyValue(v).trim()]).filter(([, v]) => v);
  /* the markup, sealed: turned face down with the back showing, as the app deals it */
  const c = card.cloneNode(true);
  c.style.transform = 'perspective(1600px) rotateY(180deg)'; c.querySelector('.card__back').style.opacity = '1';
  const live = c.querySelector('#wc-live'); if (live) live.innerHTML = '';
  const foot = c.querySelector('.wc-a-foot span'); if (foot) foot.textContent = '✦ Look up tonight';
  return { html: c.outerHTML, rules, keyframes: [...kf].filter(([n]) => anims.has(n)).map(([, t]) => t), fonts, vars };
});
await b.close();

/* rules WebKit couldn't serialize, taken from the CSS file as written */
const fromFile = ({ sel, href, wrap }) => {
  const file = join(ROOT, decodeURIComponent(new URL(href).pathname)), text = readFileSync(file, 'utf8');
  const esc = sel.split(',').map((x) => x.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')).join('\\s*,\\s*');
  const m = new RegExp(`(^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(text); if (!m) throw new Error(`can't find ${sel} in ${file}`);
  const body = m[2].replace(/\/\*[\s\S]*?\*\//g, '').trim();
  return body;
};
/* every rule scoped to the card on the page, so the app's broad rules (plain elements, :where(...)) can't reach the rest of the site */
const split = (sel) => { const out = []; let depth = 0, cur = ''; for (const ch of sel) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); };
const scope = (sel) => split(sel).map((x) => `.wc-card ${x}`).join(', ');
got.css = got.rules.map((r) => { const body = r.body ?? fromFile(r); const rule = `${scope(r.sel)} { ${body} }`; return r.wrap ? `${r.wrap} { ${rule} }` : rule; }).join('\n');

/* pictures and fonts next to the site's copy; URLs rewritten to them */
const urls = new Set([...got.html.matchAll(/(?:src="|url\(&quot;|url\(")(assets\/[^"&)]+)/g)].map((m) => m[1]));
let html = got.html;
for (const u of urls) { const to = `/home/wc/${basename(u)}`; copyFileSync(join(ROOT, u), join(HOME, 'wc', basename(u))); html = html.split(u).join(to); }
const fontCss = got.fonts.map((f) => f.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (m, file) => { if (existsSync(join(ROOT, 'fonts', file))) copyFileSync(join(ROOT, 'fonts', file), join(SITE, 'play/fonts', file)); return `url("/play/fonts/${file}")`; }));
const css = `/* Written by scripts/build-site-card.mjs from the app's own stylesheets: don't edit by hand. */
${fontCss.join('\n')}
.wc-card .wc-holder { ${got.vars.map(([k, v]) => `${k}: ${v};`).join(' ')} --cf: calc(100cqw / 28); position: absolute; inset: 0; }
${got.css}
${got.keyframes.join('\n')}
`;
writeFileSync(join(HOME, 'wc-card.css'), css);

/* the tilt spring and the turn, word for word from the app */
const src = readFileSync(join(ROOT, 'js/card.js'), 'utf8');
const grab = (from, to) => { const i = src.indexOf(from); const j = src.indexOf(to, i); if (i < 0 || j < 0) throw new Error(`card.js: can't find ${from}`); return src.slice(i, j); };
const tilt = grab('const FOLLOW =', '\n// Phone tilt moves the card');
const turn = grab('export function turnCard(', '\n}\n') + '\n}\n';
writeFileSync(join(HOME, 'card-moves.js'), `// Copied word for word from the app's js/card.js by scripts/build-site-card.mjs: don't edit by hand.\nconst reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;\n${tilt}\n${turn}`);

/* the markup into the page */
const page = join(SITE, 'index.html'); let s = readFileSync(page, 'utf8');
const a = s.indexOf('<!--wc-card-->'), z = s.indexOf('<!--/wc-card-->');
if (a < 0 || z < 0) throw new Error('index.html: no <!--wc-card--> markers');
s = s.slice(0, a + '<!--wc-card-->'.length) + `<div class="wc-holder" id="wc-holder">${html}</div>` + s.slice(z);
writeFileSync(page, s);
console.log(`card ${html.length} B, css ${css.length} B (${got.css.split('\n').length} rules, ${got.keyframes.length} keyframes, ${got.fonts.length} fonts), pictures ${[...urls].join(', ')}`);
