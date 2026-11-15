# Sky Collector

Point your phone at the sky, see what's flying (planes, helicopters, balloons and other sky things), tap to collect it.
Started 2026-11-15 as a copy of Space Collector (private repo sevaan/space-collector, which has the full history and its
660 KB CLAUDE.md of decisions). We're turning it into Sky Collector a step at a time, so most code, names and
cards still say "Space Collector" / satellites until they're changed.

Live test build: https://sevaan.github.io/sky-collector/ (GitHub Pages from `main`, root). Every push to `main`
deploys in about a minute. Sevaan tests on his phone, so push small changes often.

## Workflow
- Plain HTML/CSS/ES modules. No build step, no bundler. Keep it that way.
- **Before every commit:** `node scripts/bump.mjs` bumps `js/version.js` and `version.json` and stamps `?v=VERSION`
  on imports (cache-busting; Pages caches files for 10 min). The version shows in the app footer, so Sevaan can tell
  his phone has the new build.
- Local preview: `python3 -m http.server 8765`, open http://localhost:8765.
- Space Collector's server (`js/server.js`), RevenueCat keys (`js/plus.js`) and daily catalogue Action were
  switched off in this copy so it never touches Space Collector's live backend or store setup. Its backend code
  (`functions/`, `worker/`, `relay/`) is kept for reference: `functions/index.js` already proxies live planes from
  adsb.lol, a likely starting point for Sky Collector's data.
- Left out of this repo (still in the private Space Collector repo): store/, design/, site/, notes/, docs/, native/.
