// Render the generic art: each scene's card window to WebP 594x400 (<= 14 KB), plus a contact sheet PNG.
// usage: node render.mjs [preview|final] [only-id,...]
import { chromium } from '/Users/sevaan/code/sky-collector/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const mode = process.argv[2] || 'preview', only = process.argv[3] ? process.argv[3].split(',') : null;
const REPO = '/Users/sevaan/code/sky-collector', SCR = '/private/tmp/claude-501/-Users-sevaan-code-sky-collector/1223ec00-1d41-4d24-b585-c7f7129d0cc3/scratchpad/fa';
const outDir = mode === 'final' ? `${REPO}/assets/art/sky-generic` : `${SCR}/out`;
fs.mkdirSync(outDir, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text()); });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:8794/design/generic-art/final-2026-11-21.html', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
await p.waitForTimeout(500);
const ids = await p.$$eval('[data-shot]', (els) => els.map((e) => e.dataset.shot));
const results = {};
for (const id of ids) {
  if (only && !only.includes(id)) continue;
  const png = await p.locator(`[data-shot="${id}"]`).screenshot({ type: 'png' });
  // encode in the page: draw the 594x400 PNG on a canvas and step quality down until it fits 14 KB
  const r = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 594; c.height = 400; c.getContext('2d').drawImage(img, 0, 0, 594, 400);
    let q = .82, url;
    for (;;) { url = c.toDataURL('image/webp', q); const bytes = Math.floor((url.length - 'data:image/webp;base64,'.length) * 3 / 4); if (bytes <= 14 * 1024 || q <= .5) return { url, q, w: img.naturalWidth, h: img.naturalHeight }; q = Math.round((q - .03) * 100) / 100; }
  }, png.toString('base64'));
  const buf = Buffer.from(r.url.split(',')[1], 'base64');
  fs.writeFileSync(`${outDir}/${id}.webp`, buf);
  results[id] = { bytes: buf.length, q: r.q, src: `${r.w}x${r.h}` };
  console.log(id, buf.length, 'q', r.q, r.w + 'x' + r.h);
}
// contact sheet from the encoded WebPs: full card (297x200) and the mini (92x106, object-fit: cover) beside it
const cells = ids.filter((id) => fs.existsSync(`${outDir}/${id}.webp`)).map((id) => {
  const d = 'data:image/webp;base64,' + fs.readFileSync(`${outDir}/${id}.webp`).toString('base64'), kb = (fs.statSync(`${outDir}/${id}.webp`).size / 1024).toFixed(1);
  return `<div class="c"><div class="row"><img class="full" src="${d}"><img class="mini" src="${d}"></div><div class="lab"><b>${id}</b><span>${kb} KB</span></div></div>`;
}).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#eef5fb;font:13px system-ui,sans-serif;color:#0d2238}
h1{font:600 16px system-ui;margin:16px 18px 0}p{margin:4px 18px 0;color:#5b6878}
.g{display:grid;grid-template-columns:repeat(3,auto);gap:18px 22px;padding:16px 18px 20px;justify-content:start}
.row{display:flex;gap:10px;align-items:flex-start}.full{width:297px;height:200px;object-fit:cover;border-radius:3px;box-shadow:0 0 0 1.2px #1f4f8f}
.mini{width:92px;height:106px;object-fit:cover;border-radius:3px;box-shadow:0 0 0 1px #1f4f8f}
.lab{display:flex;gap:10px;align-items:baseline;margin-top:6px}.lab b{text-transform:uppercase;letter-spacing:.06em}.lab span{color:#5b6878}</style></head>
<body><h1>Sky Collector generic plane art, final set (2026-11-21)</h1><p>Each WebP (594 x 400) at the card's photo window (297 x 200) and the Collection mini (92 x 106, object-fit: cover).</p><div class="g">${cells}</div></body></html>`;
const sheet = await b.newPage({ viewport: { width: 1250, height: 800 }, deviceScaleFactor: 2 });
await sheet.setContent(html, { waitUntil: 'load' });
await sheet.waitForTimeout(300);
const sheetPath = mode === 'final' ? `${REPO}/design/generic-art/final-contact-2026-11-21.png` : `${SCR}/out/contact.png`;
await sheet.screenshot({ path: sheetPath, fullPage: true });
if (mode !== 'final') { await sheet.setViewportSize({ width: 1250, height: 800 }); }
console.log('sheet', sheetPath);
await b.close();
