// Bump the patch version and stamp it onto every script/stylesheet reference, so phones never mix
// a new page with cached old modules. Run before every commit:
//   node scripts/bump.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const jsPath = new URL('js/version.js', root);
const js = readFileSync(jsPath, 'utf8');
const current = js.match(/VERSION = '(\d+)\.(\d+)\.(\d+)'/);
const next = `${current[1]}.${current[2]}.${Number(current[3]) + 1}`;
writeFileSync(jsPath, js.replace(/VERSION = '[^']+'/, `VERSION = '${next}'`));
writeFileSync(new URL('version.json', root), JSON.stringify({ version: next }) + '\n');

// import ... from './x.js' and bare import './x.js'  →  './x.js?v=NEXT'
// (bare side-effect imports were missed until 2026-10-16: stories.js stayed at ?v=0.1.680, so cached phones kept an old copy)
// and dynamic import('./x.js') (2026-10-29: lazy-loaded modules), so a lazy load gets the same copy as a static one
const stampImports = (s) => s.replace(/((?:from|import)\s*\(?\s*'\.{1,2}\/[^'?]+\.js)(\?v=[^']*)?'/g, `$1?v=${next}'`);
for (const f of readdirSync(new URL('js/', root))) {
  if (!f.endsWith('.js')) continue;
  const p = new URL(`js/${f}`, root);
  const s = readFileSync(p, 'utf8');
  const out = stampImports(s);
  if (out !== s) writeFileSync(p, out);
}

// index.html: <link rel="modulepreload"> for every module main.js imports (statically, all the way down), between the
// modulepreload markers, so the app loads them in parallel instead of one import level at a time (2026-11-11 startup
// timings on an iPhone 14: ~280 ms from the page starting to main.js running). Stamped with ?v= below like any js href.
{ const seen = [], stack = ['main.js'];
  while (stack.length) { const f = stack.pop(); if (seen.includes(f)) continue; seen.push(f);
    let src = ''; try { src = readFileSync(new URL(`js/${f}`, root), 'utf8'); } catch { continue; }
    const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/') + 1) : '';
    for (const m of src.matchAll(/^\s*import\s(?:[^;'"]*?\sfrom\s)?['"]\.\/([\w./-]+\.js)(?:\?v=[^'"]*)?['"]/gm)) stack.push(dir + m[1]); }
  const p = new URL('index.html', root), s = readFileSync(p, 'utf8');
  const block = `<!-- modulepreload:start -->\n${seen.filter((f) => f !== 'main.js').map((f) => `  <link rel="modulepreload" href="js/${f}">`).join('\n')}\n  <!-- modulepreload:end -->`;
  const out = s.replace(/<!-- modulepreload:start -->[\s\S]*?<!-- modulepreload:end -->/, block);
  if (out !== s) writeFileSync(p, out); }

// <script src="js/x.js"> and <link href="css/x.css">  →  ?v=NEXT
for (const f of readdirSync(root)) {
  if (!f.endsWith('.html')) continue;
  const p = new URL(f, root);
  const s = readFileSync(p, 'utf8');
  const out = s.replace(/((?:src|href)="(?:js|css)\/[^"?]+\.(?:js|css))(\?v=[^"]*)?"/g, `$1?v=${next}"`);
  if (out !== s) writeFileSync(p, out);
}

// sw.js: a cache per version, so each deploy's service worker starts clean (2026-10-10).
{ const p = new URL('sw.js', root), s = readFileSync(p, 'utf8'); writeFileSync(p, s.replace(/const CACHE = '[^']+';/, `const CACHE = 'sc-${next}';`)); }

console.log(`v${next}`);
