# The loop for planes: rarity, sets, missions, XP, patches

**Approved by Sevaan as written, 2026-11-17** (all four recommendations at the end). Nothing here is built yet: that is sprint task D. Numbers come from the 24-hour sample
study (docs/research/sample-study.md: 30 places, 27 with coverage, 446 aircraft types, 857 airlines).

The rule from the rebuild still holds: this is Space Collector's loop with plane content. Its machinery (tiers, stamps and
levels, three daily missions, weekly themes, patches, ranks, albums) stays; this document only says what goes in it.

## What the study says the design must survive

| Fact | Number | What it forces |
|---|---|---|
| Skies differ hugely | 0.1 planes overhead at a time (Auckland) to 10.6 (Frankfurt) | Missions and pacing sized to the place |
| What's ordinary differs | Wide-bodies are 4% of aircraft in Dallas, 47% in Anchorage | One fixed rule can't call the same plane "rare" everywhere |
| A few types are everywhere | 23 types seen in 20+ of 27 places | Core sets built from these can be finished anywhere |
| Most types are local | 163 types seen in one place only | The long tail is a bonus, never a requirement |
| Some places have no feed | Lagos, Patagonia, central Australia: zero | The game must say so, not look broken |

## 1. Rarity

**A card has one tier, the same for everyone.** A Boeing 747 is Epic in Kansas and in Dubai. Cards can then be
shared, compared and gifted, and the Collection means the same thing on every phone (as in Space Collector).

**Plane cards (aircraft types):** tier from how much of the world's traffic the type is, then raised by hand for icons.

| Tier | Rule | Examples | About |
|---|---|---|---|
| Common | The 15 most-seen types | B738, A320, A21N, B789, B77W, A359, C172, E75L | 56% of sightings |
| Uncommon | Ranks 16–60 | A319, A220, B763, DH8D, CRJ9, E190, PC12 | 25% |
| Rare | Rank 61 and beyond | BE20, TWEN, most light and business types | 15% |
| Epic | Hand list: the ones people point at | 747 (all), A380, A340, MD-11, Dreamlifter, C-17, C-130, large military | 4% (the 747 and A380 are ranks 21–22 by count, lifted out of Uncommon) |
| Legendary | Hand list, a dozen at most | An-124, Beluga, airships, the last few flying classics (DC-3, Constellation) | well under 1% |

Long-haul twins (787, 777, A350) are in the top 15 worldwide, so they are Common: "Rare here" below is what makes one special in Kansas. Being obscure doesn't make a plane exciting, so the long tail stops at Rare; Epic and Legendary are chosen, not
computed. Helicopters keep their own rule: Rare (they're 0–11% of traffic by place).

**Flight cards (airline + route):** tier from distance, as now, because "this one is going a long way" is the fact that
makes a flight feel special. The bands are re-cut so the world mix is about 55 / 27 / 13 / 4 / 1:

| Tier | Now | Proposed |
|---|---|---|
| Common | under 1,500 km | under 1,500 km |
| Uncommon | 1,500–4,000 | 1,500–5,000 |
| Rare | 4,000–9,000 | 5,000–10,000 |
| Epic | 9,000+ and all cargo | 10,000–14,000; cargo is Rare, not Epic (cargo hubs made everything Epic: Anchorage's top type is a 777 freighter) |
| Legendary | none | 14,000+ (the handful of ultra-long routes) |

**"Rare here": the answer to places being different.** Beside the fixed tier, a card can carry a small ribbon when the
plane is unusual *where you are standing*: under 1% of the aircraft Sky has seen at your place in the last 30 days (it
already keeps this log for Today), once it has seen at least 200. An A350 gets no ribbon in Singapore and a ribbon in
Kansas. The ribbon pays bonus XP and counts for missions; it never changes the card's tier. It needs no server.

Check before building: run both tables over the study and print each place's pyramid. Pass: every place with coverage
has 45–70% Common and at least one Epic per 300 aircraft.

## 2. Sets (the Albums tab)

Space Collector's albums, with these contents. Every set has bronze / silver / gold thresholds below its full size, so
a quiet sky can still earn the patch and a busy one has more to chase.

**Plane sets (by family), built from the 23 everywhere-types first:**

| Set | Cards | Bronze / silver / gold |
|---|---|---|
| The 737 family | 737-700, -800, -900, MAX 8, MAX 9 | 2 / 3 / 5 |
| The A320 family | A319, A320, A321, A320neo, A321neo | 2 / 3 / 5 |
| Twin aisles | 767, 777 (3 kinds), 787 (3), A330 (3), A350 (2) | 3 / 6 / 10 |
| Regional jets | E170/175/190/195, E2s, CRJ700/900, A220 | 2 / 4 / 7 |
| Propeller airliners | Dash 8, ATR 42/72, Twin Otter, Saab 340 | 1 / 2 / 4 |
| Light aircraft | C172, PA-28, SR22, DA40 and others | 2 / 4 / 8 |
| Business jets | Citations, Challengers, Globals, Gulfstreams, Phenoms | 2 / 5 / 10 |
| Helicopters | every helicopter type | 1 / 3 / 6 |
| Giants | 747 (2), A380, A340, MD-11, An-124 | 1 / 2 / 4 |
| Freighters | the cargo versions | 1 / 3 / 5 |

**Flight sets (by where they go, measured from the flight itself, so they work in any country):**

| Set | A flight belongs when | Bronze / silver / gold |
|---|---|---|
| Short hops | under 500 km | 3 / 8 / 20 routes |
| Home skies | both ends in the country you're in | 3 / 10 / 25 |
| Next door | ends in two countries that share a border or a short sea | 2 / 6 / 15 |
| Ocean crossings | 5,000 km+ over water | 1 / 4 / 10 |
| The long way | 10,000 km+ | 1 / 2 / 5 |
| Cargo runs | a cargo airline | 1 / 4 / 10 |
| Airline spotter | counts airlines, not routes | 5 / 15 / 40 airlines |

Today's sets ("Across Canada", "Across the Atlantic", "Sun Destinations") are North America's view of the world; these
replace them. A card already caught moves to its new set by itself.

## 3. Missions sized to your sky

Three a day, drawn like Space Collector's. Space Collector already asks "which missions are possible tonight?" before it
draws; Sky answers that from its own log of what has flown over this place.

- **Possible** = a plane that would complete it was seen here in the last 7 days, or is up now. Impossible ones aren't
  dealt (no "catch a helicopter" where there are none).
- **Sized** = counts follow how busy the place is, from planes seen per open hour:

| Your sky | Planes per hour | "Catch N airlines" | "Collect N new cards" |
|---|---|---|---|
| Quiet | under 4 | 1 | 1 |
| Steady | 4–20 | 3 | 2 |
| Busy | over 20 | 5 | 4 |

- **New missions** to add to the twelve: a "Rare here" plane; a plane from each of two families; a flight over
  5,000 km; the same flight you caught yesterday (stamps); one of each height band (below 5,000 ft, above 35,000 ft).
- **A new player's place has no log yet:** deal only from the always-possible ones (first card, a flight with a route,
  any two planes) for the first three days.

## 4. XP and ranks

Space Collector's values pay per new card: 10 / 15 / 25 / 40 / 60. A plane catch makes two cards (the flight and the
type), so a new player would earn at twice Space Collector's pace.

Proposal: keep the tier values, and pay them like this.

| Event | XP |
|---|---|
| New flight card | its tier value |
| New plane card | its tier value |
| A stamp on a card you own (a new day for a flight, a new aircraft for a type) | 3 |
| "Rare here" | +10 |
| Mission | Space Collector's value |

And stretch the first two ranks so the first rank-up still lands on day 2, as Sevaan set it for Space Collector:
Spotter 0, Plane Spotter 700 (was 500), Tracker 2,000 (was 1,500); the rest unchanged.

Check before building: simulate 15-minute sessions at Peterborough, Toronto and Kansas from the study. Pass: the first
rank-up comes on day 2 or 3 at all three, never day 1.

Stamps and levels stay: flights bronze / silver / gold at 1 / 5 / 15 days, types at 1 / 10 / 50 aircraft.

## 5. Patches

Sky shows a subset of Space Collector's patches today. The plane list, 26, in Space Collector's groups; art comes after:

- **Collecting:** First Catch · 10 · 25 · 50 · 100 cards · 100 sightings
- **Planes:** Heavy Metal (a twin aisle) · Jumbo (a 747) · Superjumbo (an A380) · Rotor Head (a helicopter) ·
  Prop Day (3 propeller planes in a day) · Freight Night (a freighter after dark)
- **Flights:** Hopper (under 300 km) · Globetrotter (10,000 km+) · Five Airlines · Twenty-five Airlines ·
  Regular (one flight to gold) · Rare Here (5 ribbons)
- **Sets:** one per set at gold (shared art, set colour), plus Full Hangar (5 sets at silver)
- **Habits:** Early Bird (before 7 AM) · Night Flight (after 10 PM) · 4-week streak · 12-week streak · Road Trip
  (catches in 3 places 100 km apart)

Space Collector's secrets (UFO, Santa, stories) have no plane version here; they stay hidden until someone designs one.

## 6. When there is nothing to catch

- **No coverage** (the feed has never returned a plane here in a full day of opens): say so once, plainly, on Today and
  under the radar ("No plane tracking reaches here yet"), and don't deal missions that need a catch.
- **Quiet now:** Today's "Coming over next" is the session; Explore's radar line already says why it's empty.
- **Feed down:** already says so (2026-11-17).

## Questions for Sevaan (answered 2026-11-17: yes to all four, as recommended)

1. **One tier everywhere plus a "Rare here" ribbon** (recommended), or tiers that change by region?
2. **Flight tiers stay distance-based**, with cargo dropping from Epic to Rare?
3. **Both cards of a catch pay XP**, with the first two ranks stretched, or should only the flight card pay?
4. **The Epic and Legendary hand lists:** happy for me to draft them from the study for you to edit?
