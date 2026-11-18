# Better route data for Europe and Turkey

Researched 2026-11-17. URLs given per claim; "not reached" or "unverified" means exactly that.

## Headline

- **adsb.lol's `/api/0/routeset` is not an extra source.** Its code (https://github.com/adsblol/api, `api_routes.py`, read 2026-11-17) fetches routes from VRS standing-data and adds a plausibility check (position within the greater of 50 nm or 20% of route length of the A-B great circle). It will not fix coverage, only reject wrong matches.
- **Alphanumeric callsigns are in VRS already.** Today's check of the VRS route files found many rows with alphanumeric callsigns: RYR 40,396 of 48,821 rows, EZY 27,000 of 31,857, VLG 8,206 of 10,723, THY 6,675 of 10,264, WZZ 7,457 of 13,066 (counted by me from https://github.com/vradarserver/standing-data, 2026-11-17). So the Europe gap is probably stale, missing or ambiguous rows, not an absent format. This needs the experiment below to confirm.
- **No free, clearly commercial-safe, independent European source exists.** The practical improvement is a paid schedule lookup by flight number, cached, used only to fill VRS misses.

## Summary table

| Source | Europe coverage claim | Licence / commercial | Freshness | Query style | Bundle in app? |
|---|---|---|---|---|---|
| VRS standing-data | None stated; volunteer-submitted | CC0 (LICENSE read) | Commits daily (latest 2026-11-17) | Bulk CSV per airline code (`routes/schema-01/<letter>/<ICAO>-*.csv`); adsb.lol also hosts JSON per callsign | Yes (CC0) |
| adsb.lol routeset | Same data as VRS | ODbL for adsb.lol data; free-quota endpoint | Same as VRS | POST callsign + lat/lng | No benefit over VRS |
| adsbdb.com | None stated | Code MIT; route data credited to David Taylor and Jim Mason, "may not be copied, published, or incorporated into other databases without the explicit permission" (README) | Unknown | Per-callsign GET `/v0/callsign/{cs}`; limits not stated | No; permission needed |
| hexdb.io | None stated | Licence silent; credits PlaneBase/PlanePlotter and others | Site says database updated 18/11/26, but the route example is dated 2014 | Per-callsign GET `/api/v2/routes/{cs}`; "Free, no API key" | No (silent) |
| OpenSky | Derives origin/destination from tracks, not callsign-to-schedule | Written licence for commercial use | Live | Trino / flights endpoints; routes "not available through the REST API" | No |
| OurAirports | Airports only, not routes | Not verified (site certificate expired when fetched) | Files generated daily | Bulk CSV | Probably, after confirming licence |
| EUROCONTROL data repository | Flight plans, Europe-wide | R&D only; terms bar selling products containing the data (search snippet only; PDF not parsed) | Archive, not live | Registered download | No |
| AeroDataBox | Schedules UK 99%, Spain 85%, Turkey 92% (their table, 2026-06-03) | Paid plans commercial; caching 7 days | Live | Per flight number and date | Cache only, 7 days |
| FlightAware AeroAPI | Global | Standard tier for B2C | Live | Per flight; filed route $0.010 per result set | Cache terms not read |
| OAG / Cirium | Global schedules | Custom quote | Live | API | By contract |

## Details

**VRS standing-data.** Repo README: corrections go through the SDM site (https://sdm.virtualradarserver.co.uk/Edit); the maintainer says he does "not have any plans" to take pull requests and asks to be contacted first (https://github.com/vradarserver/standing-data). So missing airlines can be contributed, but through SDM edits, not GitHub. Rows are `Callsign,Code,Number,AirlineCode,AirportCodes`, with `AirportCodes` as e.g. `EGLL-KJFK`. I did not check how many rows are stale; a bulk CSV cannot say which of several flights sharing a callsign is flying now. That is the likely cause of low match rates.

**adsbdb.com.** Single probes today (anecdotal, one call each): `RYR4AB`, `BAW123` and `THY1AB` returned routes, `EZY84HX` returned "unknown callsign". The response includes both `callsign_icao` and `callsign_iata` (e.g. RYR4AB to FR4AB), so it maps ATC callsign to flight number where it knows the airline. Because its route data is credited to the same Taylor/Mason lineage as VRS, expect heavy overlap. No rate limits or terms stated on the pages read (https://github.com/mrjackwills/adsbdb).

**hexdb.io.** API v2 `/routes/{callsign}` returns origin, destination and `updated_at`; the documented example shows 2014 (https://hexdb.io/). "3.1M+ requests served daily", free, no key, no licence text found. Not safe to rely on commercially.

**OpenSky.** FAQ: it does not map to commercial schedules and "cannot give any information on ... flight numbers" (https://opensky-network.org/about/faq). Origin and destination are derived from track data where possible. Commercial use needs a licence (see DATA-TERMS.md).

**EUROCONTROL.** Aviation Data Repository for Research: registration via OneSky Online, R&D use only (https://www.eurocontrol.int/dashboard/aviation-data-research). Not usable for a consumer app.

**Open timetables.** I found no maintained open airline timetable for Europe. Not verified further.

**Paid.** AeroDataBox: Pro $7.50 to $8/mo for 5,000 units; Ultra $37.50 to $40 for 50,000 units; free Basic not for commercial use (https://aerodatabox.com/pricing/). Which tier the flight-by-number endpoint costs is not stated on that page. FlightAware: Standard $100/mo minimum (https://www.flightaware.com/commercial/aeroapi/). OAG publishes no price list (its FAQ describes a fixed usage-tier fee plus per-call overage, https://www.oag.com/knowledge/how-am-i-charged-for-using-flight-info-api). Cirium: custom quote only, as per web search; unverified.

**The callsign problem.** Ryanair-style callsigns (`RYR4AB`) are ATC callsigns, not flight numbers; the passenger flight number differs (FR 1234). Only a source with an airline-specific mapping or live matching handles it: adsbdb's IATA field (partially), and paid APIs that match on registration or hex and time, not callsign. Matching by aircraft hex plus position and time is the robust route, and AeroDataBox and FlightAware both support lookups by registration or aircraft (not tested here).

## Recommendation, ranked by effort vs gain

1. **Low effort, some gain:** keep VRS as the base; use the routeset plausibility rule yourself (50 nm or 20%) to drop wrong matches so you show "unknown" rather than a wrong route.
2. **Low effort, uncertain gain:** call adsbdb as a second lookup for VRS misses, after getting permission from its author (open an issue on the repo). Likely overlaps VRS.
3. **Medium effort, likely largest gain:** paid AeroDataBox, queried only for VRS misses in Europe/Turkey, cached up to 7 days, within a Pro plan. Needs the callsign-to-flight-number mapping first; confirm its endpoint cost first.
4. Submit missing airlines and corrections to the SDM site (slow, benefits everyone).
5. Skip OpenSky, EUROCONTROL, OAG and Cirium for now.

## Experiment: measure the gain

1. Sample about 300 distinct airborne callsigns over London, Madrid and Istanbul from `https://api.adsb.lol/v2/point/{lat}/{lon}/250`, keeping hex, lat, lon. Stay under the 500/day unkeyed limit (a handful of calls).
2. For each: (a) VRS lookup from downloaded CSVs; (b) `POST https://api.adsb.lol/api/0/routeset` (note: my one test call returned an empty 201 body, so check the payload format first); (c) `https://api.adsbdb.com/v0/callsign/{cs}`; (d) `https://hexdb.io/api/v2/routes/{cs}`. Pause one second between calls.
3. Score each by hit rate and plausibility using the 50 nm / 20% rule against the aircraft's position.
4. Ground-truth a 50-flight subsample with AeroDataBox (free Basic plan, 400 units, for testing only, with attribution) by flight number or registration.
5. Decide: if (c) or (d) add more than about 10 points of plausible coverage over (a), pursue licensing; if not, go to AeroDataBox.

## Sources

- https://github.com/vradarserver/standing-data (README, LICENSE, file listing, commit dates; 2026-11-17)
- https://github.com/adsblol/api (README, `src/adsb_api/utils/api_routes.py`, `plausible.py`)
- https://api.adsb.lol/api/openapi.json
- https://github.com/mrjackwills/adsbdb ; https://api.adsbdb.com/v0/callsign/RYR4AB
- https://hexdb.io/
- https://opensky-network.org/about/faq ; https://openskynetwork.github.io/opensky-api/rest.html
- https://www.eurocontrol.int/dashboard/aviation-data-research
- https://aerodatabox.com/pricing/ ; https://aerodatabox.com/data-coverage/
- https://www.flightaware.com/commercial/aeroapi/
- https://www.oag.com/knowledge/how-am-i-charged-for-using-flight-info-api
