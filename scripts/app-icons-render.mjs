// Renders Sky's alternate app icons from design/icons-sky/IconsSky.dc.html (symbols k2..k8): the 1024 px iPhone icon,
// and Android's adaptive layers (432 px: background, foreground = the mark, monochrome = the mark in white).
import { chromium } from '../node_modules/playwright/index.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
const SRC = new URL('../design', import.meta.url).pathname + '/icons-sky/IconsSky.dc.html', OUT = process.argv[2] || new URL('../design/icons-sky/out', import.meta.url).pathname; // node scripts/app-icons-render.mjs
const html = readFileSync(SRC, 'utf8');
const defs = /<defs>([\s\S]*?)<\/defs>/.exec(html)[1];
const shared = defs.replace(/<symbol[\s\S]*?<\/symbol>/g, ''); // #pl, #tk, gradients, patterns
const NAMES = { k2: 'flight-plan', k3: 'night-flight', k4: 'cheatline', k5: 'blueprint', k6: 'golden-age', k7: 'airmail', k8: 'cockpit' };
const parts = {};
for (const k of Object.keys(NAMES)) {
  const body = new RegExp(`<symbol id="${k}"[^>]*>([\\s\\S]*?)</symbol>`).exec(defs)[1];
  const i = body.indexOf('<circle cx="50" cy="50" r="27"');
  parts[k] = { bg: body.slice(0, i), fg: body.slice(i) };
  // Tidying (2026-11-19): Blueprint's outline plane at 2.4, not 1.7, so it still reads at 60 px; Flight Plan's gold
  // inset frame follows the iPhone's rounded square, so Android's circle (bgAndroid) leaves it out.
  if (k === 'k5') parts[k].fg = parts[k].fg.replace('stroke-width="1.700"', 'stroke-width="2.4"');
  parts[k].bgAndroid = k === 'k2' ? parts[k].bg.replace(/<rect x="5" y="5"[^>]*\/>/, '') : parts[k].bg;
}
// The mark in white for the monochrome layer: the ring's outline, the ticks and a solid plane.
const MONO = `<circle cx="50" cy="50" r="27" fill="none" stroke="#fff" stroke-width="4.5"/><use href="#tk" fill="#fff"/><use href="#pl" transform="translate(50 50) rotate(45) scale(.9)" fill="#fff"/>`;
// Android: 108 dp canvas, the launcher shows at most the middle 72 dp and keeps a 66 dp circle safe. The mark's ticks
// reach 41 units from the centre, so on the foreground it's drawn at 0.76 of the 100-unit art (31 of 54 dp: inside the
// safe circle with room), and the background art is stretched to fill the whole 108 dp so its edges don't show.
const svg = (inner, size, view = '0 0 100 100') => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="${view}"><defs>${shared}</defs>${inner}</svg>`;
const fgView = (() => { const s = 100 / 0.76 * (108 / 100), h = s / 2; return `${50 - h} ${50 - h} ${2 * h} ${2 * h}`; })(); // the 100-unit mark at 0.76 of a 108 dp canvas
const bgView = fgView; // the same scale as the mark, so the launcher's middle 72 dp shows about the whole iPhone icon (95 of its 100 units); the bleed beyond is the background colour
const jobs = [];
for (const [k, name] of Object.entries(NAMES)) {
  const { bg, fg } = parts[k];
  jobs.push([`${name}-1024.png`, svg(bg + fg, 1024)]);
  jobs.push([`${name}-android-background.png`, svg(`<rect x="-200" y="-200" width="500" height="500" fill="${/fill="(#[0-9a-f]{6}|url\(#\w+\))"/.exec(bg)[1]}"/>` + parts[k].bgAndroid, 432, bgView)]);
  jobs.push([`${name}-android-foreground.png`, svg(fg, 432, fgView)]);
  jobs.push([`${name}-android-monochrome.png`, svg(MONO, 432, fgView)]);
}
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
for (const [file, s] of jobs) {
  const size = /width="(\d+)"/.exec(s)[1];
  await p.setViewportSize({ width: +size, height: +size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await p.locator('svg').first().screenshot({ path: `${OUT}/${file}`, omitBackground: true });
}
await b.close(); console.log(jobs.length, 'files');
