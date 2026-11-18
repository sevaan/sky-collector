// The sample pack's driver for Sky Collector (2026-11-18; hand-written in site/pack-src, copied by scripts/build-site-pack.mjs).
// A friend who was told about the game opens a pack of three plane cards (an Airbus A380, an Airbus H135 helicopter and a
// Douglas DC-3) with the game's own pack, cards and sounds (./js, copied from the game), then the last card: what the game
// is and that it is coming soon. Nothing is sent anywhere and nothing is kept: the same pack for everyone.
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

const $ = (id) => document.getElementById(id);
const SITE = 'https://skycollector.app/';
const PLANES = ['A388', 'EC35', 'DC3']; // keep in step with scripts/build-site-pack.mjs (it copies their photos)
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
const SEEN = { A388: { altFt: 36000, gsKt: 490, rangeKm: 14 }, EC35: { altFt: 1400, gsKt: 115, rangeKm: 3 }, DC3: { altFt: 4500, gsKt: 150, rangeKm: 6 } };
const seen = (c) => catchSightings({ time: Date.now() - 36e5, hex: `sample-${c.type}`, callsign: '', reg: '', type: c.type, ...SEEN[c.type], lat: 0, lon: 0, plane: c }).filter((x) => x.cardKey === c.key);
/* "Sample pack" where the card would say it isn't collected yet (as Space Collector's sample pack does) */
function sample(el) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) if (/not (yet )?(collected|caught)( yet)?/i.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/not (yet )?(collected|caught)( yet)?/i, (s) => (s === s.toUpperCase() ? 'SAMPLE PACK' : 'Sample pack'));
  const t = el.querySelector('.fc-foot-t'), tm = el.querySelector('.fc-foot-n'); if (t) t.textContent = 'SAMPLE PACK'; if (tm) tm.textContent = ''; /* the footer's "CAUGHT · date · time" */
  return el;
}
function render(c, opts) {
  if (c.key === LAST) return lastCard();
  return sample(renderCard(c, { ...opts, preview: true, sightings: seen(c) }));
}

async function play() {
  $('start').hidden = true; $('end').hidden = true; document.body.classList.add('playing');
  const [a380, heli, dc3] = models;
  const last = { key: LAST, id: LAST, tier: 'common', name: 'Collect the sky above you' }; /* not a 'rare' card: it turns over by itself, no 'something legendary' tease (as Space Collector's) */
  await playPack({
    count: 3, newCount: 0, kicker: 'A sample pack', title: 'Cards from the sky', dates: 'Real planes that fly over your backyard',
    label: 'A sample pack', dateLabel: 'Sky Collector', footLeft: 'Free · no ads',
    subHtml: 'An Airbus A380, a helicopter and a Douglas DC-3',
    goLabel: 'See Sky Collector', laterLabel: 'Done',
    highlights: [
      { card: a380, sightings: [], tags: [['new', 'The biggest airliner']] },
      { card: heli, sightings: [], tags: [['new', 'Helicopters count too']] },
      { card: dc3, sightings: [], tags: [['new', 'Flying since 1935']] },
    ],
    tiles: [{ card: heli, isNew: false }, { card: a380, isNew: false }, { card: dc3, isNew: false }],
    tail: { card: last, label: 'Your turn', tags: [], button: { label: 'Visit SkyCollector.app', fn: () => { location.href = SITE; return null; } } }, /* something to do under the last card (2026-11-18, Sevaan): the game's page */
    onOpen: () => true,
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
function holdLast() {
  const root = $('gift'); if (!root) return;
  if (root.querySelector('.gp-count2 b')?.textContent !== 'Your turn') return; /* every card is built up front: wait until the last one is dealt */
  const host = root.querySelector('.gp-dc .lc-host'), dc = host?.closest('.gp-dc'); if (!dc) return;
  if (dc.classList.contains('lc-dealt')) return; dc.classList.add('lc-dealt'); root.classList.add('gp-final');
  const keep = () => { /* the pack sets its own tap and flick on the card once it has landed: replace them */
    if (!dc.classList.contains('settled')) { setTimeout(keep, 120); return; }
    setTimeout(() => {
      let last = 0; dc.onpointerdown = dc.onpointerup = null;
      dc._tap = () => { const t = performance.now(); if (t - last < 380) { last = 0; flipLast(host); } else last = t; };
      host.addEventListener('dblclick', (e) => e.preventDefault());
    }, 260);
  };
  keep();
}
new MutationObserver(() => holdLast()).observe(document.body, { childList: true, subtree: true, characterData: true });
/* The summary's first button, "See Sky Collector", goes to the game's page */
new MutationObserver(() => {
  const root = $('gift'); const go = root?.querySelector('.gp-btns .go'); if (!go || go.dataset.wired) return; go.dataset.wired = '1';
  const a = document.createElement('a'); a.className = go.className; a.dataset.wired = '1'; /* or this observer sees the new link as an unwired button and replaces it again, for ever (the page froze at the summary) */ a.href = SITE; a.rel = 'noopener'; a.textContent = go.textContent; a.style.display = 'flex'; a.style.alignItems = 'center'; a.style.justifyContent = 'center'; a.style.textDecoration = 'none'; go.replaceWith(a);
}).observe(document.body, { childList: true, subtree: true });

$('open').addEventListener('click', () => { if (models) play(); });
$('again').addEventListener('click', () => { if (models && !$('gift')) play(); });
(async () => {
  try { models = PLANES.map(model); if (models.some((m) => !m?.name)) throw new Error('cards'); } catch { $('open').textContent = 'Couldn’t load the pack'; $('open').disabled = true; $('start').hidden = false; return; }
  play(); /* straight into the sealed pack; the start screen (hidden in the HTML) shows only if something fails or stalls */
})();
