# Can a store app with a paid tier use these feeds?

Researched 2026-11-17. Every claim carries the URL it came from; all pages were read on that date unless marked "archived copy" or "not reached". This is a fact sheet, not legal advice. "Silent" means the page I read says nothing on the point.

## Headline

- **adsb.lol is the only free live feed whose licence (ODbL 1.0) clearly allows commercial use.** But it now meters the API: unkeyed use is **500 requests/day per IP**, which a phone app polling the sky will burn through in well under an hour. Plan for a keyed relay or a paid sponsor tier.
- **adsb.fi and airplanes.live both say non-commercial.** A free app with a paid "Plus" tier is commercial in any ordinary reading. Do not use either as a primary without written permission.
- **ADSBexchange is non-commercial on its $10 RapidAPI plan; commercial use needs an enterprise licence.** (Now operated by JETNET.)
- **OpenSky needs a written licence for any commercial or operational use.**
- **FlightAware, Flightradar24 and AeroDataBox are paid and allow commercial apps** (FR24 terms not reached; AeroDataBox is a BC, Canada company and the cheapest).

## Summary table

| Source | Licence / terms | Commercial use | Rate limit | Attribution | Cost | Own-server caching / relay | Blocked / LADD / military |
|---|---|---|---|---|---|---|---|
| adsb.lol | ODbL 1.0 | Allowed (ODbL); terms silent on what counts as commercial | No key 500/day per IP; free adhoc key 1,000/day; feeder key 7,200/day; sponsors up to 360,000/day | ODbL attribution (public use of the data or works made from it) | Free; sponsor EUR 20 to 999/mo | Silent on caching; ODbL share-alike applies if you publish an adapted database | Returns flags (military, LADD) in `dbFlags`; I found no filtering rule |
| adsb.fi | Custom terms in README | **Personal, non-commercial only**; contact them for commercial | 1 req/s public | Must cite adsb.fi and link home page | Free | Forbids "license, sell, rent, or lease any part of the data or the service" | Silent; has a `/v2/mil` endpoint |
| airplanes.live | Own terms of use (AirDG, LLC) | API guide says **Non-Commercial Use** (archived copy) | 1 req/s (archived copy) | Silent in what I could read | Free | Silent (terms body not readable) | API has `/ladd`, `/pia`, `/mil` endpoints |
| ADSBexchange | Community API terms via RapidAPI; enterprise terms at JETNET | $10 plan is "non-commercial"; commercial = enterprise licence | 10,000 requests/mo on $10 plan | Silent | $10/mo community; enterprise quote | Enterprise terms prohibit "publish, resell, transmit, broadcast, distribute" | Silent |
| OpenSky | Data Licence Agreement (Swiss non-profit) | **Written licence needed** for any for-profit use or operational REST use | Anonymous 400 credits/day; registered 4,000; feeder 8,000 | Cite OpenSky paper in publications | Free for research; commercial by quote | Non-transferable licence | Silent |
| FlightAware AeroAPI | Paid tiers | Personal tier: no public apps. Standard (B2C) and Premium (B2C+B2B) allowed | Personal 10 result sets/min; Standard 5/s | Silent in what I read | Personal: pay per query, no minimum; Standard $100/mo minimum; Premium $1,000/mo | General terms forbid redistribution without express licence | Not stated on pages read |
| Flightradar24 API | Not reached | Not verified | Not verified | Not verified | Third-party sources: Explorer about $9/mo, Essential $99, Advanced $900 (unverified) | Not verified | Not verified |
| AeroDataBox | Terms of Use, last updated 2026-10-11 | Paid plans allowed; free Basic plan not | Basic 1 req/s, 400 units/mo; Pro 5,000 units/mo | Required only on free/trial plans | Free; $7.50 to $187.50/mo (API.Market) | Cache up to 7 days; end-use apps OK, sublicensing restricted | Has an FAA LADD API and compliance FAQ (page not read) |

## Details

**adsb.lol.** The API page says "license: ODbL 1.0" and lists the key tiers above (https://www.adsb.lol/docs/open-data/api/). The OpenAPI schema (https://api.adsb.lol/api/openapi.json) says `/v2/` is metered, while `/api/0/routeset` is "free". I confirmed enforcement: an unkeyed call to `/v2/point/...` returned `x-ratelimit-limit: 500, 500;w=86400`. Sponsor tiers (https://www.adsb.lol/sponsor): clearance EUR 20/mo (3,600/day, 24,000 requests/mo), tower EUR 50 (7,200/day, 72,000/mo), approach EUR 99 (180,000/mo), center EUR 499. The privacy page (https://www.adsb.lol/docs/privacy-license/) gives an "as is" disclaimer, a user indemnity, and logs kept under 30 days. The ODbL summary (https://opendatacommons.org/licenses/odbl/summary/) requires attribution for public use of the database or works made from it, and share-alike for a public adapted database. It does not mention commercial use; the full text should be read. Note the old repo README still says "no rate limits" (https://github.com/adsblol/api); it is stale.

**adsb.fi.** README (https://github.com/adsbfi/opendata): "adsb.fi open data is for personal, non-commercial use only." and "Please contact us if you have commercial or higher request rate requirements." Its lat/lon endpoint is now `/v3/lat/{lat}/lon/{lon}/dist/{dist}`; the v2 form is called deprecated. Our relay should move to v3.

**airplanes.live.** The live site and `api.airplanes.live` return Cloudflare 403 to my fetches, so the current guide and terms were **not reached**. Archived copy of the guide (https://web.archive.org/web/2025/https://airplanes.live/api-guide/): "No SLA No Uptime Guarantee Non-Commercial Use", 1 request per second, "Access does not currently require a feeder. That might change". Archived terms v1.0, 12 Sept 2023 (https://web.archive.org/web/2024/https://airplanes.live/terms-of-use/): operated by AirDG, LLC; I only read the preamble, not the data clauses. Treat as non-commercial.

**ADSBexchange.** Community API page (https://www.adsbexchange.com/api-lite/): "built for non-commercial use", $10/mo for 10,000 requests via RapidAPI, and "If you ... need commercial use, we have Enterprise options". The terms URL now redirects to JETNET (https://www.jetnet.com/legal/terms-of-use/), which covers internal business use and prohibits redistribution and building a competing product. A support article saying any commercial-entity project needs a commercial licence was only seen in a search snippet (page blocked).

**OpenSky.** https://opensky-network.org/about/terms-of-use: licence is "solely for the purpose of non-profit research and non-profit education"; "Any use by a for-profit or commercial entity requires written permission"; operational REST use needs a written licence "regardless of the entity's non-profit status". Contact: contact@opensky-network.org (address as published). Credits and tiers: https://openskynetwork.github.io/opensky-api/rest.html. The docs also say routes are not available through the REST API.

**FlightAware AeroAPI.** https://www.flightaware.com/commercial/aeroapi/ (tiers, fees, and "Standard: Yes, for business and business-to-consumer"). A free-tier app that earns subscription revenue is arguably B2C and so needs Standard at $100/mo minimum, but I would ask FlightAware to confirm. General terms (https://www.flightaware.com/about/termsofuse): no redistribution or commercial use of API/data "unless FlightAware has granted you an express license".

**Flightradar24 API.** Official pages (fr24api.flightradar24.com, support.fr24.com, the terms page) returned no readable content or 403. Pricing is from third-party summaries only (found via web search 2026-11-17); the sources conflict on the Explorer quota. Verify before relying on any of it.

**AeroDataBox.** Pricing: https://aerodatabox.com/pricing/. Terms: https://aerodatabox.com/terms/. Key clauses: commercial use only for content retrieved "through a channel that required payment" (5.3); attribution required only on free or trial plans, with a visible link (5.4); caching up to 7 days (5.5); no sublicensing of derived works to parties who may exploit them commercially, but "End Use" apps are excluded (5.7). The FAQ says the API is not for mission-critical or operations use (https://aerodatabox.com/faq/). Coverage page (https://aerodatabox.com/data-coverage/, table dated 2026-06-03) lists schedule/live-status coverage of UK 99%/71%, Spain 85%/95%, Turkey 92%/76%.

## What this means for Sky Collector

**Clearly allowed:** adsb.lol under ODbL (with attribution); paid AeroDataBox; paid FlightAware Standard (confirm B2C wording); the CC0 VRS standing-data (https://github.com/vradarserver/standing-data, LICENSE read 2026-11-17).

**Need permission:** adsb.fi (ask via their site/Discord; contact route stated in README only as "contact us"); airplanes.live (ask them, terms unreadable to me); ADSBexchange enterprise (sales); OpenSky (contact@opensky-network.org).

**Recommended:** primary adsb.lol through your own relay holding a sponsor or feeder key (relay, not phones, so quota is pooled; phones calling direct get 500/day each). Confirm with info@adsb.lol that a store app with a paid tier on a keyed plan is fine; their terms are silent on what "commercial" means. Fallback: a second paid provider (AeroDataBox ADS-B, or FlightAware Standard) behind the same relay interface. Do not fall back to adsb.fi or airplanes.live in the shipping app.

**Attribution to show:** "Aircraft positions: adsb.lol contributors (ODbL 1.0), adsb.lol. Routes: Virtual Radar Server standing-data (CC0). Photos and logos: Wikimedia Commons, credits per photo." Add AeroDataBox with a live link if a free plan is ever used.

**Risks:** (1) adsb.lol tiers changed recently and could again; the README still promises feeding for keys. (2) Share-alike: if the relay stores and publishes a derived database of positions, ODbL may require offering it. (3) Single volunteer-run provider, no SLA. (4) Phone-direct design hits per-IP limits and exposes any key in the app binary.

## Private aircraft: privacy and safety norms

- FAA LADD lets owners block display on public trackers; vendors that take FAA feeds must hide registrations, call signs and flight numbers on the list and show no history (https://nbaa.org/aircraft-operations/security/privacy/limiting-aircraft-data-displayed-ladd/). LADD does not bind community ADS-B feeds, which "can still collect ICAO addresses directly" (same page).
- adsb.lol's `dbFlags` marks aircraft (my live sample carried flag 8). I did not verify the bit meaning; airplanes.live exposes `/ladd` and `/pia` endpoints (archived guide).
- Practical norms: hide registration and owner for LADD/PIA-flagged aircraft; show type and an anonymised label for private GA; never show owner names; delay positions for sensitive categories; add a "request removal" contact; do not show live position of military or government aircraft beyond what the source flags.

## Sources

- https://www.adsb.lol/docs/open-data/api/ (2026-11-17)
- https://api.adsb.lol/api/openapi.json (2026-11-17)
- https://www.adsb.lol/sponsor (2026-11-17)
- https://www.adsb.lol/docs/privacy-license/ (2026-11-17)
- https://opendatacommons.org/licenses/odbl/summary/ (2026-11-17)
- https://github.com/adsbfi/opendata (README, 2026-11-17)
- https://web.archive.org/web/2025/https://airplanes.live/api-guide/ (archived)
- https://web.archive.org/web/2024/https://airplanes.live/terms-of-use/ (archived)
- https://www.adsbexchange.com/api-lite/ ; https://www.jetnet.com/legal/terms-of-use/
- https://opensky-network.org/about/terms-of-use ; https://openskynetwork.github.io/opensky-api/rest.html
- https://www.flightaware.com/commercial/aeroapi/ ; https://www.flightaware.com/about/termsofuse
- https://aerodatabox.com/pricing/ ; https://aerodatabox.com/terms/ ; https://aerodatabox.com/faq/ ; https://aerodatabox.com/data-coverage/
- https://nbaa.org/aircraft-operations/security/privacy/limiting-aircraft-data-displayed-ladd/
- https://github.com/vradarserver/standing-data
