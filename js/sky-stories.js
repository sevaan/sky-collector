// Sky Collector's story cards (2026-11-19, docs/SECRETS-AND-PATCHES.md): four of its secrets give a story card instead
// of a patch, as Space Collector's story secrets do (js/stories.js). Registered as natural story cards; the art is in
// assets/art/cards/story-sky-* (public domain or CC0, js/art-credits.js and js/art-sources.js). Every fact checked
// against the source in docs/FACTS-SOURCES-STORIES.md.
import { NATURAL, NATURAL_BY_KEY } from './natural.js?v=0.1.1779';
import { STORY_BY_SECRET } from './stories.js?v=0.1.1779';
import { STORY_SECRETS } from './secrets.js?v=0.1.1779';

const S = (id, secret, name, when, stats, fact) => ({ key: `story:${id}`, id: `story:${id}`, card: `story:${id}`, natural: 'story', type: 'story', story: true, secret, name, when, code: 'STORY', tier: 'epic', stats, fact, art: id });
export const SKY_STORIES = [
  S('sky-whale', 'whale', 'The Whale', '19 July 2018 · the BelugaXL’s first flight', [['FIRST FLEW', '2018', ''], ['BASED ON', 'A330-200F', ''], ['FLEET', '6', ''], ['CARRIES', 'Plane parts', '']],
    'Airbus builds the parts of its planes in different countries and flies them to its assembly lines in the **Beluga**, named for the whale it looks like. The bigger **BelugaXL**, built from an A330, first flew in **2018**.'),
  S('sky-into-the-eye', 'hurricane', 'Into the Eye', '27 July 1943 · near Galveston, Texas', [['FIRST', '1943', ''], ['IN', 'AT-6 trainer', ''], ['NOAA P-3S', '2', ''], ['BASED', 'Lakeland, Florida', '']],
    'In **1943** pilot **Joseph Duckworth** flew a single-engine trainer into a hurricane in the Gulf of Mexico, the first person to do it. Today NOAA’s two **P-3 Orions**, nicknamed **Kermit** and **Miss Piggy**, fly through storms to measure them.'),
  S('sky-lighter-than-air', 'airship', 'Lighter Than Air', '2 July 1900 · the first Zeppelin, Lake Constance', [['FIRST ZEPPELIN', '1900', ''], ['HINDENBURG', '245', 'm long'], ['THEN', 'Hydrogen', ''], ['NOW', 'Helium', '']],
    'An airship floats because it is filled with a gas lighter than air. The great Zeppelins, like the **245 m Hindenburg**, used **hydrogen**, which burns. Today’s airships, like Goodyear’s **Zeppelin NTs**, use **helium**, which doesn’t.'),
  S('sky-vintage', 'vintage', 'Vintage', '17 December 1935 · the DC-3’s first flight', [['FIRST FLEW', '1935', ''], ['BUILT', '16,079', ''], ['PASSENGERS', '21', ''], ['ENGINES', '2', '']],
    'The **DC-3** was one of the first airliners that could make money carrying only passengers, without mail to pay its way. **16,079** were built, counting the wartime versions, and a few still fly today.'),
];
// Into Space Collector's story machinery; called by main.js and cards-page.js in Sky.
export function registerSkyStories() {
  SKY_STORIES.forEach((s, i) => { s.order = 100 + i; if (!NATURAL_BY_KEY.has(s.key)) { NATURAL.push(s); NATURAL_BY_KEY.set(s.key, s); } STORY_BY_SECRET.set(s.secret, s); STORY_SECRETS.add(s.secret); });
}
