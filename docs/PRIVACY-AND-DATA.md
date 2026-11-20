# Privacy and data terms: where Sky Collector stands (sprint task X, 2026-11-17)

Built on docs/DATA-TERMS.md (the research) and scripts/perf/net-audit.mjs (what the test build really contacts).

## Today (the test site)

privacy.html now describes this build as it is: rounded position to the Val Town relay (→ adsb.lol, adsb.fi) and to
Open-Meteo; routes bundled; everything else on the device; no accounts, purchases, analytics or reports.
It was Space Collector's policy with the name changed, describing a server, RevenueCat, usage reports and Cloudflare
analytics that Sky doesn't have, and an email address that may not exist. Contact is the public repo's issues until
Sevaan has a domain and address for Sky.

## Before a store release, in order

1. **The plane feed is not cleared for a store app.** adsb.fi's terms are personal, non-commercial; the test relay
   leans on it because adsb.lol refuses the relay's host (500 requests a day per address without a key). A store build
   must use adsb.lol with a key (feeder or sponsor) through Sky's own relay, with a paid fallback (AeroDataBox or
   FlightAware Standard), and must not use adsb.fi or airplanes.live. Sevaan: email info@adsb.lol to confirm a store
   app with a paid tier is fine on a keyed plan. Needs the backend decision (sprint Z).
2. **Phones must not ask adsb.lol directly.** At one request every 10 seconds a phone uses its 500 a day in under
   90 minutes. This applies to Space Collector's app today as well.
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
