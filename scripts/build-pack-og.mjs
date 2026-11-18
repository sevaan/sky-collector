// The link-preview picture for the sample pack page, skycollector.app/pack/og.jpg (2026-11-18, Sevaan: "Make sure those
// sample pack pages have the right meta data and seo stuff"). The page is sent as a link in Messages, WhatsApp and the
// like, so this 1200x630 picture is the first thing a friend sees. It is the page itself, photographed: the real sealed
// Sky Blue pack on the page's daylight sky and clouds, moved to the right, with the page's own words, fonts and colours on
// the left. Writes site/pack-src/og.jpg (kept: site/public is wiped by build-site.mjs), which build-site-pack.mjs copies
// into site/public/pack. Rebuild it when the pack's look changes.
// Usage: node scripts/build-site.mjs && node scripts/build-pack-og.mjs  (serves site/public itself on a spare port)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), PUB = join(ROOT, 'site/public'), OUT = join(ROOT, 'site/pack-src/og.jpg');
if (!existsSync(join(PUB, 'pack/index.html'))) throw new Error('build the site first: node scripts/build-site.mjs');
const { chromium } = await import(process.env.PW ?? 'playwright');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  let f = join(PUB, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(PUB) || !existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
}).listen(0);
const port = server.address().port;

const icon = 'data:image/png;base64,' + readFileSync(join(PUB, 'apple-touch-icon.png')).toString('base64');
const CSS = `
  #gift .gp-head, #gift .gp-x, #gift .gp-hint, #gift .gp-cue, #gift .gp-count2 { display: none !important; }
  #gift .gp-pk, #gift .gp-deck { translate: 230px 18px; scale: 1.24; }
  #og { position: fixed; z-index: 2147483647; left: 84px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; text-align: left; color: #0d2238; }
  #og .k { font: 600 22px 'SC Label', sans-serif; letter-spacing: .26em; text-transform: uppercase; color: #b42a20; }
  #og h1 { margin: 14px 0 0; font: 400 82px/.95 'SC Display', sans-serif; text-transform: uppercase; color: #0d2238; }
  #og p { margin: 22px 0 0; font: 500 32px/1.25 'SC Label', sans-serif; color: #16314c; }
  #og .app { display: flex; align-items: center; gap: 16px; margin-top: 46px; font: 400 30px 'SC Display', sans-serif; text-transform: uppercase; letter-spacing: .01em; }
  #og .app img { width: 64px; height: 64px; border-radius: 15px; box-shadow: 0 4px 12px rgba(13,34,56,.25); }
  #og .app span { display: block; font: 600 19px 'SC Label', sans-serif; letter-spacing: .14em; color: #23405c; margin-top: 2px; }`;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`http://localhost:${port}/pack/`); await p.waitForSelector('#gift .gp-pk');
await p.addStyleTag({ content: CSS });
await p.evaluate((icon) => {
  const d = document.createElement('div'); d.id = 'og';
  d.innerHTML = `<div class="k">A sample pack</div><h1>Cards from<br>the sky</h1><p>Real planes over your own backyard.<br>Open it in your browser.</p>
    <div class="app"><img src="${icon}" alt=""><div>Sky Collector<span>SKYCOLLECTOR.APP</span></div></div>`;
  document.body.appendChild(d);
}, icon);
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
writeFileSync(OUT, await p.screenshot({ type: 'jpeg', quality: 86 }));
await b.close(); server.close();
if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
console.log('og image:', OUT.replace(ROOT + '/', ''), Math.round(statSync(OUT).size / 1024), 'KB');
