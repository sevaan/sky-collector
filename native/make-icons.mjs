// Sky Collector's app icons and launch screens for the native apps (2026-11-19), all drawn from icons/icon.svg:
//   iOS: AppIcon (1024, no alpha) and the Splash image set (2732 square, aspect-filled by LaunchScreen.storyboard)
//   Android: legacy ic_launcher / ic_launcher_round (48-192 px), the adaptive icon's layers (108 dp: background = the sky,
//   contrails and clouds; foreground = the lock-on circle and the plane, inside the 66 dp safe zone; monochrome = the
//   foreground in white for themed icons), and the splash.png drawables at the sizes Space Collector's shell has.
// The launch screens are Sky's daylight: the loading screen's sky gradient (#8cc2ec to #eef5fb, css/sky-theme.css #start)
// with the lock-on mark in the middle, so the hand-over to the web app's loader is smooth.
// Usage (from native/): node make-icons.mjs   (needs Playwright's Chromium, as scripts/export-icons.mjs)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..');
const svg = readFileSync(join(root, 'icons/icon.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const RES = join(here, 'android/app/src/main/res'), XC = join(here, 'ios/App/App/Assets.xcassets');

// The icon's parts: everything up to the dashed path is the sky (background); the circles, ticks and plane the mark.
const open = svg.slice(0, svg.indexOf('</defs>') + 7), close = '</svg>';
const body = svg.slice(open.length, svg.lastIndexOf(close));
const cut = body.indexOf('<circle');
const skyPart = body.slice(0, cut), markPart = body.slice(cut);
const mark = (scale) => `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${markPart}</g>`;
const navyMark = markPart.replaceAll('stroke="#fff"', 'stroke="#0d2238"').replaceAll('fill="#fff"', 'fill="#0d2238"');
const ICON = svg;
const BG = open + skyPart + close;
const FG = open + mark(0.75) + close; /* ticks 142..882 of 1024 -> 23%..77%: inside the 66/108 safe zone */
const DAY = '<linearGradient id="day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cc2ec"/><stop offset=".55" stop-color="#cfe5f6"/><stop offset="1" stop-color="#eef5fb"/></linearGradient>';

const browser = await chromium.launch();
async function render(markup, w, h = w, { css = '', transparent = false } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}${css}</style>${markup}`);
  const png = await page.screenshot({ type: 'png', omitBackground: transparent });
  await page.close(); return png;
}
// A launch screen: the day gradient filling w x h, the mark (sized by the shorter side) in the middle
const splash = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs>${DAY}${open.replace(/^<svg[^>]*>\s*<defs>/, '').replace('</defs>', '')}</defs><rect width="${w}" height="${h}" fill="url(#day)"/>`
  + `<g transform="translate(${w / 2} ${h / 2}) scale(${Math.min(w, h) * 0.3 / 1024}) translate(-512 -512)">${navyMark}</g></svg>`;
/* on the light sky the mark is the loader's navy (index.html .wc-loader), with its red lock-on */
const noAlpha = (file) => { execFileSync('sips', ['-s', 'format', 'jpeg', file, '--out', file + '.jpg'], { stdio: 'ignore' }); execFileSync('sips', ['-s', 'format', 'png', file + '.jpg', '--out', file], { stdio: 'ignore' }); execFileSync('rm', [file + '.jpg']); };
const size = (f) => execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', f]).toString().match(/\d+/g).slice(-2).map(Number);

try {
  // iOS
  const appIcon = join(XC, 'AppIcon.appiconset/AppIcon-512@2x.png');
  writeFileSync(appIcon, await render(ICON, 1024)); noAlpha(appIcon); /* App Store icons may not have an alpha channel */
  for (const f of readdirSync(join(XC, 'Splash.imageset')).filter((n) => n.endsWith('.png'))) writeFileSync(join(XC, 'Splash.imageset', f), await render(splash(2732, 2732), 2732));
  // Android
  const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(DENS)) {
    const dir = join(RES, `mipmap-${d}`), L = Math.round(48 * k), A = Math.round(108 * k);
    writeFileSync(join(dir, 'ic_launcher.png'), await render(ICON, L, L, { css: 'svg{border-radius:12%;overflow:hidden}', transparent: true }));
    writeFileSync(join(dir, 'ic_launcher_round.png'), await render(ICON, L, L, { css: 'svg{border-radius:50%;overflow:hidden}', transparent: true }));
    writeFileSync(join(dir, 'ic_launcher_background.png'), await render(BG, A));
    writeFileSync(join(dir, 'ic_launcher_foreground.png'), await render(FG, A, A, { transparent: true }));
    writeFileSync(join(dir, 'ic_launcher_monochrome.png'), await render(FG, A, A, { css: 'svg{filter:brightness(0) invert(1)}', transparent: true }));
  }
  for (const d of readdirSync(RES).filter((n) => n.startsWith('drawable'))) {
    const f = join(RES, d, 'splash.png'); try { statSync(f); } catch { continue; }
    const [w, h] = size(f); writeFileSync(f, await render(splash(w, h), w, h));
  }
  console.log('icons and launch screens written');
} finally { await browser.close(); }
