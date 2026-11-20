# Sky Collector: replace "who's flying it" (3 places), revised

Written 2026-11-20, **revised the same day** after Sky Dev found that "airline, route and type" is not always true. Decision (Sevaan): "who's flying it" becomes airline, route and type; the lines now say "most airline flights" and "the route", so they stay true. Sky Dev places them. No app or site file was changed by me.

## What the lines may claim (source)

- Sky's privacy page (`privacy.html`): an airline flight shows the airline, the route and the type; private, business-jet, military, police and government aircraft show the type only.
- **What Sky Dev found (2026-11-20):** an airline callsign with no route data gives only the plane card, and about 40% of airline callsigns outside the 55 hand-listed airlines are not recognised as flights until collected. So not every airline flight gets a flight card with airline and route.
- So the lines say: every plane gets a card for its type (always true: each catch makes a plane card); **most** airline flights get a second card with the airline and the route. None says every, and none promises a route.

Spelling is Canadian/British (no variants here).

## 1. Site hero: `site/public/index.html:58` (`<p class="pitch">`)

Space: 18 px type, `max-width: 30em`, about 50 characters a line. The current text is 159 characters; the replacement is 165.

**Current**
> Find out what’s really up there. Point your phone at the sky, line up a plane in the circle, and collect it: where it’s going, who’s flying it, and what it is.

**Replacement (final)**
> Find out what’s really up there. Point your phone at the sky, line up a plane in the circle and collect it. Most airline flights also show the airline and the route.

## 2. Sample pack, last card: `site/public/pack/index.html:129` (`<p class="lc-fact">`)

Space: 1.1 em Georgia, the card's fact area. Current is 113 characters; the replacement is 117. **The orphan:** the old line left "plane." alone on the last line at 320 px. The last two words are joined with a no-break space (`&nbsp;`) so the last line can never be a single word. Keep the `&nbsp;` when you place it.

**Current**
> `Every plane overhead is a <strong>real flight</strong>, and every one is a card: where it’s going, who’s flying it and what it is.`

**Replacement (final)**
> `Every plane overhead gets a card for its <strong>type</strong>. Most airline flights get a second one, with the airline and the&nbsp;route.`

(One bold phrase, the type. I did not check the wrap at 320 px; the no-break space is the guarantee, not my estimate of the line break.)

## 3. Welcome card: `js/main.js:8544` (`.wc-a-text`, the `SKY_ONLY` branch)

Space: 1.22 em Georgia on the card, `flex: 1`. Current text is 159 characters without the tags; replacement is 155.

**Current**
> `Every plane up there is a card: the flight, where it’s headed and the plane flying it. Catch long-haul jets, helicopters and the odd airship, and earn <b>patches</b>.`

**Replacement (final)**
> `Every plane up there is a card. Most airline flights get a second one with the airline and route. Catch jets, helicopters, even airships, and earn <b>patches</b>.`

"even airships" replaces "the odd airship" (an idiom); airship is a real Sky type (`js/planes.js`, `js/flight-card.js`). "long-haul" was dropped to keep the length close to the old line.

## Also changed in the same pass (store text)

The promotional text and the store description in `sky-store-listing-2026-11-20.md` use the same wording, so the app, site and stores say one thing.

## Check before it goes in

- Look at each at 320 px: the welcome card text may wrap one line more than before; the pack line needs the `&nbsp;`.
- The sample pack is built from its source (`site/pack-src`), then deployed.
- The sample pack's flights are scheduled airline flights (Jetstar), so the "second card" line is true there.
