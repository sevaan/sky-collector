# Sky Collector: secrets and patches (proposal, 2026-11-19)

A design proposal for Sevaan: nothing here is built. It answers "Space Collector has secrets, what kind of secrets can we
do here. What about patches?"

## How Space Collector does it (what to mirror)

- **Secrets** (`js/secrets.js`, `SECRET_PATCHES`): things that are never mentioned anywhere and are found by stumbling on
  them. Santa on Christmas Eve, Starman's Roadster, Voyager, the Wow! signal, three full turns of the phone ("Dizzy"),
  a dead satellite on Halloween. Finding one gives a secret patch, or a story card (`js/stories.js`) instead of a patch
  for the story secrets. Found ones are kept in localStorage `secrets`. The patch wall shows them in a "Secret" group;
  until found they don't appear at all.
- **Patches** (`js/progress.js` `ACHIEVEMENTS`, drawn by `js/patches.js`): read off the player's sightings every time,
  never stored. Groups (Collection, Rarity, Time…), gold foil for milestones, holo for the rarest.
- **Sky today:** Sky already has 13 plane patches of its own (`SKY_ACHIEVEMENTS`: Heavy Metal, Jumbo, Superjumbo, Rotor
  Head, Prop Day, Freight Night, Hopper, Globetrotter, Five and Twenty-five Airlines, Regular, Rare Here, Full Hangar) plus
  29 shared ones that mean the same for planes (card counts, rarity, time of day, streaks, missions). Space's secrets are
  switched off in Sky (`secrets: SKY_ONLY ? null : …` in main.js); only Plus Member and Ambassador exist.

## What the data gives us

Sky's plane feed (adsb.lol from the phone, Sky's relay as the backup) returns the readsb aircraft record. The recorded
Toronto feed (`scripts/perf/fixtures/planes-yyz.json`, 57 aircraft) carries these fields that matter for secrets:
`flight` (callsign), `r` (registration), `t` (ICAO type), `desc`, `ownOp` (owner/operator), `year`, `category` (A1-A7
fixed wing by size, A7 = rotorcraft, B1 glider, B2 lighter than air, B4 ultralight, B6 drone, C1/C2 surface vehicles…),
`squawk`, `emergency`, `alt_baro`/`alt_geom`, `gs`, `dbFlags` (bit 1 military, 2 interesting, 4 PIA, 8 LADD), plus our
own route lookup (from, to, distance) and the player's own geometry (elevation of the plane in their sky, time, place).
In that one recorded minute over Toronto, five business jets had `dbFlags` 8 (LADD: the owner asked for the aircraft not
to be tracked publicly) and `ownOp` filled in. Sky shows neither today, and must keep it that way (see Safety below).

Every proposal below says how it's detected, how often a player would realistically meet it, and any concern.
"Verify" means the exact callsign/type code should be checked against a few days of recorded data before building.

## Secrets (hidden, never listed until found)

Ranked by delight and by how likely a player is to stumble on it.

| # | Secret | Patch name (draft) | Detected by | How often | Concerns |
|---|---|---|---|---|---|
| 1 | **Straight overhead**: catch a plane within 2° of straight up | Zenith | the plane's elevation in the player's sky ≥ 88° at the catch | Common near airports and under airways: most players within a few weeks | none |
| 2 | **Hot-air balloon** | Up, Up and Away | `category` B2 (lighter than air) and low speed | Rare: summer mornings and evenings, near festivals; many never will | none (balloons are public events) |
| 3 | **Glider** | Silent Wings | `category` B1, or type codes for common sailplanes (verify) | Rare: summer weekends near gliding clubs | none |
| 4 | **Airship** (Goodyear and other blimps) | Lighter Than Air | `category` B2 plus airship type codes (Zeppelin NT, verify the code) or a known registration list (verify) | Very rare: sports events in North America and Europe | none (they fly to be seen) |
| 5 | **The Beluga** (Airbus BelugaXL or Beluga ST) | The Whale | type `A337` (BelugaXL) / `A3ST` (Beluga ST); verify both codes | Rare outside Airbus sites (Toulouse, Hamburg, Bremen, Broughton, Saint-Nazaire); a few players a year | none |
| 6 | **A giant freighter**: Antonov An-124 or the Boeing Dreamlifter | Heavy Lifter | type `A124`, `B74D`/Dreamlifter registrations (verify) | Rare: a few sightings a month worldwide, more near cargo hubs | none |
| 7 | **A water bomber** (Canadair CL-215/415, DHC-515, air tankers) | Firebird | type codes `CL2P`/`CL2T` and air-tanker types (verify) | Seasonal and regional; rare | Mild: they fly during emergencies. Copy should admire the crews, never "go chase the fire". Award quietly, no push notification. |
| 8 | **Hurricane hunter** (NOAA WP-3D / G-IV, USAF 53rd WRS WC-130J) | Into the Eye | NOAA registrations N42RF, N43RF, N49RF; 53rd WRS "TEAL" callsigns (verify) | Very rare, Atlantic and Gulf coast in season, mostly at their bases | Same as water bombers: admiring copy, no hype during a live storm |
| 9 | **The oldest plane**: catch an aircraft built 50+ years ago | Vintage | `year` field ≤ now − 50 (only where the feed has it) | Uncommon: DC-3s, old Cessnas, warbirds at airshows | none |
| 10 | **Speed demon**: a plane with ground speed over 1,000 km/h (jet stream tailwinds) | Jet Stream | `gs` ≥ 540 kt on an airliner | Winter, eastbound over the North Atlantic and North America: several times a winter for people under those routes | none |
| 11 | **Edge of the sky**: an airliner above 45,000 ft, or a business jet at 51,000 | Ceiling | `alt_geom` ≥ 45,000 | Uncommon (bizjets cruise up there) | none |
| 12 | **Santa** on Christmas Eve | Nice List | the same time window as Space's `santa()`; a drawn sleigh in the sky, not a real flight (there's no ADS-B sleigh) | Once a year, everybody who opens the app | none: Space Collector's design, already loved |
| 13 | **Two of a kind**: two planes of the same airline in the circle at once | Formation | two plane positions within the circle's radius, same airline prefix | Uncommon near hubs on approach | none |
| 14 | **Round the world**: catch flights whose destinations cover all six inhabited continents | Six Continents | route `to` airports' continents | Months of play at an international hub; near-impossible elsewhere: make it a patch rather than a secret if it's too hard | none |
| 15 | **Dizzy** (Space's three full turns) | Dizzy | the same compass check as Space | Easy, silly, people find it | none |

**Air Force One.** The callsign only exists when the US President is aboard, the VC-25s are flagged military, and
following a head of state's aircraft is exactly the kind of tracking we shouldn't reward. **Not recommended.** If
Sevaan wants a nod to famous aircraft, use public airshow teams (the Snowbirds, the Red Arrows, the Blue Angels, by their
public display callsigns) on airshow days only, and verify they broadcast at all.

**Emergencies (squawk 7700, 7600, 7500).** A 7700 is a real emergency with real people on board, and 7500 means a
hijacking. **Never** a secret, patch or reward. At most, if `emergency` is set, the card could quietly say "This
flight declared an emergency; flights like this almost always land safely", with no XP and no badge. Recommend we
leave it out entirely for now.

**Special liveries.** Players would love them, but the feed has no livery field. It needs a hand-kept list of
registrations (e.g. Air Canada's or KLM's special schemes) that goes stale. Defer; a good later project with photos.

### Story secrets (cards, like Space's `js/stories.js`)
A secret that gives a story card instead of a patch, for things with a story to tell:
- **The Whale** (Beluga): why Airbus flies its own parts between factories in a whale-shaped plane.
- **Into the Eye** (hurricane hunters): the 1943 bet that started flying into hurricanes.
- **Lighter Than Air** (airships): from the Hindenburg era to today's blimps over stadiums.
- **Vintage** (oldest plane): the DC-3, still flying after 90 years.
Each card's story follows `docs/FACT-STYLE.md` and its sources go in `docs/FACTS-SOURCES*.md`, under the house rule that
no fact rests on an uncited sentence.

## Patches (earned in plain sight)

Sky's 13 own patches cover rare types, distance and airlines. Proposed additions, grouped as the wall groups them:

**Firsts** (one each, the "first time" moments a new player should hit in the first week)
- *First Heavy at Night* already exists as Freight Night; add **Red-eye** (a long-haul flight caught between midnight and 5 am).
- **Home Run**: catch a flight landing at the player's nearest big airport (route `to` within 30 km of them).
- **Outbound**: catch one taking off from it.

**Sets and families** (from `js/sky-sets.js`, which already groups types into families)
- **Family Album** tiers: one patch for completing each family set's first goal (Airbus narrow-body, Boeing wide-body,
  regional jets, turboprops, helicopters…), gold for all goals of a family.
- **Alliance** patches: five airlines from one alliance (Star, oneworld, SkyTeam; needs an airline-to-alliance table).

**Streaks and habits** (the shared Time patches cover weeks and months; add a daily one)
- **Seven Skies**: catch something seven days in a row. **Thirty Skies**: thirty.
- **Rush Hour**: five planes in ten minutes.

**Time of day and season**
- Twilight, Owl and Dawn exist. Add **Golden Hour** (a catch in the hour before sunset, sun 0-6° up) and
  **Four Seasons** (a catch in each season of one year).

**Weather** (Sky already fetches weather for the sky drawing)
- **Above the Clouds**: catch a plane when the sky is overcast (it's there, you just can't see it).
- **Snow Day**: catch during snowfall. Both are pleasant reasons to open the app on a grey day.

**Distance and geography**
- Hopper (< 300 km) and Globetrotter (> 10,000 km) exist. Add **Coast to Coast** (a domestic flight > 3,500 km),
  **Equator Crosser** (route crosses the equator; `js/flight-facts.js routeFacts` already works this out),
  **Date Line** (route crosses the date line), **Pole Hopper** (shortest path passes north of the Arctic Circle).
- **Passport** tiers: flights to 10, 25 and 50 different countries.

**Rare types and airlines**
- **Twin Engine / Quad**: a four-engined airliner (A340, 747, A380) for players who will never see an A380.
- **Turboprop Ten**: ten different turboprop types. **Rotor Club**: three helicopter types.
- **Fifty Airlines** and **Hundred Airlines** after the existing 5 and 25.

**Milestones**
- Card counts exist (10 to 1,000). Add **Frequent Flyer** for total distance of all caught flights (40,075 km = round
  the world, then to the Moon at 384,400 km), a patch that keeps growing with play.

## Safety and privacy rules (for every secret and patch)

1. **Never reward following a particular aircraft or person.** No patch for catching the same private aircraft
   repeatedly, no "most wanted" lists, no owner names. Sky must never show `ownOp`.
2. **LADD and PIA aircraft (dbFlags 8 and 4)**: these owners asked not to be tracked publicly. Recommend Sky treats them
   as anonymous: show the type and "Private flight", never the registration or callsign, and never count them toward a
   secret. (Today Sky's cards already drop the registration of planes without an airline callsign, `js/flights.js:80`,
   but Explore's live label shows the callsign, which for a private plane is its registration, `js/main.js` `p-name`;
   this rule would hide it there too for flagged aircraft.)
3. **Military and police (dbFlags 1, police types)**: fine as a generic card (Sky already has a Military family and a
   "Fast Jet" category card), but no secrets that send people looking for specific military or police aircraft.
4. **Emergencies and hijack codes**: never gamified (above).
5. **Firefighting and storm aircraft**: admiring copy, no notifications, never during a live event in a way that sends
   people towards it.
6. **No location sharing in secrets**: a found secret's card says what and when, never where the player was.

## Suggested first build (if Sevaan likes the direction)

1. Turn the secrets machinery on for Sky with three that need no new data and are easy to verify: **Zenith**,
   **Santa** (already built for Space), **Dizzy** (already built).
2. Add the category-based ones next: **Up, Up and Away**, **Silent Wings**, **Lighter Than Air**, after checking a week
   of recorded feeds for the B1/B2 categories and type codes.
3. The LADD/PIA privacy rule (Safety 2) before any of the above, since it's a privacy fix as much as a design one.
4. Then the patch additions in order of how many players will see them: Seven Skies, Golden Hour, Home Run / Outbound,
   Passport, Frequent Flyer, the weather pair.
