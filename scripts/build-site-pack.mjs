// The sample pack page, skycollector.app/pack (2026-11-18, Sevaan: Space Collector's Tell a friend, for Sky). What a player
// sends when they tell a friend about the game: a pack of three plane cards (PLANES below) and a last card about the game,
// played in any browser with the game's own pack, cards and sounds. Space Collector's version is its
// scripts/build-site-pack.mjs + site/public/pack; this is the same idea for planes.
// It copies the game's modules into site/public/pack/js (imports followed, static and dynamic; ?v stamps removed so each
// module loads once), the CSS they need with its fonts and pictures, the card backs, the three planes' photos and the
// sounds. The page itself (index.html, pack.js) is hand-written in site/pack-src and copied in: site/public is wiped by
// scripts/build-site.mjs, which runs this at its end. Usage: node scripts/build-site-pack.mjs (or node scripts/build-site.mjs)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), OUT = join(ROOT, 'site/public/pack'), SRC = join(ROOT, 'site/pack-src');
const ENTRIES = ['gift-pack.js', 'card.js', 'card-backs.js', 'rarity.js', 'sfx.js', 'audio-ctx.js', 'flights.js', 'sky-cards.js', 'flight-card.js', 'pack-flight.js', 'pack-flights.js', 'airline-photos.js', 'airline-logos.js', 'routes.js', 'planes.js', 'card-moment.js'];
export const PLANES = ['A388', 'DC3']; // the Airbus A380 and the Douglas DC-3, after a live flight card (js/pack-flight.js); keep in step with site/pack-src/pack.js

rmSync(OUT, { recursive: true, force: true });
const seen = new Set(), queue = ENTRIES.map((f) => join(ROOT, 'js', f));
while (queue.length) {
  const file = queue.pop(); if (seen.has(file)) continue; if (!existsSync(file) || !statSync(file).isFile()) { console.warn('skipped (not a file):', relative(ROOT, file)); continue; } seen.add(file);
  const src = readFileSync(file, 'utf8'), dest = join(OUT, 'js', relative(join(ROOT, 'js'), file));
  mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, src.replace(/(\.js)\?v=[0-9.]+/g, '$1'));
  for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"]*['"](\.{1,2}\/[^'"?]+)/gm)) queue.push(join(dirname(file), m[1]));
  for (const m of src.matchAll(/\bimport\(\s*['"](\.{1,2}\/[^'"?]+)/g)) queue.push(join(dirname(file), m[1]));
}
const copy = (rel) => { const from = join(ROOT, rel); if (!existsSync(from) || !statSync(from).isFile()) return false; const to = join(OUT, rel); mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); return true; };
const copyDir = (rel, keep = () => true) => { let n = 0; for (const f of readdirSync(join(ROOT, rel))) if (keep(f) && copy(join(rel, f))) n++; return n; };
// the stylesheets, and every font and picture they name
let cssFiles = 0;
for (const f of ['fonts.css', 'cards.css', 'gift.css', 'ui.css', 'sky-theme.css', 'sky-cards.css']) {
  const css = readFileSync(join(ROOT, 'css', f), 'utf8'); copy(join('css', f));
  for (const m of css.matchAll(/url\(\s*['"]?\.\.\/((?:fonts|assets)\/[^'")?#]+)/g)) if (copy(m[1])) cssFiles++;
}
// the three planes' photos: whatever the game's own card markup asks for, full size and small
globalThis.localStorage = { getItem: () => null, setItem() {} }; globalThis.Image ??= class { decode() { return Promise.resolve(); } }; /* js/card-backs.js preloads a back as it loads */
const J = (f) => import(join(ROOT, 'js', f));
const { planeCardHtml, skyCardPhotoUrl } = await J('flight-card.js'); const { cardsFor, retier } = await J('flights.js'); const { skyModel } = await J('sky-cards.js');
let photos = 0;
for (const type of PLANES) {
  const card = retier(skyModel(cardsFor({ type, callsign: '', reg: '' }, null, '').plane, 'plane'));
  const html = planeCardHtml({ ...card, type }, { sightings: 0, eager: true, stampInfo: { count: 0, level: null, toNext: 1, stamps: [], liveries: [], liveryCount: 0, kind: 'plane' } }) + planeCardHtml({ ...card, type }, { sightings: 0, small: true, stampInfo: { count: 0, level: null, toNext: 1, stamps: [], liveries: [], liveryCount: 0, kind: 'plane' } });
  const want = new Set([...html.matchAll(/assets\/[^"')\s]+\.(?:webp|png|jpg|svg)/g)].map((m) => m[0]));
  for (const size of ['sm', 'tiny', 'full']) { const u = skyCardPhotoUrl({ ...card, type }, type, size); if (u) want.add(u.replace(/^\.?\//, '')); }
  let got = 0; for (const u of want) if (copy(u)) got++;
  if (!got) throw new Error(`no photo found for ${type}`);
  photos += got;
}
// Only what this page can show or play (2026-11-18: it shipped all 36 backs and 31 sounds, 7.4 MB): the backs a new
// visitor can be dealt (js/card-backs.js: the unlocked ones) and the sounds pack.js lists in PAGE_SFX.
const { CARD_BACKS, backUnlocked } = await J('card-backs.js');
const backFiles = new Set(CARD_BACKS.filter((b) => { try { return backUnlocked(b); } catch { return false; } }).map((b) => b.url.split('/').pop()));
const backs = copyDir('assets/art/backs', (f) => backFiles.has(f));
const pageSfx = new Set(JSON.parse((/const PAGE_SFX = (\[[^\]]*\])/.exec(readFileSync(join(SRC, 'pack.js'), 'utf8'))?.[1] ?? '[]').replace(/'/g, '"')));
if (!pageSfx.size) throw new Error('PAGE_SFX not found in site/pack-src/pack.js');
const sfx = copyDir('assets/audio/sfx', (f) => pageSfx.has(f.replace(/\.mp3$/, '')));
// The flight card (js/pack-flight.js): a live airliner over the visitor's city can be any airline with a logo and a photo
// of its own aircraft, so their route data, photos (full, small, blur) and logos ship. They are fetched one at a time, a
// card's worth, but they are big: kept out of git (.gitignore), rebuilt by this script before every deploy.
const { AIRLINE_PHOTOS } = await J('airline-photos.js'); const { AIRLINE_LOGOS } = await J('airline-logos.js');
const lines = new Set(Object.keys(AIRLINE_LOGOS).filter((a) => existsSync(join(ROOT, 'data/routes/r', a + '.json'))));
let flightFiles = 0;
for (const a of lines) { if (copy(`data/routes/r/${a}.json`)) flightFiles++; if (copy(`assets/logos/${a}.webp`)) flightFiles++; }
for (const k of Object.keys(AIRLINE_PHOTOS)) if (lines.has(k.slice(0, 3))) for (const d of ['', 'sm/', 'tiny/']) if (copy(`assets/photos/airlines/${d}${k}.webp`)) flightFiles++;
copy('data/routes/airports.json');
for (const f of ['index.html', 'pack.js', 'og.jpg']) copyFileSync(join(SRC, f), join(OUT, f));
console.log('pack page: modules', seen.size, '· css pictures and fonts', cssFiles, '· plane photos', photos, '· backs', backs, '· sounds', sfx, '· flight card files', flightFiles, 'for', lines.size, 'airlines');
