# Sky Collector: mission and patch wording, and the naming drift

Written 2026-11-20. For Sky Dev. I changed no app file. This is the Sky half of the pass I did for Space Collector (`content/space-patches-missions-wording-2026-11-20.md` in the Space repo).

**What I looked at.** `js/progress.js` (SKY_MISSIONS, SKY_STARTER, SKY_CHALLENGES, SKY_WEEK_THEMES, SKY_OVER, ACHIEVEMENTS, SKY_PATCHES), `js/sky-patches.js`, `js/sky-secrets.js`. Line numbers are as of 2026-11-20 on a working tree with uncommitted changes, so search for the quoted string.

**The good news first.** Sky's own missions, challenges, weekly themes and most new patches are already plain. Round 2 (`design/missions-draft.md`) wrote them for a seven-year-old and `SKY_OVER` already replaced the worst of Space's "log, observe, night" wording. There are **no degrees, magnitudes or "zenith" in Sky's missions**. The remaining work is a short list of leftovers from Space Collector and a few naming drifts.

**What must not change.** No `done:` rule changes. Where a number is the rule itself it stays in the text.

---

## Part 1. Jargon

| # | Where | Current | Replacement | Real rule (unchanged) |
|---|---|---|---|---|
| 1 | `js/sky-patches.js` P('sky-pole', 'Pole Hopper', …) | Catch a flight whose shortest path passes north of the Arctic Circle | Catch a flight that goes over the far north, past the Arctic Circle | the flight's great-circle path (`K(a).pole`) goes north of the Arctic Circle (66.5°N). The word "shortest path" is how the rule is worked out, not what the player sees. |
| 2 | `js/sky-patches.js` P('sky-dateline', 'Date Line', …) | Catch a flight whose shortest path crosses the International Date Line | Catch a flight that crosses the International Date Line, where one day becomes the next | the great-circle path crosses the Date Line |
| 3 | `js/sky-secrets.js` `overhead`, name `Zenith` | name "Zenith" (text is plain: "You caught a plane flying almost straight over your head.") | name "Straight Up" (the name Space Collector uses for the same idea) | none: name only. The id stays `overhead`, so earned patches keep. |
| 4 | `js/progress.js` SKY_MISSIONS `oldtype` | Catch a plane type from before 1980 | Catch a kind of plane that first flew before 1980 | `isOldType(typeCode)`: the year that exact model first flew is before 1980 |
| 5 | `js/progress.js` SKY_MISSIONS `newtype` (the text is built from the year) | Catch a plane type from ${year-10} or later | Catch a kind of plane that first flew in ${year-10} or later | `isNewType`, the last 10 years |

Why 4 and 5: the patches already say "a kind of plane that first flew before 1970" (`SKY_OVER.oldtimer`), so "plane type" in the missions is the one place that says "type". See Part 2d.

**Checked and fine as they are** (words explained in the same line, or the real name of the thing):
Red-eye, Livery Spotter / Livery Collector / Paint Shop ("a type in an airline’s colours"), Jet Stream, Ceiling (feet, an aviation unit), Rush Hour, Golden Hour, Home Run, Outbound, Equator Crosser, Heavy Metal, Round the World, To the Moon, Seven Skies, Thirty Skies, Cleared for Takeoff.

**Idioms (voice guide section 8):** the approved decision is to keep established names and explain at first use. Each of those names has a plain line beside it already. No change.

---

## Part 2. Naming drift

### 2a. Leftover "Log", "Sightings", "Observe" from Space Collector

`SKY_OVER` already rewrote `sightings100`, `marathon`, `owl`, `streak4`, `streak12`, `anniversary` and `fullhouse`. Five Space strings are still in Sky's effective patch list. All are patches in `SKY_PATCHES`.

| id (name) | Current | Replacement |
|---|---|---|
| `twilight` ("Dusk Patrol") | Log a sighting between 5 and 9 PM | Catch a plane between 5 and 9 PM |
| `dawn` ("Dawn Patrol") | Log a sighting between 4 and 7 AM | Catch a plane between 4 and 7 AM |
| `months3` ("Season Ticket") | Sightings in 3 different months | Catch a plane in 3 different months |
| `months12` ("Full Year") | Sightings in 12 different months | Catch a plane in 12 different months |
| `roadtrip` ("Road Trip") | Sightings from two places more than 100 km apart | Catch planes from two places more than 100 km apart |

For `owl` Sky already says "Catch a plane between 1 and 4 AM", so these now match it.

**Names that contain "sighting":** DECIDED (Sevaan, 2026-11-20): "Hundred Sightings" becomes **"Hundred Catches"** and "Double Sighting" becomes **"Double Catch"**. The ids stay.

### 2b. badge → patch (DECIDED 2026-11-20: patches everywhere, "badge" is retired)

| Where | Current | Replacement |
|---|---|---|
| `js/progress.js` ~881 (week achievements) `sub` | Week badge | Week patch |
| `js/progress.js` ~558 `sky-weeks12`, "Every Week" | Earn all 12 week badges | Earn all 12 week patches |
| `js/sky-events-data.js` (63 lines) and `js/events.js` event texts | "Catch either one tonight for the badge." | "…for the patch." Change the generator (`scripts/build-sky-events.mjs` in Space; Sky's copy of it if it has one), not the data. Only if sky events can show in Sky. Sky Dev: please confirm they cannot; they also say "tonight", which does not fit Sky. |

### 2c. Collect vs Catch

Sky is consistent: **Collect** a card ("Collect your first card", "Collect a new Rare card, or rarer", "Collect a new card"), **Catch** a plane or helicopter. Keep. One thing to watch: `again` says "Catch a plane you’ve caught before" and the week theme `sky-regulars` says "Catch five cards you already own again". Both say Catch; Space says "See ... again". Fine for Sky, no change.

### 2d. "type" vs "kind" vs "aircraft" vs "plane"

Players see all four. The rule for Sky:
- **plane** for the thing in the sky; **helicopter**, **balloon**, **airship**, **glider** by name. **Aircraft** only when it covers all of them, as in "Catch 10 aircraft of one kind".
- **kind** in sentences ("a kind of plane"). **Type** only as a label on the card ("TYPE A337"), because that is what the card prints.
- **flight** only for a scheduled airline flight with a route.

Current strings that break it:

| Where | Current | Replacement |
|---|---|---|
| `js/progress.js` `oldtype` / `newtype` | "plane type" | "kind of plane" (rows 4 and 5 above) |
| `js/progress.js` SKY_CHALLENGES `moreaircraft` | Add a new aircraft to a plane card you own | Add a new plane to a card you already own (real rule: a catch with `moreAircraft`) |
| `js/progress.js` SKY_OVER `silver` | Turn a card silver: a flight on 5 days, or 10 aircraft of one kind | keep ("aircraft" is correct, it covers helicopters and balloons) |
| `js/progress.js` SKY_OVER `gold` | …a flight on 15 days, or 50 aircraft of one kind | keep |

---

## Part 3. Questions of principle (not wording)

1. **Sky patch "Firebird" (DECIDED 2026-11-20: stays, as an aircraft type).** Current text (`js/sky-secrets.js`, `firebird`): "You caught a water bomber, a plane that skims a lake to fill up with water for fighting fires." It names the type, and "for fighting fires" says what the plane is for, not a fire in progress. To be safe, here is wording with no mention of fire: **"You caught a water bomber, a plane built to scoop up water from a lake."** Use it if the current line is thought too close to an emergency. (The rest of the patch, name "Firebird", stays.)
2. **Sky patch "Into the Eye"** (`hurricane`): a NOAA hurricane hunter, "a plane that flies into storms to measure them". Science flight, type only; I think it is fine.
3. **Mission "Catch a military plane"** (`military`): shows type only and is only dealt where military types have been seen (Sevaan's decision 6, per the code comment). Fine under the rule. It is the one mission that names a category the privacy rule treats specially, so Boss may want to look at it.
4. **Hop distance:** the patch `sky-hopper` says "Catch a flight shorter than 300 km", while the mission `short` and the week `sky-hops` say 500 km. A player who sees both gets two meanings of "short hop". Choose one number (or call the patch "Hopper (300 km)"). Decision for Sky Dev or Sevaan; wording only follows.
5. **"Mission Control Archivist"** (Space patch `reunion25`) is not in Sky's list, and the Sky rank ladder is a separate job (`content/sky-ranks-2026-11-20.md`).

## Not changed and not checked

- I did not run the app, so I have not seen these on a patch card or a mission card. The replacements are about the same length as the originals, except "Pole Hopper" and "Date Line", which are a little longer.
- `localText` converts km to miles and spelling on US phones; `distText()` already does this for the mission lines that carry a distance. None of my replacements adds a unit.
- Tests in `tests/` may match old text. Sky Dev runs them after.
