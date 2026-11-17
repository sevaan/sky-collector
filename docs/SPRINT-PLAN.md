# Sprint plan (written 2026-11-16, for the sprint starting 2026-11-17)

Where Sky Collector stands, what separates it from a top-studio game, and who runs what. Task numbers in brackets
are from docs/PROJECT-PLAN.md.

## Where we are

Solid:
- The rebuild is live (v0.1.1681): Space Collector's code with a thin Sky layer, decoupled from Space Collector.
- Speed matches Space Collector on every measured screen (scripts/perf/budget.mjs with PERF_SKY=1).
- Look: daylight theme, red accent, Flight Plan back, foil pack over moving clouds, light Settings and sheets.
- Content: 412 plane photos with hand-checked framing, airline logos, stamps and levels.
- The sample study is in (docs/research/sample-study.md): 89 types and 225 airlines cover 90% of sightings.

Not yet true:
- Nobody has caught a real plane outdoors with it (Checkpoint A). Everything else rests on this.
- The game loop is Space Collector's with plane cards dropped in: rarity, sets, missions, XP and patches aren't
  designed for planes yet.
- The data is borrowed: the relay is on a host that is shutting down, routes are missing for about half of
  European flights, some routes are wrong, and some regions have no planes at all.

## FIRST THING TOMORROW: a real plane Sky missed (Sevaan, outdoors, 2026-11-16 9:23 PM)

Sevaan saw a plane overhead. Space Collector showed it ("Just a plane": Air Canada Jazz 7897, Embraer 175,
24,800 ft up, 10 km away, drawn in the circle with its dashed path). Sky Collector, at the same time and place, did
not have it. Nothing changed yet, by his instruction. This is the Checkpoint A failure the plan warned about, so it
goes before every track, including the sync.

Find out why before fixing. Suspects, most likely first:
1. **Different plane sources.** Space Collector asks its own server (`/planes`, adsb.lol through Cloud Run) or, in the
   iPhone app, adsb.lol directly from the phone. Sky's website asks the Val Town relay (adsb.lol + adsb.fi merged).
   The relay may have been down, slow, rate-limited (adsb.lol turned away cloud hosts before), or missing that plane.
   Check the relay's answer for Peterborough and compare with adsb.lol direct.
2. **Sky's feed status went unnoticed.** If the relay was failing, did Explore say so, or just show an empty sky?
   (js/planes.js status; Today's "Can't reach the plane feed".)
3. **Sky draws or filters planes differently.** `sky.planesFirst`, the 5° floor on Today, MAX_AGE_S 60, the radius
   (40 nm), stale positions after the app was in the background.
4. **Phone-side:** location not granted on the test site, an old cached build (check the version in Settings), or
   the page asleep in a background tab.

Known from Sevaan: Sky was on v0.1.1681, so an old cached build is ruled out. Not known: whether the radar showed
any planes or Today listed anything (the plane left first). Next time outdoors, check those two.
Then: a side-by-side check script (same place, same minute, both feeds), the fix, and a visible "feed is down" state
on Explore if there isn't one.

## What "top studio" means here, in priority order

1. **It works on the first try outside.** The icon sits on the real plane; a quiet sky is still a good session;
   an empty region explains itself and offers something to do.
2. **A loop worth returning to.** Rarity that fits where you stand, sets you can finish, missions sized to your
   sky, patches with plane art, XP tuned for planes. [12–16]
3. **Data you can trust.** Own backend, bundled route and airport data, wrong routes filtered, better European
   coverage, data terms that allow a store app. [10, 11, 25, 27]
4. **Every card is worth reading.** A checked fact per type and route; a good photo for the top 90 types and 225
   airlines; fewer letterboxed photos. [17]
5. **No seams.** No leftover space content (events, UFO/Santa, stories, notifications, week themes); plane
   versions of Send cards, Observer stats, Circle highlights, Albums/Find, Plus perks. [19, 21]
6. **Proven polish.** Catch→reveal timed for a plane; viewer, reveal, tour and first-run compared against Space
   Collector (the first comparison missed them); 320 px fixes; plane sound and haptics; ft/m and km/mi. [20, 22]
7. **Shippable.** Native apps, store assets, privacy policy. [26, 28]

## Tracks and who runs them

Rule: `js/main.js`, `css/sky-theme.css` and `css/sky-cards.css` have ONE writer at a time (the main session).
Helpers get their own files or write reports. At most 2–3 heavy helpers at once on this Mac.

| Track | What | Who | Files it may write | Output |
|---|---|---|---|---|
| 0. Sync | Bring Space Collector's changes since `fc2de46b` into Sky | Main session, alone, FIRST | everything | one commit |
| A. Loop design | Rarity by place, sets, missions, XP, patch list, from the study | Fable/Opus | `docs/DESIGN-LOOP.md` only | a design Sevaan approves |
| A2. Loop build | Build the approved design | Sonnet, after A | `js/flights.js`, `js/progress.js`, `js/sets.js`, tests | code + tests |
| B. Data | Bundle routes/airports; filter wrong routes; research European route sources and feed terms | Sonnet | `js/routes.js`, `data/`, `relay/`, `docs/DATA-TERMS.md` | code + a terms report |
| C. Photos | Photos for missing top-90 types and top airlines; better-framed replacements for letterboxed ones | Sonnet | `assets/photos/`, `scripts/photos/`, the three photo data modules | photos + contact sheet |
| D. Facts | One fact per type and top route | Haiku drafts, Sonnet checks sources | `js/sky-facts.js` (new) | facts with sources |
| E. QA | Plane catch→reveal in the budget; compare viewer, reveal, tour, first-run at both sizes | Sonnet | `scripts/perf/` only | a findings list |
| F. Seams | Leftover space content; plane versions of hidden features; fixes from E | Main session | main.js, CSS | commits |
| G. Native | Capacitor shell under Sky's own ids | Opus, own session, later | `native/` | a build |

Order for the day:
1. Track 0 alone.
2. Start A, B and E together (A is light). When B or E finishes, start C; D runs any time (cheap).
3. Main session works F while helpers run, then fixes E's findings.
4. Sevaan approves A's design → A2 builds.

## Only Sevaan can do

- **Outdoor test (Checkpoint A):** catch real planes; note whether the icon sits on the aircraft.
- **Backend:** a personal Google Cloud/Firebase project (not the work account) or another host; unblocks the relay,
  Send cards, reminders and usage reports.
- **Art picks still open:** welcome safety card (A–D), name badge, logo mark.
- **Plus:** which plane perks to build (reminders, rare-plane alerts, a Today widget, shinies).
- **Approve the loop design** (track A).

## Port back to Space Collector (offer, don't apply unasked)

The `?resume=1` start hang; the cloud tint option; every orange reading `--gold`; the perf harness's PERF_URL.
