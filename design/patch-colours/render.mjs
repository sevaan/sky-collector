// Renders the real Collection → Patches wall (cards.html?sky) with each palette option injected, day and night.
import { chromium } from '/Users/sevaan/code/sky-collector/node_modules/playwright/index.mjs';
import { OPTIONS } from './options.mjs';
const OUT = process.argv[2] || '/Users/sevaan/code/sky-collector/design/patch-colours';
const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(OPTIONS);

// Earned, in wall order (newest first); a mix of every Sky group, two gold-finish ones and two NEW-less ones.
const EARNED = ['sky-world', 'sky-livery10', 'sky-rush', 'ambassador', 'epic', 'sky-globetrotter', 'week-sky-airlines', 'album-b737', 'sky-trijet', 'compass', 'legend', 'hattrick'];
const NEW = new Set(['sky-world', 'sky-livery10', 'sky-rush', 'ambassador', 'epic']);
const LOCKED_KEEP = new Set(['sky-airlines25', 'sky-passport10', 'sky-seven', 'sky-redeye', 'album-props', 'sky-star']);

const transform = (opt, night) => {
  const P = window.__P, all = window.__all;
  const hex = (c) => { c = c.replace('#', ''); if (c.length === 3) c = [...c].map((x) => x + x).join(''); return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)); };
  const toHex = (r) => '#' + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const lum = (c) => { const v = hex(c).map((x) => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
  const deepen = (c, bg, target) => { let t = 0, x = c; while (cr(x, bg) < target && t < 1) { t += .04; x = mix(c, '#0d2238', t); } return x; };
  const o = { ...opt, ...(night ? opt.night : {}) };
  const report = [];
  document.querySelectorAll('.pw-item:not(.locked)').forEach((it) => {
    const a = all.find((x) => x.id === it.dataset.id); if (!a) return;
    const g = P.groupOf(a), svg = it.querySelector('.patch-svg'), span = it.querySelector('.patch');
    const gold = span.classList.contains('patch--gold');
    let ground = o.idGround?.[a.id] ?? o.ground[g] ?? o.ground._all;
    if (night && opt.groundNight) ground = opt.groundNight;
    const rimC = opt.rimBy ? (opt.idRim?.[a.id] ?? opt.rimBy[g]) : null;
    let rim = rimC ? [mix(rimC, '#000000', .5), mix(rimC, '#ffffff', .2)] : o.rim;
    if (gold && !rimC) rim = ['#7a560c', '#ffe39a'];
    const thread = o.thread, label = o.label === 'rimDeep' ? deepen(rimC, ground, 4.5) : o.label;
    const accent = o.accent === 'rim' ? deepen(rimC, ground, 3) : o.accent;
    const id = svg.querySelector('pattern')?.id.replace(/w$/, '');
    // ground, edge shade, outer shadow, emboss shadow
    const circles = [...svg.children].filter((e) => e.tagName === 'circle');
    circles[0].setAttribute('fill', o.drop);
    const gc = circles.find((c) => c.getAttribute('r') === '52' && /^#/.test(c.getAttribute('fill'))); gc?.setAttribute('fill', ground);
    svg.querySelectorAll(`#${id}s stop`)[1]?.setAttribute('stop-opacity', o.shade);
    svg.querySelectorAll('feFlood').forEach((f) => f.setAttribute('flood-opacity', o.emboss));
    // the merrowed edge, recoloured (luminance → duotone)
    const [r0, r1] = rim.map(hex);
    const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter'); f.id = id + 'rim'; f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML = `<feColorMatrix type="matrix" values=".3 .59 .11 0 0 .3 .59 .11 0 0 .3 .59 .11 0 0 0 0 0 1 0"/><feComponentTransfer>${['R', 'G', 'B'].map((k, i) => `<feFunc${k} type="table" tableValues="${(r0[i] / 255).toFixed(3)} ${(r1[i] / 255).toFixed(3)}"/>`).join('')}</feComponentTransfer>`;
    svg.querySelector('defs').appendChild(f);
    svg.querySelector('image[href*="merrow"]')?.setAttribute('filter', `url(#${id}rim)`);
    // thread colours
    const map = { '#fff2b3': thread, 'var(--gold)': accent, ...(o.map ?? {}) };
    svg.querySelectorAll('[fill],[stroke]').forEach((e) => {
      if (e.closest('defs')) return;
      for (const k of ['fill', 'stroke']) { const v = e.getAttribute(k); if (v && map[v.toLowerCase?.() ?? v] && !(e.tagName === 'circle' && e === circles[0])) e.setAttribute(k, map[v.toLowerCase()]); }
    });
    svg.querySelectorAll('text').forEach((t) => { if (t.querySelector(`textPath[href="#${id}b"]`)) t.setAttribute('fill', label); });
    if (o.dim) svg.style.filter = `brightness(${o.dim})`;
    report.push({ id: a.id, g, ground, thread: +cr(thread, ground).toFixed(2), label: +cr(label, ground).toFixed(2), accent: +cr(accent, ground).toFixed(2), rim: rim.join('/') });
  });
  return report;
};

const CSS = (night) => `
html.sky-cards .patch--gold .patch-svg { filter: none; }
html.sky-cards${night ? '.sky-night' : ':not(.sky-night)'} .pw-item.new::after { background: ${night ? '#ff6b5e' : '#b42a20'}; color: ${night ? '#0b1626' : '#fffdf6'}; box-shadow: 0 1px 2px rgba(13,34,56,.25); }
html.sky-cards .pw-item.new .patch::before { box-shadow: 0 0 0 2px ${night ? 'rgba(255,107,94,.8)' : 'rgba(215,54,43,.7)'}, 0 0 14px ${night ? 'rgba(255,107,94,.25)' : 'rgba(215,54,43,.2)'}; animation: none; }`;

const b = await chromium.launch();
const results = {};
for (const key of only) for (const night of [false, true]) {
  const opt = OPTIONS[key];
  const p = await b.newPage({ viewport: { width: 390, height: 1150 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.addInitScript(([earned, fresh]) => { localStorage.setItem('dev', '1'); localStorage.setItem('patchSeen', JSON.stringify(earned.filter((x) => !fresh.includes(x)))); }, [EARNED, [...NEW]]);
  await p.route('**/js/cards-page.js*', async (r) => { const res = await r.fetch(); let t = await res.text();
    t = t.replace("const wall = $('patch-wall'), { all, dates } = patchWall();", "const wall = $('patch-wall'), { all, dates } = window.__wallHook ? window.__wallHook(patchWall()) : patchWall();");
    await r.fulfill({ response: res, body: t }); });
  await p.goto('http://localhost:8781/cards.html?sky'); await p.waitForTimeout(2000);
  await p.evaluate(async ([earned, keep, night]) => {
    window.__P = await import('./js/patches.js?v=0.1.1807');
    if (night) document.documentElement.classList.add('sky-night');
    window.__wallHook = (w) => { const now = Date.now();
      w.all = w.all.filter((a) => earned.includes(a.id) || keep.includes(a.id));
      w.all.forEach((a) => { const i = earned.indexOf(a.id); if (i >= 0) { a.done = true; w.dates[a.id] = now - i * 6e4; } else a.done = false; });
      window.__all = w.all; return w; };
  }, [EARNED, [...LOCKED_KEEP], night]);
  await p.click('#tab-patches'); await p.waitForTimeout(1200);
  if (!opt.asIs) { await p.addStyleTag({ content: CSS(night) }); results[key + (night ? 'n' : 'd')] = await p.evaluate(`(${transform})(${JSON.stringify(opt)}, ${night})`); }
  // scroll so the tabs sit near the top, like the phone screenshot
  await p.evaluate(() => { const t = document.querySelector('.collection-tabs'); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 24); });
  await p.waitForTimeout(1500); // the merrow and twill images
  await p.screenshot({ path: `${OUT}/${key}-${night ? 'night' : 'day'}.png` });
  await p.close();
}
await b.close();
console.log(JSON.stringify(results, null, 1));
