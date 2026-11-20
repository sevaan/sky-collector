# Privacy and data terms: where Sky Collector stands (sprint task X, 2026-11-17)

Built on docs/DATA-TERMS.md (the research) and scripts/perf/net-audit.mjs (what the test build really contacts).

## Today (the test site)

privacy.html now describes this build as it is: rounded position to Sky's relay (→ Fly Italy ADSB; the apps ask adsb.lol directly first) and to
Open-Meteo; routes bundled; everything else on the device; no accounts, purchases, analytics or reports.
It was Space Collector's policy with the name changed, describing a server, RevenueCat, usage reports and Cloudflare
analytics that Sky doesn't have, and an email address that may not exist. Contact is the public repo's issues until
Sevaan has a domain and address for Sky.

## Before a store release, in order

1. **Where the planes come from (as built, 2026-11-19).** In the apps each phone asks adsb.lol itself
   (api.adsb.lol/v2/point, around the phone's rounded position), under adsb.lol's ODbL 1.0 terms and its limit of
   about 500 requests a day for each address (no key; adsb.lol allows phones, and permission isn't required). How
   often it asks adapts to what's near (js/plane-feed.js); when adsb.lol answers 429, its count runs low
   (`switchAt`, 25 left) or it fails, the phone hands over to Sky's own relay for the rest of the day
   (server/planes-relay.js on Sky's Cloud Run, which asks Fly Italy ADSB under its commercial-use terms and caches
   briefly). The website, which can't reach adsb.lol from a browser, uses Sky's relay only (since 2026-11-19; the
   Val Town test relay, which read adsb.lol and adsb.fi under non-commercial terms, is retired: relay/planes.ts stays
   in the repo for reference only). Watch the monthly Fly Italy budget on the relay's /status. A paid fallback (AeroDataBox or FlightAware) remains an option for the relay.
2. *(Removed 2026-11-19: "Phones must not ask adsb.lol directly." The apps do, within adsb.lol's per-address limit,
   and hand over to the relay before it runs out.)*
3. **Attribution screen** (Settings → Credits): "Aircraft positions: adsb.lol contributors (ODbL 1.0). Routes: Virtual
   Radar Server standing-data (CC0). Photos and logos: Wikimedia Commons, credited on each card. Weather: Open-Meteo
   (or MET Norway through our server)."
4. **Private aircraft. Done 2026-11-19** (js/planes.js isAnonymous, anonId): every aircraft that isn't flying an airline
   flight is anonymous: private and general-aviation planes (their callsign is their registration), LADD and PIA
   (dbFlags 8, 4) and military (dbFlags 1). Type only: no callsign, no registration, never the feed's ownOp, and the
   transponder hex is replaced at parse time by a salted hash (per phone, never sent) so plane cards can count
   different aircraft. Catches stored before this were scrubbed the same way on the next launch (main.js
   anonymizeStored). The sample pack's live flight skips flagged aircraft. Still to add: a removal request route.
5. **Military and government aircraft. Done 2026-11-19, tightened the same day** (aviation-enthusiast playtest: a
   Military set with Epic fighters, and RCH/RRR/Home Office callsigns passing as airlines): military, police, coast guard
   and government aircraft (dbFlags 1, the operators in js/plane-privacy.js GOV_OPS, or a military type code) are
   anonymous. Fractional and charter business-jet operators (NetJets, Flexjet, XO, flyExclusive, AirSprint, VistaJet,
   EJM: BIZ_OPS) are anonymous like private planes.
   **Shown by type again, Sevaan 2026-11-19** ("I should be able to catch a stealth bomber if I see it and it's in the
   api data because it's allowing itself to be tracked"; he chose "Type card + Military set"): a military or government
   aircraft is a real type card (C-17, B-2, KC-135: photo, facts, specs), the Military set and the military Epic tiers
   are back, and the card's band says "Not an airline · Military" or "· Government" (js/planes.js catchClass). Never
   its callsign, registration, real hex (salted anonId), unit, operator or route; never a flight card (js/flights.js
   cardsFor), no regulars, no alert or secret that names a unit or callsign; no Police set. The launch and sent-pack
   scrub (js/plane-privacy.js scrubSighting) keeps the type. Catches made under the size-only rule stay size cards.
6. **Rewrite privacy.html for the store build** once the backend exists: the server, purchases (RevenueCat), backups
   (iCloud key 'sky-backup'), notifications, any usage reports, a real contact address.
7. **Airline logos and names**: identification only, with the hide-all switch that exists; keep the per-airline
   removal route.

## Location: precise on the phone, rounded off it (2026-11-20)

Sevaan decided Sky asks for **precise** location (Space Collector stays approximate): a ~3 km approximate fix draws a
plane 10 km away several degrees off (design/privacy-store-checklist.md has the numbers).

- **On the phone only.** The fix is used to work out where each plane is in your sky (js/planes.js skyPosition) and is
  kept on the device (localStorage 'observer', and each catch's own place, which is part of the card; both are in the
  player's own iCloud/Android backup, never on our server).
- **What leaves the phone is rounded.** Plane requests (adsb.lol from the phone, Sky's relay as the backup, the
  website's relay) carry the position snapped to a **0.05° grid** (js/planes.js feedPoint: about 5.5 km north-south,
  less east-west). The snapped point is at most √2 × 0.025° = 2.1 NM from the real one, so the radius grows from 40 to
  **43 NM** and every plane within 40 NM of the real spot is still in the answer (tests/location-privacy.test.mjs checks
  20,000 random places). 43 NM = 79.6 km, inside the relay's 80 km cap. Weather asks Open-Meteo / our /wx for a 0.1°
  square. The raw fix is never sent.
- **The relay** (server/planes-relay.js, server/index.js) keeps answers per 1° square in memory (tileOf: only the
  square's centre goes to Fly Italy ADSB) and its own logs never print a coordinate. **But** Cloud Run's request log
  records each request's URL, which carries the rounded 0.05° point, for the log's retention (30 days by default). To
  keep even that off the server: move lat/lon from the query string to a header or POST body (a server deploy, then an
  app change), or lower the request log's retention / exclude /planes from it in Cloud Logging.
- **Never in reports.** Usage notes (js/field-notes.js → POST /t → sky_events) carry no location: checked every note()
  call (the tour's 'loc' note says only own / tz / skip / none). Sent packs (js/gift.js asGift) drop lat/lon/az/el/
  rangeKm. Widgets get names and times, not places. The on-phone testing readouts (Settings → Plane positions, the
  feed log) show coordinates on the phone only.
