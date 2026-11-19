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
5. **Military and government aircraft. Done 2026-11-19:** catchable only as generic type cards (anonymous as above);
   no secret or patch names a military or police aircraft. No history beyond the type card's count.
6. **Rewrite privacy.html for the store build** once the backend exists: the server, purchases (RevenueCat), backups
   (iCloud key 'sky-backup'), notifications, any usage reports, a real contact address.
7. **Airline logos and names**: identification only, with the hide-all switch that exists; keep the per-airline
   removal route.
