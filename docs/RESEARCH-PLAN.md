# Sky Collector: research plan for cards, art and data

Written 2026-11-15. Sky Collector has to work for someone in Toronto, Lagos, Jakarta, Reykjavík or a farm in Saskatchewan.
Every card, fact and set below has to make sense wherever the player stands. This plan lists what we need to find out,
where the answers can come from, and in what order.

## What a card is (decided 2026-11-15)

- **Flight cards** (the main collection): an airline flying a route, for example Icelandair Toronto → Reykjavík.
  The card key is the airline plus origin plus destination.
- **Planes cards** (second collection): the aircraft type, for example Boeing 737 MAX 8. Airlines are stamps on it.
  Anything without a route lands only here: helicopters, light planes, balloons, airships, gliders, military
  aircraft and private jets.
- **Patches, missions and sets**: Space Collector's mechanics, re-themed.

Rough sizes:
- About 500 aircraft types make up nearly everything overhead, out of roughly 10,000 ICAO type codes.
- About 800 active airlines.
- About 3,500 airports with scheduled flights.
- Tens of thousands of routes.

So Flight cards can't each be hand-written. They're built from data, and the hand-written parts (art, facts) belong to
**destinations, airlines and types**, which there are far fewer of.

---

## Phase 0: the sample study (do first; everything else is sized by it)

Before writing a single card, measure what players actually see.

- **Where:** 30 places on every inhabited continent. Busy, medium and rural in each region, for example:
  - Toronto, a rural Ontario town, Vancouver
  - New York, Dallas, Mexico City, São Paulo
  - London, Frankfurt, a Spanish town, Istanbul, Dubai
  - Lagos, Nairobi, Johannesburg
  - Delhi, Singapore, Jakarta, Tokyo, Seoul
  - Sydney, Auckland, Honolulu, Reykjavík, Anchorage
  - plus remote stand-ins (central Australia, northern Canada)
- **How:** adsb.lol publishes daily whole-world history files (ODbL). One or two days of those, filtered to a 75 km
  circle around each place, show everything a player there could have caught. No live polling is needed.
- **What to measure, per place:**
  1. Planes per hour overhead (above 8° elevation), by hour of day. This tells us whether the game is playable there and when.
  2. The share with a usable callsign, and how many of those get a route from Virtual Radar Server's free data (`js/routes.js`).
     Spot-check 50 against a flight tracker by hand to estimate how often the route is **wrong**, not just missing.
  3. The aircraft-type mix. Which types make up 90%, 99% and 99.9% of sightings, worldwide and per region. This orders the Planes art work.
  4. The airline mix and the destination mix, which order the airline and destination research.
  5. Helicopters, balloons, military and other non-airline traffic: how much, and what.
- **Deliverable:** one table per place plus a world summary, kept in `docs/research/sample-study.md`. The script goes in `scripts/research/`.

The open question this answers: **is ADS-B coverage good enough everywhere?** Volunteer receivers are thin in parts of
Africa, Central Asia, South America and the oceans. Where coverage is poor, the app shows an empty sky over planes the player can actually see.

---

## Phase 1: data sources and what we're allowed to do with them

For each source, record: what it gives us, its licence, its rules for commercial use (Sky Collector will sell a Plus
plan), attribution wording, rate limits, how fresh it is, and how much of the world it covers.

| Need | Candidates to check | Notes |
|---|---|---|
| Live positions | adsb.lol (ODbL), adsb.fi, airplanes.live, OpenSky | adsb.lol now refuses cloud relays (Val Town 429, Cloud Run 502). Test a Cloudflare Worker. Read each one's commercial-use terms. ODbL is share-alike for **databases** we derive from it, so check what that means for our rarity stats. |
| Routes by callsign | Virtual Radar Server standing data (CC0, used now), OpenSky route data, paid APIs (AeroDataBox, FlightAware, Cirium) | Phase 0 measures VRS coverage and accuracy. Paid options get costed per 1,000 lookups as a fallback. adsbdb was already dropped by Space Collector over its licence. |
| Airports | VRS airports (CC0), OurAirports (public domain), Wikidata (CC0) | Need city name, country, position, size, time zone, and local-language names. |
| Airlines | Wikidata, OpenFlights airlines (ODbL), ICAO 3-letter / IATA 2-letter code lists | Need name, country, founding year, alliance, and the ICAO↔IATA mapping (callsign `ACA848` → flight `AC 848`). |
| Aircraft types | ICAO Doc 8643 type designators, Wikidata, manufacturers' spec sheets | Need maker, model, family, first flight, seats, range, speed, wingspan, engines, number built. |
| Individual aircraft | ADS-B hex → registration (in the feed), national registers (FAA is public domain; Transport Canada, UK CAA G-INFO and others vary) | Only for aircraft age or "this exact plane" extras. See privacy below. |
| Time zones | IANA tz via timezone-boundary-builder (ODbL), or the airport's zone from a dataset | For "time there: +5 h". |
| Base map for route art | Natural Earth (public domain) | Real coastlines under the dashed route arc. |

**Deliverable:** `docs/research/data-sources.md`, one section per source, with a yes / no / ask-them verdict for commercial use.

---

## Phase 2: Planes cards (aircraft types)

Ordered by Phase 0's type mix. Start with the types that make up 95% of sightings worldwide, about 120. Then
regional favourites (Dash 8 and Twin Otter in Canada, ATR 72 in Asia, An-2s where they still fly), then the rare and
legendary list.

**Per type, research:**
- **Name and family.** "Boeing 737 MAX 8", in the 737 family. Many ICAO codes collapse into one card; decide which (A332 and A333 → A330?).
- **Stats for the card's four boxes:** cruise height, cruise speed, seats (typical two-class), range, wingspan, first flight, number built.
- **One fun fact**, true, surprising and short, with a source link, as on Space Collector's cards.
- **Tier:** from how often it's seen (Phase 0), then adjusted by hand. A350s are common in Doha and rare in Kansas, so tier may need to be **regional**. Phase 5 decides.
- **How to recognise it from the ground:** engine count, tail shape, wing position. These feed a future "what am I looking at?" hint.

**Rare and legendary list (separate research):**
- Airbus Beluga, An-124, the last An-225 story, 747 freighters, Concorde (museum card?)
- Air Force One / heads-of-state aircraft
- Water bombers (CL-415, DHC-515), air ambulances, coast guard
- Airships, the Goodyear blimps, hot-air balloons, gliders
- Historic warbirds at air shows

For each, the question is whether ADS-B data can spot it: hex code ranges, callsigns like SAM28000 or AIRSHIP, or type codes.

**Questions to settle:**
- Military aircraft often don't broadcast, or appear only through MLAT. Do we include what does broadcast? Are there sensitivities?
- Drones mostly don't broadcast, so they're out of scope for now.

**Deliverable:** `data/types.json` (one row per card, every number with a source URL) plus a type list for the art pipeline.

---

## Phase 3: Flight cards (airlines, destinations, routes)

Route cards are put together from parts; the research goes into the parts.

**Destinations (about 3,500 airports; start with the top 1,000 by Phase 0 traffic):**
- City name as people say it ("Reykjavík", not "Keflavik International"), country, and local-language names for localisation.
- **One fun fact per destination city**, sourced. This is the biggest writing job. Check whether facts can be written
  per city rather than per airport, since London has five airports and New York three.
- Time zone (computed) and maybe the flag (country, not airline).

**Airlines (about 800; start with the top 200 by Phase 0 traffic):**
- Name, country, founding year, hub, alliance, and the callsign word it uses on the radio ("SPEEDBIRD" for British Airways).
  That last one makes a good short fact.
- **Logos: yes, to say which airline it is** (checked 2026-11-15; see Phase 6). Get them from a licensed logo set
  (Airhex or Duffel), not copied from Wikipedia. Show them where a flight tracker would, on the card next to the
  airline's name. Don't make the logo itself the prize. Keep one switch that hides logos everywhere, in case an app
  store objects.

**Routes (computed, not researched):**
- Distance, time in the air and sets come from the parts.
- Research only the **standout routes**: the longest flights, polar crossings, the shortest scheduled flight (Westray–Papa
  Westray), famous ocean crossings, record routes. These become special sets and Legendary cards.

**Deliverables:** `data/airports.json`, `data/airlines.json`, `data/destination-facts.json`, `data/special-routes.json`.

---

## Phase 4: card art

Space Collector's rules carry over:
- Real pictures, with credit, licence and source recorded for each (`scripts/art-photos.json`).
- Drawings made from **text descriptions, never by feeding the model reference images**, then checked against the references.
- Redo art from the actual image file, never from a description of one.

**Planes cards: three routes to test on ten types before choosing:**
1. **Photos from Wikimedia Commons.** Free licences, but quality and angle vary, and each needs credit. Count how many of the top 120 types have a good, freely licensed, in-flight photo.
   - Planespotters.net, Airliners.net, JetPhotos: photographers keep copyright; their terms don't allow use in an app. Only by asking photographers one by one.
   - Manufacturer press images: usually editorial-only. Check Boeing, Airbus, Embraer, ATR, De Havilland, Bombardier.
2. **Our own drawings** in one consistent style: side view or three-quarter in-flight view, in a neutral livery (no airline marks), through Space Collector's drawing pipeline. Consistent and legally clean, but needs care with details (engine count, winglets, tail shape).
3. **Mixed:** photos where good free ones exist, drawings for the rest. Space Collector did this.

Also research what the "shiny" version of a plane card looks like.

**Flight cards:**
- The art is the route on a real map: Natural Earth coastlines, the great-circle arc, the two airports. It's generated, so it works for every route on Earth for free. Test the projection and zoom rules for very short hops (Toronto–Ottawa), very long ones (Toronto–Hong Kong over the pole) and routes crossing the date line.
- Optional extra: a destination picture (a postcard of Reykjavík). Same licence question as photos, for 1,000+ cities. Decide after the map art is tested.

**Deliverable:** `docs/research/art-direction.md` with the ten-type test sheet and a recommendation.

---

## Phase 5: rarity, sets and missions that work everywhere

The hardest design problem. It needs Phase 0's numbers first.

- **Rarity has to be relative to where you are.** An Emirates A380 is everyday over Dubai and legendary over Winnipeg.
  Options:
  - Rarity from **how often that flight passes over your area**, computed from adsb.lol history on a world grid (say 1° squares) and shipped as a small lookup.
  - Or measured on the phone over time.
  - Or global rarity with local bonus labels ("rare here").

  Model each option against the Phase 0 places, so every place gets a sensible pyramid (most Common, a few Epic).
- **Sets must be completable from anywhere**, or be clearly local:
  - **Global sets:** six continents, alliances, every widebody family.
  - **Local sets, generated per player:** "Over your home", "Every airline at your nearest airport", "Departures from your nearest hub".
  - Avoid sets like "Across the Atlantic" that are impossible from Perth, unless they're marked as travel sets.
- **Quiet skies:** rural players may see five planes a day. Research what keeps them playing: missions sized to their
  sky, helicopters and light aircraft counting for more, and catches on trips (catches made while away from home).
- **Missions and patches:** go through Space Collector's list (`js/progress.js`, `js/patches.js`) and re-theme each one,
  checking it can be done in every Phase 0 place.

**Deliverable:** `docs/research/rarity-and-sets.md`, with the chosen model and a table of what each Phase 0 place would see.

---

## Phase 6: legal, privacy and safety

- **Licences:**
  - ODbL share-alike (adsb.lol, OpenFlights, timezone data) and what it requires of our derived files.
  - CC BY-SA attribution for photos.
  - Wikipedia text: CC BY-SA, so facts are **written fresh**, not copied.
  - CC0 data needs no credit, but we credit it anyway.
- **Trademarks: airline logos, checked 2026-11-15.**
  - **Wikipedia isn't a source.** Most logos there are shown under fair use for that one article only. A few
    lettering-only ones are public domain on Commons for copyright, but they're still trademarks.
  - **The industry uses logos to identify airlines:**
    - Flightradar24 shows airline logos on its map and in its apps.
    - Logo services sell licensed sets for apps: Airhex has 920+ airlines and Duffel 600+, and Duffel calls its set
      "brand compliant". Airhex licenses the logo files it makes, not the airlines' trademarks themselves.
  - **The legal footing is "nominative fair use":** using a brand to say what something is. Courts look harder at
    logos than at names. Putting someone's logo on your own product, as merchandise, is generally not covered.
  - **The closest real case:** American Airlines sued The Points Guy (2022) over its name and graphics in a points
    app. It survived a motion to dismiss, then American dropped it in November 2022, with no ruling on the merits.
  - **Apple guideline 5.2.1** rejects apps using third-party trademarks without permission. Developers report
    rejections even after removing logos (over sports team names), and reviewers may ask for proof of permission.
  - **Verdict:** showing a logo to identify the airline on a flight card is the same use flight trackers make, and is
    likely fine. Using logos as collectible stamps or patches drifts toward merchandise, so avoid that.
  - **Before launch:**
    - get a written logo licence (Airhex or Duffel)
    - have the hide-logos switch ready
    - give App Review a short note explaining the use
    - a lawyer's half hour is worth it before selling Plus

  Sources: [Flightradar24 label options](https://www.flightradar24.com/blog/inside-flightradar24/new-flightradar24-com-label-options/),
  [Duffel airline logos](https://duffel.com/blog/get-high-quality-brand-compliant-airline-logos-in-our-flights-api),
  [Airhex logo API](https://airhex.com/de/api/logos/),
  [Points Guy suit dropped (Law360)](https://law360.com/articles/1547330),
  [Fordham IPLJ on the suit](https://fordhamiplj.org/2022/05/03/the-points-guy-just-wants-to-fly-american-airlines-sues-over-trademark-infringement/),
  [Apple forums: 5.2.1 rejection over team names](https://developer.apple.com/forums/thread/718427),
  [Nominative use](https://www.wikipedia.org/wiki/Nominative_use).
- **Privacy:**
  - **Private aircraft:** a registration identifies the owner. Respect FAA LADD/PIA (blocked and privacy-programme
    aircraft) and the EU's GDPR position on registrations.
  - Proposal: private and general-aviation aircraft show **type only, never the registration**, on cards and in shares.
    Research whether data sources already filter LADD.
  - **Police, medical and military:** showing a live air ambulance is fine (it's on every flight tracker). Showing a
    police helicopter's live position may be sensitive. Decide a policy.
- **Countries where plane-spotting is touchy:** some places have arrested spotters (Greece 2001, UAE incidents) or limit
  flight-tracking apps. Research the app-store listing and any in-app caution, country by country, for the top 50 markets.
- **Safety:** nobody should be pointing their phone up while driving, or at airports' restricted edges. Look at what
  Space Collector's onboarding says, and add plane-specific notes.

**Deliverable:** `docs/research/legal-privacy.md` with a policy for each item.

---

## Phase 7: works everywhere (localisation and conventions)

- **Languages:** Space Collector ships English, German, Mexican Spanish, Canadian French, Japanese and Brazilian
  Portuguese. Check which languages the Phase 0 places need. Add at least Arabic (right-to-left), Hindi, Indonesian and
  Mandarin? City and airline names come from Wikidata labels in each language; facts need translating.
- **Units:** aviation uses feet for height worldwide except China, Russia and a few others (metres). Speed in knots for
  pilots, km/h or mph for players. `js/localize.js` already converts km↔mi and spelling; extend it for ft↔m.
- **Time and dates:** 12/24-hour clock and local date formats (already handled for Space Collector).
- **Southern hemisphere and the tropics:** daylight, seasons and night-sky scenery work anywhere. Check the
  "Today / busiest hours" chart in places with traffic all night (Dubai, Hong Kong).

**Deliverable:** additions to `js/localize.js` and a language list.

---

## Order and size

| Order | Phase | Mostly | Size |
|---|---|---|---|
| 1 | 0: sample study | script + analysis | 1–2 days |
| 2 | 1: data sources | reading terms, small tests | 1 day |
| 3 | 4: art test on 10 types | art pipeline | 1–2 days |
| 4 | 2: top 120 types | research + fact-checking | about 1 week, can run as parallel agents |
| 5 | 3: top 200 airlines, top 1,000 destinations | research + writing | 1–2 weeks, parallel |
| 6 | 5: rarity and sets | modelling on Phase 0 data | 2–3 days |
| 7 | 6: legal and privacy | reading + short legal check | 1–2 days, plus any lawyer time |
| 8 | 7: localisation | translation | ongoing |

**Fact-checking rule for every phase:** each number and fact gets a source URL, and a second, independent pass checks
it against that source before it ships. Space Collector's cards worked that way, with the SOURCE link on every card.
