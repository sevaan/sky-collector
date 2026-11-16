# Sky Collector: what becomes of the Tonight tab

Written 2026-11-15. A plan only, no code changed.

Line numbers are for js/main.js as it stood while this was written. main.js was changing during the writing, so
search by function name if a number is off.

---

## The short version

- Call the tab **Today**.
- Satellites can be planned hours ahead. Planes can't. So the page swaps "the plan for the night" for
  **what's up now, what's coming in the next 15 minutes, and how busy your sky usually is**.
- Honest horizons:
  - live position: now
  - straight-line guess: 5 to 15 minutes
  - with the route: up to about 30 minutes for cruising jets
  - hours ahead: only "regulars", flights that pass most days at the same time, learned from history.
- Build it in 12 small steps. The first four need no new data source.

---

## What Space Collector's Tonight has today

The tab is `#nav-sky` (index.html:220), hidden in Sky Collector for now. It opens the `#visible` panel
(index.html:225–241). Two halves:

- **Now** (`#vtab-now`), drawn by `renderVisible()` (main.js:2160)
- **Tonight** (`#vtab-tonight`), drawn by `renderTonight()` (main.js:4222)

The plan behind it, `state.tonight`, comes from `requestTonight()` (main.js:2468). That sends the satellite
catalogue to `js/tonight-worker.js`, which steps from now to dawn a minute at a time. It returns:

- every visible pass: start, peak, height, direction, brightness, Moon distance, fade into shadow
- a count of visible satellites per minute (`curve`), and the same since dusk (`pastCurve`)
- dusk and dawn

The plan is cached in localStorage (`tonightCache`) and redone every 20 minutes or when place or sky changes.

Every section, top to bottom, and what feeds it:

| # | Section | Code | Fed by |
|---|---|---|---|
| 1 | Second-night welcome | `nightTwoCard()` | sighting log |
| 2 | Hero: "Go out now" / next card worth getting, with countdown. Day, cloudy and quiet versions. | `nowHero()` (1938), `stateHero()` (3838), `skyMode()` (3789) | live sky + plan + weather |
| 3 | Parts of the night (dusk, Earth's shadow, dawn), each with a verdict | `renderParts()` (3304), `nightShape()` | plan + weather |
| 4 | Sky window / night strip: dusk to dawn as 16 bars, best window in orange, the headliner's star, a "now" mark | `renderSkyWindow()` (3644), `renderStrip()` (3809), `nightStats()` (3797) | `curve` + weather |
| 5 | Up now row | `upNowRow()` | live sky |
| 6 | Tonight's run: the passes worth catching, with pills (New card +XP, Headliner, Shiny chance, Mission, Week) | `renderRunA()` (3912), `shinyChances()`, `headliner()` (4814), `MISSION_PASS`, `WEEK_PASS` | plan + progress |
| 7 | Missions: three a night plus a bonus challenge, each with "Next: 7:42 PM, east" | `renderMissionsA()` (4094), `dealMissions()` (2783), js/progress.js `MISSIONS` (78), `CHALLENGES` (120), `STARTER` (131) | plan + sighting log |
| 8 | Week theme | progress.js `WEEK_THEMES` (34) | sighting log |
| 9 | All passes: tier chips, New only, Up next / This evening / Late night / Before dawn, "Cloud rolls in", "Busiest", "Dawn" marks. Each row has Show me and a swipe-left bell. | inside `renderTonight()` | plan + weather |
| 10 | Also up tonight: planets and constellations | `alsoUpTonight()` (4516) | astronomy |
| 11 | Worth setting an alarm for: mini cards with a bell | end of `renderTonight()` | plan |
| 12 | Weather line, next clear night | `tonightWeather()` (4564), `fillNextClear()`, js/weather.js | Open-Meteo |
| 13 | Events (meteor showers) | js/events.js, `activeEvent()` | fixed dates |
| 14 | Reminders: bell sheet, free vs Plus | `bellTap()` (2185), `openPassRemind()` (4457), `FREE_KEYS` | native local notifications; web push via js/pass-alerts.js |
| 15 | Weekly recap (a ticket on the first visit of a week) | `weeklyRecap()` (6534), `recapData()` | sighting log |
| 16 | On Explore: "Right now you can catch" chips and "Tonight's plan ›" | `udNow()` (8067), `#ud-now` | live sky |

---

## 1. The name: **Today**

Options looked at:

- **Today.** Pairs with Tonight, so the code and the layout map one to one. Missions, the busy-hours chart and the
  recap are all daily. Short enough for the tab bar.
- **Up Now.** Accurate for the hero, but the page is also about the next 15 minutes and the day's rhythm.
- **Sky Today.** Clear, but long, and "Sky" is already in the app name.
- **Overhead.** Nice word, but it reads as a list, not a plan.

Pick **Today**. One idea for later: after dark the label could say **Tonight**, since planes still fly at night and
Space Collector players know the word. main.js already swaps this label in one nav style (`applyNavProto()`,
8494). That's an open question below.

The day should run midnight to midnight. Space Collector's `nightKey` runs noon to noon, which suits stargazing but
not planes.

---

## 2. Section by section

### Keep, with new contents

**Hero (2).** Becomes **Up now**.
- A plane in your sky: the best catch now (new to you first, then rarest). Its name, where it's headed, "High in
  the west". Show me.
- Nothing up: "Next one in 2 min · WestJet to Calgary, from the west." A countdown, like the satellite hero.
- Modes: `skyMode()` today returns night, day, cloudy or quiet. For planes:
  - **busy**: planes up now
  - **quiet**: none up now, the next one is minutes away
  - **cloudy**: low cloud. "They're up there, behind the cloud. You can still catch them." Catching works by
    position, so cloud doesn't stop play. It just makes it less fun.
  - **dark**: "At night you'll see their lights: red on the left wing, green on the right, a white flash."
- Drop the midnight-sun and Earth's-shadow branches.

**Pass list (9).** Becomes **Coming over next**.
- Every plane predicted to cross your sky in the next ~15 minutes (more for cruising jets with a known route).
- One row each: time ("in 4 min"), tier, New flight / New plane, "To Reykjavík · Icelandair · Boeing 757",
  "from the south · up to 55°". Show me.
- Keep the tier chips and New only.
- Replace Up next / This evening / Late night / Before dawn with **Up now**, **Next 5 minutes**, **Later**.
- Each row says how sure it is: a solid time for planes already close, "about" for further out.
- The row layout (`.b-row`, `.b-face`, `.showme`) can be reused as is.

**Tonight's run (6).** Merges into the top of Coming over next, as the best three with pills:
- New flight +XP, New plane +XP
- Mission
- Week
- Shiny chance (see shinies below)
- Catch of the day (the headliner)

**Headliner.** Becomes **Catch of the day**: the rarest new-to-you flight seen or expected today. Keep the
+25 XP and the "Top of the Bill" patch. Early on it's picked from what's up in the next 15 minutes. Once the
history tiles exist (step 10) it can be a regular: "Emirates A380 to Dubai, usually over around 9:50 PM."

**Night strip (4).** Becomes two things:
- **Next 15 minutes**: a thin timeline, one tick a minute, a dot per plane crossing your sky, coloured by tier.
  Tap it to jump to the list. Honest, because it only shows what we can predict.
- **Today by hour**: 24 bars, a "now" mark, your catches as dots on top.
  - First version: the hours your phone saw (see section 3). Hours with the app closed show as empty outlines,
    not zero.
  - Later: a typical day for your area, from adsb.lol history (step 10). "Busiest 5 to 7 PM."

**Missions (7).** Keep. Three a day plus a bonus challenge. The hint line becomes "Next: WestJet to Calgary in
4 min, from the west." The list is in section 4.

**Week theme (8).** Keep, re-themed (section 4).

**Weather (12).** Keep, retuned for spotting. Open-Meteo's free forecast (already used by js/weather.js:31) has
more fields we can ask for in the same request:
- `cloud_cover_low`: low cloud hides everything. This is the one that matters most.
- `cloud_cover_mid`, `cloud_cover_high`: cruising jets fly at 10–12 km, above most mid cloud and inside high cloud.
- `visibility`: haze and fog.
- Humidity and temperature at 250 hPa (about 10 km up): that's enough to say **contrail day** or not. Contrails
  make planes easy to spot, so it's a fun line: "Contrail weather: look for the white lines."
- Sunrise and sunset: by day you see the shape, at dusk the sunlit plane, at night only lights.

One line, for example: "Clear, contrail weather" or "Low cloud until 3 PM · they're up there, catch by sound."
Drop "next clear night". Add "clears at 3 PM" when low cloud lifts later today.

**Reminders (14).** Changes most. Covered in section 3.

**Weekly recap (15).** Keep. Feed it from Sky Collector's catches (`catches()` in js/sky-catch.js, the
`skyCatches` key) instead of satellite sightings: new flights, new planes, days out, the furthest destination,
the rarest catch.

**Second-day welcome (1).** Keep the idea ("Day two. Here's what your sky does.") once there's a day of history.

**Explore chips (16).** Keep: "Right now you can catch" lists planes in range, and "Today ›" opens the tab.

### Drop

- **Parts of the night (3)**: dusk, Earth's shadow and dawn don't decide anything for planes.
- **Also up tonight (10)**: planets and stars are switched off in Sky Collector (`SKY_ONLY`, main.js:77).
- **Meteor showers (13)**. Later maybe: **rare visitors**, live, "An Antonov An-124 is 200 km north and heading
  your way." That comes out of the wider radius in step 3, not from a calendar.
- **The until-dark countdown and its free reminder**: planes don't wait for dark.
- **js/tonight-worker.js**: not needed. A few hundred planes projected 30 minutes ahead is a few milliseconds of
  work. Do it in a new `js/plane-forecast.js` on the main thread. Keep the worker file for now, since Space
  Collector code still imports around it.

### Change: "Worth setting an alarm for" (11)

Becomes **Regulars worth waiting for**: rare flights that pass most days near the same time. Only once there's
history (step 10). Each with a bell.

### Shinies, re-themed

Space Collector's four kinds map well:
- **Fade into Earth's shadow** becomes **Last light**: the sun has set where you stand, but the plane at 11 km is
  still lit and glows gold. Same sun maths as satellites. Only around sunrise and sunset.
- **Moon crossing** stays: a plane passing close to the Moon. Rare, loved by photographers. The Moon code is in
  js/celestial.js already.
- **Straight overhead** stays: caught above 75°.
- **First catch** stays.

---

## 3. Data: what each part needs and where it comes from

### What we have now

- js/planes.js polls the relay every 10 s (`POLL_MS`, line 16), within 40 nautical miles, about 75 km
  (`RADIUS_NM`, line 17). Each plane has position, height, ground speed, track, climb rate, callsign, type and
  registration.
- Routes come from Virtual Radar Server's free data, by callsign (js/routes.js).
- Polling stops when the app is in the background (planes.js `update()`).

### How far ahead we can honestly predict

A cruising jet does about 15 km a minute. Our 75 km ring is only about **5 minutes** of warning. So:

| Horizon | How | How sure |
|---|---|---|
| Now to 2 min | Live position | Solid. Feed delay is a few seconds. |
| 2 to 5 min | Straight line on current track (planes.js `extrapolate()`) | Good for cruising jets. Poor near airports, where planes turn. |
| 5 to 15 min | Same, from a **wider fetch**: about 120 nm (220 km) every 60 s, only while Today is open | Good for cruise. Airways bend at waypoints, so a plane can swing 10–20 km off the line. Say "about". |
| 15 to 30 min | Great-circle path toward the destination, when the route is known | Fair. Knows where it's going, not the airway. Best for long-haul overflights. |
| Hours | **Regulars**: the same flight passes most days within ~15 min (from history, step 10) | "Usually around 7:40 PM, 5 of the last 7 days." Never a promise. |
| Not yet airborne | Airline schedules (paid APIs such as AeroDataBox) | Out of scope until costed. |

What route data adds:
- A path past the next 15 minutes for cruising jets.
- A better guess for climbing and descending planes: a departure is heading away from its origin, an arrival toward
  its destination. Near a big airport, still keep the horizon short (2–3 min). Which runway is in use changes with
  the wind.
- The card text ("To Reykjavík") in the list before you catch.

What "crosses your sky" means: highest point at least **15° up**. Lower than that, trees and buildings hide it.
planes.js notes a cruising jet is about 8° up at 75 km.

The wider fetch: adsb.lol's point query goes up to 250 nm. Over a busy city, 120 nm can be 400+ planes, about
200 KB a minute. Only fetch it while the Today tab is open, and once a minute. Check the Val Town relay's limits
(`SKY_RELAY` in planes.js) before turning it on for everyone.

### Where each section's data comes from

| Section | Live feed | Phone's own history | Static data (no server) | A server, later |
|---|---|---|---|---|
| Up now hero | 40 nm poll | which ones are new to you | | |
| Coming over next | 120 nm fetch + projection | | route lookups | |
| Next 15 minutes strip | same | | | |
| Today by hour | | **seen log** (below) | **traffic tiles** (step 10) | |
| Catch of the day | next 15 min | | regulars (tiles) | |
| Missions | predictions, for hints | catches | tiles say what's possible here | |
| Weather | Open-Meteo | | | MET Norway (see open questions) |
| Rare visitors | 250 nm fetch, now and then | | | |
| Reminders | | | regulars (tiles) | a watcher for real-time push |
| Weekly recap | | catches | | |

**Seen log (new).** Record every plane the 40 nm poll sees, not just catches: hex, callsign, type, tier, time,
highest elevation. One row per plane per pass. Keep 30 days in IndexedDB (localStorage is too small). This feeds
Today by hour, "you've seen 212 planes today" and later local rarity. Its limit: it only covers hours the app was
open. The chart has to show that honestly.

**Traffic tiles (new, step 10).** adsb.lol publishes daily whole-world history files. A script, run by hand or by
a weekly GitHub Action, could:
- cut the world into cells (say 0.5°)
- for each cell, count planes that crossed above 15° per hour of the week, over the last 2–4 weeks
- list the **regulars**: callsigns seen on most days within the same 30 minutes, with their route and type
- write one small JSON file per cell to `data/traffic/`, served by GitHub Pages

That gives a typical day for anywhere, from day one, with no live server. It's the same work as RESEARCH-PLAN.md
Phase 0 (sample study) and Phase 5 (rarity grid), so build it once. Licence: derived from adsb.lol, so ODbL
share-alike applies to the tiles. They'd need to be published under ODbL with credit.

### Reminders: what's possible where

| Kind | Website | Phone apps (Capacitor) |
|---|---|---|
| In the app, while it's open: "New Rare coming in 4 min, from the north" | Yes: toast and buzz | Yes |
| A regular, hours ahead: "Emirates A380 usually over at 9:50" | Web push via the existing relay pattern (js/pass-alerts.js, relay/push.ts). iPhone only when added to the Home Screen. | Yes: a local notification at the usual time, like satellite passes today. On tap, check it's really coming. |
| Real time from the background: "A rare one is coming right now" | Needs a server watching the feed for you, then push | Same. Apps can't poll in the background on demand (iOS runs background fetch when it chooses, not every minute). |

So:
- v1: in-app pings only.
- v2: regular reminders (local notifications in the apps, web push on the site).
- v3, maybe Plus: a server watcher. It needs a server that polls the feed per area and sends pushes. Space
  Collector's server is switched off here, and adsb.lol turns away cloud servers, so this needs its own decision.

Reminder rules carry over: the bell sheet, the lead time from Settings, free vs Plus (`FREE_KEYS`). Suggestion:
in-app pings free, regular reminders free for one, unlimited with Plus.

---

## 4. Missions, weeks and patches that work everywhere

The test: can someone in Toronto **and** on a farm in Saskatchewan (maybe 5 planes a day) do it? Space Collector
already skips missions the sky can't deliver: `missionsFor(night, possible)` (progress.js:141) draws only from
those with a qualifying pass. For planes, "possible" comes from:
- the next hour's predictions, and
- once tiles exist, what this cell saw on most of the last 7 days.

When a sky is quiet (tiles say under ~3 an hour), deal from the **always possible** set and let helicopters and
light planes count toward "any plane" missions.

### Daily missions (from progress.js `MISSIONS`, line 78)

Marked ✓ = works anywhere planes fly. G = gated on "possible here".

| Space Collector | Sky Collector | |
|---|---|---|
| firstcard (starter) | Collect your first flight or plane | ✓ |
| satellite (starter) | Catch a plane | ✓ |
| planet (starter) | Catch something more than 30° up | ✓ |
| high | Catch something more than 60° up | ✓ |
| low | Catch something under 20° up | ✓ |
| peak | Catch a plane at its highest point | ✓ |
| again | See a flight you already own (daily flights repeat) | ✓ |
| rarenew | Collect a new Rare or better | G |
| epic | Catch something Epic or Legendary | G |
| levelup2 | Turn a card silver or gold | ✓ over time |
| stage | Catch a cargo flight | G |
| old | Catch a type first flown before 1980 (the 737 counts) | ✓ mostly |
| recent | Catch a new-generation plane (A220, A320neo, 737 MAX, 787, A350) | G |
| sixties / eighties | A type first flown in the 1960s / 1980s | G |
| race | Boeing and Airbus on the same day | G |
| soviet, china, europe, asia | An airline from another country | G |
| nations3 | Airlines from three countries | G |
| sats3 | Three different airlines | G |
| junk | Catch a helicopter | G (often easier in the country) |
| debris2 | Two different types from one maker | ✓ mostly |
| conset | Three flights to the same country | G |
| deep | Catch a widebody (two aisles) | G |
| station | Catch a long-haul flight, over 4,000 km | G |
| planets2 | Catch two different plane types | ✓ |
| moon | Catch a plane near the Moon | challenge only |
| fade | Last light: a sunlit plane after sunset | G (dusk and dawn) |
| late | Catch something after 10 PM | G |
| star, brightstar, wanderer | Drop (stars and planets are off) | |

Bonus challenges (`CHALLENGES`, line 120): revisit3 → see 3 you own again ✓; pair10 → two planes within 5
minutes (G, busy skies); brightstar → catch a prop plane (G); wanderer → the same airline twice ✓; levelup ✓.

### Week themes (`WEEK_THEMES`, line 34)

| Space Collector | Sky Collector |
|---|---|
| Rocket stage week | Cargo week: three cargo flights |
| Old-timers week | Classics week: three types first flown before 1990 |
| Station week | Long-haul week: two flights over 4,000 km |
| Fleet week | Airline week: three types from one airline |
| Planet week | Makers week: Boeing, Airbus and one other maker |
| Moon week | Dawn patrol week: three catches before 8 AM |
| Star week | Destinations week: ten new destinations |
| Debris week | Small wings week: three helicopters or light planes (good for quiet skies) |
| China week | World week: airlines from three countries |
| Deep sky week | Widebody week: three widebodies |
| Shiny week | Shiny week: one shiny |
| High flyer week | High flyer week: five catches above 60° |

main.js already swaps a week's theme when the sky can't deliver it. Keep that, fed by tiles.

### Patches (`ACHIEVEMENTS`, line 179; groups in js/patches.js)

| Group | Becomes |
|---|---|
| Collection (first, ten … catalogue, sightings100) | Same counts, of flights and planes |
| Rarity (legend, epic, spectrum, shiny) | Same |
| Rockets (stage, stages25, junk, reunion) | **Cargo**: Freighter, Night Freight (25). **Round trip**: catch a flight and its return (A→B and B→A). Works everywhere, since commuter routes come back. |
| Nations | **Airlines**: airlines from 8 and 15 countries. **Destinations on six continents** (long-term). |
| History (oldtimer, sputnik, coldwar, decades, witness, headliners) | **Classics**: a type first flown before 1970; types from 6 decades; **Last flights**: retiring types (747 passenger, A380); Top of the Bill: 10 catches of the day |
| Fleets | **Fleets**: 5 types from one airline; every type an airline flies over you |
| Solar system, Constellations | **Postcards**: 10, 50, 100 destination cities |
| Sky skills (zenith, horizon, compass, close, far) | Keep: straight overhead; low on the horizon; all 8 compass directions; under 3 km away; over 70 km away; plus **Above it all**: 40,000 ft or higher |
| Time (twilight, owl, dawn, streaks) | Keep: Last light, after midnight, before dawn, streaks |
| New group: **Rotors and others** | Helicopter, air ambulance, balloon, airship. Good for quiet skies. |

---

## 5. Build order

Each step ships to the test site on its own (bump the version, push). Sizes: S = an hour or two, M = half a
day, L = a day or more.

1. **Show the tab as Today (S).** Unhide `#nav-sky` under `SKY_ONLY` (`applyNavProto()`). Title "Today".
   Hide satellite sections. Placeholder: "Planes in your sky now: 6." Stop `requestTonight()` running in Sky
   Collector.
2. **Up now hero + live list (S–M).** From `state.planeItems` (the 40 nm poll). Best catch first. Show me
   aims the sky at it (a plane version of `showMePass()`, main.js:1116, by hex). Busy, quiet and dark modes.
3. **Coming over next (M).** New `js/plane-forecast.js`. A second, wider fetch in `PlaneTracker` (120 nm, every
   60 s, only while Today is open). Project each plane 15 min ahead in 15 s steps with `skyPosition()`. Keep
   those that rise above 15°: start, peak time, peak height, direction. Same shape as tonight-worker's passes,
   so the list rows can be reused. Add the Next 15 minutes strip.
4. **Seen log + Today so far (S–M).** IndexedDB log of every plane seen. 24-bar chart of your hours, honest gaps.
   "212 planes seen today."
5. **Route-aware forecast (M).** Great-circle toward the destination when the route is known (horizon up to
   30 min for cruise). Short horizon for climbing and descending planes near airports. "About" on unsure times.
   Rare visitors: a 250 nm look every 10 minutes for Epic and Legendary types.
6. **Missions and weeks (M–L).** A daily key (midnight to midnight). The mapping in section 4. Hints from the
   forecast. Mission and week pills on list rows. XP from catches.
7. **Spotting weather (S–M).** The extra Open-Meteo fields: low cloud, visibility, contrails, light. One line
   on the hero, cloudy mode.
8. **In-app pings (S).** "Tell me when a new Rare or better is coming." Toast and buzz while the app is open.
9. **Shinies (M).** Last light, Moon crossing, straight overhead. Shiny-chance pills on the list.
10. **Traffic tiles (L).** The adsb.lol history script (shared with the Phase 0 sample study). Typical day by
    hour, regulars per cell, served from `data/traffic/`. The chart becomes "a typical Saturday here".
11. **Regulars and reminders (M).** "Regulars worth waiting for." Bells: local notifications in the apps, web
    push on the site through the relay pattern in js/pass-alerts.js. Catch of the day from regulars.
12. **Weekly recap and patches (M).** Recap from catches; the patch list from section 4.

Later, needs its own decision: a server that watches the feed and pushes "a rare one is coming now" (Plus).

Steps 1–4 make a useful tab with no new data source. Steps 5–9 make it a game. Steps 10–11 make it worth
opening before you go outside.

---

## 6. Open questions for Sevaan

1. **Name:** Today all the time, or Today by day and Tonight after dark?
2. **The wider fetch:** OK to pull about 200 KB a minute through the Val Town relay while Today is open? Or
   only in the apps, which ask adsb.lol directly?
3. **Traffic tiles:** OK to publish them under ODbL with adsb.lol credit? That's what deriving them requires.
4. **Weather source:** Open-Meteo's free tier is for non-commercial use. Space Collector moved to MET Norway
   through its own server for that reason. Sky Collector has no server yet. Which way before launch?
5. **Reminders:** which are free and which are Plus? Suggestion: in-app pings free, one regular reminder free,
   unlimited with Plus.
6. **A server watcher** for real-time background alerts: worth building at all, and when?
7. **Rarity for "Coming over next":** use today's global tiers (flights.js `tierFor()`: distance and cargo), or
   wait for local rarity ("rare here") from tiles before the list leans on it?
8. **Quiet skies:** below what traffic should the page switch to the quiet design ("Your sky is quiet. Here's
   what usually comes by")? Suggestion: under 3 planes an hour.
9. **Catching through cloud:** allowed (position only) or limited when low cloud covers your sky?
10. **The missions day:** midnight to midnight, or 4 AM to 4 AM so a late-night catch counts for the evening?
