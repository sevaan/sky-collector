// Sky Collector's flight and plane cards. Design 2026-11-15 ("D · Light Touch, daylight", fidelity pass): Space Collector's
// card anatomy at full richness, printed light. A metal frame by rarity (steel, sage steel, gold, iridescent, animated
// gold foil) around cream card stock with a fine grain and a double inner rule; a recessed photo window with the real
// aircraft (flights: js/airline-photos.js in the airline's livery, else js/type-photos.js; credited on the card); the
// route as a boarding-pass strip under the photo; Russo One
// title, Barlow Condensed labels, a Georgia fact with an orange rule, and a collected footer. Foil and glare follow the
// tilt variables that js/card.js attachTilt writes (--mx/--my/--rx/--ry/--bgx/--bgy/--o/--hyp), read with fallbacks
// so they inherit from whichever ancestor is tilting (the reveal's holder or the card itself).

import { TIERS } from './flights.js?v=0.1.1699';
import { typePhoto } from './type-photos.js?v=0.1.1699';
import { housePhoto } from './house-photos.js?v=0.1.1699';
import { airlinePhoto } from './airline-photos.js?v=0.1.1699';
import { airlineLogo } from './airline-logos.js?v=0.1.1699';
import { fitStyle } from './photo-fit.js?v=0.1.1699';
import { dist, speed } from './units.js?v=0.1.1699';
import { typeFact } from './sky-facts.js?v=0.1.1699';
import { localText } from './localize.js?v=0.1.1699';
import { hasAirlineCallsign, planeLine, levelWord } from './sky-stamps.js?v=0.1.1699';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

export const GLYPHS = {
  jet: '<path d="M32 3c2.2 0 3.4 3 3.4 6.5V24l22.6 12.2v4.3L35.4 34v15.2l7.2 5.6v3.6L32 55.6l-10.6 2.8v-3.6l7.2-5.6V34L6 40.5v-4.3L28.6 24V9.5C28.6 6 29.8 3 32 3z"/>',
  heli: '<ellipse cx="32" cy="27" rx="7" ry="11"/><rect x="30.5" y="36" width="3" height="20" rx="1.5"/><rect x="25" y="53" width="14" height="3" rx="1.5"/><path d="M9 12L55 42M55 12L9 42" fill="none" stroke-width="2.6" stroke-linecap="round"/>',
  prop: '<path d="M30 7h4l1 9v32l7 5v3H22v-3l7-5V16z"/><rect x="4" y="17" width="56" height="7" rx="3"/>',
};
export function glyphSvg(kind = 'jet', cls = '') {
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">${GLYPHS[kind] ?? GLYPHS.jet}</svg>`;
}

const TIER_KEYS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const tierOf = (t) => (TIER_KEYS.includes(t) ? t : 'common');
const tierPill = (tier, cls = 'fc-tier') => { const t = tierOf(tier), T = TIERS[t]; return `<span class="${cls}"><i aria-hidden="true">${T.mark}</i>${T.label.toUpperCase()}</span>`; };
const stat = (label, value, unit = '') => `<div class="fc-stat"><span class="fc-stat-l">${label}</span><span class="fc-stat-v">${esc(value)}${unit ? `<small>${unit}</small>` : ''}</span></div>`;
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
  return housePhoto(t) || (HOUSE_NEAR[t] && housePhoto(HOUSE_NEAR[t])) || (AIRLINE_TYPE_PHOTO.has(t) ? null : typePhoto(t));
}
// A flight's photo: that type in the airline's own livery (js/airline-photos.js) when we have one, else the type photo.
// The airline is the callsign's ICAO prefix (older saved catches only carry it in the key, F:ACA:CYYZ-KLAX).
const airlineIcao = (f) => f?.airlineIcao || (/^F:([A-Z]{3}):/.exec(f?.key || '') || [])[1] || (f?.callsign || '').slice(0, 3);
// The airline's logo beside its name (2026-11-15, Sevaan: "the cards need the airline logos too"). Logos only identify the
// airline: they sit next to its name and nowhere else, come from Wikimedia Commons in the public domain (js/airline-logos.js,
// scripts/logos/), and Settings → Airline logos hides them all (localStorage 'skyLogos' = 'off').
const logosOn = () => { try { return localStorage.getItem('skyLogos') !== 'off'; } catch { return true; } };
// The airline as its logo when we have one (the logo is the name: a wordmark next to the same name read twice), else its name.
function airlineMark(f, cls) {
  const lg = logosOn() ? airlineLogo(airlineIcao(f)) : null;
  return lg ? `<img class="${cls}" src="${esc(lg.url)}" alt="${esc(f.airline)}" title="${esc(f.airline)}" width="${lg.w}" height="${lg.h}" decoding="async" draggable="false">` : `<span>${esc(f.airline)}</span>`;
}
/* An airline's family (2026-11-15, Sevaan: an Alaska 737 MAX on an Air Canada Rouge card): brands and regional carriers that
   fly in, or alongside, their parent's paint. When we have no photo of that type in the flight's own livery, the parent's is
   the next best thing; only carriers that fly for ONE brand are listed (SkyWest and Republic fly for several, so not them). */
const FAMILY = {
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
// No photo: a daylight sky panel with soft cloud banks and the silhouette crossing it.
const skyPanel = (glyph, cls, mark = '') => `<span class="${cls}" aria-hidden="true"><span class="fc-cloud fc-cloud--a"></span><span class="fc-cloud fc-cloud--b"></span>${mark ? `<span class="fc-sky-ring"></span><span class="fc-sky-mark">${esc(mark)}</span>` : ''}${glyphSvg(glyph, 'fc-glyph')}</span>`;

// The route as a boarding-pass strip: origin code and city, a dashed great-circle arc with a plane on it, destination.
function routeStrip(f, typeName) {
  return `<div class="fc-route" aria-hidden="true">
      <span class="fc-route-end"><b>${esc(code(f.from))}</b><small>${esc(f.from.city)}</small></span>
      <span class="fc-route-mid"><svg viewBox="0 0 120 26" preserveAspectRatio="none"><path class="fc-route-arc" d="M4 22 Q60 -6 116 22"/><circle cx="4" cy="22" r="3.2" class="fc-route-a"/><circle cx="116" cy="22" r="3.2" class="fc-route-b"/></svg>
        <svg class="fc-route-plane" viewBox="0 0 64 64">${GLYPHS.jet}</svg>${typeName ? `<small>${esc(typeName)}</small>` : ''}</span>
      <span class="fc-route-end fc-route-end--b"><b>${esc(code(f.to))}</b><small>${esc(f.to.city)}</small></span>
    </div>`;
}

// Layers over the printed face: foil (rarity), gloss, glare under the finger.
const layers = '<span class="fc-foil" aria-hidden="true"></span><span class="fc-coat" aria-hidden="true"></span><span class="fc-glare" aria-hidden="true"></span>';

function shell(kind, tier, inner, label, level = 'none') {
  const t = tierOf(tier);
  return `<article class="fc fc--${kind} fc--${t}${['rare', 'epic', 'legendary'].includes(t) ? ' fc--gilt' : ''}${level && level !== 'none' ? ` fc--lvl fc--lvl-${level}` : ''}" style="--tier:${TIERS[t].color}" aria-label="${esc(label)}">
  <div class="fc-rot"><div class="fc-face"><div class="fc-in">${inner}</div></div>${layers}</div>
</article>`;
}

function footer(caughtAt, right) {
  const time = caughtAt ? caughtAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase() : '';
  return `<div class="fc-foot"><span class="fc-check" aria-hidden="true">✓</span><span class="fc-foot-t">CAUGHT · ${dateLong(caughtAt)}</span><span class="fc-foot-n">${time}</span>
      <span class="fc-brand"><small>${esc(right)}</small>SKY COLLECTOR</span></div>`;
}

// ---- Stamps (js/sky-stamps.js): the passport row under the stats, and the level chip ----
const levelChip = (level, cls = 'fc-lvl') => (level && level !== 'none' ? `<span class="${cls} ${cls}--${level}">${levelWord(level)}</span>` : '');
const MAX_INK = 6;
const inkFlight = (s, fresh) => { const d = new Date(s.time); return `<span class="fc-ink${fresh ? ' fc-ink--new' : ''}" title="${esc(dateLong(d))}"><b>${esc(dateShort(d))}</b><small>${d.getFullYear()}</small></span>`; };
const inkPlane = (s, fresh) => `<span class="fc-ink${fresh ? ' fc-ink--new' : ''}" title="${esc(String(s.hex).toUpperCase())}"><b>${esc(s.airline || '—')}</b><small>${esc(String(s.hex).slice(-4).toUpperCase())}</small></span>`;
// info: flightStampInfo / planeStampInfo. newest = animate the latest stamp in (a re-catch).
function passport(info, { newest = false } = {}) {
  if (!info?.count) return '';
  const plane = info.kind === 'plane', shown = info.stamps.slice(-MAX_INK), more = info.count - shown.length;
  const head = plane ? `${info.count} AIRCRAFT${info.liveryCount ? ` · ${info.liveryCount} LIVER${info.liveryCount === 1 ? 'Y' : 'IES'}` : ''}` : `${info.count} DAY${info.count === 1 ? '' : 'S'}`;
  return `<div class="fc-pass" aria-label="${esc(`${info.count} stamps, ${info.level}`)}"><div class="fc-pass-h"><span class="fc-pass-k">STAMPS · ${head}</span>${levelChip(info.level)}</div>
      <div class="fc-pass-row">${more > 0 ? `<span class="fc-ink fc-ink--more"><b>+${more}</b></span>` : ''}${shown.map((x, i) => (plane ? inkPlane : inkFlight)(x, newest && i === shown.length - 1)).join('')}</div></div>`;
}
export const passportHtml = passport;

// opts: { caughtAt: Date, heightFt, sightings, type (ICAO, for older catches), planeName, eager, stampInfo (flightStampInfo), newStamp }
export function flightCardHtml(f, opts = {}) {
  const type = f.type || opts.type || '', ph = flightPhotoFor(f, type), typeName = f.typeName || opts.planeName || '';
  const air = !f.air ? '—' : f.air.h ? `${f.air.h} h ${String(f.air.m).padStart(2, '0')}` : `${f.air.m} min`;
  const long = Math.max(f.from.city.length, f.to.city.length) > 11;
  const art = ph ? `${photoImg(ph, 'fc-photo', opts.eager, opts.small)}${credit(ph)}` : skyPanel('jet', 'fc-sky', type);
  const inner = `
    <div class="fc-art${ph ? '' : ' fc-art--sky'}">
      <div class="fc-pic">${art}<span class="fc-holo" aria-hidden="true"></span>${tierPill(f.tier)}<span class="fc-set">${esc(String(f.setName ?? f.set ?? '').toUpperCase())}</span></div>
      ${routeStrip(f, typeName)}
    </div>
    <h2 class="fc-name${long ? ' fc-name--long' : ''}"><span>${esc(f.from.city)} <i aria-label="to">→</i></span><span>${esc(f.to.city)}</span></h2>
    <div class="fc-id"><span class="fc-id-l">${airlineMark(f, 'fc-logo')}</span><span class="fc-id-r">FLIGHT ${esc(f.callsign || '—')}</span></div>
    <div class="fc-stats">${stat('DISTANCE', dist(f.km ?? null).v, dist(f.km ?? null).u)}${stat('IN THE AIR', air)}${stat('CAUGHT AT', feet(opts.heightFt), 'ft')}${stat('SEEN', opts.sightings ?? 1, '×')}</div>
    ${passport(opts.stampInfo, { newest: opts.newStamp })}
    <p class="fc-fact">${rich(localText(f.fact))}</p>
    ${footer(opts.caughtAt, type ? `TYPE ${type}` : 'FLIGHTS')}`;
  return shell('flight', f.tier, inner, `${f.from.city} to ${f.to.city}, ${f.airline}, ${TIERS[tierOf(f.tier)].label}${opts.stampInfo?.level && opts.stampInfo.level !== 'none' ? `, ${opts.stampInfo.level} level` : ''}`, opts.stampInfo?.level);
}

/* A checked fact for the type first (js/sky-facts.js, 2026-11-17: 131 types, sources in docs/FACTS-SOURCES.md) */
const planeFact = (p) => p.fact || typeFact(p.type || (/^P:(.+)$/.exec(p.key ?? '') || [])[1]) || (p.glyph === 'heli' ? 'Helicopters fly low and slow, so they’re among the hardest things in the sky to catch twice.'
  : p.glyph === 'prop' ? 'Propeller planes cruise lower and slower than jets, which makes them easier to spot and to hear.'
    : 'Every different aircraft of this type you catch adds a **stamp** to this card, and every airline it flies for is another livery.');

// opts: { caughtAt, heightFt, speedKmh, awayKm, sightings, stampInfo (planeStampInfo), newStamp, callsign (the registration is hidden unless it's an airline's), eager }
export function planeCardHtml(p, opts = {}) {
  const ph = photoFor(p.type), long = (p.name || '').length > 16;
  const art = ph ? `${photoImg(ph, 'fc-photo', opts.eager, opts.small)}${credit(ph)}` : skyPanel(p.glyph, 'fc-sky fc-sky--big', p.type);
  const si = opts.stampInfo, stamps = si?.count ?? opts.stamps ?? (p.stamp ? 1 : 0);
  const showReg = p.reg && hasAirlineCallsign(opts.callsign ?? p.callsign);
  const inner = `
    <div class="fc-art fc-art--plane${ph ? '' : ' fc-art--sky'}">
      <div class="fc-pic">${art}<span class="fc-holo" aria-hidden="true"></span>${tierPill(p.tier)}<span class="fc-set">${esc(String(p.setName ?? p.set ?? 'Planes').toUpperCase())}</span>${opts.rareHere ? '<span class="fc-here" title="Unusual where you caught it">RARE HERE</span>' : ''}</div>
    </div>
    <h2 class="fc-name${long ? ' fc-name--long' : ''}"><span>${esc(p.name)}</span></h2>
    <div class="fc-id"><span class="fc-id-l">${esc(si?.count ? planeLine(si, p.type || '') : p.stamp ? `${p.stamp}${stamps > 1 ? ` + ${stamps - 1} more` : ''}` : p.glyph === 'heli' ? 'Helicopter' : 'Aircraft')}</span><span class="fc-id-r">${esc(p.type || '—')}${showReg ? ` · ${esc(p.reg)}` : ''}</span></div>
    <div class="fc-stats">${stat('CAUGHT AT', feet(opts.heightFt), 'ft')}${stat('SPEED', speed(opts.speedKmh ?? null).v, speed(0).u)}${stat('AWAY', dist(opts.awayKm ?? null).v, dist(0).u)}${stat('STAMPS', stamps)}</div>
    ${passport(si, { newest: opts.newStamp })}
    <p class="fc-fact">${rich(localText(planeFact(p)))}</p>
    ${footer(opts.caughtAt, p.type ? `TYPE ${p.type}` : 'PLANES')}`;
  return shell('plane', p.tier, inner, `${p.name}, ${TIERS[tierOf(p.tier)].label}${si?.level && si.level !== 'none' ? `, ${si.level} level` : ''}`, si?.level);
}

// A small card for the Collection grid: the same frame, photo, rarity, title, identity, two stats and footer, laid out
// for ~110 px. e: { kind, card, type, last (ms), n (times seen), stamps (count), stampInfo }. Returns the inner markup; the caller
// wraps it in its button.
export function miniCardHtml({ kind, card: c, type, last, n = 1, stamps = 0, stampInfo = null }) {
  const t = tierOf(c.tier), ty = c.type || type || '', ph = kind === 'flight' ? flightPhotoFor(c, ty) : photoFor(ty);
  const glyph = kind === 'plane' ? c.glyph : 'jet';
  const pic = ph ? photoImg(ph, 'sct-photo', false, true) : skyPanel(glyph, 'fc-sky sct-sky');
  const gem = `<span class="sct-tier"><i aria-hidden="true">${TIERS[t].mark}</i>${TIERS[t].label.toUpperCase()}</span>`;
  const lvl = stampInfo?.level && stampInfo.level !== 'none' ? stampInfo.level : '';
  const medal = lvl ? `<span class="sct-lvl sct-lvl--${lvl}" title="${lvl} · ${stampInfo.count} stamps"><i>${stampInfo.count}</i><em>${lvl.toUpperCase()}</em></span>` : '';
  const when = last ? `<span class="sct-foot"><span>✓ ${dateShort(new Date(last))}</span><span>${n}×</span></span>` : '<span class="sct-foot"><span>NOT YET COLLECTED</span></span>'; /* the target ticket shows a card you don't have yet */
  if (kind === 'flight') {
    const air = !c.air ? '—' : c.air.h ? `${c.air.h}h${String(c.air.m).padStart(2, '0')}` : `${c.air.m} min`;
    return `<span class="sct-face sct--${t}${lvl ? ` sct-face--lvl sct-face--${lvl}` : ''}" style="--tier:${TIERS[t].color}"><span class="sct-in">
      <span class="sct-art${ph ? '' : ' sct-art--sky'}">${pic}${gem}${medal}<span class="sct-route"><b>${esc(code(c.from))}</b><svg viewBox="0 0 40 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 9 Q20 -3 38 9"/></svg><b>${esc(code(c.to))}</b></span></span>
      <span class="sct-name">${esc(c.to.city)}</span>
      <span class="sct-sub">${kind === 'flight' ? airlineMark(c, 'sct-logo') : `<span>${esc(c.airline)}</span>`}</span>
      <span class="sct-stats"><span><small>${dist(0).u.toUpperCase()}</small>${esc(dist(c.km ?? null).v)}</span><span><small>AIR</small>${air}</span></span>
      ${when}</span><span class="sct-shine" aria-hidden="true"></span></span>`;
  }
  return `<span class="sct-face sct--${t}${lvl ? ` sct-face--lvl sct-face--${lvl}` : ''}" style="--tier:${TIERS[t].color}"><span class="sct-in">
    <span class="sct-art${ph ? '' : ' sct-art--sky'}">${pic}${gem}${medal}</span>
    <span class="sct-name">${esc(c.name)}</span>
    <span class="sct-sub">${stampInfo?.count ? esc(`${stampInfo.count} aircraft${stampInfo.liveryCount ? ` · ${stampInfo.liveryCount} liver${stampInfo.liveryCount === 1 ? 'y' : 'ies'}` : ''}`) : esc(c.glyph === 'heli' ? 'Helicopter' : 'Aircraft')}</span>
    <span class="sct-stats"><span><small>TYPE</small>${esc(c.type || '—')}</span><span><small>STAMPS</small>${stampInfo?.count ?? stamps}</span></span>
    ${when}</span><span class="sct-shine" aria-hidden="true"></span></span>`;
}

// The catch screen. kind 'new' (default): the new-card screen, the flight card (or the plane card when there's no route)
// plus the Planes strip. kind 'stamp': the "new stamp" moment for a card you own: the card with its newest stamp
// inking in and, on a level-up, the new level. Takes sky-catch.js collect()'s result. Resolves when it's closed.
export function showCatch(r) {
  const { flight, plane, isNewFlight, isNewPlane, heightFt, speedKmh, awayKm, flightSeen, planeSeen, kind = 'new', stampOn = 'flight',
    level, levelUp, stampCount, flightStampInfo: fInfo = null, planeStampInfo: pInfo = null, callsign } = r;
  const at = new Date(), stamp = kind === 'stamp', onPlane = stamp && (stampOn === 'plane' || !flight);
  const el = document.createElement('section');
  el.className = `fcatch${stamp ? ' fcatch--stamp' : ''}`; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', stamp ? 'New stamp' : 'New card');
  const asFlight = flight && !onPlane;
  const main = asFlight ? flightCardHtml(flight, { caughtAt: at, heightFt, sightings: flightSeen, type: plane?.type, planeName: plane?.name, eager: true, stampInfo: fInfo, newStamp: stamp })
    : planeCardHtml(plane, { caughtAt: at, heightFt, speedKmh, awayKm, sightings: planeSeen, eager: true, stampInfo: pInfo, newStamp: stamp, callsign });
  const noun = asFlight ? 'DAY' : 'AIRCRAFT';
  const head = stamp ? `NEW STAMP <span>· ${noun} ${stampCount}${levelUp ? ` · ${String(level).toUpperCase()}!` : ''}</span>`
    : `${flight ? (isNewFlight ? 'NEW FLIGHT' : 'SEEN AGAIN') : (isNewPlane ? 'NEW PLANE' : 'SEEN AGAIN')} <span>· +${flight ? (isNewFlight ? 80 : 10) : (isNewPlane ? 60 : 10)} XP</span>`;
  const ph = photoFor(plane?.type);
  const planeNote = flight && !onPlane ? (isNewPlane ? 'NEW PLANE' : r.planeStamps?.gained ? `STAMP ${r.planeStamps.count}${r.planeStamps.levelUp ? ` · ${String(r.planeStamps.level).toUpperCase()}!` : ''}` : `SEEN ${planeSeen}×`) : '';
  const strip = flight && !onPlane ? `<div class="fcatch-strip">
      <span class="fcatch-strip-art${ph ? ' has-photo' : ''}">${ph ? `<img src="${esc(ph.url)}" alt="">` : glyphSvg(plane.glyph)}</span>
      <span class="fcatch-strip-t"><span class="fcatch-strip-k">+ PLANES · ${planeNote}</span>
      <span class="fcatch-strip-n">${esc(plane.name)}</span></span></div>` : '';
  el.innerHTML = `<div class="fcatch-top"><span class="fcatch-k">${head}</span>
      <button class="fcatch-x" type="button" aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="fcatch-card">${main}</div>${strip}
    <button class="fcatch-done" type="button">KEEP SPOTTING</button>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  return new Promise((resolve) => {
    const close = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 250); resolve(); };
    el.querySelector('.fcatch-x').addEventListener('click', close);
    el.querySelector('.fcatch-done').addEventListener('click', close);
  });
}
// The same screen by its other name, for callers that only ever show a stamp.
export const showStamp = (r) => showCatch({ ...r, kind: 'stamp' });
