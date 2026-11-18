// Export the app icon (icons/icon.svg) to every size the app and the website use:
//   icons/icon-{180,192,512,1024}.png   home screen (180 = apple-touch-icon), manifest, App Store / iOS AppIcon (1024)
//   icons/favicon-{16,32,48}.png        browser tabs
//   icons/favicon.ico                   16, 32 and 48 in one file (PNG-in-ICO), for browsers and tools that ask for /favicon.ico
// Then `node scripts/build-site.mjs` copies them to skycollector.app.
//   node scripts/export-icons.mjs        (needs Playwright's Chromium: npx playwright install chromium)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const out = (f) => new URL(`icons/${f}`, root).pathname;
const svg = readFileSync(new URL('icons/icon.svg', root), 'utf8');
const browser = await chromium.launch();
const png = {};
try {
  for (const size of [16, 32, 48, 180, 192, 512, 1024]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    png[size] = await page.screenshot({ type: 'png' });
    await page.close();
    const name = size <= 48 ? `favicon-${size}.png` : `icon-${size}.png`;
    writeFileSync(out(name), png[size]); console.log(`icons/${name}`);
  }
} finally { await browser.close(); }

// favicon.ico: a 6-byte header, a 16-byte entry per image, then the PNGs themselves
const sizes = [16, 32, 48], head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => { const e = 6 + 16 * i, data = png[s];
  head.writeUInt8(s, e); head.writeUInt8(s, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += data.length; });
writeFileSync(out('favicon.ico'), Buffer.concat([head, ...sizes.map((s) => png[s])])); console.log('icons/favicon.ico');
