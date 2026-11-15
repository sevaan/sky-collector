// Draw a piece of the page into a canvas exactly as it looks (2026-10-31, Sevaan: the share image must match the card).
// Every element's computed style is written inline on a copy, ::before/::after become rules, and pictures, masks and
// fonts are embedded as data URLs; the copy is drawn through an SVG <foreignObject>. Animations and transitions are
// dropped, so what's drawn is the current frame.
const DROP = /^(animation|transition|will-change|cursor|pointer-events|user-select|-webkit-user-select|touch-action)/;
const URL_RE = /url\((['"]?)(.*?)\1\)/g;
const dataCache = new Map();

function toData(url) {
  if (!url || url.startsWith('data:')) return Promise.resolve(url);
  if (!dataCache.has(url)) dataCache.set(url, fetch(url).then((r) => r.ok ? r.blob() : null).then((b) => b && new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = () => ok(''); f.readAsDataURL(b); })).catch(() => ''));
  return dataCache.get(url);
}
// Replace every url(...) in a CSS value with its data URL.
async function inlineUrls(css, base) {
  const found = [...css.matchAll(URL_RE)];
  if (!found.length) return css;
  const data = await Promise.all(found.map((m) => m[2].startsWith('#') ? `#${m[2].slice(1)}` : toData(new URL(m[2], base).href))); /* url(#id) is a reference inside the copy */
  let i = 0; return css.replace(URL_RE, () => `url("${data[i++] || ''}")`);
}
function styleText(cs, extra = '') {
  let t = '';
  for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (!DROP.test(p)) t += `${p}:${cs.getPropertyValue(p)};`; }
  return t + extra;
}
// @font-face rules for the fonts in use, each with only its first source, embedded.
async function fontCss(doc, families) {
  const out = [];
  for (const sheet of doc.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) {
      if (r.type !== CSSRule.FONT_FACE_RULE) continue;
      const fam = r.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
      if (!families.has(fam)) continue;
      const first = (r.style.getPropertyValue('src').match(/url\([^)]*\)(\s*format\([^)]*\))?/) ?? [])[0];
      if (!first) continue;
      out.push(inlineUrls(`@font-face{font-family:'${fam}';src:${first};font-weight:${r.style.getPropertyValue('font-weight') || 'normal'};font-style:${r.style.getPropertyValue('font-style') || 'normal'};}`, sheet.href ?? doc.baseURI));
    }
  }
  return (await Promise.all(out)).join('\n');
}

// el: the element. pad: room around it (for an outer glow). skip(node) leaves an element out; skipPseudo(node, '::after')
// leaves out one of its pseudo-elements; extra(node) adds CSS to an element (e.g. to undo a tilt). Returns a canvas `scale` times the element's layout size (+ pad).
export async function snapElement(el, { scale = 2, pad = 0, skip = () => false, skipPseudo = () => false, extra = () => '' } = {}) {
  const doc = el.ownerDocument, win = doc.defaultView, base = doc.baseURI;
  const W = el.offsetWidth + pad * 2, H = el.offsetHeight + pad * 2;
  const rules = [], waits = [], families = new Set();
  let n = 0;
  const copy = (node, root) => {
    if (node.nodeType === 3) return doc.createTextNode(node.nodeValue);
    if (node.nodeType !== 1 || skip(node)) return null;
    const cs = win.getComputedStyle(node);
    if (cs.display === 'none') return null;
    let out;
    if (node.tagName === 'CANVAS') { out = doc.createElement('img'); try { out.src = node.toDataURL(); } catch {} }
    else out = node.cloneNode(false);
    out.removeAttribute('class'); /* ids stay: SVG masks and gradients point at them (the Moon's phase shade) */ out.removeAttribute('srcset'); out.removeAttribute('loading');
    if (out.tagName === 'IMG' && node.tagName === 'IMG') waits.push(toData(node.currentSrc || node.src).then((d) => out.setAttribute('src', d || '')));
    cs.getPropertyValue('font-family').split(',').forEach((f) => families.add(f.replace(/['"]/g, '').trim()));
    const own = root ? 'transform:none;translate:none;rotate:none;scale:none;margin:0;position:relative;left:auto;top:auto;' : '';
    const flat = (cs.transform.startsWith('matrix3d') ? 'transform:none;' : '') + 'transform-style:flat;perspective:none;' /* 3D layers (tilt, parallax) drawn flat */
      + (cs.textOverflow === 'ellipsis' ? 'text-overflow:clip;overflow:visible;' : ''); /* zoomed text can come out a hair wider than its fixed box: never cut it to "STATIO…" */
    let st = styleText(cs, own + flat + extra(node));
    if (st.includes('url(')) waits.push(inlineUrls(st, base).then((s) => out.setAttribute('style', s)));
    out.setAttribute('style', st);
    for (const pseudo of ['::before', '::after']) {
      const pc = win.getComputedStyle(node, pseudo), content = pc.getPropertyValue('content');
      if (!content || content === 'none' || content === 'normal' || skipPseudo(node, pseudo)) continue;
      const cls = `sn${n++}`; out.classList.add(cls);
      rules.push(inlineUrls(`.${cls}${pseudo}{${styleText(pc)}}`, base));
    }
    for (const ch of node.childNodes) { const c = copy(ch, false); if (c) out.appendChild(c); }
    return out;
  };
  const clone = copy(el, true);
  await Promise.all(waits);
  const css = (await Promise.all(rules)).join('\n') + '\n' + await fontCss(doc, families);
  const wrap = doc.createElement('div');
  wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrap.setAttribute('style', `width:${W}px;height:${H}px;padding:${pad}px;box-sizing:border-box;zoom:${scale};`); /* scaled here, not by a viewBox (WebKit draws foreignObject at 1× under one) or a transform (box-shadows land in the wrong place) */
  const style = doc.createElement('style'); style.textContent = css; wrap.append(style, clone);
  const xhtml = new XMLSerializer().serializeToString(wrap);
  const SW = Math.round(W * scale), SH = Math.round(H * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><foreignObject x="0" y="0" width="${SW}" height="${SH}">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const c = doc.createElement('canvas'); c.width = SW; c.height = SH;
  const ctx = c.getContext('2d');
  // Safari can paint a foreignObject's embedded pictures and fonts a frame late: draw, wait, draw again.
  ctx.drawImage(img, 0, 0, c.width, c.height);
  await new Promise((r) => setTimeout(r, 120));
  ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
