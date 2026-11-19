// Every Sky screen by night and by day (2026-11-18, Sevaan: "All the screens" dark at night): a fresh page per screen,
// a seeded collection, the recorded Toronto feed, the clock fixed. Screenshots to OUT (default scripts/qa/out/night).
//   PERF_SKY=1 PERF_URL=http://localhost:8768/ node scripts/qa/night-screens.mjs [night|day] [webkit|chromium] [size] [only,screens]
import { open, URL0 } from '../perf/harness.mjs';
import { mkdirSync } from 'node:fs';
const [when = 'night', eng = 'webkit', size = '393x852', only = ''] = process.argv.slice(2);
const OUT = process.env.OUT || new URL('./out/night', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const at = when === 'night' ? '2026-11-18T23:30:00-05:00' : '2026-11-18T13:30:00-05:00';
const frame = (p) => p.frames().find((x) => /cards\.html/.test(x.url()));
const tap = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const fTap = async (p, sel) => { const f = frame(p); const e = f && await f.$(sel); if (!e) return false; await e.tap().catch(() => f.evaluate((x) => x.click(), e)); return true; }; /* a real tap: the Collection's tabs answer pointer events */
const settings = async (p, W) => { await tap(p, '#nav-more'); await W(1500); };
const collection = async (p, W) => { await tap(p, '#nav-collection'); await W(4500); };
const SCREENS = {
  explore: async (p, W) => { await p.evaluate(async () => { const v = document.querySelector('script[src*="main.js"]')?.src.split('?')[1] ?? ''; const { ticket } = await import('/js/toast.js?' + v); ticket({ kind: 'mission', eyebrow: 'Mission complete', line: 'Night Shift', xp: 50, ms: 20000 }); }); await W(1500); },
  today: async (p, W) => { await tap(p, '#nav-sky'); await W(3500); },
  'today-scrolled': async (p, W) => { await tap(p, '#nav-sky'); await W(3500); await p.evaluate(() => { const t = document.getElementById('sky-today'); (t?.closest('.overlay, section') ?? document.scrollingElement)?.scrollBy?.(0, 900); t?.scrollBy?.(0, 900); }); await W(1200); },
  around: async (p, W) => { await tap(p, '#radar'); await W(3500); },
  collection: collection,
  viewer: async (p, W) => { await collection(p, W); const t = await frame(p)?.$('.tile-slot .card-tile'); await t?.tap(); await W(2500); },
  albums: async (p, W) => { await collection(p, W); await fTap(p, '#tab-albums'); await W(2000); },
  patches: async (p, W) => { await collection(p, W); await fTap(p, '#tab-patches'); await W(2000); },
  'patch-card': async (p, W) => { await collection(p, W); await fTap(p, '#tab-patches'); await W(1800); const t = await frame(p)?.$('.pw-item'); await t?.click({ force: true }); await W(1800); },
  find: async (p, W) => { await collection(p, W); await fTap(p, '#tab-discover'); await W(2000); },
  stats: async (p, W) => { await settings(p, W); await tap(p, '#set-stats-open'); await W(4000); },
  settings: settings,
  plus: async (p, W) => { await settings(p, W); await tap(p, '#set-plus-open'); await W(2000); },
  backs: async (p, W) => { await settings(p, W); await tap(p, '#set-back-open'); await W(2000); },
  location: async (p, W) => { await settings(p, W); await tap(p, '#set-loc-open'); await W(1500); },
  credits: async (p, W) => { await settings(p, W); await tap(p, '#set-credits'); await W(1500); },
  howto: async (p, W) => { await settings(p, W); await tap(p, '#set-howto'); await W(1800); },
  tell: async (p, W) => { await p.evaluate(() => window.__tell?.('open')); await W(1500); },
  recap: async (p, W) => { await p.evaluate(() => window.__showRecap?.()); await W(2500); },
};
const list = only ? only.split(',') : Object.keys(SCREENS);
for (const name of list) {
  const { b, p, W, hud, seed, errs } = await open(eng, { size, dsf: 2, at });
  try { await p.goto(URL0); await hud().catch(() => {}); await seed(80); await p.reload(); await hud().catch(() => {}); await W(5000);
    await p.evaluate(() => { const r = document.getElementById('recap'); if (r && !r.hidden) r.querySelector('button')?.click(); }); await W(400);
    await SCREENS[name](p, W);
    await p.screenshot({ path: `${OUT}/${when}-${eng}-${size}-${name}.png` });
    const night = await p.evaluate(() => document.documentElement.classList.contains('sky-night'));
    console.log(when, name.padEnd(15), 'sky-night', night, errs.length ? errs.slice(0, 2) : '');
  } catch (e) { console.log(when, name, 'FAILED', String(e).slice(0, 120)); }
  await b.close();
}
