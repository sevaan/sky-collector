// The sample pack's driver for Sky Collector (2026-11-18; hand-written in site/pack-src, copied by scripts/build-site-pack.mjs).
// A friend who was told about the game opens a pack of three cards with the game's own pack, cards and sounds (./js,
// copied from the game): a real flight near them (js/pack-flight.js), an Airbus A380 and a Douglas DC-3, then the last
// card: what the game is and that it is coming soon. The only request it makes is for the planes near the city of the
// visitor's time zone (the city's coordinates, never the visitor's); nothing is kept.
// Space Collector's version is its site/public/pack/pack.js; this differs only in the cards and the last card.
import { playPack } from './js/gift-pack.js';
import { renderCard, attachTilt, miniCard } from './js/card.js';
import { cardsFor, retier } from './js/flights.js';
import { skyModel, catchSightings } from './js/sky-cards.js';
import { skyCardPhotoUrl } from './js/flight-card.js';
import { applyBack } from './js/card-backs.js';
import { TIER_INFO } from './js/rarity.js';
import { sfx as appSfx, loadSfx, sfxOnly } from './js/sfx.js';
import { audioCtx } from './js/audio-ctx.js';
import { startMusic } from './js/music.js'; /* the game's own music, from the first touch (2026-11-23, Sevaan; Space Collector e45a77ff) */
import { TIERS } from './js/card-moment.js';
import { lookupRoute } from './js/routes.js';
import { airlineName, loadAirlines } from './js/planes.js';
import { airlinePhoto } from './js/airline-photos.js';
import { airlineLogo } from './js/airline-logos.js';
import { cityForZone, visitorZone, findLiveFlight, nearestCanned, liveTag, seenTag, seenWhen, km } from './js/pack-flight.js';
import { PACK_FLIGHTS } from './js/pack-flights.js';
/* The game's music (2026-11-23, Sevaan; Space Collector e45a77ff): started by the first touch, click or key, once; iPhone only
   lets sound start from a touchend or click. Volume, fade-in and pausing when the page is hidden are js/music.js's own. */
{ let on = false; const go = () => { if (on) return; on = true; try { startMusic(); } catch {} for (const t of ['pointerdown', 'touchend', 'click', 'keydown']) removeEventListener(t, go, true); };
  for (const t of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(t, go, { capture: true, passive: true }); }

const $ = (id) => document.getElementById(id);
const SITE = 'https://skycollector.app/';
const PLANES = ['A388', 'DC3']; // keep in step with scripts/build-site-pack.mjs (it copies their photos)
const tierColor = (t) => (TIER_INFO[t] ?? TIER_INFO.common).color;

// ---- sound (2026-11-18): only the sounds this page can play, fetched and decoded while the sealed pack sways, so the
// first touch only has to start the audio (Sevaan, iPhone: "it freezes the first time I try to open it"; the first
// touch used to start all 31 of the game's sounds). Browsers start audio only from a gesture: the context is made
// suspended here and resumed by the first touch. The tear is the game's own sfx('tear') (it waits for its file and
// for the context, js/sfx.js), so it goes through audioTrack and audioOut like every sound.
const PAGE_SFX = ['tear', 'step', 'swipe', 'arrive', 'lock', 'flip', 'rattle', 'seen', 'stamp', 'r_common', 'r_uncommon', 'r_rare', 'r_epic', 'r_legend'];
sfxOnly(PAGE_SFX);
let touched = false;
setTimeout(() => { try { if (audioCtx()) loadSfx(['tear', 'step', 'swipe']); } catch {} }, 900); /* after the pack has arrived, before anyone can reach it */
function wake() {
  if (touched) return; touched = true;
  try { const ctx = audioCtx(); if (ctx && ctx.state !== 'running') ctx.resume?.().catch(() => {}); } catch {}
  setTimeout(() => { try { loadSfx(['tear']); } catch {} }, 0); /* anything not loaded yet (a touch inside the first second): after this touch, never in it */
}
addEventListener('pointerdown', wake, { capture: true }); addEventListener('keydown', wake, { capture: true });
function sfx(name, o = {}) { if (touched) return appSfx(name, o); }

function lastCard() {
  const host = document.createElement('div'); host.className = 'lc-host';
  const turn = document.createElement('div'); turn.className = 'lc-turn'; host.appendChild(turn);
  turn.appendChild($('lastcard').content.cloneNode(true));
  const back = document.createElement('div'); back.className = 'lc-back'; try { applyBack(back); } catch {} turn.appendChild(back);
  for (const a of host.querySelectorAll('a')) { a.addEventListener('click', (e) => e.stopPropagation()); a.addEventListener('pointerdown', (e) => e.stopPropagation()); } /* a tap on the link never turns or flings the card */
  return host;
}

// ---- the cards: the game's own plane-type cards, in the maker's colours (no airline) ----
const LAST = 'your-turn';
const model = (type) => ({ ...retier(skyModel(cardsFor({ type, callsign: '', reg: '' }, null, '').plane, 'plane')), type });
let models = null;
/* One made-up catch per card, so its numbers read like a card you own (how high, how fast, how far) and not a row of dashes */
const SEEN = { A388: { altFt: 36000, gsKt: 490, rangeKm: 14, track: 250 }, DC3: { altFt: 4500, gsKt: 150, rangeKm: 6, track: 95 } };
const SIGHT = new Map(); /* a flight card's own sighting: its real height, speed and distance */
const seen = (c) => SIGHT.get(c.key) ?? catchSightings({ time: Date.now() - 36e5, hex: `sample-${c.type}`, callsign: '', reg: '', type: c.type, ...SEEN[c.type], lat: 0, lon: 0, plane: c }).filter((x) => x.cardKey === c.key).map((x) => ({ ...x, cls: '', track: SEEN[c.type].track })); /* a sample, not a catch: no 'what kind of flight' band (it read 'No airline flight number' on the A380, 2026-11-19), and a heading for the YOUR CATCH box */

// ---- the flight card (2026-11-18, Sevaan: "users should see one that goes over their area") ----
// The pack opens straight away with a flight Sky's relay saw over the nearest big city (js/pack-flights.js, labelled with
// when). Meanwhile the page asks for what is over the visitor's city now; if a good airliner with a known route answers
// within 2.5 s and the pack is still sealed, the first card becomes that flight, "Over <city> right now".
const city = cityForZone(visitorZone()), T0 = performance.now(), LIVE_MS = 2500;
const hasArt = (a3, type) => !!(airlinePhoto(a3, type) && airlineLogo(a3));
function flightModel(p, route, airline, time) {
  const { flight } = cardsFor(p, route, airline); if (!flight) return null;
  const m = { ...retier(skyModel(flight, 'flight')), type: p.type };
  SIGHT.set(m.key, catchSightings({ time, hex: `sample-${p.callsign}`, callsign: p.callsign, reg: '', type: p.type, altFt: p.altFt, gsKt: p.gs, rangeKm: Math.round(km(city.lat, city.lon, p.lat, p.lon)), lat: p.lat, lon: p.lon, flight, plane: { key: 'P:' + p.type } }).filter((x) => x.cardKey === m.key));
  return m;
}
function cannedFlight() {
  const near = [...PACK_FLIGHTS].sort((a, b) => km(city.lat, city.lon, a.lat, a.lon) - km(city.lat, city.lon, b.lat, b.lon));
  for (const c of near) { const m = flightModel(c.plane, c.route, c.airline, c.seen); if (m) return { card: m, tag: seenTag(c.hub, seenWhen(c.seen)) }; }
  return null;
}
const live = (async () => {
  try { await loadAirlines(); } catch {}
  const f = await findLiveFlight(city, { lookupRoute, airlineName, hasArt, timeoutMs: LIVE_MS });
  if (!f || performance.now() - T0 > LIVE_MS + 1500) return null;
  const m = flightModel(f.plane, f.route, f.airline, Date.now()); return m ? { card: m, tag: liveTag(city.name) } : null;
})().catch(() => null);
/* Put the live flight into the sealed pack in place of the stand-in: only while the pack is still sealed, pictures decoded first */
let sealedDone = false;
async function swapIn(first, f) {
  if (sealedDone) return;
  const dc = [...document.querySelectorAll('#gift .gp-dc')].find((d) => d._h === first); if (!dc) return;
  const el = render(f.card, {});
  await Promise.race([Promise.all([...el.querySelectorAll('img')].map((im) => im.decode?.().catch(() => {}))), new Promise((ok) => setTimeout(ok, 1200))]);
  if (sealedDone || !dc.isConnected) return;
  dc._card.replaceWith(el); dc._card = el;
  first.card = f.card; first.tags = [['new', f.tag]];
  dc.style.setProperty('--t', tierColor(f.card.tier) ?? '#fff'); dc._rare = TIERS.indexOf(f.card.tier) >= 2;
}
/* "Sample pack" where the card would say it isn't collected yet (as Space Collector's sample pack does) */
function sample(el) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) if (/not (yet )?(collected|caught)( yet)?/i.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/not (yet )?(collected|caught)( yet)?/i, (s) => (s === s.toUpperCase() ? 'SAMPLE PACK' : 'Sample pack'));
  /* no sample card claims a catch, a level or progress (2026-11-18): the passport row ("Caught on 1 day · Bronze · 4 more
     to silver") goes, and the frame keeps no level colour */
  el.querySelectorAll('.fc-pass').forEach((x) => x.remove());
  for (const c of [...el.classList]) if (/^level-(bronze|silver|gold)$/.test(c)) { el.classList.remove(c); el.classList.add('level-none'); }
  const t = el.querySelector('.fc-foot-t'), tm = el.querySelector('.fc-foot-n'); if (t) t.textContent = 'SAMPLE PACK'; if (tm) tm.textContent = ''; /* the footer's "CAUGHT · date · time" */
  return el;
}
function render(c, opts) {
  if (c.key === LAST) return lastCard();
  return sample(renderCard(c, { ...opts, preview: true, sightings: seen(c) }));
}

async function play() {
  $('start').hidden = true; $('end').hidden = true; document.body.classList.add('playing');
  const [a380, dc3] = models; sealedDone = false;
  const stand = cannedFlight();
  const first = stand ? { card: stand.card, sightings: [], tags: [['new', stand.tag]] } : null;
  const swapped = live.then((f) => (f && first ? swapIn(first, f) : null)).catch(() => null);
  const last = { key: LAST, id: LAST, tier: 'common', name: 'Collect the sky above you' }; /* not a 'rare' card: it turns over by itself, no 'something legendary' tease (as Space Collector's) */
  await playPack({
    count: 3, newCount: 0, kicker: 'A sample pack', title: 'Cards from the sky', dates: 'Real planes that fly over your backyard',
    label: 'A sample pack', dateLabel: 'Sky Collector', footLeft: 'Free · no ads',
    subHtml: 'A real flight, an Airbus A380 and a Douglas DC-3',
    goLabel: 'See Sky Collector', laterLabel: 'Done',
    highlights: [
      ...(first ? [first] : []),
      { card: a380, sightings: [], tags: [['new', 'The biggest airliner']] },
      { card: dc3, sightings: [], tags: [['new', 'Flying since 1935']] },
    ],
    tiles: [{ card: a380, isNew: false }, { card: dc3, isNew: false }],
    tail: { card: last, label: 'Your turn', tags: [], stays: true, onLand: claimLast, button: { label: 'Visit SkyCollector.app ›', fn: () => { location.href = SITE; return null; } } }, /* something to do under the last card (2026-11-18, Sevaan): the game's page */
    onOpen: async () => { /* a live flight that's nearly here gets what's left of its 2.5 s, at most 0.7 s after the tear; then the cards are what they are */
      await Promise.race([swapped, new Promise((ok) => setTimeout(ok, Math.min(700, Math.max(0, LIVE_MS - (performance.now() - T0)))))]); sealedDone = true; return true; },
    renderCard: render, attachTilt, artImage: (c) => skyCardPhotoUrl(c, c.type) ?? '', mini: (c) => sample(miniCard(c, { status: 'Sample pack', preview: true, sightings: seen(c) })), applyBack, sfx, feel: () => {}, tierColor,
  });
  showEnd();
}
function showEnd() {
  document.body.classList.remove('playing');
  $('start').hidden = true; $('end').hidden = false;
  const h = $('end-card'); h.replaceChildren(lastCard().querySelector('.lc'));
  if (!h._tilt) h._tilt = attachTilt(h, { scroll: true }); /* the same lean, light and foil as in the pack; a finger can still scroll the page */
  scrollTo(0, 0);
}
/* The last card stays (Space Collector's sample pack, 2026-11-18, Sevaan): no swiping it away, no Skip or ✕; it tilts, and a
   double tap flips it to the card back and again, like the game's cards. The pack never goes on to its summary. */
function flipLast(host) {
  const turn = host.querySelector('.lc-turn'); if (!turn || host._busy) return; host._busy = true; sfx('flip', { gain: 0.8 });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, half = reduced ? 1 : 230;
  turn.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], { duration: half, easing: 'ease-in' }).onfinish = () => {
    host.classList.toggle('flipped');
    turn.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0deg)' }], { duration: half, easing: 'ease-out' }).onfinish = () => { host._busy = false; };
  };
}
function claimLast(dc) { /* the pack hands the last card over as it lands (tail.stays; Space Collector 5585f2e5): it never arms its own tap or flick on it */
  const host = dc.querySelector('.lc-host'); if (!host) return;
  dc.classList.add('lc-dealt'); $('gift')?.classList.add('gp-final');
  let last = 0; dc.onpointerdown = dc.onpointerup = null;
  dc._tap = () => { const t = performance.now(); if (t - last < 380) { last = 0; flipLast(host); } else last = t; };
  host.addEventListener('dblclick', (e) => e.preventDefault());
}
/* The summary's first button, "See Sky Collector", goes to the game's page */
new MutationObserver(() => {
  const root = $('gift'); const go = root?.querySelector('.gp-btns .go'); if (!go || go.dataset.wired) return; go.dataset.wired = '1';
  const a = document.createElement('a'); a.className = go.className; a.dataset.wired = '1'; /* or this observer sees the new link as an unwired button and replaces it again, for ever (the page froze at the summary) */ a.href = SITE; a.rel = 'noopener'; a.textContent = go.textContent; a.style.display = 'flex'; a.style.alignItems = 'center'; a.style.justifyContent = 'center'; a.style.textDecoration = 'none'; go.replaceWith(a);
}).observe(document.body, { childList: true, subtree: true });

$('open').addEventListener('click', () => { if (models) play(); });
$('again').addEventListener('click', () => { if (models && !$('gift')) play(); });
(async () => {
  try { models = PLANES.map(model); if (models.some((m) => !m?.name)) throw new Error('cards'); } catch { $('open').textContent = 'Couldn’t load the pack'; $('open').disabled = true; $('start').hidden = false; return; }
  window.__packReady = true; /* index.html's 3 s fallback: a tap on Open the pack reloads only if this never happened (Space's) */
  play(); /* straight into the sealed pack; the start screen (hidden in the HTML) shows only if something fails or stalls */
})();

