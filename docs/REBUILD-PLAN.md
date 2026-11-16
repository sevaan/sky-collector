# Rebuild: Sky Collector as a thin layer on Space Collector

Sevaan, 2026-11-15: "Maybe we should start over from the Space Collector code base and then make changes to style it…
Starting over lets you use the real code." Chosen: a fresh copy of today's Space Collector plus a Sky layer (not one shared
codebase with a Sky build, not more fixes to the current fork).

## Why

The first fork drifted: 84 of Space Collector's files changed, 711 lines of override CSS, parallel UI (Today's own buttons,
the old catch panel, the old Collection). Each drift was a place Space Collector's behaviour or polish didn't reach, and
Sevaan kept finding them by hand. Space Collector has also moved on since the fork (live activities, world-ready facts,
server fixes) and Sky only gets that by hand-merging.

## The rule for the rebuild

Every Sky change to a Space Collector file must be one of three things, and nothing else:

1. **A theme variable.** Colours live in `css/sky-theme.css`, which re-points Space Collector's own CSS variables. Where Space
   Collector hard-codes a colour, the fix is to make that one place read a variable, not to override it from outside.
2. **A plane branch** behind the one flag (`SKY_ONLY` in main.js, `SKY` in cards-page.js, `setSkyProgress` in progress.js),
   where planes genuinely play differently: what's catchable, the catch itself, stamps, Today, the card face. Each branch
   says why in a comment.
3. **Copy**: names and words ("Sky Collector", "Today", plane How to play).

Plane-only code lives in its own modules and is copied over unchanged. The Sky layer is kept as a small, readable set of
changes so the next sync from Space Collector is a re-apply, not a re-port.

## Sevaan's asks to build in (2026-11-16)

- Today's top card is Space Collector's Tonight hero card (`.tn` hero), with its weather: live clouds and rain from the
  forecast (js/weather-art.js cloudsHtml / rainHtml), not a plain gradient.
- Every orange in Sky becomes red: one accent variable in the theme (labels, chart bars, tab indicator, links, chips), not
  per-element overrides.

## Base

Space Collector at its latest commit (`fc2de46b`, 2026-11-15), committed files only (`git archive`), excluding store/,
design/, site/, notes/, docs/, native/ as before. Built on a `rebuild` branch; the test site keeps serving the current
version from `main` until the rebuild passes side-by-side checks, then `rebuild` replaces `main`.

## The Sky layer

**Set-up (from the first fork):** rename to Sky Collector, Space Collector's server, RevenueCat keys and catalogue Action
switched off, Sky's own storage name and icon.

**Plane modules, copied unchanged:** js/planes.js (Sky's, with the relay list and status), routes.js, flights.js,
flight-card.js (card face artwork only), airlines.js, airline-photos.js, airline-logos.js, type-photos.js, photo-fit.js,
sky-cards.js, sky-stamps.js, sky-today.js; relay/; assets (card backs, pack, plane photos, logos, tear sound); scripts
(photos, logos, art, research); docs; tests for those modules.

**Plane branches in Space Collector's code** (from Milestone 1.5, re-applied):
- card.js: `renderCard` / `renderCardTile` plane branch (Space Collector's `.card` shell around the plane face).
- card-model.js: plane stamp keys (day for flights, aircraft for plane types).
- main.js: planes as the only catchable things; the plane in the circle fills `#discover`; `capturePlane` → Space
  Collector's capture, reveal and `showCaptureCard` with plane fleet stamps; Show me guidance to a plane; planes on the
  radar; Today page (`renderSkyToday`) with rows opening cards; card models from plane sightings; How to play slides;
  tour and welcome copy; page marker for the header theme.
- cards-page.js: no satellite catalogue; plane cards from your catches; Albums and Find hidden until plane sets exist.
- progress.js: plane missions, starter, challenges and patch list.

**Card back:** Engine is the default (Sevaan, 2026-11-15); the other Sky backs are Plus.

**Theme:** daylight palette, red (#d7362b) for buttons and primary actions, light header and tabs everywhere except Explore
at night.

**Dropped:** sky-collection.js, sky-catch.js's own panel, sky-progress.js, catch-store.js (the one-time import of old
catches stays), the 711-line override sheet.

**Fixes that belong in Space Collector too** (offered to Sevaan, not applied there without asking): the `?resume=1` hang at
start, and any hard-coded colour turned into a variable.

## Checks before switching the test site

- Every screen side by side with Space Collector at 390 × 844 and 320 × 640: same layout, components and animations; only
  palette, red and plane content differ (docs/VISUAL-AUDIT.md method, run once on the rebuild).
- Performance: Space Collector's performance meter and startup timings on both; Sky no slower.
- Tests: Space Collector's suite plus Sky's module tests.
- Old catches import and show; card backs, logos, photos and stamps as today.

## Progress

1. Done: `rebuild` branch = Space Collector `fc2de46b` (committed files, same exclusions) + Sky's plane modules, assets,
   scripts, relay and tests; planes.js = Sky's (relay list, feed status, airline table, routes) + Space Collector's new
   worldwide airline names. Dropped: sky-collection.js, sky-progress.js, css/sky.css. Nothing wired yet.
2. Next: set-up (user-visible names only, Space Collector's server / RevenueCat / Action off), then re-apply each plane
   branch by a three-way merge of main's change to that file onto the fresh file, reviewing every hunk against the rule
   (theme variable, plane branch, or copy; anything else is dropped), then the theme file.
3. Done (2026-11-16): plane branches re-applied by three-way merge, every hunk reviewed: old unconditional changes now
   `SKY_ONLY ? plane : Space Collector's original`; renderPlane → renderSkyPlane branch; dead old reveal removed; Sky's
   storage names kept (IndexedDB `sky-collector`, `sky-collector.explore`, `skycollector://`, skycollector.app) so the
   phone's existing catches carry over (checked: 15 sightings, 11 plane cards found). sky.js gets `planesFirst` and uses
   its own `showShadow`; progress.js applies Sky's rank names only in Sky mode.
4. Done: every hard-coded orange in Space Collector's CSS (384, plus 74 with transparency) reads `--gold`; `--gold` has a
   default on every page (ui.css). css/sky-theme.css re-points it to red and carries the daylight look;
   css/sky-cards.css holds Sky's own components (card face, Today, stamps, logos, photo framing, hidden satellite UI).
5. Runs: starts, finds old catches, planes in the sky, light chrome by day, red accent.

## Space Collector features the rebuild brings that need plane content (found on first run)

- Weekly recap ("Your week"): works with plane cards; its picture is a satellite and "Coming up" is an astronomy event.
- Last night's pack ("Your night, in a pack"): works with plane catches; the ticket art is Space Collector's pack.
- Sky event tickets (meteor showers, the Moon meets Jupiter): astronomy, not planes. Hide in Sky or make plane events.
- Still to check: secrets/stories, Tonight's notifications and reminders, Send cards (gifting), patches page, Plus sheet,
  share pictures, morning notification, 9 PM notes.
