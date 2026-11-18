# Card facts: style guide

How the facts on Sky Collector's aircraft cards are written (2026-11-18). It follows Space Collector's researched card
facts (data/facts.json, its 2026-10-15 writing review and 2026-10-20 content QA) and Sky's first pass (js/sky-facts.js,
docs/FACTS-SOURCES.md). Every type card has **three** facts; each different aircraft of that type you catch shows the
next one, so collecting a type again teaches you something new.

## The shape

- **One or two plain sentences**, at most about **170 characters** (the card shows about three lines).
- **Exactly one bold phrase**, wrapped in `**…**`: the hook a reader's eye lands on (a number, a name, a nickname, the
  surprising word). Not the whole sentence; usually 1 to 5 words.
- Starts with the thing itself, not "Did you know" or "Fun fact". No exclamation marks. No questions.
- Uses the type's everyday name the first time ("The 737-300", "The Dash 8-400", "The Bonanza"), not the ICAO code.

## The voice

- Curious and plain, for anyone from about ten to eighty. Short words. Explain jargon in the same sentence or don't use it
  ("ETOPS" alone means nothing; "rules for twin jets flying far from land" does).
- Concrete and visual: sizes people can picture ("longer than two tennis courts"), what you'd notice from the ground,
  how it sounds, where its name came from.
- Confident, never breathless: "the world's first", "built in 102 days", stated plainly.

## What makes a good fact

Aim for three **different angles** per type, for example:
1. **Spot it**: how to recognise it from the ground (T-tail, high wing, four engines, the hump, the sound of propellers).
   At least one of the three should help a player tell this type apart in the sky.
2. **Its story**: where the name came from, a first, a record, a famous user, why it was built.
3. **How it works**: a design choice with a reason (why the engines sit high, why it has winglets, a whole-plane parachute).

## Never

- Accidents, crashes, hijackings, groundings, investigations, wars, combat or deaths. (Military types: say what they
  are for, never what they did in a war.)
- Anything that goes stale: current fleet sizes, order books, prices, "is still the biggest", "the newest", who flies it
  today. Date it instead ("when it arrived in 1988", "in 2005 it flew …") or leave it out.
- Politics, controversy, brand comparisons that sneer.
- Guesses. If the source doesn't say it, it isn't in the fact.

## Numbers and units

- Metric first, as the existing facts do: km, m, km/h, tonnes. Heights in feet with metres after when it helps:
  "30,000 feet (9,100 m)". Thousands with commas. Spell out one to nine in text, digits for 10 and up.
- Every figure must appear in the source as written (or be a direct unit conversion of it).

## Sources

- Each fact names the page it was checked against: Wikipedia (the type's article), the maker, a museum, an aviation
  authority. Record the exact figures you checked. One fact = one source URL (two if it needs two).
- If a figure differs between sources, use the type's Wikipedia article and say "about".

## Examples (existing, kept)

- The 747's hump exists because Boeing expected it to become a **freighter**, so the cockpit went up top to leave the nose free to open.
- The EC135's tail rotor is hidden in a ring called a **Fenestron**, and it was the quietest helicopter in its class for 15 years.
- The Cirrus SR22 has a **parachute for the whole plane**, which can lower the entire aircraft to the ground in an emergency.
- Sikorsky first called it the S-74, then renamed it the S-76 to honor the US Bicentennial of **1976**.
