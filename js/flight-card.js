// Sky Collector's flight and plane cards. 2026-11-19 (card spike, design/card-spike/combo-pass-spec.html, Sevaan's pick): a
// FLIGHT card is a boarding pass and a PLANE card a spec sheet on drafting paper, inside the same frame and tier metal.
// Earlier design notes, still true of the frame, photo and foil: Design 2026-11-15 ("D · Light Touch, daylight", fidelity pass): Space Collector's
// card anatomy at full richness, printed light. A metal frame by rarity (steel, sage steel, gold, iridescent, animated
// gold foil) around cream card stock with a fine grain and a double inner rule; a recessed photo window with the real
// aircraft (flights: js/airline-photos.js in the airline's livery, else js/type-photos.js; credited on the card); the
// route as a boarding-pass strip under the photo; Russo One
// title, Barlow Condensed labels, a Georgia fact with an orange rule, and a collected footer. Foil and glare follow the
// tilt variables that js/card.js attachTilt writes (--mx/--my/--rx/--ry/--bgx/--bgy/--o/--hyp), read with fallbacks
// so they inherit from whichever ancestor is tilting (the reveal's holder or the card itself).

import { regularFor, clockText } from './sky-regulars.js?v=0.1.1888';
import { TIERS, unlisted, hoursMins, tidyHours } from './flights.js?v=0.1.1888';
import { flightFact } from './flight-facts.js?v=0.1.1888';
import { typePhoto } from './type-photos.js?v=0.1.1888';
import { housePhoto } from './house-photos.js?v=0.1.1888';
import { gapPhoto } from './gap-photos.js?v=0.1.1888'; /* the types that had no photo (2026-11-18) */
import { airlinePhoto } from './airline-photos.js?v=0.1.1888';
import { airlineLogo } from './airline-logos.js?v=0.1.1888';
import { fitStyle } from './photo-fit.js?v=0.1.1888';
import { dist, speed, useMiles } from './units.js?v=0.1.1888';
import { catchClass, CLASS_WORDS, airlineName } from './planes.js?v=0.1.1888';
import { typeSpecs, makerLine } from './type-specs.js?v=0.1.1888';
import { typeFact } from './sky-facts.js?v=0.1.1888';
import { localText } from './localize.js?v=0.1.1888';
import { hasAirlineCallsign, levelWord, THRESHOLDS } from './sky-stamps.js?v=0.1.1888';
import { qrEncode, qrSvg } from './qr.js?v=0.1.1888';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// A type name escaped, with its hyphenated model codes kept on one line ('Boeing KC-135R Stratotanker' broke after 'KC-').
export const escName = (s) => esc(s).replace(/\S+-\S+/g, (w) => `<span style="white-space:nowrap">${w}</span>`);
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

export const GLYPHS = {
  jet: '<path d="M32 3c2.2 0 3.4 3 3.4 6.5V24l22.6 12.2v4.3L35.4 34v15.2l7.2 5.6v3.6L32 55.6l-10.6 2.8v-3.6l7.2-5.6V34L6 40.5v-4.3L28.6 24V9.5C28.6 6 29.8 3 32 3z"/>',
  heli: '<ellipse cx="32" cy="27" rx="7" ry="11"/><rect x="30.5" y="36" width="3" height="20" rx="1.5"/><rect x="25" y="53" width="14" height="3" rx="1.5"/><path d="M9 12L55 42M55 12L9 42" fill="none" stroke-width="2.6" stroke-linecap="round"/>',
  prop: '<path d="M30 7h4l1 9v32l7 5v3H22v-3l7-5V16z"/><rect x="4" y="17" width="56" height="7" rx="3"/>',
  /* 2026-11-19: balloons, airships and gliders were drawn as jets */
  balloon: '<path d="M32 4c13 0 19 10 15 22-3 8-9 13-11 18h-8c-2-5-8-10-11-18C13 14 19 4 32 4z"/><path d="M28 46h8v3h-8z"/><rect x="27" y="52" width="10" height="8" rx="1.5"/><path d="M28 49l-1 3M36 49l1 3" stroke="currentColor" stroke-width="1.5"/>',
  airship: '<ellipse cx="30" cy="30" rx="24" ry="11"/><path d="M50 26l10-8v24l-10-8z"/><rect x="24" y="41" width="12" height="6" rx="1.5"/>',
  glider: '<path d="M2 26q30-5 60 0v3q-30-4-60 0z"/><path d="M30.5 12h3l-.6 40h-1.8z"/><path d="M24 50h16v3H24z"/>',
};
export function glyphSvg(kind = 'jet', cls = '') {
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">${GLYPHS[kind] ?? GLYPHS.jet}</svg>`;
}

const TIER_KEYS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const tierOf = (t) => (TIER_KEYS.includes(t) ? t : 'common');
const tierPill = (tier, cls = 'fc-tier') => { const t = tierOf(tier), T = TIERS[t]; return `<span class="${cls}"><i aria-hidden="true">${T.mark}</i>${T.label.toUpperCase()}</span>`; };
const dateLong = (d) => (d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : '');
const dateShort = (d) => (d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '');
const feet = (ft) => { if (!ft) return '—'; const r = Math.round(ft / 100) * 100; return r >= 1000 ? r.toLocaleString('en-US') : String(Math.round(ft)); };
const code = (a) => a?.iata || a?.icao || '—';

// The photo for an ICAO type code, or null (the card then draws the top-down glyph on a sky panel).
/* A card never shows another airline's paint (2026-11-15, Sevaan: an Alaska 737 MAX on an Air Canada Rouge card). A type's
   picture is, in order: the type in its maker's own paint or with no airline markings (js/house-photos.js), the nearest type
   that has one, then the old type photo only where it shows no airline; otherwise the drawn sky panel. */
const HOUSE_NEAR = { E190: 'E290', E195: 'E295', E170: 'E75L', A321: 'A21N', A19N: 'A319', A333: 'A332', B738: 'B38M', B739: 'B39M', B744: 'B748' };
const AIRLINE_TYPE_PHOTO = new Set(['A19N', 'A20N', 'A21N', 'A306', 'A319', 'A320', 'A321', 'A332', 'A333', 'A339', 'A359', 'A35K', 'A388', 'A124', 'B38M', 'B39M', 'B737', 'B738', 'B739', 'B744', 'B748', 'B752', 'B762', 'B763', 'B772', 'B77L', 'B77W', 'B789', 'B78X', 'BCS1', 'BCS3', 'C208', 'CRJ2', 'CRJ9', 'DH8A', 'DH8C', 'DH8D', 'E170', 'E190', 'E195', 'E290', 'E75L', 'MD11']);
export function photoFor(type) {
  if (!type) return null; const t = String(type).toUpperCase();
  return housePhoto(t) || (HOUSE_NEAR[t] && housePhoto(HOUSE_NEAR[t])) || (AIRLINE_TYPE_PHOTO.has(t) ? null : typePhoto(t)) || gapPhoto(t);
}
// A flight's photo: that type in the airline's own livery (js/airline-photos.js) when we have one, else the type photo.
// The airline is the callsign's ICAO prefix (older saved catches only carry it in the key, F:ACA:CYYZ-KLAX).
const airlineIcao = (f) => f?.airlineIcao || (/^F:([A-Z]{3}):/.exec(f?.key || '') || [])[1] || (f?.callsign || '').slice(0, 3);
// The airline's logo beside its name (2026-11-15, Sevaan: "the cards need the airline logos too"). Logos only identify the
// airline: they sit next to its name and nowhere else, come from Wikimedia Commons in the public domain (js/airline-logos.js,
// scripts/logos/).
const logosOn = () => true; /* always on: the Settings switch was removed (2026-11-19) */
/* An airline's family (2026-11-15, Sevaan: an Alaska 737 MAX on an Air Canada Rouge card): brands and regional carriers that
   fly in, or alongside, their parent's paint. When we have no photo of that type in the flight's own livery, the parent's is
   the next best thing; only carriers that fly for ONE brand are listed (SkyWest and Republic fly for several, so not them). */
export const FAMILY = {
  ROU: 'ACA', JZA: 'ACA', CRQ: 'ACA', WEN: 'WJA', SWG: 'WJA', QXE: 'ASA',
  ENY: 'AAL', PDT: 'AAL', JIA: 'AAL', AWI: 'AAL', EDV: 'DAL', GJS: 'UAL', ASH: 'UAL', UCA: 'UAL',
  CFE: 'BAW', SHT: 'BAW', CLH: 'DLH', KLC: 'KLM', HOP: 'AFR', QLK: 'QFA', AKX: 'ANA', JTA: 'JAL', JAC: 'JAL', HDA: 'CPA', IBS: 'IBE',
};
// A flight's photo: that type in the airline's own livery, then in its parent's, then the type with no airline's paint at all.
export function flightPhotoFor(f, type) {
  if (!type) return null; const a = airlineIcao(f);
  return airlinePhoto(a, type) || (FAMILY[a] && airlinePhoto(FAMILY[a], type)) || photoFor(type);
}
// A plane card's photo as a URL (2026-11-16: the weekly recap's "rarest find" showed Space Collector's art, a satellite):
// the flight's airline photo or the type's, sm/ (480 px) unless size is 'full'. null when the card has none.
export function skyCardPhotoUrl(o, type, size = 'sm') {
  const ph = o?.sky === 'flight' ? flightPhotoFor(o, type || o.type) : photoFor(type || o?.type); if (!ph) return null;
  return size === 'full' ? ph.url : String(ph.url).replace(/\/([^/]+)$/, `/${size}/$1`);
}
const credit = (ph) => `<span class="fc-credit">Photo: ${esc(ph.credit)}, ${esc(ph.licence)}</span>`;
// The whole aircraft always shows (2026-11-15, Sevaan: "planes can't be cropped"). Each photo carries the box the plane
// sits in (scripts/photos/photo_common.py); once the frame has a size, fitPhoto picks a cover crop that keeps the box, or shows
// the whole photo over a blurred copy of itself when the frame is too wide or tall for any crop to hold the plane.
// Sizes (2026-11-16, Collection scroll gap): small faces (grid tiles, minis) load sm/ (480 px) like Space Collector's 440 px
// tile art; the soft sides behind a contained photo are tiny/ (32 px) stretched, a blur with no live CSS filter.
const sized = (url, size) => String(url).replace(/\/([^/]+)$/, `/${size}/$1`);
const photoImg = (ph, cls, eager, small = false) => `${ph.box ? `<img class="ph-blur" src="${esc(sized(ph.url, 'tiny'))}" alt="" aria-hidden="true" decoding="async" draggable="false">` : ''}<img class="${cls}" src="${esc(small ? sized(ph.url, 'sm') : ph.url)}" alt="" ${eager ? '' : 'loading="lazy" '}decoding="async" draggable="false"${ph.box ? ` data-box="${ph.box.join(',')}" data-w="${ph.w}" data-h="${ph.h}"` : ''}>`;
function fitPhoto(img) {
  const f = img.parentElement, fw = f?.offsetWidth, fh = f?.offsetHeight; if (!fw || !fh) return false;
  const st = fitStyle(img.dataset.box.split(',').map(Number), +img.dataset.w, +img.dataset.h, fw, fh);
  const contain = st.mode === 'contain';
  img.style.objectFit = contain ? 'contain' : 'cover'; img.style.objectPosition = contain ? '50% 50%' : st.objectPosition;
  f.classList.toggle('ph-contain', contain); return true;
}
// Cards are built as HTML strings all over the app, so fit any photo that appears, and again when frames change size.
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const pending = new Set(); let raf = 0;
  const flush = () => { raf = 0; for (const img of pending) if (!img.isConnected || fitPhoto(img)) pending.delete(img); if (pending.size) raf = requestAnimationFrame(flush); };
  const queue = (img) => { pending.add(img); raf ||= requestAnimationFrame(flush); };
  const scan = (n) => { if (n.nodeType !== 1) return; if (n.matches?.('img[data-box]')) queue(n); n.querySelectorAll?.('img[data-box]').forEach(queue); };
  const start = () => { new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach(scan); }).observe(document.body, { childList: true, subtree: true }); scan(document.body); };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
  addEventListener('resize', () => document.querySelectorAll('img[data-box]').forEach(queue));
}
// No photo: real-sky art of the kind of aircraft (2026-11-21, Sevaan picked direction C, design/generic-art/: a believable
// daylight sky with the aircraft lit by the sun), one pre-drawn WebP per kind in assets/art/sky-generic/, framed so the
// Collection mini's narrow crop still shows the aircraft. The panel's own sky gradient shows until the picture has loaded.
const SKY_ART = { LIGHT: 'light', SMALL: 'small', LARGE: 'large', HEAVY: 'heavy', FAST: 'fast', GLIDER: 'glider', BALLOON: 'balloon', ULTRA: 'ultralight', DRONE: 'drone' };
export const skyArtKind = (un, glyph) => (glyph === 'heli' ? 'heli' : un ? (SKY_ART[un.mark] ?? 'unknown') : glyph === 'glider' ? 'glider' : glyph === 'balloon' ? 'balloon' : glyph === 'prop' ? 'light' : 'large');
const skyArt = (kind, cls) => `<span class="${cls} fc-sky--art" aria-hidden="true"><img class="fc-skyart" src="${new URL(`../assets/art/sky-generic/${kind}.webp`, import.meta.url).href}" alt="" decoding="async" draggable="false"></span>`;

// Layers over the printed face: foil (rarity), gloss, glare under the finger.
const layers = '<span class="fc-foil" aria-hidden="true"></span><span class="fc-coat" aria-hidden="true"></span><span class="fc-glare" aria-hidden="true"></span>';

// face: the print inside the frame ('bp' boarding pass, 'ss' spec sheet); mini: the Collection's small layout.
const miniMedal = (lvl, n) => (lvl ? `<span class="sct-lvl sct-lvl--${lvl}" title="${lvl} · ${n}"><i>${n}</i><em>${lvl.toUpperCase()}</em></span>` : ''); /* the level medal on a mini card's picture (Sevaan 2026-11-19: 'Go with B'): the catch count in a disc of the level's metal */
function shell(kind, tier, inner, label, level = 'none', face = '', mini = false) {
  const t = tierOf(tier);
  return `<article class="fc fc--${kind} fc--${t}${['rare', 'epic', 'legendary'].includes(t) ? ' fc--gilt' : ''}${level && level !== 'none' ? ` fc--lvl fc--lvl-${level}` : ''}${mini ? ' fc--mini' : ''}" style="--tier:${TIERS[t].color}" aria-label="${esc(label)}">
  <div class="fc-rot"><div class="fc-face"><div class="fc-in${face ? ` fc-in--${face}` : ''}">${inner}</div></div>${layers}</div>
</article>`;
}

// ---- Stamps (js/sky-stamps.js): the progress line and the level chip ----
const levelChip = (level, cls = 'fc-lvl') => (level && level !== 'none' ? `<span class="${cls} ${cls}--${level}">${levelWord(level)}</span>` : '');
/* How far the card is toward its next level: a count and a bar (2026-11-18, Sevaan: no row of stamps marking each day or each
   aircraft's id, "if you see the same plane a hundred times it's untenable"). info: flightStampInfo / planeStampInfo.
   newest = this catch just counted, so the bar grows from where it was. */
function passport(info, { newest = false } = {}) {
  if (!info?.count) return '';
  const plane = info.kind === 'plane', n = info.count, T = THRESHOLDS[info.kind] ?? THRESHOLDS.flight, next = T.find((x) => n < x);
  const head = plane ? `${n} AIRCRAFT${info.liveryCount ? ` · ${info.liveryCount} LIVER${info.liveryCount === 1 ? 'Y' : 'IES'}` : ''}` : `CAUGHT ON ${n} DAY${n === 1 ? '' : 'S'}${info.nights ? ` · ${info.nights === n ? (n === 1 ? 'AT NIGHT' : 'ALL AT NIGHT') : `${info.nights} AT NIGHT`}` : ''}`;
  const to = next ? `${next - n} MORE TO ${next === T[1] ? 'SILVER' : 'GOLD'}` : 'TOP LEVEL';
  const pct = next ? Math.round(n / next * 100) : 100, from = next && newest ? Math.round((n - 1) / next * 100) : pct;
  return `<div class="fc-pass" aria-label="${esc(`${head.toLowerCase()}, ${info.level}, ${to.toLowerCase()}`)}"><div class="fc-pass-h"><span class="fc-pass-k">${head}</span>${levelChip(info.level)}</div>
      <div class="fc-prog${newest ? ' fc-prog--new' : ''}"><span class="fc-prog-bar"><i style="--from:${from}%;width:${pct}%"></i></span><span class="fc-prog-t">${to}</span></div></div>`;
}
export const passportHtml = passport;

// A printed barcode for the pass's stub: bars from the callsign, the same every time (decoration, it encodes nothing).
function barcode(seed, n) {
  let h = 2166136261; for (const c of String(seed || 'SKY')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  let s = '';
  for (let i = 0; i < n; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; s += `<i style="width:${[.1, .1, .18, .28][h >>> 29 & 3]}em;margin-right:${[.08, .14, .2, .1][h >>> 26 & 3]}em"></i>`; }
  return `<span class="fc-bars" aria-hidden="true">${s}</span>`;
}
const timeOf = (d) => (d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase() : '');
const jet = (cls = '') => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">${GLYPHS.jet}</svg>`;
const ICONS = {
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0110 0v3h1.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-13C4.7 22 4 21.3 4 20.5v-9C4 10.7 4.7 10 5.5 10H7zm2 0h6V7a3 3 0 00-6 0v3z"/></svg>',
  box: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7zm9 2.2L6.2 6.8 12 4.3l5.8 2.5L12 9.2zM5 8.5v7.2l6 2.7v-7.2l-6-2.7z"/></svg>',
  jet: `<svg viewBox="0 0 64 64" aria-hidden="true" class="fc-rot90">${GLYPHS.jet}</svg>`,
};
// The airline as its logo (the logo is the name), else its name as a printed wordmark.
function passMark(f, cls, wm) {
  const lg = logosOn() ? airlineLogo(airlineIcao(f)) : null;
  return lg ? `<img class="${cls}" src="${esc(lg.url)}" alt="${esc(f.airline)}" title="${esc(f.airline)}" width="${lg.w}" height="${lg.h}" decoding="async" draggable="false">` : `<span class="${wm}">${esc(String(f.airline || airlineIcao(f) || '').toUpperCase())}</span>`;
}
const airLine = (air, tight = false) => (!air ? '—' : `≈${hoursMins(air, tight ? { h: 'h', m: '', mins: ' min', gap: '' } : { h: ' h', m: '', mins: ' min' })}`); /* ≈2 h, ≈1 h 05, ≈45 min: no zero part (Sky Build playtest v0.1.1812) */ /* an estimate from the distance (flights.js airTime), so it says so */
const field = (label, value, unit = '') => `<div><span>${label}</span><b>${esc(value)}${unit && value !== '—' ? `<small>${unit}</small>` : ''}</b></div>`;

// FLIGHT = the boarding pass (design/card-spike/combo-pass-spec.html, approved 2026-11-19): the airline's logo across the
// top with BOARDING PASS and the callsign, a smaller photo with rarity and set, the giant airport codes with their cities,
// distance / time in the air / height caught at / aircraft, a fact on a red rule, then the tear line and the stub with when
// you caught it, how often, its level and a barcode.
// opts: { caughtAt: Date, heightFt, sightings, type (ICAO, for older catches), planeName, eager, small (Collection mini),
//   stampInfo (flightStampInfo), newStamp }
export function flightCardHtml(f, opts = {}) {
  const type = f.type || opts.type || '', ph = flightPhotoFor(f, type), si = opts.stampInfo, lvl = si?.level && si.level !== 'none' ? si.level : '';
  const label = `${f.from.city} to ${f.to.city}, ${f.airline}, ${TIERS[tierOf(f.tier)].label}${lvl ? `, ${lvl} level` : ''}`;
  if (opts.small) {
    const pic = ph ? photoImg(ph, 'fc-photo', false, true) : skyArt('large', 'fc-sky');
    const inner = `<div class="m-lg">${passMark(f, 'm-logo', 'm-wm')}</div>
      <div class="fc-pic m-ph${ph ? '' : ' fc-pic--sky'}">${pic}${tierPill(f.tier, 'fc-tier m-tier')}${miniMedal(lvl, si?.count ?? 0)}</div>
      <div class="m-cd"><span>${esc(code(f.from))}</span>${jet('fc-rot90')}<span>${esc(code(f.to))}</span></div>
      <div class="bp-perf"></div>
      <div class="m-st"><span>${opts.caughtAt ? `✓ ${dateShort(opts.caughtAt)}` : 'NOT YET'}</span>${barcode(f.callsign || f.key, 12)}</div>`;
    return shell('flight', f.tier, inner, label, si?.level, 'bp', true);
  }
  const art = ph ? `${photoImg(ph, 'fc-photo', opts.eager, !!opts.shrunk)}${credit(ph)}` : skyArt('large', 'fc-sky');
  const reg = (() => { try { const r = regularFor(f.callsign); return r ? `<span class="bp-reg">REGULAR · ABOUT ${esc(clockText(r.minute))}</span>` : ''; } catch { return ''; } })();
  const d = dist(f.km ?? null), T = THRESHOLDS.flight, n = si?.count ?? 0, next = T.find((x) => n < x);
  const prog = n ? `${n} DAY${n === 1 ? '' : 'S'}${si.nights ? ` · ${si.nights === n ? (n === 1 ? 'AT NIGHT' : 'ALL AT NIGHT') : `${si.nights} AT NIGHT`}` : ''}<br>${next ? `${next - n} MORE TO ${next === T[1] ? 'SILVER' : 'GOLD'}` : 'TOP LEVEL'}` : '';
  const fact = rich(localText(flightFact({ ...f, fact: tidyHours(String(f.fact ?? '')).replace(' as the crow flies: about ', ', about ').replace(/ on a (?=[AEIOU])/, ' on an ') }, si?.count ?? 1)));
  /* The landscape pass (2026-11-21, Sevaan, design/pass-landscape/ round 3b): 42 x 16em, as long as the plane card is tall,
     always turned -90deg so you read it from the right side of the screen; the element itself is 16 x 42em. Behind the plane
     card only its end shows above the card, so that end (the band) carries the airline, date, route and flight written
     along it; the stub has when you caught it, a real QR code and the type; the main part the header, photo, codes, details
     and fact. css/sky-cards.css .fc--land; the reveal's deck (js/reveal.js) stands it behind the card and brings it forward. */
  const when = opts.caughtAt;
  const inner = `<div class="lp-turn"><div class="lp"><div class="lp-paper">
    <div class="lp-main">
      <div class="lp-hd">${passMark(f, 'lp-logo', 'lp-wm')}<div class="lp-k">BOARDING PASS<b>${esc(f.callsign || '—')}</b></div></div>
      <div class="fc-pic lp-ph${ph ? '' : ' fc-pic--sky'}">${art}${tierPill(f.tier)}<span class="fc-set">${esc(String(f.setName ?? f.set ?? '').toUpperCase())}</span>${reg}${opts.shrunk ? miniMedal(lvl, si?.count ?? 0) : ''}</div>
      <div class="lp-info">
        <div class="lp-codes"><div><b>${esc(code(f.from))}</b><small>${esc(f.from.city)}</small></div><div class="lp-mid">${jet('lp-jet')}</div><div class="lp-to"><b>${esc(code(f.to))}</b><small>${esc(f.to.city)}</small></div></div>
        <div class="lp-fields">${field('DISTANCE', d.v, d.u)}${field('IN THE AIR', airLine(f.air))}${field('CAUGHT AT', feet(opts.heightFt), 'ft')}</div>
        <p class="lp-fact">${fact}</p>
      </div>
    </div>
    <div class="lp-perf"></div>
    <div class="lp-stub">
      <div class="lp-in"><div><span class="lp-l">CAUGHT</span><b class="lp-v">${when ? timeOf(when) : 'NOT YET'}</b></div>${passQr()}<div class="lp-lv"><b>${esc(type || '—')}</b>SEEN ${esc(opts.sightings ?? 1)}×${lvl ? ` · <em class="bp-lvl bp-lvl--${lvl}">${levelWord(lvl)}</em>` : ''}${prog ? `<br>${prog}` : ''}</div></div>
      <div class="lp-band"><div class="lp-band-in"><div class="lp-r1">${passMark(f, 'lp-blogo', 'lp-bwm')}<span class="lp-dt">${when ? dateLong(when) : ''}</span></div>
        <div class="lp-r2"><span class="lp-rt">${esc(code(f.from))}${jet('lp-jet')}${esc(code(f.to))}</span><span class="lp-fl">FLIGHT<b>${esc(f.callsign || '—')}</b></span></div></div></div>
    </div>
  </div></div></div>`;
  const t = tierOf(f.tier);
  return `<article class="fc fc--flight fc--land fc--${t}${lvl ? ` fc--lvl fc--lvl-${lvl}` : ''}" style="--tier:${TIERS[t].color}" aria-label="${esc(label)}"><div class="fc-rot">${inner}</div></article>`;
}
/* The stub's code is a real QR code (js/qr.js), the same on every pass: it opens a well-known music video (2026-11-21,
   Sevaan). Made once. */
let QR_SVG = '';
function passQr() { if (!QR_SVG) { try { QR_SVG = qrSvg(qrEncode('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'L'), { quiet: 3, cls: 'lp-qr' }); } catch { QR_SVG = ''; } } return QR_SVG; }

/* A checked fact for the type first (js/sky-facts.js, 2026-11-17: 131 types, sources in docs/FACTS-SOURCES.md) */
/* Several facts per type (2026-11-18, Sevaan: "there may be multiple facts too"): the card shows the one for how many
   different aircraft of the type you've caught (1st aircraft: fact 1, 2nd: fact 2 …, round again), so catching a type
   again teaches something new. n = that count (stampInfo.count), 1 for a card you don't have yet. */
const planeFact = (p, n = 1) => p.fact || unlisted(p.key)?.fact || typeFact(p.type || (/^P:(.+)$/.exec(p.key ?? '') || [])[1], n) || (p.glyph === 'heli' ? 'Helicopters fly low and slow, so they’re among the hardest things in the sky to catch twice.'
  : p.glyph === 'prop' ? 'Propeller planes cruise lower and slower than jets, which makes them easier to spot and to hear.'
    : 'Every different aircraft of this type you catch counts toward this card’s **level**, and every airline it flies for is another livery.');

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compass = (deg) => (Number.isFinite(deg) ? COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] : '—');
const SIZE_WORD = { A1: 'Light', A2: 'Small', A3: 'Large', A4: 'Large', A5: 'Heavy', A7: 'Rotorcraft', B1: 'Glider', B2: 'Balloon', B4: 'Ultralight' };
// The class of the newest catch of a plane card (js/planes.js catchClass, saved on the sighting); older catches from before
// it was saved are worked out again from what they kept (the airline callsign, the type, the card's size category).
export function planeCatchClass(p, last) {
  if (!last) return null;
  const type = unlisted(p.key) ? '' : (p.type || ''), cat = last.cat || (/^P:UNKNOWN-(\w+)$/.exec(p.key ?? '') || [])[1] || '';
  const cls = last.cls ?? catchClass({ callsign: last.callsign, category: cat, type, heli: p.glyph === 'heli' || p.key === 'P:HELI' });
  const airline = cls === 'airline' || cls === 'cargo', cs = String(last.callsign ?? '').trim().toUpperCase();
  return { cls, word: CLASS_WORDS[cls] ?? '', airline, routed: last.routed !== false, op: airline ? (last.op || airlineName(cs) || '') : '', icao: airline && hasAirlineCallsign(cs) ? cs.slice(0, 3) : '',
    reg: airline && hasAirlineCallsign(cs) ? (last.reg || '') : '' };
}
// The band over a plane-only catch's photo: what kind of thing it was. null when the card shows an airline flight's operator
// line instead, or (gov) when there's nothing to say.
function classBand(k, mini = false) {
  if (!k?.cls || (k.airline && k.routed)) return null;
  if (k.cls === 'cargo') return { cls: 'cargo', icon: ICONS.box, head: mini ? 'Cargo' : 'Cargo airline', tail: mini ? k.op : [k.op, 'route not known'].filter(Boolean).join(' · '), logo: k.icao };
  if (k.cls === 'airline') return { cls: 'airline', icon: ICONS.jet, head: 'Airline', tail: mini ? k.op : [k.op, 'route not known'].filter(Boolean).join(' · '), logo: k.icao };
  if (k.cls === 'airliner') return { cls: 'noair', icon: '', head: mini ? 'No flight number' : 'No airline flight number', tail: mini ? '' : 'Airliner' };
  return null; /* no band for private, business, military, government or rotorcraft (2026-11-21, Sevaan: a Gulfstream said "Business jet" under the photo and "Business Jets" in the header; the set and the size already say what kind it is) */
}
function bandHtml(b, cls = 'ss-band') {
  if (!b) return '';
  const lg = b.logo && cls === 'ss-band' && logosOn() ? airlineLogo(b.logo) : null; /* no logo in the mini's thin band */
  return `<div class="${cls} ${cls}--${b.cls}">${b.icon}<span>${esc(b.head)}${b.tail ? ` <small>· ${esc(b.tail)}</small>` : ''}</span>${lg ? `<img src="${esc(lg.url)}" alt="" decoding="async" draggable="false">` : ''}</div>`;
}
// The type's printed spec cells (js/type-specs.js, verified); a type we have none for shows what the feed and your catches say.
function specCells(p, si, last, type) {
  const s = typeSpecs(type);
  if (s) return s.cells.map(([l, v, u]) => (l === 'Range' && u === 'km' && useMiles() ? [l, dist(Number(v.replace(/,/g, ''))).v, 'mi'] : [l, v, u]));
  const cat = last?.cat || (/^P:UNKNOWN-(\w+)$/.exec(p.key ?? '') || [])[1] || '';
  return [SIZE_WORD[cat] && cat !== 'A7' ? ['Size', SIZE_WORD[cat]] : null, /* not 'Rotorcraft' on a helicopter's card: it says so already, and the word ran out of its cell (playtest 2026-11-21) */ si?.count ? ['Aircraft', String(si.count)] : null,
    si?.liveryCount ? ['Operators', String(si.liveryCount)] : null, (si?.days ?? 0) > 1 ? ['Days seen', String(si.days)] : null].filter(Boolean);
}

// PLANE = the spec sheet (design/card-spike/combo-pass-spec.html, approved 2026-11-19): cream drafting paper with a blue grid,
// an AIRCRAFT tab and the set, the TYPE plate, the photo (with a band saying what kind of thing a plane-only catch was), the
// name, maker · country · kind, up to four checked spec cells, the operator (airline catches only), YOUR CATCH (the newest
// catch: height, speed, distance away, heading, when), progress and a fact.
// opts: { caughtAt, heightFt, speedKmh, awayKm, sightings, stampInfo (planeStampInfo, with .last: the newest catch, js/sky-cards.js
//   skyStampInfo), newStamp, callsign (the registration is hidden unless it's an airline's), eager, small (Collection mini) }
export function planeCardHtml(p, opts = {}) {
  /* un: an aircraft the feed has no type for (js/flights.js unlisted): named for its size, with the airline as its identity */
  const un = unlisted(p.key), type = un ? '' : (p.type || ''), name = un ? un.name : p.name;
  const ph = photoFor(type), si = opts.stampInfo, lvl = si?.level && si.level !== 'none' ? si.level : '';
  const last = si?.last ?? (opts.callsign != null || opts.heightFt != null ? { callsign: opts.callsign ?? '', altFt: opts.heightFt } : null);
  const k = planeCatchClass(p, last), plate = type || un?.mark || (p.glyph === 'heli' ? 'HELI' : '—');
  const label = `${name}, ${TIERS[tierOf(p.tier)].label}${k?.word && !k.airline ? `, ${k.word}` : ''}${lvl ? `, ${lvl} level` : ''}`;
  const cells = specCells(p, si, last, type), set = String(p.setName ?? p.set ?? 'Planes');
  if (opts.small) {
    const pic = ph ? photoImg(ph, 'fc-photo', false, true) : skyArt(skyArtKind(un, p.key === 'P:HELI' ? 'heli' : un ? un.glyph : p.glyph), 'fc-sky fc-sky--big');
    const left = typeSpecs(type)?.cells.find((c) => c[0] === 'First flew') ?? cells[0];
    const inner = `<div class="m-hd"><span class="m-kind">AIRCRAFT</span><span class="ss-plate m-plate"><b>${esc(plate)}</b></span></div>
      <div class="fc-pic m-ph${ph ? '' : ' fc-pic--sky'}">${pic}${tierPill(p.tier, 'fc-tier m-tier')}${miniMedal(lvl, si?.count ?? 0)}${bandHtml(classBand(k, true), 'm-band')}</div>
      <b class="m-n">${escName(name)}</b>
      <div class="m-sp">${left && left[0] !== 'Aircraft' ? `<span>${esc(left[0])} <b>${esc(left[1])}</b></span>` : `<span>${esc(set)}</span>`}<span><b>${si?.count ?? 0}</b> aircraft</span></div>`;
    return shell('plane', p.tier, inner, label, si?.level, 'ss', true);
  }
  const art = ph ? `${photoImg(ph, 'fc-photo', opts.eager, !!opts.shrunk)}${credit(ph)}` : skyArt(skyArtKind(un, p.key === 'P:HELI' ? 'heli' : un ? un.glyph : p.glyph), 'fc-sky fc-sky--big');
  const band = classBand(k), specs = typeSpecs(type);
  const mk = specs ? makerLine(specs) : un ? 'Exact type not known' : ''  /* true of a plane with no type and of a code Sky can't name (2026-11-20) */;
  const who = k?.airline && k.routed && (k.op || k.reg) ? `<div class="ss-who"><b>${k.cls === 'cargo' ? 'CARGO AIRLINE' : 'AIRLINE'}</b><span>${esc([k.op, k.reg].filter(Boolean).join(' · '))}</span></div>` : '';
  const when = last?.time ? new Date(last.time) : opts.caughtAt;
  const kmh = last?.gsKt > 30 ? Math.round(last.gsKt * 1.852) : last?.gsKt != null ? null : opts.speedKmh ?? null;
  const sp = speed(kmh), aw = dist(last?.rangeKm != null ? Math.round(last.rangeKm) : opts.awayKm ?? null);
  /* Spine (2026-11-22, Sevaan picked variant 2 of design/plane-card-team/round2.html): a navy column down the left holds every
     number (the type code, the specs, this catch's height, speed, distance and heading, the level medal); the rest is the
     photo, the set, the name, what it is, when and from whom you caught it, your progress in plain words, and the fact. */
  const T = THRESHOLDS.plane, n = si?.count ?? 0, nextT = T.find((x) => n < x), nextWord = nextT === T[1] ? 'Silver' : 'Gold';
  const spec = specs?.maker ? { maker: specs.maker, desc: [specs.country, specs.desc].filter(Boolean).join(' · ') } : null;
  const model = spec && name.toLowerCase().startsWith(spec.maker.toLowerCase() + ' ') ? name.slice(spec.maker.length + 1) : null; /* any case: 'de Havilland Canada' (Android playtest 2026-11-22: the full name took three lines and pushed the fact off) */
  const caught = last || opts.caughtAt;
  const st = (l, v, u) => `<div class="sp-st"><b>${esc(v)}${u && v !== '—' ? `<small>${esc(u)}</small>` : ''}</b><span>${esc(l)}</span></div>`;
  const opLine = k?.airline && k.routed && (k.op || k.reg) ? /* as before: the operator and registration only with a route; without one the band's words */ `<p class="sp-op">${esc(k.op || '')}${k.reg ? `<small>${esc(k.reg)}</small>` : ''}</p>` : band ? `<p class="sp-op sp-op--band">${esc(band.head)}${band.tail ? `<small>${esc(band.tail)}</small>` : ''}</p>` : '';
  const prog = n ? `<div class="sp-pr"><p>${n} of ${nextT ?? n} different aircraft</p><div class="sp-bar"><i style="width:${Math.min(100, Math.round(n / (nextT ?? n) * 100))}%"></i></div><p class="sp-sub">${si?.liveryCount ? `${si.liveryCount} airline liver${si.liveryCount === 1 ? 'y' : 'ies'} seen` : ''}</p></div>` : '';
  const inner = `
    <div class="sp-side">
      <span class="sp-l">TYPE</span><b class="sp-tp${plate.length > 4 ? ' sp-tp--long' : ''}">${esc(plate)}</b>
      ${cells.length ? `<h3>THE TYPE</h3>${cells.slice(0, 4).map(([l, v, u]) => st(l, v, u)).join('')}` : ''}
      ${caught ? `<h3>YOUR CATCH</h3>${st('Height', feet(last?.altFt ?? opts.heightFt), 'ft')}${st('Speed', sp.v, sp.u)}${st('Away', aw.v, aw.u)}${st('Heading', compass(last?.track), '')}` : ''}
      ${lvl ? `<div class="sp-md"><span class="sp-medal sp-medal--${lvl}">${n}</span><p><b>${levelWord(lvl).toUpperCase()}</b>${nextT ? `${nextT - n} more<br>for ${nextWord}` : 'Top level'}</p></div>` : ''}
    </div>
    <div class="sp-main">
      <div class="fc-pic sp-ph${ph ? '' : ' fc-pic--sky'}">${art}<span class="fc-holo" aria-hidden="true"></span>${tierPill(p.tier)}${opts.rareHere ? '<span class="fc-here" title="Unusual where you caught it">RARE HERE</span>' : ''}</div>
      <div class="sp-body">
        <div class="sp-kick">${esc(set.toUpperCase())}</div>
        <h2 class="sp-name${(model ?? name).length > 20 ? ' sp-name--xl' : (model ?? name).length > 13 ? ' sp-name--long' : ''}">${model ? `<small>${esc(spec.maker.toUpperCase())}</small>` : ''}<span>${escName(model ?? name)}</span></h2>
        ${spec?.desc || mk ? `<p class="sp-kind">${esc(String(spec?.desc || mk).replace(/^./, (c) => c.toUpperCase()))}</p>` : ''}
        ${caught ? `<div class="sp-ct"><span class="sp-l sp-red">CAUGHT</span><p class="sp-when">${when ? `${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${timeOf(when).toLowerCase()}` : ''}</p>${opLine}</div>` : ''}
        ${prog}
        ${(() => { const f = localText(planeFact(p, si?.count ?? 1)), n = f.replace(/\*\*/g, '').length; return `<p class="fc-fact sp-fact${n > 210 ? ' sp-fact--s' : n > 150 ? ' sp-fact--m' : ''}">${rich(f)}</p>`; })() /* the whole fact, never cut off: longer ones a little smaller (2026-11-22, Sevaan) */}
      </div>
    </div>`;
  return shell('plane', p.tier, inner, label, si?.level, 'sp');
}

// A small card on its own (the catch panel's fallback when main.js gives no mini): the Collection's mini layout, the same
// face as renderCard's mini, drawn 112 px wide. e: { kind, card, type, last (ms), n (times seen), stamps (count), stampInfo }.
// Returns the markup; the caller wraps it.
export function miniCardHtml({ kind, card: c, type, last, n = 1, stamps = 0, stampInfo = null }) {
  const si = stampInfo ?? (stamps ? { kind, count: stamps, level: 'none' } : null);
  const opts = { shrunk: true, caughtAt: last ? new Date(last) : null, sightings: n, stampInfo: si, type }; /* the full card shrunk (the Spine plane card, the landscape pass), as the Collection's tiles are (2026-11-22, Sevaan: "make sure the minicards are updated too") */
  const html = kind === 'flight' ? flightCardHtml({ ...c, type: c.type || type }, opts) : planeCardHtml({ ...c, type: c.type || type || '' }, opts);
  return `<span class="sct-face sct-mini">${html}</span>`;
}


// The catch screen. kind 'new' (default): the new-card screen, the flight card (or the plane card when there's no route)
// plus the Planes strip. kind 'stamp': the "new stamp" moment for a card you own: the card with its newest stamp
// inking in and, on a level-up, the new level. Takes sky-catch.js collect()'s result. Resolves when it's closed.
/* showCatch / showStamp (the old catch panel's own reveal) are gone (2026-11-19): Space's reveal shows every catch */
