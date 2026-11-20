# Sky Collector: replace "who's flying it" (3 places)

Written 2026-11-20. Decision (Sevaan, 2026-11-20): "who's flying it" becomes "airline, route and type". Sky Dev puts these in. No app or site file was changed by me.

## What the lines may claim (source)

Sky's own privacy page (`privacy.html:52`, `site/public/privacy.html`): an airline flight shows the airline, the route and the type. Private, business-jet, military, police and government aircraft show the type only, never callsign, registration, operator or route. So every line says **airline flights** show airline, route and type. None says every plane does.

Not checked by me: whether a route is always shown when we have no route data for a callsign (`docs/PROJECT-PLAN.md` says some airline callsigns have no route until after you collect). "Show" is true when the data exists. If Boss wants "when we know it" added, say so; I left it out to keep the lines short.

Spelling is Canadian/British (as agreed). These lines have no spelling variants.

## 1. Site hero: `site/public/index.html:58` (`<p class="pitch">`)

Space: 18 px type, `max-width: 30em`, about 50 characters a line, so about four lines on a desktop and five on a phone (`max-width: 26em`). The current text is 159 characters. Mine is 165, about one more short line at most.

**Current**
> Find out what’s really up there. Point your phone at the sky, line up a plane in the circle, and collect it: where it’s going, who’s flying it, and what it is.

**Replacement (pick)**
> Find out what’s really up there. Point your phone at the sky, line up a plane in the circle and collect it. Airline flights show the airline, the route and the type.

**Option B** (shorter, 151 characters, drops the opening line)
> Point your phone at the sky, line up a plane in the circle and collect it as a card. Airline flights show the airline, the route and the type of plane.

Why the pick: it keeps the page's opening line, says exactly what an airline flight shows, and ends on the thing the card tells you.

## 2. Sample pack, last card: `site/public/pack/index.html:129` (`<p class="lc-fact">`)

Space: 1.1 em Georgia, one bold phrase, the card's fact area (about three lines on a phone). Current is 113 characters. Mine is 98 (plus the tags).

**Current**
> `Every plane overhead is a <strong>real flight</strong>, and every one is a card: where it’s going, who’s flying it and what it is.`

**Replacement (pick)**
> `Every plane overhead is a card. Airline flights show the <strong>airline, the route and the type</strong> of plane.`

**Option B**
> `Every plane overhead is a <strong>card</strong>: its type and, for an airline flight, the airline and the route.`

Why the pick: the old line said "every one is a real flight", which is not true for a private or military aircraft; this one is.

## 3. Welcome card: `js/main.js:8544` (`.wc-a-text`, the `SKY_ONLY` branch)

Space: `.wc-a-text` is 1.22 em Georgia on the card, `flex: 1`, between the three steps and the footer. The current text is 159 characters without the tags. Mine is 157, so the card should not grow.

**Current**
> `Every plane up there is a card: the flight, where it’s headed and the plane flying it. Catch long-haul jets, helicopters and the odd airship, and earn <b>patches</b>.`

**Replacement (pick)**
> `Every plane up there is a card. Airline flights show the airline, the route and the type. Catch long-haul jets, helicopters, even airships, and earn <b>patches</b>.`

**Option B** (152 characters)
> `Every plane up there is a card, with its type and, for airline flights, the airline and route. Catch jets, helicopters, even airships, and earn <b>patches</b>.`

Why the pick: it drops "the odd airship" (an idiom that a non-native reader or a child may not get) for "even airships". Airship is a real type in Sky (`js/planes.js` has an `airship` type and `js/flight-card.js` draws one).

## Check before it goes in

- Look at each on a 320 px phone: the card text may wrap one line more than before (welcome card), and the hero is five lines at 26 em.
- The sample pack is built from the app's own code by `scripts/build-site-pack` (Sky's pack is under `site/pack-src`). Change the source, rebuild, then deploy. I don't know the exact script name in Sky; Sky Dev does.
- Cards in the sample pack are airline flights (JST563, JST112, Jetstar, scheduled). Fine under the rule.
