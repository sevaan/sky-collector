// The capture moment. Chosen from design/reveal-demo.html (2026-09-29):
//  First sighting: the ring snaps shut, the object rushes at you, a flash and thump, a sealed card
//  lands glowing in its rarity colour, you tap it, it flips, light sweeps it, a ticket toast says what you earned.
//  Seen before: the card flies straight in face-up and the ticket shows the count (and any level up).
//  Everything scales with rarity (Legendary dims the sky, shockwave, held breath, slow flip, fanfare).
// Waits use timers, not animation.finished, so a paused tab can never freeze the sequence.

import { sfx, loadSfx } from './sfx.js?v=0.1.1867';
import { audioCtx } from './audio-ctx.js?v=0.1.1867';
import { TIER_INFO } from './rarity.js?v=0.1.1867';
import { levelFor, attachTilt, attachGyro, attachFlip, throwOff, retype, turnCard } from './card.js?v=0.1.1867';
import { applyBack } from './card-backs.js?v=0.1.1867';
import { addStarfield } from './starfield.js?v=0.1.1867';
import { TIER_FX, flipCard, heartbeats, payoffSound } from './card-moment.js?v=0.1.1867';
import { packPlan, packFoil, packIntro, packSeen, primePack } from './pack-reveal.js?v=0.1.1867'; /* the two-card pack opening (prototype, 2026-11-20) */
import { tearJag } from './gift-pack.js?v=0.1.1867';

const FX = TIER_FX; /* one rarity table for every card moment (js/card-moment.js, 2026-11-11) */
const NIGHT_MILESTONES = [3, 5, 10, 25, 50, 100, 200, 365], STAMP_MILESTONES = [5, 10, 25, 50, 100, 200, 300, 400];
const LEVEL_NAME = { bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD' };
const LEVEL_COLOR = { bronze: '#c98a4b', silver: '#dfe6ee', gold: '#f2c94c' };

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
addStarfield($('reveal')); // twinkling stars behind the reveal (css/reveal.css)
function play(el, frames, opts) { el.animate(frames, opts); return sleep((opts.duration ?? 0) * (opts.iterations ?? 1)); }
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- sound (iPhones can’t vibrate from the web, so sound carries the "thump") ----------
// Call from inside the tap handler, before any await, so iOS lets the sound play. The sounds themselves are the
// designed set (js/sfx.js, 2026-10-11); the old oscillator tones are gone.
export function primeReveal() { audioCtx(); loadSfx(); }

// ---------- particles ----------
let parts = [], loopOn = false;
function fxLoop() {
  const cv = $('rv-fx'), ctx = cv.getContext('2d');
  const d = devicePixelRatio || 1;
  if (cv.width !== innerWidth * d) { cv.width = innerWidth * d; cv.height = innerHeight * d; }
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += .12; p.vx *= .985; p.life -= .012;
    ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
    if (p.star) {
      const s = p.size * 2.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.quadraticCurveTo(p.x, p.y, p.x + s, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + s);
      ctx.quadraticCurveTo(p.x, p.y, p.x - s, p.y); ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(fxLoop); else loopOn = false;
}
function burst(x, y, n, color) {
  if (reduced()) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 7;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, size: 1.5 + Math.random() * 3, color, star: Math.random() < .35 });
  }
  if (!loopOn) { loopOn = true; requestAnimationFrame(fxLoop); }
}

// ---------- the sequence ----------
let run = 0, tilt = null, stopGyro = null, onFlipTap = null;
let backTilt = null, backGyro = null; // the sealed card tilts too, until it flips
let packRun = null; // a two-card pack opening under way (js/pack-reveal.js)
function stopBack() { backGyro?.(); backTilt?.destroy(); backGyro = backTilt = null; }
function showFace(which) {
  $('rv-back').style.visibility = which === 'back' ? 'visible' : 'hidden';
  $('reveal-card').style.visibility = which === 'front' ? 'visible' : 'hidden';
}
export function stopReveal() {
  run++;
  flick = null; holderTo(0, 0, 0); $('rv-holder').style.opacity = '';
  stopGyro?.(); tilt?.destroy(); stopGyro = tilt = null;
  for (const it of deck?.items ?? []) { it.tilt?.destroy(); it.flip?.destroy(); it.tilt = it.flip = null; }
  if (deck) deck.ready = false;
  stopBack();
  parts = [];
  if (onFlipTap) { $('rv-holder').removeEventListener('click', onFlipTap); onFlipTap = null; }
  packRun?.stop(); packRun = null; $('reveal').querySelectorAll('.pk-under, .pk').forEach((e) => e.remove());
}

// A page left zoomed in (a pinch, or iOS's double-tap zoom) makes every overlay bigger than the screen, with the
// reveal's top row and the card off the top (Duo playtest 2026-10-22). Opening a card snaps the zoom back: briefly
// capping the viewport's scale makes WebKit return to 1.
function unzoom() {
  if (!(window.visualViewport?.scale > 1.01)) return;
  const m = document.querySelector('meta[name="viewport"]'); if (!m) return;
  const was = m.content; m.content = `${was}, maximum-scale=1`; setTimeout(() => { m.content = was; }, 400);
}
// Fold, unfold or rotate with a card up: size it again for the new window (big-screen playtest 2026-10-22: it kept the
// old size, a small card in the middle of an iPad).
let sizedCard = null;
const LP_PEEK = 2.25; // em of the pass that shows above the plane card (css/sky-cards.css --lp-peek)
addEventListener('resize', () => { if (sizedCard && !$('reveal').hidden) requestAnimationFrame(() => sizeCard(sizedCard)); });
function sizeCard(cardEl) {
  sizedCard = cardEl;
  unzoom();
  const root = $('reveal');
  root.style.setProperty('--cf', '12px');
  const cards = [...$('reveal-card').querySelectorAll(':scope > .dk-slot > .card')], peek = root.classList.contains('two') ? DECK_PEEK + 2 : 0;
  /* the tallest card in the deck, measured untransformed (the one behind is scaled down, a sealed one turned over) */
  const em = Math.max(39.2, ...(cards.length ? cards : [cardEl]).map((c) => (c.offsetHeight || c.getBoundingClientRect().height) / 12));
  // Room for the header and chips above, the rank bar and link below (2026-10-12: the card sat high over dead space).
  let cf = Math.max(7, Math.min(Math.min(innerWidth, innerHeight) >= 600 ? 18 : 14, (innerWidth - 58) / 28, (innerHeight - 270) / em)); /* big screens (iPad, unfolded Duo) may go to 18, like the docked card (iPad/Duo playtest 2026-10-24: 100pt empty bands) */ // 270: both zones plus the notch and home bar
  root.style.removeProperty('--rv-y');
  root.style.setProperty('--cf', `${cf}px`);
  root.style.setProperty('--ch', em);
  // Then check it really sits between the top row and the rank bar (or View in collection) as laid out, and if not
  // shrink it and centre it in the room there is (iPhone Duo playtest 2026-10-22: on the unfolded Duo the card ran off
  // the top of the screen with the ✕; the rows around it grow with Larger Text). Phones that fit are left as they were.
  const h = $('rv-holder'), H = root.clientHeight;
  if (!H || !h.offsetHeight) return;
  const news = $('rv-news'), top = Math.max($('rv-top').offsetTop + $('rv-top').offsetHeight, news ? news.offsetTop + 26 : 0) + 8; /* clear the chips row too */
  const teach = root.classList.contains('teaching') ? $('rv-teach') : null; /* the lesson panel under the card (2026-10-25) */
  const under = teach ?? (root.classList.contains('has-rank') ? $('rv-rank') : $('reveal-view')), bot = (under.offsetHeight ? under.offsetTop : H) - 8;
  // Grow (or shrink) it to the room there really is: the 270 above is a guess, and on phones it left the card small with
  // dead space above and below (Sevaan 2026-10-22: "has room to be bigger"). 20px a side, 14 at most (big screens).
  /* two cards (a flight and its plane): the card behind peeks out above the front one, so the peek's room comes off the
     height, which only shrinks a card that was height-limited; a width-limited card keeps today's size (Sevaan 2026-11-19:
     keep the card form, size and shape) */
  cf = Math.max(5, Math.min(Math.min(innerWidth, innerHeight) >= 600 ? 18 : 14, 0.95 * (bot - top - peek) / em, 0.95 * (root.clientWidth - 40) / 28)); /* 5% smaller for air above and below (Sevaan 2026-10-25: "just a tiny bit") */ /* same cap as the first pass (iPad playtest 2026-10-24: this clamped it back to 14) */
  root.style.setProperty('--cf', `${cf}px`);
  /* Always centred in the room there really is, between the chips row and the rank bar (2026-11-19, Space Collector
     305780c2, Sevaan on a Galaxy Z Flip, 360x880: the CSS centre measured from the NEW CARD row, so on tall screens the
     card sat ~40px high of the gap; Sky measured the same, 40-41px at 360-412 wide). */
  let mid = (top + bot) / 2; const half = em * cf / 2;
  if (peek && mid - half - peek < top) mid = Math.min(mid + (top - (mid - half - peek)), bot - half); /* the peek clears the chips row */
  /* The landscape pass (css/sky-cards.css .dk-pass): behind the card its end shows above it, LP_PEEK em (just the airline and
     the date, 2026-11-21, Sevaan), so that comes off the
     room like the peek; in front it grows to fill the room between the chips and the rank bar, tilted 7.5deg (--lpk). */
  const passBack = !!$('reveal-card').querySelector(':scope > .dk-back.dk-pass'), passAny = !!$('reveal-card').querySelector(':scope > .dk-pass');
  if (passBack) { cf = Math.min(cf, 0.95 * (bot - top) / (em + LP_PEEK)); root.style.setProperty('--cf', `${cf}px`); mid = (top + bot) / 2; const hh = em * cf / 2, pk = LP_PEEK * cf; if (mid - hh - pk < top) mid = Math.min(mid + (top - (mid - hh - pk)), bot - hh); }
  if (passAny) { const th = 7.5 * Math.PI / 180, w = 16 * cf, hgt = 42 * cf, bw = w * Math.cos(th) + hgt * Math.sin(th), bh = w * Math.sin(th) + hgt * Math.cos(th);
    const k = Math.min(0.97 * (bot - top) / bh, (root.clientWidth - 24) / bw); root.style.setProperty('--lpk', Math.max(1, k).toFixed(3));
    /* the pass in front is centred on the holder; keep its tilted box inside the room */
    root.style.setProperty('--lp-dy', `${((top + bot) / 2 - mid).toFixed(1)}px`); }
  root.style.setProperty('--rv-y', `${(mid - H / 2).toFixed(1)}px`);
}

// A lesson panel under the card (2026-10-25, Sevaan; design/first-night.html 04): the card shrinks to make room above
// it, eased over a third of a second (instant under Reduce Motion), and grows back when it goes.
export function teachRoom(on) {
  const root = $('reveal'); if (!sizedCard || root.hidden) return;
  const read = (k, d) => { const v = parseFloat(getComputedStyle(root).getPropertyValue(k)); return Number.isFinite(v) ? v : d; };
  const from = read('--cf', 12), fromY = read('--rv-y', 22);
  root.classList.toggle('teaching', on); sizeCard(sizedCard);
  const to = read('--cf', from), toY = read('--rv-y', 22);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || (Math.abs(to - from) < 0.05 && Math.abs(toY - fromY) < 0.5)) return;
  const t0 = performance.now(), ms = 320;
  const step = (t) => { const u = Math.min(1, (t - t0) / ms), e = 1 - (1 - u) ** 3;
    root.style.setProperty('--cf', `${(from + (to - from) * e).toFixed(3)}px`); root.style.setProperty('--rv-y', `${(fromY + (toY - fromY) * e).toFixed(2)}px`);
    if (u < 1) requestAnimationFrame(step); };
  root.style.setProperty('--cf', `${from}px`); root.style.setProperty('--rv-y', `${fromY}px`); requestAnimationFrame(step);
}

// card: rendered card element. o: catalogue card (for tier). seen: sightings of this card incl. this one.
// origin: {x, y} screen point the object was at (the reticle centre).
// fleet (fleet cards only): { newStamp, stamps, total, cospar, level, before }. A launch seen for the
// first time lands a NEW STAMP on the card, and the card’s level counts stamps, not sightings.
// collected: how many different cards you own now, counting this one. A new card only gets a stamp when
// that number is a milestone (MILESTONES); repeat sightings keep their SEEN / NEW STAMP / level stamps.
export const MILESTONES = [1, 10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
// What the stamp used to say now goes out as a ticket toast (2026-10-05): main.js registers the renderer.
let announce = null;
export function onRevealNews(fn) { announce = fn; }
// The rush starts on the tap (2026-11-11, Sevaan: "the moment you tap Collect"): the dot swells and flies at you while the
// catch is saved and its XP and rank are worked out; playReveal then picks up where the rush is, instead of the tap waiting
// ~50–90 ms on a phone for that work before anything moved.
let rush = null;
export function rushReveal({ origin, tier }) {
  const tk = FX[tier] ? tier : 'common', fx = FX[tk], root = $('reveal');
  root.style.setProperty('--fx', (TIER_INFO[tk] ?? TIER_INFO.common).color); root.classList.remove('rv-done');
  $('reveal-eyebrow').textContent = ''; $('rv-news').replaceChildren(); setRank(null); setDeck([]); $('rv-holder').style.opacity = 0;
  for (const id of ['rv-dot', 'rv-dim']) $(id).getAnimations().forEach((a) => a.cancel());
  $('rv-dim').style.opacity = 0;
  const x = origin?.x ?? innerWidth / 2, y = origin?.y ?? innerHeight * .4, ms = reduced() ? 1 : 400;
  $('rv-dot').style.left = `${x}px`; $('rv-dot').style.top = `${y}px`;
  sfx('arrive');
  if (fx.dim) $('rv-dim').animate([{ opacity: 0 }, { opacity: fx.dim }], { duration: 260, fill: 'forwards' });
  $('rv-dot').animate([
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, easing: 'cubic-bezier(.2,.9,.3,1)' },
    { transform: 'translate(-50%,-50%) scale(1.7)', opacity: 1, offset: .35, easing: 'cubic-bezier(.5,0,.8,.4)' },
    { transform: 'translate(-50%,-50%) scale(5)', opacity: 0 },
  ], { duration: ms, fill: 'forwards' });
  rush = { t0: performance.now(), x, y, ms };
}
export function cancelRush() { rush = null; for (const id of ['rv-dot', 'rv-dim']) $(id).getAnimations().forEach((a) => a.cancel()); $('rv-dim').style.opacity = 0; }
// cards (Sky Collector, 2026-11-19, Sevaan approved design/card-spike/team-d-reveal.html): one catch can give two cards,
// a flight card and a plane card, each { card, o, seen, fleet, progress, shiny, livery }. Both show, as a two-card deck:
// the front one plays the reveal, the other peeks out above it; swipe sideways (or tap it, or its tab) to swap. Without
// cards, the single card in card/o/seen/fleet/progress/shiny plays as it always has.
// pack (Testing tools, js/pack-reveal.js): 'A' | 'B' | 'C' opens a two-card catch from a pack; '' (the default) as today.
// packShort: true/false forces the short or full cut (the spike page); otherwise it follows how many packs were opened.
export async function playReveal({ card, o, seen, origin, fleet = null, progress = null, collected = 0, con = null, shiny = null, xp = 0, rank = null, earned = [], cards = null, pack = '', packShort = null }) {
  const rushed = rush && performance.now() - rush.t0 < 3000 ? rush : null; rush = null; /* already rushing since the tap */
  stopReveal();
  const my = run;
  const items = orderDeck((cards?.length ? cards : [{ card, o, seen, fleet, progress, shiny }]).map(cardNews)), lead = items[0];
  const plan = items.length > 1 ? packPlan(pack, packShort == null ? packSeen() : packShort ? 99 : 0) : null; /* only a catch that gives two cards */
  ({ card, o, seen, fleet, progress, shiny } = lead);
  const { fresh, tierKey, level, levelUp, nights, newStamp } = lead; // progress (other cards): { level, before, nights }. Levels count observing nights.
  const fx = FX[tierKey], color = (TIER_INFO[tierKey] ?? TIER_INFO.common).color;
  const root = $('reveal');
  root.style.setProperty('--fx', color);
  root.classList.remove('rv-done');
  /* a plane or flight card (Sky Collector, playtest 2026-11-18: a repeat plane read "NEW PHASE STAMP"): a stamp is another aircraft of the type, or the flight on another day */
  $('reveal-eyebrow').textContent = fresh && items.length > 1 && items.every((it) => it.fresh) ? '2 NEW CARDS' : fresh ? 'NEW CARD' : newStamp ? (o.sky === 'plane' ? 'NEW AIRCRAFT STAMP' : o.sky === 'flight' ? 'NEW FLIGHT STAMP' : fleet?.line ? 'NEW PHASE STAMP' : 'NEW LAUNCH STAMP') : NIGHT_MILESTONES.includes(nights) ? `SEEN ON ${nights} ${o.sky ? 'DAYS' : 'NIGHTS'}` : 'SEEN AGAIN';
  /* what a screen reader says as the reveal opens: the news, the card and its rarity (accessibility pass 2026-11-09) */
  { const nm = card?.querySelector?.('.card__name')?.textContent?.trim() || o?.name || ''; const rv = $('reveal'); rv.removeAttribute('aria-labelledby'); rv.setAttribute('aria-label', `${$('reveal-eyebrow').textContent.trim().toLowerCase().replace(/^./, (c) => c.toUpperCase())}${nm ? `: ${nm}` : ''}, ${(TIER_INFO[tierKey] ?? TIER_INFO.common).label}${xp > 0 ? `, plus ${xp} XP` : ''}`); }
  if (xp > 0) $('reveal-eyebrow').insertAdjacentHTML('beforeend', `<span class="rv-xp"><span class="rv-roll"><span><i class="rv-dot">·</i>+${xp} XP</span></span></span>`); // rolls in when the card lands
  setRank(xp > 0 ? rank : null);
  $('rv-news').replaceChildren(); earnedNow = earned;
  setDeck(items);
  if ((items[1]?.fresh || plan) && !isPass(items[1])) seal(items[1]); /* a new card behind waits face down, glowing in its rarity (out of a pack, any card); a boarding pass is paper, not a card, so it's always face up (2026-11-21, Sevaan) */
  $('reveal-card').classList.toggle('dk-wait', (fresh || plan) && items.length > 1); /* and shows once the front one has turned over */
  for (const id of ['rv-holder', 'rv-flipper', ...(rushed ? [] : ['rv-dot', 'rv-dim']), 'rv-flash', 'rv-shock']) $(id).getAnimations().forEach((a) => a.cancel());
  $('rv-holder').style.opacity = 0; $('rv-holder').classList.remove('live');
  $('rv-flipper').style.transform = '';
  $('rv-back').classList.remove('glow');
  if (!rushed) $('rv-dim').style.opacity = 0;
  // Safari doesn’t reliably hide the reverse face of a 3D card, so show one face at a time ourselves.
  { const rb = $('rv-back'); rb.className = rb.className.replace(/\btier-\w+|\bshiny\b|\bgold-foil\b/g, '').replace(/\s+/g, ' ').trim(); rb.classList.add(`tier-${tierKey}`); if (shiny) rb.classList.add('shiny'); if (card.classList.contains('gold-foil')) rb.classList.add('gold-foil'); }
  if (fresh || plan) applyBack($('rv-back'), o);
  showFace(fresh || plan ? 'back' : 'front');
  sizeCard(card);
  /* Out of a pack: the card behind rises under the top one as a copy of its sealed slot, and both cards' pictures and the
     pack's art are decoded before the pack shows (at most 150 ms, so a slow picture never holds up the catch). Tilt stays
     off for the whole sequence (data-swiping, js/card.js). */
  let under = null, decoded = null;
  if (plan) {
    deck.pack = true; primePack();
    under = document.createElement('div'); under.className = 'pk-under'; under.setAttribute('aria-hidden', 'true');
    /* only its back, not the whole card: a full card copy (face, photo) under a scaling rise cost ~170 frames over 20 ms in
       ten catches at 4x CPU in Chromium (its raster went from 163 to 644 ms a catch) */
    { const sl = slots()[1], w = document.createElement('div'), pass = isPass(items[1]), bk = pass ? Object.assign(document.createElement('div'), { className: 'pk-pass' }) : sl.querySelector('.card__back')?.cloneNode(true); w.className = pass ? 'dk-slot dk-pass' : 'dk-slot sealed'; w.style.cssText = sl.style.cssText;
      if (bk) { bk.removeAttribute('id'); bk.style.transform = 'none'; w.append(bk); } under.append(w); } $('rv-holder').before(under); /* a boarding pass rises as a plain paper stand-in: a full copy (photo, grain, cut-outs) under the scaling rise was what a whole card copy cost before */
    for (const it of items) it.card.dataset.swiping = '1';
    const srcs = new Set();
    for (const el of [$('rv-back'), under, ...items.map((it) => it.card)]) for (const e of [el, ...el.querySelectorAll('img, [style*="url("]')]) {
      if (e.tagName === 'IMG' && (e.currentSrc || e.src)) srcs.add(e.currentSrc || e.src);
      const m = /url\(["']?([^"')]+)/.exec(e.style?.backgroundImage || ''); if (m) srcs.add(m[1]); }
    /* built and drawn under the rush, in a task of its own: inside the catch's own long task it made that frame ~110 ms
       longer at 4x CPU (Chromium, 2026-11-20) */
    const built = new Promise((res) => setTimeout(() => { if (alive()) { const foil = packFoil(items); packRun = packIntro({ root, holder: $('rv-holder'), under, plan, tier: foil.tier, shiny: foil.shiny, jag: tearJag(), sfx, flash: $('rv-flash'), reduced: reduced() }); } res(); }, 0));
    decoded = Promise.race([Promise.all([...[...srcs].map((src) => { const im = new Image(); im.src = src; return im.decode().catch(() => {}); }), primePack()]), sleep(150)]).then(() => built);
  }
  const x = rushed?.x ?? origin?.x ?? innerWidth / 2, y = rushed?.y ?? origin?.y ?? innerHeight * .4;
  if (!rushed) { $('rv-dot').style.left = `${x}px`; $('rv-dot').style.top = `${y}px`; }
  $('rv-shock').style.left = `${x}px`; $('rv-shock').style.top = `${y}px`;
  const alive = () => my === run;

  // 1. Pulled from orbit: the object swells and rushes at you. Flash, sparks. (Started on the tap when rushed: wait out the rest.)
  if (rushed) await sleep(Math.max(0, rushed.t0 + rushed.ms - performance.now()));
  else {
  sfx('arrive');
  if (fx.dim) $('rv-dim').animate([{ opacity: 0 }, { opacity: fx.dim }], { duration: 260, fill: 'forwards' });
  await play($('rv-dot'), [
    // It answers the tap at once (UX room 2026-10-12: 500 ms of nearly nothing): a pop out, then the rush into the flash.
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, easing: 'cubic-bezier(.2,.9,.3,1)' },
    { transform: 'translate(-50%,-50%) scale(1.7)', opacity: 1, offset: .35, easing: 'cubic-bezier(.5,0,.8,.4)' },
    { transform: 'translate(-50%,-50%) scale(5)', opacity: 0 }, // a quick pop into the flash, not a 40× blur (2026-10-08)
  ], { duration: reduced() ? 1 : 400, fill: 'forwards' });
  }
  if (!alive()) return;
  $('rv-flash').style.setProperty('--fx-x', `${x}px`); $('rv-flash').style.setProperty('--fx-y', `${y}px`);
  $('rv-flash').animate([{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' }); // short and bright, from where you caught it
  burst(x, y + 20, Math.round(fx.particles / 2), color);
  // A crisp ring that grows (size, not scale, so its line stays thin and sharp: 2026-10-08, the scaled one smeared into a muddy disc).
  if (fx.shock && !reduced()) $('rv-shock').animate([{ width: '20px', height: '20px', opacity: 1, borderWidth: '3px' }, { width: '140vmax', height: '140vmax', opacity: 0, borderWidth: '1.5px' }], { duration: 760, easing: 'cubic-bezier(.15,.7,.3,1)' });

  // Two cards out of a pack (prototype): it pops in, tears, the pair rises and settles, the top one turns over (js/pack-reveal.js).
  if (plan) {
    await decoded; if (!alive()) return;
    packSeen(1);
    if (reduced()) { $('rv-flipper').style.transform = 'perspective(1600px) rotateY(180deg)'; showFace('front'); }
    if (!packRun) return; const how = await packRun.start(); packRun = null; if (!alive()) return;
    /* the turn carries its own perspective(1600px), as every other card turn does (card.js turnCard, the double tap and the
       deck's second card; the gift and morning packs' flipCard): in WebKit the holder's perspective is flattened away, so
       the plain flip read as a 2D squeeze (Sevaan 2026-11-20: "looks like the card is being squeezed and flipped") */
    if (how === 'flip') await flipCard($('rv-flipper'), { tier: tierKey, faces: [$('rv-back'), $('reveal-card')], showFace: (f) => showFace(f ? 'front' : 'back'), alive, perspective: '1600px' });
    else $('rv-flipper').style.transform = 'perspective(1600px) rotateY(180deg)'; /* a tap skipped straight to the face */
    if (!alive()) return;
    showFace('front');
    retype(card);
    for (const it of items) delete it.card.dataset.swiping;
    setTimeout(() => { if (alive()) under.remove(); }, 720); /* once the deck's own slot (armDeck, 250 ms on, .34 s fade) is up over the copy */
    return finish({ fx, color, fresh, seen, level, levelUp, card, alive, fleet, newStamp, nights, collected, con, shiny });
  }

  if (!fresh) {
    // Seen before: straight to the card.
    $('rv-flipper').style.transform = 'rotateY(180deg)';
    await play($('rv-holder'), [{ opacity: 0, transform: 'scale(.5) translateY(40px)' }, { opacity: 1, transform: 'scale(1.04)' }, { opacity: 1, transform: 'scale(1)' }], { duration: reduced() ? 1 : 480, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' });
    if (!alive()) return;
    return finish({ fx, color, fresh, seen, level, levelUp, card, alive, fleet, newStamp, nights, collected, con, shiny });
  }

  // 2. A sealed card lands, glowing in its rarity colour, and waits for your tap.
  await play($('rv-holder'), [{ opacity: 0, transform: 'scale(.4) translateY(60px) rotate(-8deg)' }, { opacity: 1, transform: 'scale(1.05) rotate(2deg)' }, { opacity: 1, transform: 'scale(1) rotate(0)' }], { duration: reduced() ? 1 : 520, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'forwards' });
  if (!alive()) return;
  $('rv-back').classList.add('glow');
  // Listen on the holder, which doesn’t rotate: the back inherits the tilt values, and the finger never
  // "leaves" the card just because its tilted edge moved out from under it.
  backTilt = attachTilt($('rv-holder'));
  if (!reduced()) backGyro = attachGyro($('rv-holder'), backTilt);
  $('rv-holder').classList.add('live');
  await new Promise((resolve) => {
    // It flips by itself after a second (2026-10-05: no more "tap to reveal"); a tap flips it sooner.
    let timer = 0;
    const beats = [];
    onFlipTap = () => { clearTimeout(timer); beats.forEach((f) => f()); $('rv-holder').removeEventListener('click', onFlipTap); onFlipTap = null; primeReveal(); resolve(); };
    $('rv-holder').addEventListener('click', onFlipTap);
    // A heartbeat before the big ones (2026-10-21, slick idea 05, Sevaan): for Epic and Legendary the wait is two slow
    // double beats (thump-thump, thump-thump): the sky dims a little more and the card's glow swells on each, and the
    // phone thumps in time; then it turns over. A tap still turns it at once.
    const big = !reduced() && ['epic', 'legendary'].includes(tierKey);
    const stopBeats = heartbeats(tierKey, (strong) => {
      $('rv-dim').animate([{ opacity: getComputedStyle($('rv-dim')).opacity }, { opacity: strong ? .9 : .8, offset: .25 }, { opacity: getComputedStyle($('rv-dim')).opacity }], { duration: 420, easing: 'ease-out' });
      $('rv-holder').animate([{ transform: 'scale(1)', filter: 'none' }, { transform: `scale(${strong ? 1.05 : 1.03})`, filter: strong ? 'brightness(1.25)' : 'brightness(1.12)', offset: .2 }, { transform: 'scale(1)', filter: 'none' }], { duration: 360, easing: 'ease-out', composite: 'add' }); }, () => alive() && !!onFlipTap);
    beats.push(stopBeats);
    timer = setTimeout(() => onFlipTap?.(), reduced() ? 400 : big ? 1700 : ['common', 'uncommon'].includes(tierKey) ? 700 : 1000); // the rare ones keep their second of suspense
  });
  if (!alive()) return;
  $('rv-holder').classList.remove('live');
  $('rv-back').classList.remove('glow');
  stopBack();

  // 3. Legendary holds its breath; then the flip (Epic spins on the way). The shared flip (js/card-moment.js), also
  // used by every pack: faces are chosen each frame from the actual angle (Safari ignores backface-visibility here).
  await flipCard($('rv-flipper'), { tier: tierKey, faces: [$('rv-back'), $('reveal-card')], showFace: (f) => showFace(f ? 'front' : 'back'), alive, perspective: '1600px' }); /* its own perspective, like every card turn (card.js turnCard): WebKit flattens #rv-holder's, so the turn read as a 2D squeeze (2026-11-20) */
  if (!alive()) return;
  showFace('front');
  retype(card);
  return finish({ fx, color, fresh, seen, level, levelUp, card, alive, fleet, newStamp, nights, collected, con, shiny });
}

// Already in your collection: the card spins out of the toast’s thumbnail and settles, ready to tilt.
// from: the thumbnail’s screen rect. sighting: { seen, nights, level, levelUp } when tapping View also
// counted as seeing it again tonight (then a stamp lands), or null when you’re only looking.
export async function playView({ card, o, from, sighting = null, eyebrow = null }) {
  stopReveal();
  const my = run, alive = () => my === run;
  const tierKey = FX[o.tier] ? o.tier : 'common';
  const fx = FX[tierKey], color = (TIER_INFO[tierKey] ?? TIER_INFO.common).color;
  $('rv-news').replaceChildren(); // a plain view shows no earned chips (playtest 2026-10-16: the last catch’s chips came back)
  const root = $('reveal');
  root.style.setProperty('--fx', color);
  root.classList.remove('rv-done');
  setRank(null);
  $('reveal-eyebrow').textContent = eyebrow ?? (!sighting ? 'IN YOUR COLLECTION' : NIGHT_MILESTONES.includes(sighting.nights) ? `SEEN ON ${sighting.nights} NIGHTS` : 'SEEN AGAIN');
  setDeck([cardNews({ card, o, seen: 2 })]);
  for (const id of ['rv-holder', 'rv-flipper', 'rv-dot', 'rv-dim', 'rv-flash', 'rv-shock']) $(id).getAnimations().forEach((a) => a.cancel());
  $('rv-holder').classList.remove('live');
  $('rv-back').classList.remove('glow');
  $('rv-dim').style.opacity = 0;
  $('rv-dot').style.opacity = 0;
  $('rv-flipper').style.transform = 'rotateY(180deg)';
  showFace('front');
  sizeCard(card);
  // Rise out of the thumbnail with a full turn about the vertical axis, the back showing while it faces
  // away: the same "closer look" as tapping a tile in the collection (js/cards-page.js spin).
  const h = $('rv-holder').getBoundingClientRect();
  const dx = from ? from.left + from.width / 2 - (h.left + h.width / 2) : 0;
  const dy = from ? from.top + from.height / 2 - (h.top + h.height / 2) : innerHeight * .35;
  const s = from ? Math.max(0.15, from.width / h.width) : 0.3;
  const opts = { duration: reduced() ? 1 : 760, easing: 'cubic-bezier(.25,.8,.25,1)' };
  setTimeout(() => { if (alive()) retype(card); }, opts.duration * .6); // the launch line types in once the face is round
  const backEl = card.querySelector('.card__back');
  if (backEl && !reduced()) {
    applyBack(backEl, o);
    // Offsets are in eased progress, so the back shows exactly while rotateY is 90°–270°.
    backEl.animate([{ opacity: 0 }, { opacity: 0, offset: .25 }, { opacity: 1, offset: .25 }, { opacity: 1, offset: .75 }, { opacity: 0, offset: .75 }, { opacity: 0 }], opts);
    backEl.querySelector('.back-holo')?.animate([{ opacity: .55, backgroundPosition: '20% 20%, 80% 80%, 15% 25%' }, { opacity: .55, backgroundPosition: '80% 80%, 20% 20%, 85% 75%' }], opts);
    backEl.querySelector('.back-glare')?.animate([{ opacity: .5 }, { opacity: .5 }], opts);
  }
  sfx('arrive', { gain: 0.7 });
  await play($('rv-holder'), [
    { opacity: 1, transform: `perspective(1600px) translate(${dx}px, ${dy}px) scale(${s}) rotateY(0deg)` },
    { opacity: 1, transform: 'perspective(1600px) translate(0, 0) scale(1) rotateY(360deg)' },
  ], { ...opts, fill: 'forwards' });
  if (!alive()) return;
  if (sighting) return finish({ fx, color, fresh: false, seen: sighting.seen, level: sighting.level, levelUp: sighting.levelUp, card, alive, nights: sighting.nights });
  $('rv-sweep').classList.remove('go'); void $('rv-sweep').offsetWidth; $('rv-sweep').classList.add('go');
  armDeck(alive);
  root.classList.add('rv-done');
}

// 4. Light sweeps the card, sparks fly, the stamp lands, and the card is yours to tilt.
const STAMP_INK = '#8fb8ff';
async function finish({ fx, color, fresh, seen, level, levelUp, card, alive, fleet = null, newStamp = false, nights = 0, collected = 0, con = null, shiny = null }) {
  const r = $('rv-holder').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  // The haptic lands with the payoff, not when the sealed card arrives (UX room 2026-10-12): main.js listens.
  dispatchEvent(new CustomEvent('sc:payoff', { detail: { tier: Object.keys(FX).find((k) => FX[k] === fx) ?? 'common', fresh, levelUp, newStamp: !!newStamp } }));
  // The payoff: the rarity stinger for a new card, a soft tap for one you have; layers for level-up, stamp and shiny.
  payoffSound(Object.keys(FX).find((k) => FX[k] === fx) ?? 'common', { fresh, newStamp, levelUp, shiny });
  burst(cx, cy, fx.particles + (levelUp ? 60 : 0) + (shiny ? 90 : 0), shiny ? '#ff8fd8' : color);
  if (shiny) setTimeout(() => { burst(cx, cy - 40, 70, '#8ff0ff'); burst(cx, cy + 40, 70, '#fff2b3'); }, 220);
  if (fx.particles > 60 || levelUp) setTimeout(() => burst(cx, cy - 60, fx.particles / 2 + 20, levelUp ? LEVEL_COLOR[level] : '#ffffff'), 180);
  $('rv-sweep').classList.remove('go'); void $('rv-sweep').offsetWidth; $('rv-sweep').classList.add('go');
  await sleep(250);
  if (!alive()) return;
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  const stampLine = fleet ? (fleet.line ?? `LAUNCH ${fleet.cospar} · ${fleet.stamps} OF ${fleet.total}`) : ''; // fleet.line: the Moon’s phase
  const conDone = !!con && con.level === 'gold';
  // 1, 10, 25, 50, 100… cards each earn a patch, and the patch coin says so; no second "milestone" toast for them (playtest 2026-10-09).
  const PATCHED = [1, 10, 25, 50, 100, 250, 500, 1000];
  const milestone = (fresh && (!!con || (MILESTONES.includes(collected) && !PATCHED.includes(collected)))) || !!shiny;
  // The stamp that used to land on the card is now a ticket toast with the same words.
  // In the notice layout (design/notifications-all.html, 2026-10-18): kind line, title, detail.
  const left = con ? con.total - con.have : 0, label = card.querySelector('.card__title, .card__name, h2, h3')?.textContent?.trim() || '';
  const news = shiny && !conDone ? { kind: 'shiny', eyebrow: `SHINY · ${shiny.label.toUpperCase()}`, line: label, sub: shiny.line, ms: 5000 } // say why it’s shiny (2026-10-08)
    : fresh && con ? (conDone ? { kind: 'event', eyebrow: con.unit === 'worlds' ? 'SET COMPLETE' : 'CONSTELLATION COMPLETE', line: con.name, sub: `All ${con.total} ${con.unit ?? 'stars'} · patch earned`, art: con.art } : (con.have === Math.ceil(con.total / 2) && con.total >= 4 ? { kind: 'xp', id: 'con-progress', eyebrow: con.name.toUpperCase(), line: `Halfway · ${con.have} of ${con.total} ${con.unit ?? 'stars'}`, sub: left === 1 ? 'One to go' : `${left} to go`, art: con.art } : milestone && MILESTONES.includes(collected) && !PATCHED.includes(collected) ? { kind: 'event', icon: 'calendar', eyebrow: 'MILESTONE', line: `${collected.toLocaleString('en-US')} cards collected` } : null)) /* a card-count milestone that happens to be a star still says so */ /* only at halfway and complete (2026-10-25, design/catch-feel.html 06 rule 4) */
    : fresh ? (milestone ? { kind: 'event', icon: 'calendar', eyebrow: 'MILESTONE', line: collected === 1 ? 'Your first card' : `${collected.toLocaleString('en-US')} cards collected` } : null)
    : newStamp ? (fleet?.milestone ? { kind: 'event', eyebrow: 'NEW STAMP', line: fleet.milestone } : !fleet?.line && STAMP_MILESTONES.includes(fleet?.stamps) ? { kind: 'event', icon: 'stamp', eyebrow: 'NEW STAMP', line: `${fleet.stamps} launches stamped` } : { kind: 'xp', eyebrow: 'NEW STAMP', line: stampLine })
    : NIGHT_MILESTONES.includes(nights) ? { kind: 'event', icon: 'calendar', eyebrow: 'MILESTONE', line: `Seen on ${nights} different nights`, sub: label }
    : null; // a plain repeat: no toast (2026-10-07)
  if (news) announce?.({ ms: 3200, ...news, delay: 900 }); // its sound plays as it appears (main.js onTicketShown)
  // A second (third…) night on an old friend: a little "+1 NIGHT" stamp drops onto the card (2026-10-08 polish).
  // (The "+1 night · N nights" stamp is gone: 2026-10-19, Sevaan found it confusing, gone too fast, and on fleet cards
  // it counted different launches as the same card’s nights.)
  if (!reduced()) $('reveal').animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 180 });
  if (levelUp) card.querySelector('.card__face')?.animate([{ boxShadow: '0 0 0 transparent' }, { boxShadow: `0 0 34px ${LEVEL_COLOR[level]}` }, { boxShadow: '0 0 0 transparent' }], { duration: 1300 });
  armDeck(alive);
  $('reveal').classList.add('rv-done');
  fillRank(alive);
  showNews(earnedNow, alive);
}

// What this catch earned, as chips under the header (2026-10-12, playtest room: missions, patches and rank-ups used to
// arrive afterwards as a pile of toasts over the circle). news: [{ kind: 'mission'|'patch'|'rank'|'event', text, xp }].
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let earnedNow = []; // playReveal’s earned list, for the finish step
const NEWS_ICON = { ghost: '◎', mission: '◆', patch: '◎', rank: '▲', event: '✦', reunion: '⇄', back: '▭', backs: '✦', peak: '⌃', train: '⋯', birthday: '✦' };
// A chip with an action (`act`) is a button: tap, Enter or Space fire sc:news-act for main.js.
function wireAct(c, n) {
  if (!n.act) return; c.classList.add('rv-chip--act'); /* a › says it opens something (QA round 4) */ c.setAttribute('role', 'button'); c.tabIndex = 0; c.style.pointerEvents = 'auto'; c.style.cursor = 'pointer';
  const go = (e) => { e.stopPropagation(); dispatchEvent(new CustomEvent('sc:news-act', { detail: n.act })); };
  c.addEventListener('click', go); c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
}
function showNews(news, alive) {
  const box = $('rv-news'); box.style.flexWrap = '';
  const pager = buildPager(); if (pager) { if (deck.pack) { const of = document.createElement('span'); of.className = 'rv-of'; of.textContent = `${deck.front + 1} of 2`; box.append(of); } box.append(pager); } /* two cards: their tabs come first (which one is in front); out of a pack, "1 of 2" before them */
  if (!news?.length) return;
  // One row: the two biggest pieces of news, then "+N" (a second row covered the card on small phones).
  const ORDER = { ghost: -1, rank: 0, back: 1, backs: 1.5, reunion: 2, peak: 2.5, train: 2.6, birthday: 0.5, event: 3, patch: 4, mission: 5 }; // a new card back is rare news: up front (2026-10-24)
  const sorted = news.slice().sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9));
  const max = (innerWidth < 430 ? 2 : 3) - (pager ? 1 : 0); /* the pager takes a chip's room */
  let shown = sorted.slice(0, max), rest = sorted.slice(max); // three long chips don't fit a phone (iPhone 14 playtest 2026-10-30: the third was cut mid-word)
  const chip = (n) => {
    const c = document.createElement('span'); c.className = `rv-chip rv-chip--${n.kind}`;
    c.innerHTML = `${n.kind === 'more' ? '' : `<i aria-hidden="true">${NEWS_ICON[n.kind] ?? '◆'}</i>`}${esc(n.text)}${n.xp ? `<b>+${n.xp}</b>` : ''}`;
    if (n.kind === 'more') { // tap to see the rest (iOS playtest 2026-10-20: it was a dead tap)
      c.setAttribute('role', 'button'); c.tabIndex = 0; c.style.pointerEvents = 'auto'; c.style.cursor = 'pointer';
      c.addEventListener('click', () => { c.remove(); Object.assign(box.style, { overflowX: 'auto', pointerEvents: 'auto', touchAction: 'pan-x', scrollbarWidth: 'none' }); /* one row you can swipe along: wrapped rows ran onto the card (iPhone playtest 2026-10-26) */ for (const m of rest) { const x = document.createElement('span'); x.className = `rv-chip rv-chip--${m.kind} in`; x.innerHTML = `<i aria-hidden="true">${NEWS_ICON[m.kind] ?? '◆'}</i>${esc(m.text)}${m.xp ? `<b>+${m.xp}</b>` : ''}`; wireAct(x, m); box.append(x); } }, { once: true });
    }
    wireAct(c, n); /* e.g. "see them all" card backs → Plus (2026-10-24) */
    return c;
  };
  /* Laid out at once (still invisible: a chip shows when it gets .in), then fitted: the last chip, "+N more" included, must end
     before the row's 28px right-hand fade, else the chip before it goes into "+N more" (playtest 2026-11-20 #10: with the
     two-card pager first, "+2 MORE" was faded to "+2 MOR" at 360-430 px). */
  let els = [];
  const lay = () => { els.forEach((c) => c.remove()); const list = rest.length ? [...shown, { kind: 'more', text: `+${rest.length} more` }] : shown; els = list.map((n) => { const c = chip(n); box.append(c); return c; }); return list; };
  let list = lay();
  const fits = () => { const w = box.clientWidth, last = els.at(-1); return !w || !last || last.offsetLeft + last.offsetWidth <= w - 28; };
  while (!fits() && shown.length) { rest = [shown.pop(), ...rest]; list = lay(); }
  /* still too wide (the two-card pager on a 320 px screen, playtest 2026-11-21: "+1 MO"): just the count */
  if (!fits() && rest.length && els.length) { const c = els.at(-1); c.firstChild && (c.firstChild.textContent = `+${rest.length}`); c.setAttribute('aria-label', `${rest.length} more`); }
  list.forEach((n, i) => setTimeout(() => {
    if (!alive()) return;
    const c = els[i]; if (!c?.isConnected) return;
    requestAnimationFrame(() => c.classList.add('in'));
    // Each chip sounds and feels like what it is (2026-10-17 haptics playtest: a rank-up got the generic XP tick).
    if (n.kind === 'rank') sfx('rankup'); else if (n.kind === 'reunion') { sfx('complete', { gain: 0.8 }); dispatchEvent(new CustomEvent('sc:feel', { detail: 'success' })); } else if (n.kind === 'mission') { sfx('mission', { gain: 0.8 }); dispatchEvent(new CustomEvent('sc:feel', { detail: 'light' })); } else if ((n.kind === 'patch' || n.kind === 'ghost')) sfx('patch', { gain: 0.7 }); else sfx('xp', { gain: 0.7 });
  }, (reduced() ? 0 : 900) + i * (reduced() ? 0 : 260)));
}
// The rank bar under a new card (design D): XP counts up from before to after while the bar fills.
// rank: { from, to, name, at, next } (next null at the top rank).
const fmtXp = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : n); // 1,145 / 3,000 like everywhere else (UX playtest 2026-10-21)
let rankInfo = null;
function setRank(r) {
  rankInfo = r; $('reveal').classList.toggle('has-rank', !!r); $('rv-rank').hidden = !r;
  if (!r) return;
  const pct = (v) => (r.next ? Math.max(0, Math.min(1, (v - r.at) / (r.next - r.at))) : 1) * 100;
  // A rank-up starts on the old rank, part-filled (2026-10-17 haptics playtest: it began at the new rank’s floor, so
  // the old rank never filled); fillRank runs it to the end, flashes, and carries on into the new one.
  const p = r.prev, startPct = p ? Math.max(0, Math.min(1, (r.from - p.at) / Math.max(1, (p.next ?? r.at) - p.at))) * 100 : pct(Math.max(r.at, r.from));
  $('rv-rank-name').textContent = p ? p.name : r.name; $('rv-rank-next').textContent = fmtXp(p ? (p.next ?? r.at) : (r.next ?? r.to));
  $('rv-rank-xp').textContent = fmtXp(p ? r.from : Math.max(r.at, r.from));
  $('rv-rank-fill').style.transition = 'none'; $('rv-rank-fill').style.width = `${startPct}%`;
  r.pct = pct;
}
function fillRank(alive) {
  const r = rankInfo; if (!r) return;
  if (r.prev && !r.wrapped) { // fill the old rank, flash, swap the name, then fill the new rank from its floor
    r.wrapped = true; const f = $('rv-rank-fill'), ms = reduced() ? 1 : 500;
    setTimeout(() => { if (!alive()) return; f.style.transition = `width ${ms}ms cubic-bezier(.4,0,.6,1)`; f.style.width = '100%'; $('rv-rank-xp').textContent = fmtXp(r.prev.next ?? r.at); }, reduced() ? 0 : 200);
    setTimeout(() => { if (!alive()) return; $('rv-rank').classList.remove('wrap'); void $('rv-rank').offsetWidth; $('rv-rank').classList.add('wrap'); sfx('rankup'); dispatchEvent(new CustomEvent('sc:feel', { detail: 'success' }));
      $('rv-rank-name').textContent = r.name; $('rv-rank-next').textContent = fmtXp(r.next ?? r.to); f.style.transition = 'none'; f.style.width = '0%'; void f.offsetWidth; r.from = r.at; fillRank(alive); }, reduced() ? 0 : 200 + ms + 160);
    return;
  }
  const from = Math.max(r.at, r.from), ms = reduced() ? 1 : 900, t0 = performance.now() + (reduced() ? 0 : 200);
  setTimeout(() => { if (!alive()) return; const f = $('rv-rank-fill'); f.style.transition = `width ${ms}ms cubic-bezier(.3,.8,.3,1)`; f.style.width = `${r.pct(r.to)}%`; }, reduced() ? 0 : 200);
  const step = (t) => { if (!alive()) return; const k = Math.max(0, Math.min(1, (t - t0) / ms)), e = 1 - (1 - k) ** 3; { const v = Math.round(from + (r.to - from) * e); if ($('rv-rank-xp').textContent !== String(v)) { $('rv-rank-xp').textContent = fmtXp(v); sfx('xp', { gain: 0.6, gap: 75 }); } } if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// Flick the finished card up and away to go back to the sky. Dragging still just tilts the card (the card
// never follows your finger); only a quick, mostly upward flick throws it off the top of the screen.
let onDismiss = null, flick = null;
export function onRevealDismiss(fn) { onDismiss = fn; }
// A swipe-away of a brand-new card goes into the binder instead of off the top (2026-10-21, Sevaan): main says yes or no.
let intoBinderOk = null;
export function onRevealSwipeIntoBinder(fn) { intoBinderOk = fn; }
function holderTo(x, y, ms) {
  const h = $('rv-holder');
  h.style.transition = ms ? `transform ${ms}ms cubic-bezier(.3,.6,.4,1), opacity ${ms}ms` : 'none';
  h.style.transform = x || y ? `translate(${x}px, ${y}px)` : '';
}
{
  // The flick is read on the whole reveal, not just the card (Duo playtest 2026-10-22: a flick that began where
  // another layer sat over the card did nothing, and the player was stuck); buttons and links keep their taps.
  const h = $('rv-holder'), area = $('reveal');
  area.addEventListener('dragstart', (e) => e.preventDefault()); // nothing in the reveal is draggable
  area.addEventListener('pointerdown', (e) => {
    if (!$('reveal').classList.contains('rv-done') || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest?.('button, a, input, .pill')) return;
    flick = { id: e.pointerId, pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
  });
  area.addEventListener('pointermove', (e) => {
    if (!flick || e.pointerId !== flick.id) return;
    flick.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (flick.pts.length > 12) flick.pts.shift();
  });
  const end = (e) => {
    if (!flick || e.pointerId !== flick.id) return;
    const pts = flick.pts; flick = null;
    if (deckTook || deck?.busy) return; // a sideways swipe the deck took is never a flick
    const last = pts[pts.length - 1], now = performance.now();
    const from = pts.find((p) => now - p.t < 140) ?? pts[0];   // the last ~0.15 s of the gesture
    const dx = last.x - from.x, dy = last.y - from.y, dt = Math.max(16, now - from.t);
    const total = last.y - pts[0].y;
    if (!(dy < -45 && total < -60 && Math.abs(dx) < -dy * 0.9 && -dy / dt > 0.6)) return;
    /* Two cards, the one behind not seen yet: a flick up brings it forward instead of throwing both away (2026-11-21,
       Sevaan: so nobody swipes away without seeing the boarding pass). The next flick up dismisses as usual. */
    if (deck?.ready && deck.items.length > 1 && !deck.items[1 - deck.front].seenFront) { deckSwap(0, dx); return; }
    // Fly off the top at the speed of the flick (no fade: you should see it go), keeping some of the
    // sideways throw and a little spin that way.
    if (intoBinderOk?.()) { tilt?.reset(); sfx('swipe'); onDismiss?.(); return; } // it flies from here into the Collection tab
    const cur = getComputedStyle(h).transform; // where it’s drawn now, before its landing animation is dropped
    h.getAnimations().forEach((a) => a.cancel()); h.style.opacity = '1';
    tilt?.reset();
    sfx('swipe');
    const ms = throwOff(h, dx, dy, dt, cur);
    // Close first and tidy up after the reveal has gone: cancelling the throw before closing put the card back in the
    // middle for a moment as the reveal faded (2026-10-19, Sevaan: janky). The next reveal resets the holder anyway.
    setTimeout(() => { onDismiss?.(); setTimeout(() => { if (!document.getElementById('reveal').hidden) return; /* a new reveal owns it now */ h.getAnimations().forEach((a) => a.cancel()); h.style.opacity = ''; }, 500); }, ms + 20);
  };
  area.addEventListener('pointerup', end);
  area.addEventListener('pointercancel', () => { flick = null; });
}

// ---------- two cards from one catch (Sky Collector, 2026-11-19) ----------
// Space Collector's Collection deck (js/cards-page.js deckFront / deckSwap / deckWire, css/collection.css .lb-deck), on the
// reveal: #reveal-card is the track, each card sits in a slot. One card in front, the other peeking out above it, a little
// smaller and dimmer. Swipe the front card either way, tap the one behind, or tap its tab in the chips row: the front card
// flies off and settles behind while the other comes forward. Flick up throws both away; double tap flips the front one.
const DECK_PEEK = 8, /* how far the card behind shows above the front one (css/reveal.css .dk-back, 2026-11-20) */ LEVEL_WORD = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
let deck = null, deckTook = false, onFront = null;
export function onRevealFront(fn) { onFront = fn; } // main.js: Share and View in collection follow the front card
export const revealFrontCard = () => (deck?.items.length ? deck.items[deck.front].card : null);
const slots = () => [...$('reveal-card').children].filter((c) => c.classList.contains('dk-slot'));
// Both cards of a two-card deck, as they sit, for main.js's flight into the binder (Space's one-card path: a flick or
// close on a new catch flies a copy of the card into the Collection tab). It copied only the front card and hid the
// rest, so the card behind just vanished (2026-11-20, Sevaan). Each card goes in a layer with its slot's transform and
// dimming, the one behind peeking out above as it does here; null for a single card (main.js copies that one as before).
export function revealDeckClone() {
  if (!deck || deck.items.length < 2) return null;
  const st = document.createElement('div'); st.className = 'bf-stack';
  const ss = slots().sort((a, b) => a.classList.contains('dk-front') - b.classList.contains('dk-front')); // the back one first, underneath
  for (const s of ss) {
    const cs = getComputedStyle(s), w = document.createElement('div');
    Object.assign(w.style, { transform: cs.transform === 'none' ? '' : cs.transform, transformOrigin: cs.transformOrigin, filter: cs.filter === 'none' ? '' : cs.filter });
    if (!s.classList.contains('dk-front')) { w.style.clipPath = 'inset(-40px -40px 85% -40px)'; w.classList.add('bf-back'); w.style.setProperty('--peek', '6px'); } /* bf-back: the front card's contact shadow on it, as in the deck */ // only its top peeks out from behind the front card: drawing all of it doubled the flight's cost a frame (4x CPU: 34 ms frames, 18 ms clipped, the same as one card)
    const c = s.firstElementChild?.cloneNode(true); if (!c) continue; c.removeAttribute('id');
    w.append(c); st.append(w); // the card keeps its own transform: a sealed one, or one double-tapped to its back, flies turned over
  }
  st.style.setProperty('--fc-u', getComputedStyle($('reveal')).getPropertyValue('--cf') || '12px'); // a flight or plane card sizes off the reveal's --cf in #reveal-card
  return st;
}
// What one card's reveal is: new, a level up, a stamp, or just seen again, and what its tab and its ink stamp say.
function cardNews(e) {
  const seen = e.seen ?? 1, fleet = e.fleet ?? null, progress = e.progress ?? null, o = e.o ?? {};
  const fresh = e.fresh ?? seen <= 1, tierKey = FX[o.tier] ? o.tier : 'common';
  const level = fleet ? fleet.level : progress?.level ?? levelFor(seen);
  const levelUp = e.levelUp ?? (!fresh && (fleet ? fleet.level !== fleet.before : progress ? progress.level !== progress.before : level !== levelFor(seen - 1)));
  const newStamp = !fresh && !!fleet?.newStamp, n = fleet?.stamps ?? seen, flight = o.sky === 'flight';
  let tab = 'New', stamp = null;
  if (!fresh) {
    const next = level === 'bronze' ? 'silver' : level === 'silver' ? 'gold' : null;
    if (levelUp && LEVEL_WORD[level]) { tab = `${LEVEL_WORD[level]} ▲`; stamp = [`${LEVEL_WORD[level]} ▲`, flight ? `seen on ${n} days` : `${n} aircraft`]; }
    else if (newStamp) { tab = flight ? `Day ${n}` : e.livery ? 'Livery' : '+1';
      stamp = flight ? [`Day ${n}`, new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] : [e.livery ? 'New livery' : '+1 aircraft', next && fleet?.total ? `${n} of ${fleet.total} for ${next}` : `${n} aircraft`]; }
    else tab = 'Again';
  }
  return { ...e, o, seen, fleet, progress, shiny: e.shiny ?? null, fresh, tierKey, level, levelUp, newStamp, nights: progress?.nights ?? 0, tab, stamp, kind: flight ? 'Flight' : o.sky === 'plane' ? 'Plane' : 'Card' };
}
// The order: the plane you caught in front, its boarding pass (the flight card) behind (2026-11-21, Sevaan: "the plane you
// collect should be first"; it was new cards first, the flight first when both were). Otherwise new, then a level-up.
function orderDeck(items) {
  if (items.length < 2) return items;
  const rank = (it) => (it.o?.sky === 'plane' ? 0 : 8) + (it.fresh ? 0 : 4) + (it.levelUp ? 0 : 2);
  return items.slice(0, 2).sort((a, b) => rank(a) - rank(b));
}
function setDeck(items) {
  const tr = $('reveal-card'); tr.classList.add('dk-track'); tr.classList.remove('dk-wait', 'instant');
  tr.replaceChildren(...items.map((it, i) => { const s = document.createElement('div'); s.className = `dk-slot ${i ? 'dk-back' : 'dk-front'}${it.card.querySelector?.('.fc--land') ? ' dk-pass' : ''}`; /* the landscape boarding pass (css/sky-cards.css #reveal .dk-pass) */ if (i) s.setAttribute('aria-hidden', 'true'); s.append(it.card); return s; }));
  $('reveal').classList.toggle('two', items.length > 1);
  deck = items.length ? { items, front: 0, busy: false, ready: false } : null;
}
const isPass = (it) => it?.o?.sky === 'flight'; // a boarding pass (the flight card): paper, face up, never turned over
function seal(it) { // face down behind: its real card back, turned over when it first comes forward
  const back = it.card.querySelector('.card__back'); if (!back) return;
  applyBack(back, it.o); back.style.opacity = '1'; it.card.style.transform = 'perspective(1600px) rotateY(180deg)'; it.sealed = true;
  const s = it.card.parentElement; s.classList.add('sealed'); s.style.setProperty('--glow', (TIER_INFO[it.tierKey] ?? TIER_INFO.common).color);
}
// Once the front card has landed: tilt and double-tap flip on both, the phone's tilt on the front one, the swipe is live.
function armDeck(alive) {
  const d = deck; if (!d) return;
  d.items.forEach((it) => { it.tilt = attachTilt(it.card); it.flip = isPass(it) ? null : attachFlip(it.card, { onBack: applyBack }); }); /* no double-tap flip on a boarding pass: it has no back */
  tilt = d.items[d.front].tilt; stopGyro = attachGyro(d.items[d.front].card, tilt);
  d.ready = true;
  if (d.items.length < 2) return;
  $('reveal-card').classList.remove('dk-wait');
  forward(d.front, true);
  // A nudge that says "there's another one" (the first three two-card catches)
  let n = 0; try { n = +localStorage.getItem('deckNudges') || 0; localStorage.setItem('deckNudges', String(n + 1)); } catch {}
  if (n < 3 && !reduced()) setTimeout(() => { if (!alive() || deck !== d || d.busy || d.front !== 0) return; slots().forEach((s) => { s.classList.remove('nudge'); void s.offsetWidth; s.classList.add('nudge'); });
    setTimeout(() => slots().forEach((s) => s.classList.remove('nudge')), 950); }, 1100);
}
function deckFront(i) {
  const d = deck; d.front = i;
  slots().forEach((c, k) => { c.classList.toggle('dk-front', k === i); c.classList.toggle('dk-back', k !== i); c.setAttribute('aria-hidden', String(k !== i)); c.style.transform = ''; c.style.filter = ''; });
  syncPager();
}
function deckSwap(dir, dx = 0) { // the front card flies off to that side (dir 0: up, a flick up with the other card unseen) and settles behind; the back one comes forward
  const d = deck; if (!d || d.busy || !d.ready || d.items.length < 2) return;
  d.busy = true; const k = d.front, f = slots()[k]; f.classList.add('dk-leaving'); f.style.transform = dir ? `translateX(${dir * 115}%) rotate(${dir * 8}deg)` : `translate(${Math.max(-120, Math.min(120, dx * 2)).toFixed(0)}px, -120%) rotate(${Math.sign(dx) * 5}deg)`;
  d.items[k].tilt?.reset(); sfx('swipe', { gain: 0.5 });
  setTimeout(() => { if (deck !== d) return; f.classList.remove('dk-leaving'); deckFront(1 - k); onFront?.(d.items[1 - k]); forward(1 - k); setTimeout(() => { d.busy = false; }, 320); }, 200);
}
// A card coming forward: the phone's tilt follows it; a sealed one turns over (a quick second reveal); an owned one gets
// its stamp inked on the first time it comes forward.
async function forward(i, initial = false) {
  const d = deck, it = d.items[i], my = run, slot = it.card.parentElement;
  stopGyro?.(); tilt = it.tilt; stopGyro = tilt ? attachGyro(it.card, tilt) : null;
  if (it.sealed) {
    it.sealed = false; slot.classList.remove('sealed');
    await sleep(reduced() ? 0 : 180); if (my !== run || deck !== d) return;
    sfx('flip', { gain: 0.8 });
    await turnCard(it.card, { from: 180, to: 360, ms: 560, lift: 1.05 }).finished; if (my !== run || deck !== d) return;
    retype(it.card); payoffSound(it.tierKey, { fresh: it.fresh, shiny: it.shiny }); /* out of a pack a card you have also comes sealed */
    const r = it.card.getBoundingClientRect(), color = (TIER_INFO[it.tierKey] ?? TIER_INFO.common).color;
    burst(r.left + r.width / 2, r.top + r.height / 2, Math.round(FX[it.tierKey].particles * .6), color);
    dispatchEvent(new CustomEvent('sc:feel', { detail: 'success' }));
  }
  if (it.seenFront) return; it.seenFront = true;
  if (it.stamp && !it.fresh) { it.card.insertAdjacentHTML('beforeend', `<span class="dk-stamp" aria-hidden="true">${esc(it.stamp[0])}<small>${esc(it.stamp[1])}</small></span>`); requestAnimationFrame(() => it.card.querySelector('.dk-stamp')?.classList.add('in'));
    if (!initial) setTimeout(() => { if (my === run) sfx('stamp', { gain: 0.6 }); }, reduced() ? 0 : 300); } // the front card's payoff already sounded its stamp
  if (it.levelUp && !initial) (it.card.querySelector('.card__face, .fc') ?? it.card).animate([{ boxShadow: '0 0 0 transparent' }, { boxShadow: `0 0 34px ${LEVEL_COLOR[it.level]}` }, { boxShadow: '0 0 0 transparent' }], { duration: 1300 });
}
// The two cards as tabs in the chips row: which one is in front; tap the other to bring it forward.
function buildPager() {
  if (!deck || deck.items.length < 2) return null;
  const pg = document.createElement('span'); pg.className = 'rv-pager'; pg.setAttribute('role', 'tablist'); pg.setAttribute('aria-label', 'Cards from this catch');
  deck.items.forEach((it, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); if (it.levelUp) b.className = 'lvl';
    b.innerHTML = `<span class="dot" aria-hidden="true"></span>${it.kind} · <em>${esc(it.tab)}</em>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); if (deck?.front !== i) deckSwap(-1); }); pg.append(b); });
  requestAnimationFrame(() => pg.classList.add('in'));
  queueMicrotask(syncPager);
  return pg;
}
function syncPager() { const of = $('rv-news').querySelector('.rv-of'); if (of && deck) of.textContent = `${deck.front + 1} of 2`; $('rv-news').querySelectorAll('.rv-pager button').forEach((b, i) => { const on = i === deck?.front; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); }
{
  const d = $('reveal-card'); let x0 = 0, y0 = 0, dx = 0, on = false, dragging = false, t0 = 0, slot = null, k = -1;
  const live = () => deck && deck.ready && !deck.busy && deck.items.length > 1 && $('reveal').classList.contains('rv-done');
  d.addEventListener('pointerdown', (e) => { if (!live()) return; slot = e.target.closest('.dk-front'); if (!slot) return; k = slots().indexOf(slot); on = true; dragging = false; x0 = e.clientX; y0 = e.clientY; dx = 0; t0 = performance.now(); });
  d.addEventListener('pointermove', (e) => { if (!on) return; dx = e.clientX - x0; const dy = e.clientY - y0;
    if (!dragging) { if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) { if (Math.abs(dy) > 12) on = false; return; } // vertical: the card's tilt and the flick up keep it
      dragging = true; deckTook = true; slot.classList.add('dk-drag'); try { d.setPointerCapture(e.pointerId); } catch {}
      deck.items[k].card.dataset.swiping = '1'; deck.items[k].tilt?.reset(true); } /* at rest at once (2026-11-20): a settling tilt repainted the card face every frame of the drag */ // while the deck has the finger the card stops tilting and can't count a tap (js/card.js reads data-swiping)
    slot.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
  }); /* the card behind no longer brightens as you pull: it is barely shaded now, and a filter written each move repainted the whole card (2026-11-20) */
  const end = () => { if (!on) return; on = false; if (!dragging) return; slot.classList.remove('dk-drag'); const back = slots()[1 - k]; if (back) back.style.filter = '';
    const el = deck?.items[k]?.card; setTimeout(() => { if (el) delete el.dataset.swiping; deckTook = false; }, 0);
    const fast = Math.abs(dx) / Math.max(1, performance.now() - t0) > 0.5;
    if (Math.abs(dx) > 70 || (fast && Math.abs(dx) > 24)) deckSwap(Math.sign(dx)); else slot.style.transform = '';
    d.dataset.dragged = '1'; setTimeout(() => delete d.dataset.dragged, 0); };
  d.addEventListener('pointerup', end); d.addEventListener('pointercancel', end);
  d.addEventListener('click', (e) => { if (d.dataset.dragged) { e.stopPropagation(); e.preventDefault(); } }, true); // a swipe isn't a tap
  d.addEventListener('click', (e) => { const b = e.target.closest('.dk-back'); if (b && live()) { e.stopPropagation(); e.preventDefault(); deckSwap(-1); } }, true); // tapping the card peeking behind brings it forward
}
