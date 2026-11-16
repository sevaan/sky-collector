# Sky Collector: project plan

Written 2026-11-15 by a producer's review of the code at v0.1.1607. This is the list the main session works
through when Sevaan says "Go". It replaces nothing: docs/RESEARCH-PLAN.md and docs/TONIGHT-PLAN.md stay the
detailed references, and this file says what to do, in what order, and who (which model) does it.

---

## State of the game

**What makes a flight-catching game work.** Four beats, in order:

1. **Notice.** The app tells you a plane worth having is up, and where.
2. **Find and catch.** You point, the app's plane sits on the real plane, you collect. It feels fair and a little skilful.
3. **Reward.** A card that is worth looking at, that tells you something you didn't know, and that moves a number.
4. **Come back.** Something is left undone: a mission, a set, a rare regular that passes at 9:50 PM.

**Where Sky Collector stands on each.**

| Beat | State | What's there | What's missing (checked in code) |
|---|---|---|---|
| Notice | Half | Today page: Up now, Coming over next, by-hour chart | No way to be told when the app is closed. Radar dial doesn't show planes. |
| Find and catch | Half | Plane in the 6° circle shows the catch panel; Collect plays the reveal | "Show me" with motion on is only a toast ("Look north, about 30° up"), no arrow. No limit on re-collecting the same plane. Never tested against real planes for lag. |
| Reward | Strong look, thin substance | High-fidelity cards, real photos for 75 types, Space Collector's reveal | "+80 XP" is shown but never saved: there is no XP, rank or level. The fact on every flight card is one generated sentence. |
| Come back | Empty | Collection with two tabs | No missions, sets progress, patches, streaks, regulars or reminders for planes. |

**The honest summary.** The card is ahead of the game. Most of the day's effort has gone to how cards and card
backs look. The loop underneath has real holes, and two of them are bugs that make the game wrong outside
North America. Art rounds should stop until the loop is whole and has been played on a phone outdoors.

### Bugs and risks found in this review

1. **Four in ten airline flights aren't recognised as flights until after you collect.** `planes.js` only starts
   a route lookup when the callsign prefix is in its hand-typed `AIRLINES` list (55 airlines, mostly North
   American). In the study sample, 551 of 1,391 airline callsigns (40%) are outside it: Ryanair, easyJet, IndiGo,
   Qantas and so on. For those the catch panel and Today say "NEW PLANE", Today scores them as planes, and the card
   prints the airline as its three-letter code ("RYR"). `sky-catch.js collect()` does look the route up, so the
   card that comes out is a flight, which is how this hid.
2. **You can collect the same plane over and over.** `collect()` has no check on the aircraft or the time. Every
   tap is "SEEN AGAIN" and adds a row. Counts and any future XP are farmable.
3. **XP is display only.** `skyReveal()` passes 80/60/10 to the reveal; nothing stores it and `rank` is null.
4. **A relay failure looks like a quiet sky.** `PlaneTracker` counts failures but nothing reads the count. Today
   shows "Quiet sky" whether the sky is empty, the relay is down, or the feed has no receivers there.
5. **Coverage is thin in whole regions.** One evening snapshot from the study (planes within 75 km): New York
   124–151, Toronto 51–62, Tokyo 61–65, but Frankfurt 1–3, Delhi 4, Johannesburg 1–2, Lagos 0, Nairobi 0–1,
   Reykjavík 0–1. Frankfurt at 10 PM local is not an empty sky, so that is the feed, not the traffic. The relay
   asks adsb.lol first and only tries adsb.fi and airplanes.live when adsb.lol fails outright, never when it is
   merely sparse.
6. **Three outside dependencies, none ours.** The plane relay is on Val Town (shutting down). Routes and airports
   are fetched live from `raw.githubusercontent.com/vradarserver/standing-data/main` with no pinned version and
   no offline copy. adsb.lol has already turned away cloud servers once. Any one failing stops the game.
7. **Korean Air is cargo.** `flights.js` `CARGO` contains `KAL`, so every Korean Air passenger flight is Epic and
   in the Cargo set.
8. **Sets are Canadian.** "Across Canada", "North America", "Across the Atlantic", "Sun Destinations": a player
   in Jakarta gets "Around the World" for everything. Tiers are distance only, the same everywhere.
9. **Registrations are shown and stored for every aircraft**, including private ones. RESEARCH-PLAN Phase 6
   proposes type only for private and general-aviation aircraft.
10. **Web only.** Space Collector's `native/` was left out of this repo. Background alerts, direct feed calls
    from the phone and the store builds all depend on bringing it over.
11. **Tests.** 81 pass, 6 fail (gift links 25–30, inherited). Nothing tests flights, routes, tiers or the catch store.
12. **Not checked, worth a look:** `routes.js` splits CSV lines on commas; an airport name with a comma inside
    quotes would shift the columns. And `skyCatches` is mirrored whole into localStorage (about 1 KB a catch), which
    runs out somewhere past a few thousand catches.

---

## Verdict on the work in flight

| | Work | Verdict | Why |
|---|---|---|---|
| A | Airline-matched photos on flight cards | **Continue to the finish, then stop.** | It improves the main card, it is nearly done, and it is bounded. Land what it found. No second search round for the gaps. |
| B | Design room round 3 for card backs | **Let the two agents finish, then freeze.** | The tokens are spent. Sevaan picks one or keeps Cheatline. No round 4 until Milestone 2 is done. Card backs are seen for half a second in the reveal. |
| C | Pack art, 3 options | **Parked on Sevaan's pick.** | One pick, applied once in task 23. No new options. |
| D | Name-badge shape on Cheatline | **Parked on Sevaan's pick.** | Same: applied with C in task 23. |
| E | Six logo-mark options | **Let it finish, then park.** | The mark is needed for the store icon (Milestone 4), not before. |
| F | Lighter inner shadows on welcome and tour pictures | **Commit with the next push.** | It is done. |

**Cut for now:** mission patch art (it needs the missions list first, task 16), any further card-back or card-front
fidelity passes, and new back designs for Plus.

**The rule from here:** one art decision batch per milestone. Options go to Sevaan once, he picks, it's applied,
it's closed.

---

## How to run this list

- **Models.** Opus (the main session) does three things only: surgery in `js/main.js` (8,700 dense lines where a
  wrong edit breaks the app), design decisions, and reviewing what comes back. Sonnet builds anything that lives
  in its own module or script. Haiku does tables, sweeps, test files and mechanical edits.
- **At most two or three agents at once** on this Mac. Give each one its files and its done-when from this list.
- **Each task ends with** `node --test tests/` no worse than before, `node scripts/bump.mjs`, a commit, a push.
- **Tasks marked PHONE** aren't done until Sevaan has tried them outdoors. Work continues on the next task meanwhile.
- **Tasks marked SEVAAN** need his decision. They are checkpoints. Nothing unrelated waits on them.
- Space Collector is the reference for layout and animation. Compare at 390 × 844 with the two apps side by side.

---

## Milestone 1: playable core on a phone

Goal: stand outside anywhere, find a plane, catch it once, get a card that counts. Tasks 1–4 are independent and
can run in parallel.

**1. Every airline is a flight.** Sonnet.
- Goal: a route lookup for every airline-style callsign, and the airline's real name, before you collect.
- Files: new `js/airlines.js` (ICAO code → name, built from Virtual Radar Server's airlines file plus the current
  hand list as overrides), new `scripts/build-airlines.mjs`, `js/planes.js` (`route()`, `airlineFor`).
- Done when: on `data/research/samples-*.jsonl.gz`, 95% or more of airline callsigns get a name; a Ryanair or
  IndiGo callsign shows "To <city>" in the catch panel and Today without collecting; a test covers it.

**2. Catching again stamps the card, like Space Collector's fleet cards.** Sonnet builds, Opus reviews. (Sevaan,
2026-11-15: "you should just get a new stamp on it each time … like the fleet cards in Space Collector".)
- Goal: a card you already own gets a stamp, not a duplicate. Stamps level the card Bronze → Silver → Gold the way
  fleet launches do (`js/card-model.js` `fleetLevel`, `stampsIn`; `js/card.js` dot map and "N / M stamped" line).
- What a stamp is:
  - Flight card (e.g. ROU1908 Toronto → Reykjavík): one stamp per day you catch it, dated, like a passport stamp.
  - Plane card (e.g. A321): one stamp per individual aircraft (hex) of that type, and the airline's colours it
    flew in, so "7 A321s in 4 liveries".
- Re-catching the same aircraft on the same day gives nothing: the panel says "STAMPED TODAY" with the button off.
- Thresholds to start: flights 1 / 5 / 15 days, plane types 1 / 10 / 50 aircraft. XP for a new stamp, less than a new card.
- The reveal for a re-catch plays Space Collector's "new stamp" moment instead of a new-card reveal.
- Files: `js/sky-catch.js` (`catchPanel`, `collect`), `js/flights.js` (stamp keys), `js/flight-card.js` (stamp row,
  level frame), `js/sky-collection.js` (level and stamp count on mini cards), `js/main.js` `skyReveal` (Opus), `css/sky.css`.
- Done when: a second catch of the same flight on another day adds a dated stamp and moves the level; the same
  aircraft twice in one day does nothing; tests cover both.

**3. Small correctness fixes.** Haiku.
- Remove `KAL` from `CARGO` in `js/flights.js`; delete the dead ternary in `tierFor`.
- Hide the registration on cards and in the sightings list when the aircraft has no airline callsign
  (`js/flight-card.js`, `js/sky-collection.js`); stop saving it for those in `js/sky-catch.js`.
- Check `routes.js` CSV parsing against a quoted airport name; fix if it breaks.
- Done when: tests for the three exist and pass.

**4. Honest sky states and a wider feed.** Sonnet.
- Goal: tell apart "nothing up", "can't reach the plane feed" and "few receivers near you". Fill thin regions.
- Files: `relay/planes.ts` (and the Deno and Cloudflare copies), `js/planes.js`, `js/sky-today.js`, `js/main.js`
  (one status line on Explore; Opus makes that edit).
- Build: the relay asks all three feeds at once and merges by hex (newest position wins), and says which answered.
  `PlaneTracker` exposes `status` (ok, failing, never loaded). `planeRelay` becomes a list tried in order.
- Done when: with the relay URL broken, Today says the feed can't be reached; `scripts/research/sample-study.py`
  run once per feed shows the merged count for Frankfurt, Delhi and Johannesburg next to adsb.lol alone.

**5. XP and rank that are real.** Sonnet builds, Opus wires `main.js`.
- Goal: a catch adds XP that is saved, the reveal shows the rank bar filling, the header shows the rank.
- Files: new `js/sky-progress.js` (XP per catch, rank thresholds, stored with the catches and in the iCloud
  backup), `js/main.js` (`skyReveal` passes `rank`), `js/cloud-backup.js`.
- Done when: XP survives a reload, a rank-up plays Space Collector's rank-up chip, and re-collecting gives nothing (task 2).

**6. Lead me to the plane.** Opus. PHONE.
- Goal: Show me, with motion on, steers you to a plane the way Space Collector steers you to a satellite. Planes
  appear on the radar dial.
- Files: `js/main.js` (`skyShowMe`, `findPlane`, guidance and `updateCompass`, which draws only `state.items` today).
- Done when: tapping Show me on Today shows the arrow and turn hint until the plane is in the circle; the dial shows
  a dot per plane, with new-to-you ones marked; a plane that leaves range ends the guidance with a message.

**7. Does the drawn plane sit on the real one?** Opus. PHONE (this one needs Sevaan outdoors).
- Goal: measure and fix lag between the icon and the aircraft in the sky.
- Build first: a hidden test readout under More showing each plane's data age in seconds and which feed it came from.
- Sevaan's playtest, ten planes: is the icon on the plane, ahead or behind, by how much; does the catch feel fair;
  is the circle too easy or too hard for low, fast planes.
- Then: adjust extrapolation, poll rate or the circle's slack from what he reports.
- Done when: Sevaan says the icon is on the plane for jets at cruise and near enough for low traffic.

**8. The loop screens match Space Collector.** Sonnet audits, Opus reviews and fixes `main.js` parts. PHONE.
- Goal: the three screens in the loop are as tidy as Space Collector's: Explore with the catch panel, the reveal,
  the card viewer. The reveal gets a daylight background instead of the dark starfield.
- Files: `css/sky.css`, `css/reveal.css`, `index.html`, `js/main.js` (`skyReveal`).
- Method: side-by-side screenshots at 390 × 844 and 320 wide; a written list of each difference in spacing, type
  size, radius and alignment; fix the list.
- Done when: the list is empty and Sevaan signs it off on his phone.

**CHECKPOINT A (SEVAAN, PHONE):** twenty minutes outdoors with the build after tasks 1–8. His notes become the
first tasks of Milestone 2.

---

## Milestone 2: reasons to come back

**9. Read the study.** Sonnet runs it, Opus reads it.
- Goal: once the 24-hour sample is complete, `python3 -I scripts/research/analyse-study.py` writes
  `docs/research/sample-study.md`.
- Done when: the file has, per place, planes per hour by hour of day, the share with a route, and the type and
  airline lists that cover 90% and 99%. Opus adds a half-page "what this means" at the top: which places are
  playable, when, and what a quiet-sky player sees in a day.

**10. A permanent home for the relay.** SEVAAN decides, Sonnet ports.
- Options to put to him: (a) a new Cloudflare account on a personal email, since the login problem is with the
  account not the product; (b) Vercel or Netlify edge function, signed in with GitHub, free tier; (c) a small
  personal GCP project, which he'll want anyway for Milestone 4.
- The relay is one 60-line fetch handler; porting is an hour. Test first that the chosen host isn't turned away by
  the feeds, as Val Town and Cloud Run were.
- Done when: the site reads from the new host, with Val Town kept as the second entry until it closes.
- This is only for the website. In the apps each phone asks the feeds itself (task 26).

**11. Routes and airports that don't depend on GitHub being up.** Sonnet.
- Goal: pin Virtual Radar Server's data to a commit, keep fetched files on the phone between sessions (Cache
  storage), and ship the airports table with the app.
- Files: `js/routes.js`, `sw.js`, new `scripts/build-airports.mjs`, `data/airports.json`.
- Done when: a route already seen resolves with the network off.

**12. Rarity that fits where you stand.** Opus designs from task 9, Sonnet builds.
- Goal: a sensible pyramid in every study place (mostly Common, a few Epic), replacing distance-only tiers.
- First version, no server: world rarity for aircraft types from the study, plus "rare here" learned on the phone
  from the seen log (a flight or type you see less than once a week).
- Files: `js/flights.js` (`tierFor`, plane tier), `js/sky-today.js` (seen log kept for 30 days, not one), new
  `data/type-rarity.json`.
- Done when: the model, run over the study data, gives each of the 30 places a pyramid, written up in
  `docs/research/rarity-and-sets.md`.

**13. Sets anyone can finish.** Opus designs, Sonnet builds.
- Goal: replace the Canadian sets with global ones (continents reached, widebody families, alliances, helicopters)
  and local ones made per player (airlines at your nearest airport, your regulars).
- Files: `js/flights.js` (`setFor`), new `js/sky-sets.js`, `js/sky-collection.js` (set progress on the Collection page).
- Done when: every study place has at least three sets it can complete; Collection shows progress bars.

**14. Missions sized to your sky.** Opus writes the mission list, Sonnet builds.
- Goal: three missions a day on Today, dealt from what your sky can deliver (from the seen log: a quiet sky gets
  "catch 2 planes", a busy one "catch 3 widebodies"). XP on completion, shown as chips in the reveal.
- Files: new `js/sky-missions.js` (modelled on `js/progress.js` `MISSIONS` and `dealMissions`), `js/sky-today.js`, `js/main.js`.
- Done when: missions appear, tick off on a catch, reset at local midnight, and a test deals a doable set for a
  5-planes-a-day sky and a 500-planes-a-day sky.

**15. Today earns its tab.** Sonnet.
- Goal: Catch of the day; the quiet-sky version of the page (what usually comes by, from the 30-day log);
  regulars ("Emirates to Dubai, most days around 9:50 PM").
- Files: `js/sky-today.js`, `css/sky.css`.
- Done when: after a week of logs (simulate with the study data) the page shows regulars; under 3 planes an hour
  it switches to the quiet design.

**16. Patches.** Opus lists them, Sonnet builds, art after.
- Goal: about 20 patches earned from catches, sets and missions (first helicopter, ten airlines, five continents,
  a week's streak), shown where Space Collector shows them.
- Files: new `js/sky-patches.js` (modelled on `js/patches.js`), Collection page.
- Art: painted with the existing card-back script once the list is fixed. One round, SEVAAN picks.
- Done when: each patch can be earned in every study place or is clearly marked as a travel patch.

**17. Cards that teach you something.** Haiku drafts, Sonnet checks each fact against its source, Opus spot-checks 20.
- Goal: a real fact, with a source link, for the aircraft types that make up 95% of sightings (from task 9), the
  top 200 airlines (include the radio callsign word, "Speedbird"), and the top 200 destination cities.
- Files: `data/types.json`, `data/airlines.json`, `data/destination-facts.json`, `js/flights.js`, `js/flight-card.js`.
- Done when: the generated "as the crow flies" sentence only appears when no written fact exists.
- Run as two or three agents at a time, in batches of about 40.

**18. Airline logos, with the off switch.** Sonnet. SEVAAN checks the sheet.
- As RESEARCH-PLAN Phase 3: Wikidata P154, public domain or CC0 only, the match rule, a contact sheet for a human
  check, one switch that hides every logo. Logos sit beside the airline's name and nowhere else.
- Done when: the top 200 airlines are checked on the sheet and the switch works.

**CHECKPOINT B (SEVAAN, PHONE):** a week of ordinary use. Does he open it without being asked?

---

## Milestone 3: polish

**19. The rest of the alignment audit.** Sonnet, Opus reviews. Today, Collection grid and viewer, tour, welcome,
toasts and notifications against cards. Same method as task 8.

**20. Feet, metres, miles.** Haiku. Extend `js/localize.js` for ft↔m and km↔mi; use it on cards, the catch panel and Today.

**21. Leftover Space Collector.** Haiku sweeps, Sonnet fixes. Every string, setting, panel and file load that is
still about satellites and reachable in Sky Collector. Also: does the app still download the satellite catalogue
and start its workers at launch? If so, stop it.

**22. Speed on a phone.** Sonnet. Measure first frame, frame rate on Explore with 100 planes, memory after 30
minutes (`js/perf-meter.js`). Fix the worst two.

**23. Art decisions, one batch.** SEVAAN picks, Sonnet applies. Card back from round 3 (B), pack art (C), name
badge (D). Applied together, then closed.

**24. Tests worth having.** Haiku. Fix or remove the six gift-link tests. Add tests for `flights.js` (tiers, sets),
`routes.js` (parsing), `catch-store.js` (merge, restore), `sky-missions.js`.

---

## Milestone 4: launch prep

**25. Data terms and privacy, written down.** Sonnet researches, Opus writes the policy.
`docs/research/data-sources.md` and `docs/research/legal-privacy.md` as RESEARCH-PLAN Phases 1 and 6: each
feed's commercial-use terms, ODbL duties, the private-aircraft and police-helicopter policy, the logo licence
question. **This decides whether the game can sell Plus on these feeds at all**, so start the reading during
Milestone 2 even though it lands here.

**26. The phone apps.** Opus. Bring Space Collector's Capacitor shell into this repo under Sky Collector's own
bundle ID. Phones ask the feeds directly. Local notifications for regulars and missions.

**27. Its own backend and name.** SEVAAN. A personal GCP/Firebase project (never the work account), a domain, the
privacy contact, Plus pricing and what Plus includes.

**28. Store pieces.** Sonnet. Icon from the logo pick (E), screenshots and preview video with Space Collector's
`scripts/store` method, listing text, the App Review note on airline logos.

---

## Decisions waiting on Sevaan

| # | Decision | Needed by | Blocks |
|---|---|---|---|
| 1 | Card back from round 3, or keep Cheatline | Task 23 | Nothing else |
| 2 | Pack art pick | Task 23 | Nothing else |
| 3 | Name-badge shape | Task 23 | Nothing else |
| 4 | Logo mark | Task 28 | Nothing else |
| 5 | Relay host (new Cloudflare account, Vercel/Netlify, or personal GCP) | Task 10 | Only the website once Val Town closes |
| 6 | Catching through cloud: allowed? Missions day: midnight or 4 AM? (TONIGHT-PLAN questions 9 and 10) | Task 14 | Task 14 only |
| 7 | Plus: price and perks | Task 27 | Launch |

## Top risks

1. **The data isn't ours and may not cover the world.** Empty feeds over Lagos, Nairobi and (in one snapshot)
   Frankfurt, three third-party hosts in the path, and commercial terms unread. Tasks 4, 9, 10, 11 and 25. If the
   terms say no, the plan changes, so read them early.
2. **Polish keeps winning over play.** A day of card-back rounds against a loop with no XP, no missions and a
   farmable Collect. The one-art-batch-per-milestone rule is the control.
3. **Nobody has caught a real plane with it yet.** Whether the icon sits on the aircraft, and whether a quiet sky
   is any fun, is unknown until tasks 7 and 9 report. Everything in Milestone 2 is sized by those two answers.
