# Sky missions: full draft

Draft, 2026-11-20. Nothing built. For Sevaan to mark up.

★ = my pick. ✂ = I'd cut it (reason given).
(kept) = already in Sky's js/progress.js. (new) = not built.

## How to read each mission

- Line 1: id, how hard, kept or new.
- Then the words the app shows, in quotes.
- Data: what decides it.
- Airport / Rural: how often it can be done.
  - Airport = a mid-size airport 5 to 15 km away.
  - Rural = a quiet sky under an airway, 1 to 4 planes an hour, mostly cruising.
  - often = most days, some days = 1 to 3 days a week, rare = a week or more apart.
  - These are my estimates, from the 24-hour sample study in docs/DESIGN-LOOP.md and how airports work.

Tags:
- [route] needs a known route. Only airline flights have one. Private, business and military planes never do.
- [new data] needs something the catch doesn't save yet (list at the end).
- [history] needs to know what you had before today. A mission's check only sees today's catches now.
- [years] needs first-flight years for more types (type-specs.js has 58).

## What's there now (counted from the code)

My brief said 11 / 3 / 6. The code today has more:
- Sky: 16 daily missions, 3 bonus challenges, 8 week themes.
- Sky: about 73 patches (29 shared with Space, 14 plane ones, 30 more in sky-patches.js), plus 22 secrets.
- Space: 30 daily missions, 5 bonus challenges, 12 week themes, 83 patches.

So for milestones I list what's missing, not what Sky already has.

## A bug to fix before any of this

- "Turn a card silver or gold" (bonus challenge `levelup`) is wrong in Sky.
- progress.js marks `lv` on the 5th and 10th DAY you caught any flight, and the 5th and 10th aircraft you caught of any type. It counts across all your cards together.
- Sky's real levels are per card: a flight is silver at 5 days, gold at 15. A plane type is silver at 10 aircraft, gold at 50 (sky-stamps.js).
- The same mix-up feeds Space's gold-card count in Sky.

---

# Day one (fixed set)

Now: "Collect your first card", "Catch a plane on its way somewhere", "Catch two different kinds of plane". The first airline catch does two of the three.

Proposed: three steps, one per catch.

**firstcard · easy · kept**
"Collect your first card"
- Data: any new card.

**types2 · easy · kept**
"Catch two different kinds of plane"
- Data: two type codes.

**catches3 · easy · new**
"Catch three planes"
- Data: three catches. A catch saves two sightings (flight and plane) at the same moment, so count catches, not sightings (3 s apart, as Hat Trick does).
- Quiet sky: "Catch two planes".

✂ **firstflight** "Catch a plane on its way somewhere": the first airline catch also finishes "first card". It joins the daily pool as an easy one (same as `airlines3` in a quiet sky).

---

# Daily missions

## Where it's going

**abroad · medium · kept**
"Catch a flight to another country" [route]
- Data: flight card's from.cc ≠ to.cc.
- Airport: often in Europe, some days at a US mid-size field.
- Rural: often in Europe, some days in the US.

**★ continent · medium · new**
"Catch a flight to another continent" [route]
- Data: continentOf(from.cc) ≠ continentOf(to.cc). The table is in sky-secrets.js (Six Continents).
- Airport: some days. Rural: some days, often under ocean routes.
- Note: countries decide the continent. Hawaii counts as North America (US), the Canary Islands as Europe (Spain). Never false, but a Honolulu flight won't count. Open question 4.

**region · medium · new**
"Catch a flight heading to Asia" (the continent changes)
- Data: continentOf(to.cc). Deal only a continent that flights here went to at this hour in the last 7 days.
- [route] [new data]: sky-local.js would need a "to:AS" style tally. Routes are bundled, so the lookup is cheap.
- Airport: some days. Rural: some days.

**countries3 · stretch · new**
"Catch flights to three different countries" [route]
- Data: three different to.cc today.
- Airport: some days (often at a hub). Rural: rare.

**far · medium · kept**
"Catch a long flight (over 3,000 km)" [route]
- Data: flight km > 3,000.
- Airport: some days. Rural: often (overflights are long).

**ocean · stretch · kept**
"Catch a very long flight (over 5,000 km)" [route]
- Data: km > 5,000.
- Airport: rare to some days. Rural: some days.

**short · easy · kept**
"Catch a short hop (under 500 km)" [route]
- Data: km < 500.
- Airport: often. Rural: rare (short hops fly low and near airports).

**★ landing · easy · new**
"Catch a flight landing near you" [route]
- Data: the flight's to-airport is within 30 km of where you stand (same test as the Home Run patch).
- Airport: often. Rural: rare.

✂ **leaving** "Catch a flight that took off near you": same idea as `landing`. Keep only one in the pool, or never deal them together.

✂ **island** "Catch a flight to an island": no island data, and it's hard to keep true. Great Britain, Japan and Ireland are islands. Hawaii can't be told from a country code. Needs a hand list of airports.

✂ **newcountry** "Catch a flight to a new country": the Passport patches already track this, and `countries3` covers the day.

## When the type first flew

Data: type-specs.js "First flew" (the year of that exact model, as printed on the card). Only 58 types have it today [years].

**★ oldtype · medium · new**
"Catch a kind of plane that first flew before 1980" [years]
- Data now: C172 (1955), PA-28 (1960), AS350 helicopter (1974), plus military types (C-130, KC-135, B-52, F-16…).
- No airliner type in the table first flew before 1980. The variants we see are newer (the 747-400 first flew in 1988).
- More light types to add, checked on Wikipedia the way type-specs.js does: C152, C182, King Air 200, Twin Otter, Beaver, 737-200, Bonanza.
- Airport: often near a field with light planes, some days at an airliner-only one. Rural: some days.

**newtype · easy · new**
"Catch a kind of plane that first flew in the last 10 years"
- Data: first flew ≥ this year − 10. Today that's the A321neo (2016), 737 MAX 8 (2016), A319neo (2017), 737 MAX 9 (2017).
- Add 787-10, A350-1000, E195-E2 [years].
- Airport: often. Rural: often.

✂ **decades3** "Catch kinds of plane that first flew in three different decades": good, but too few years yet. Bring it back once [years] is done.

## Where it is in the sky

**high · easy · kept**
"Catch a plane flying really high" (35,000 ft and up)
- Data: altFt.
- Airport: often (overflights). Rural: often.

**low · easy · kept**
"Catch a plane flying low" (under 5,000 ft)
- Airport: often. Rural: rare.

**bands · medium · kept**
"Catch one low plane and one really high one"
- Needs two catches.
- Airport: often. Rural: rare.

**★ overhead · medium · new**
"Catch a plane right over your head" (more than 70° up)
- Data: [new data] the plane's height in your sky (hit.el) at the catch. It exists then but isn't saved. The Zenith secret is 88°, so this one is easier.
- Airport: some days, often under the approach path. Rural: some days.

**up · easy · new**
"Catch a plane on its way up"
- Data: [new data] climb rate (feed baro_rate / geom_rate, already parsed as `climb`) ≥ 1,000 ft/min, below 15,000 ft.
- Airport: often. Rural: rare.

**down · easy · new**
"Catch a plane on its way down"
- Data: climb ≤ −1,000 ft/min, below 15,000 ft.
- Worded "on its way down", not "landing": a plane can come down without landing.
- Airport: often. Rural: rare.
- Never dealt with `up`.

✂ **fast** "Catch a plane going faster than 900 km/h": a number for kids to read, and the Jet Stream secret already does it.

✂ **slow** "Catch a slow plane": the same planes as `low`, `prop` and `heli`.

## Timing and skill

**★ three10 · medium · new (from bonus `pair10`)**
"Catch three planes in 10 minutes"
- Data: three catches inside 10 minutes.
- Quiet sky: "Catch two planes in 10 minutes".
- Airport: often. Rural: rare even at two.

**★ quick · medium · new**
"Catch a plane in its first minute in your sky"
- Data: [new data] when it rose above 5° (sky-up.js UP_MIN_EL, "over the trees"). The tracker would note the first poll each plane was up.
- Polls are 10 to 30 s apart, so allow 90 s inside the rule.
- Only counts planes the app saw rise, not ones already up when it opened.
- Airport: often. Rural: some days.

**dark · easy · new**
"Catch a plane after dark"
- Data: sunEl below −6° (saved on every catch).
- Deal only when dark falls before midnight and planes flew here then this week.
- Airport: often (in winter). Rural: often.

**golden · medium · new**
"Catch a plane while the sun is low"
- Data: sunEl between −1° and 6°, morning or evening (the Golden Hour patch counts only evenings).
- Deal only when that window falls in the next 4 hours.
- Airport: some days. Rural: some days.

**shiny · stretch · new**
"Catch a shiny"
- Data: s.shiny. A plane gives one: beside the Moon (within 1°), at sunset (sun −1° to 2°), or new colours on a Rare-or-better type (shiny.js).
- Never dealt with `golden`.
- Airport: rare. Rural: rare.

## Two at once

**boeingairbus · medium · new** (★ dropped 2026-11-20: too easy near airports)
"Catch a Boeing and an Airbus"
- Data: type code. Boeing: B7xx, B3xM. Airbus: A3xx, A3xN, BCS1/BCS3 (the A220, Airbus since 2018). No military types.
- Airport: often. Rural: often.

**jetprop · medium · new**
"Catch a jet and a propeller plane"
- Data: isProp(type), and a jet = a known type that's not a prop and not a helicopter.
- Airport: often. Rural: some days.

**sameairline · medium · new**
"Catch two planes from the same airline"
- Data: two catches, same 3-letter callsign prefix, different aircraft.
- Airport: often at a hub, some days at a mid-size field. Rural: some days.

**airlines3 · easy to medium · kept**
"Catch an airline flight" / "Catch three different airlines" (size follows your sky)
- Airport: often. Rural: often at one.

**families2 · medium · kept**
"Catch planes from two plane families"
- Data: plane card set (sky-sets.js).
- Busy sky: three families.
- Airport: often. Rural: often.

✂ **twofour** "A two-engine jet and a four-engine plane": the two-engine half is any jet, so it's really "four engines". The Four Engines patch does that, and `giant` covers the day.

## What kind of plane

**wide · medium · kept**
"Catch a big wide jet"
- Data: WIDE pattern on the type.
- Wide-bodies are 4% of planes in Dallas, 47% in Anchorage (sample study).
- Airport: some days. Rural: some days, often under ocean routes.

**★ giant · stretch · new**
"Catch a Giant" (747, A380, A340, MD-11, DC-10: the Giants album)
- Data: plane set `giants`.
- Airport: rare. Rural: rare to some days.

**★ regional · easy · new**
"Catch a regional jet"
- Data: plane set `regional` (E175, CRJ, A220…).
- Airport: often in North America, some days in Europe. Rural: some days.

**prop · easy · kept**
"Catch a propeller plane"
- Data: isProp(type).
- Airport: often. Rural: some days.

✂ **light** "Catch a small plane": nearly every small plane is also a propeller plane. Keep `prop`.

**heli · medium · kept**
"Catch a helicopter"
- Airport: some days (often near a hospital). Rural: rare.

**biz · medium · new**
"Catch a business jet"
- Data: plane set `bizjets`, or the catch's class `biz`. Type only: a business jet is always hidden (no callsign, no registration, no operator).
- Airport: often. Rural: some days.

**military · stretch · new**
"Catch a military plane"
- Data: by type only: MIL_TYPES or class `mil`. Never callsign, unit, base or route.
- [new data]: sky-local needs a `mil` flag so it's dealt only where they fly.
- Airport: rare (often near a base). Rural: rare.

**cargo · medium · new**
"Catch a cargo flight"
- Data: callsign prefix in CARGO_AIRLINES (FedEx, UPS, DHL…). No route needed.
- Airport: some days (most fly at night). Rural: some days.

## Your collection

**newflights2 · easy · kept**
"Collect a new card" / "Collect three new cards" (size follows your sky)

**again · easy · kept**
"Catch a plane you've caught before"
- Data: a card you already own (not first).

**levelup · stretch · kept as a bonus, now a mission too**
"Turn a card silver or gold"
- Data: per-card level (fix the bug above first).
- Airport: some days (a common type gets 10 aircraft fast). Rural: rare.

**rarenew · medium · kept**
"Collect a new Rare card, or rarer"
- Note: every helicopter is Rare, and so is every flight over 5,000 km. So this is easier than it sounds near a hospital or under ocean routes.

**rarehere · stretch · kept**
"Catch a plane that's rare around here"

**★ newairline · medium · new**
"Catch an airline you've never caught" [history]
- Deal it only if an airline you don't have flew here at this hour this week. sky-regulars.js already keeps airline callsigns and when they pass.
- Airport: often in month one, some days later. Rural: some days.

**★ livery · easy · new**
"Catch a plane in new colours"
- A type in an airline's colours you don't have yet, as the Livery patches count it.
- Data: [history]. planeStamps.newLivery is known at the catch, so save it on the sighting.
- Airport: often. Rural: often.

**newalbum · medium · new**
"Start a new album"
- Data: [history] a card in an album you had none in.
- Airport: some days. Rural: some days. Gets harder over time; stop dealing it once fewer than 3 albums are left that this sky can fill.

## Count

- 50 daily ideas, 8 ✂ (plus firstflight), so 42 in the pool plus 3 for day one.
- 16 of the 42 are the ones there now; 26 are new.
- That's over the ~35 aim. Next to cut if you want 35: region, countries3, golden, jetprop, sameairline, newalbum, cargo (the ones that need the most new data, or overlap most).
- My ★ picks (10): continent, landing, oldtype, overhead, three10, quick, giant, regional, newairline, livery.

---

# Bonus challenge (the fourth goal)

Space has 5, Sky 3. Every one can be done with cards you own, so a quiet day still has one. Proposed 8:

- revisit3 (kept): "Catch 3 cards you own again"
- pair10 (kept): "Catch two planes in 10 minutes"
- levelup (kept, fix the bug): "Turn a card silver or gold"
- ★ moreaircraft (new): "Add a new aircraft to a plane card you own"
  - Data: a plane card stamp gained (a new hex) on an owned card.
- livery2 (new): "Catch a kind you own in new colours"
- sameairline (new): "Catch two planes from the same airline"
- ★ compass (new): "Catch planes in two different parts of the sky" [new data: az]
- dusk (new): "Catch a plane you own after dark"

---

# Milestones (patches)

Sky already has: card counts 1 to 1,000; rarity; airlines 5/25/50/100; three alliances; passports 10/25/50; time-of-day; streaks; missions 10/50; Full House; four engines; 10 turboprops; 3 helicopters; liveries 10/25/50; distance totals; weather; seasons; every album's own gold patch; 22 secrets.

What's missing. "Takes" = a rough time for a keen player.

## Levels

**silver · new**
"Regular Visitor": "Turn a card silver"
- Data: per-card level (fix first). Takes: a week or two near an airport.

**gold · new**
"Old Friend": "Turn a card gold"
- Takes: months. Sky's Regular patch (a flight on 15 days) is one way to do it.

**gold3 · new**
"Inner Circle": "Three gold cards"
- Takes: months.

These three are Space patches left out of Sky's list (SKY_PATCHES) because of the level bug.

## Shinies

**shiny · new to Sky**
"Shiny Hunter": "Catch a shiny"
- Space has it; Sky left it out. Takes: weeks.

**shiny5 · new to Sky**
"Shiny Collector": "Catch 5 shinies"
- Takes: months.

**★ shinyall · new**
"Full Shine": "Catch all three kinds of shiny: by the Moon, at sunset, and new colours"
- Takes: months. Rare.

## Secrets

**secrets3 · new**
"Secret Keeper": "Find 3 secrets"

**secrets10 · new**
"Hidden Hangar": "Find 10 secrets"
- Data: count of earned secret patches. Takes: months.

## Engines

[new data]: an engines-by-type table. QUAD and TURBOPROP lists exist; nothing else.

**★ trijet · new**
"Three Engines": "Catch a plane with three engines"
- True examples: MD-11, DC-10, Boeing 727, and the Falcon 50, 900, 7X and 8X business jets.
- Takes: weeks near business jets, rare elsewhere.

**single · new**
"One Engine": "Catch a plane with one engine"
- Cessna 172, PA-28, PC-12, Caravan, TBM. Takes: days near light planes.

**engines4 · new**
"Engine Room": "Catch planes with one, two, three and four engines"
- Takes: months. A stretch.

## Makers

[new data]: a maker-by-type table. type-specs.js has a maker for 58 types; extend it. The Boeing / Airbus split can come from the code alone.

**makers5 · new**
"Plane Makers": "Catch planes from 5 different makers"
- Takes: a week or two.

**makers10 · new**
"Factory Tour": "Catch planes from 10 different makers"
- Takes: months.

**bigtwo · new**
"Big Two": "Catch five kinds of Boeing and five kinds of Airbus"
- Takes: weeks near an airport, months rural.

## When the type first flew

[years] for all three.

**oldtimer · new**
"Old Timer": "Catch a kind of plane that first flew before 1970"
- C172, PA-28, C-130, KC-135, B-52… Takes: days to weeks.

**★ decades · new**
"Time Traveller": "Catch kinds of plane that first flew in 6 different decades"
- 1950s (C172), 1960s (PA-28), 1970s (AS350), 1980s (A320), 1990s (737-800), 2000s (787-8), 2010s (A321neo). All of these are already in type-specs.js.
- Takes: weeks.

**newgen · new**
"New Generation": "Catch 5 kinds of plane that first flew in the last 10 years"
- Takes: weeks.

## Where and when

**compass · new**
"Compass Rose": "Catch planes in all four quarters of the sky (north, east, south, west)" [new data: az]
- Space has it. Takes: days.

**nightshift · new**
"Night Shift": "Catch 25 planes after dark"
- Takes: weeks.

**upaway · new**
"Up and Away": "Catch 10 planes on their way up" [new data: climb]
- Takes: a week near an airport. Rural: months.

**continents3 · new**
"Three Continents": "Catch flights heading to 3 continents" [route]
- A step before the Six Continents secret. Takes: weeks.

**★ alliances · new**
"Alliance Hat Trick": "Catch an airline from each of the three alliances"
- Data: ALLIANCES in sky-patches.js. Takes: days at a hub, weeks elsewhere.

## Kinds

**biz5 · new**
"Jet Set": "Catch 5 kinds of business jet"
- Takes: weeks. The Business Jets album's silver is 5 cards, though, so maybe ✂.

✂ "3 military types", "10 cargo flights", "5 regional jets": each album already has bronze / silver / gold and a gold patch. Don't duplicate them.

**albums10 · new**
"Album Starter": "Have a card in 10 albums"
- Sky has 19 albums (7 flight, 12 plane). Takes: weeks.

## Missions

**missions100 · new**
"Old Hand": "Complete 100 missions"

**weeks4 · new**
"Four Weeks": "Finish 4 week themes"

**★ weeks12 · new**
"Every Week": "Earn all 12 week badges"
- Takes: about a year (one theme a week, 12 in the rotation).

✂ Rank patches: your rank already shows on the profile. A patch per rank would just repeat it.

✂ "Catch the same aircraft again": it follows one airframe. Airline aircraft are public, but it's the habit we don't want. A type card's stamps already count aircraft without naming them.

Fix while there: "Hundred Sightings" ("Log 100 sightings") counts sightings, and a plane catch saves two. Either count catches, or reword it as "Catch 100 planes" counted by catches.

## Count

27 new milestones (5 of them Space patches Sky left out: silver, gold, gold3, shiny, shiny5), 5 ✂ (biz5 is a maybe). ★: shinyall, trijet, decades, alliances, weeks12.

---

# Week themes (12)

The 8 there now, all kept:
- Airline week: five different airlines.
- Heavy week: three different wide-body jets.
- Propeller week: three propeller planes.
- Long-haul week: three flights over 5,000 km [route].
- Family week: four plane families.
- Regulars week: five cards you own, again.
- New cards week: eight new cards. Size it to your sky: a quiet sky can't find eight in month three.
- Short hop week: three flights under 500 km [route].

Four new:

**★ sky-night · new**
"Night Flight week": "Catch five planes after dark."
- Data: sunEl. Good for rural skies and winter.

**sky-passport · new**
"Passport week": "Catch flights to four different countries." [route]

**★ sky-livery · new**
"Livery week": "Catch five planes in new colours." [history]

**sky-makers · new**
"Makers week": "Catch planes from four different makers." [new data: maker table]

Week swaps: chooseWeek in main.js swaps a theme the sky can't give, but its check only knows Space themes. Every Sky theme passes. Heavy week where no wide-bodies fly, or Long-haul week at a small field, can't be done. Use the same 7-day flags as the missions (open question 2).

---

# Pacing rules

## Day one
- The fixed three: first card, two kinds of plane, three catches.
- One step per catch, so the first catch shows 1 of 3, not 2 of 3.

## Days 2 and 3 (no local log yet)
- Deal only missions any sky can give: newflights2, families2, airlines3, again, three10 (at two), boeingairbus, high.
- As DESIGN-LOOP.md §3 already says.

## Every day after that

1. **One easy, one medium, one stretch.**
   - The tier above is the default.
   - Once this place has 3 days of log, set the tier from this place: the share of planes at this hour that would do it.
     - 30% or more: easy.
     - 5 to 30%: medium.
     - under 5%: stretch.
   - So `low` is easy at the airport and stretch in the country. sky-local.js counts flags per hour; it also needs a total-planes-per-hour count.

2. **One catch can't finish all three.**
   - Each mission lists its "partners": missions one plane can finish together.
   - The medium can't be a partner of the easy one. The stretch can't be a partner of either, unless the stretch needs 2+ catches (bands, three10, jetprop, boeingairbus, sameairline, countries3, families2, counts over 1).
   - Partner groups (one plane does them all):
     - Long-haul jet at cruise: wide, giant, high, far, ocean, abroad, continent, region, rarenew (a 5,000 km flight is Rare), newtype, boeingairbus's half.
     - Regional jet near the airport: regional, short, low, down, up, landing.
     - Light plane: prop, low, oldtype.
     - Helicopter: heli, low, rarenew (every helicopter is Rare), rarehere.
     - Any new catch: newflights2 at size 1, airlines3 at size 1, livery, newairline, newalbum.
   - Any-catch missions (the last group) go only in the easy slot. In a steady or busy sky they're sized to 2 or more.

3. **Fits the hour.**
   - skyPossible as now: dealt only if a plane that does it flew here in the next 4 clock hours on the last 7 days.
   - New flags sky-local.js needs: regional, biz, mil, cargo, giant, up, down, overhead, newtype, oldtype, to:<continent>.
   - Time-of-day missions (dark, golden, shiny) are dealt only when their window falls inside today's next 4 hours, with planes seen then.

4. **Never together.** Same idea twice: up / down, far / ocean, landing / leaving, golden / shiny, low / bands, high / bands, prop / jetprop, three10 / pair10.

5. **No repeats.** Not the same mission two days running; not the same three within 7 days. Relax this in a quiet sky with a small pool.

6. **Quiet night.** Under 2 planes an hour in the coming hours: easy = again or newflights2 at 1, and the stretch may be a 2-catch one. The bonus challenge carries the night.

## Rules every mission follows
- Every fact true. "On its way down", not "landing". "Kind of plane that first flew", with the variant's own year as printed on its card.
- No emergencies or diversions, ever: no squawk 7700/7600/7500 and no "changed course".
- Military by type only. No callsign, unit, base, route or registration. They're already hidden like that (plane-privacy.js).
- Nothing that follows one aircraft or person. Private and business planes count by type only. Their aircraft id is already a salted hash on the phone.

---

# New data the catch would save

All of these are known at the moment of the catch; they're just not kept:
- `el` (height in your sky, degrees): overhead, compass check.
- `az` (direction): compass.
- `climb` (ft/min; the feed's geom_rate or baro_rate): up, down, upaway.
- `upFor` (seconds since it rose above 5°): quick.
- `newLivery` (from planeStamps): livery missions and week.

Tables to add:
- Engines by type.
- Maker by type.
- More first-flight years, checked on Wikipedia as type-specs.js does.

In progress.js:
- Mark each sighting with history flags in the loop, as it marks `first`: newAirline, newCountry, newAlbum, newLivery. A mission check then still only reads today.
- Fix `lv` so it's per card.

---

# Decisions (Sevaan, 2026-11-20)

1. Missions count catches, not sightings (one tap = one). Hundred Sightings counts catches.
2. Week themes this sky can't give are swapped out, using the same 7-day flags as missions.
3. "Last 10 years" rolls each January.
4. Continents by country code, with one exception: Hawaii (HNL, OGG, KOA, LIH, ITO) counts as Oceania.
5. Stretch missions ease in a quiet sky (e.g. two in 10 minutes instead of three), sized from how busy this hour has been over the last 7 days.
6. The military mission is dealt only where military types have been seen at this hour.
7. ★ picks trimmed to 10: Boeing + Airbus dropped.
