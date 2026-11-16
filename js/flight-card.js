// Sky Collector's flight and plane cards. Design 2026-11-15 ("D · Light Touch, daylight", fidelity pass): Space Collector's
// card anatomy at full richness, printed light. A metal frame by rarity (steel, sage steel, gold, iridescent, animated
// gold foil) around cream card stock with a fine grain and a double inner rule; a recessed photo window with the real
// aircraft (flights: js/airline-photos.js in the airline's livery, else js/type-photos.js; credited on the card); the
// route as a boarding-pass strip under the photo; Russo One
// title, Barlow Condensed labels, a Georgia fact with an orange rule, and a collected footer. Foil and glare follow the
// tilt variables that js/card.js attachTilt writes (--mx/--my/--rx/--ry/--bgx/--bgy/--o/--hyp), read with fallbacks
// so they inherit from whichever ancestor is tilting (the reveal's holder or the card itself).

import { TIERS } from './flights.js?v=0.1.1608';
import { typePhoto } from './type-photos.js?v=0.1.1608';
import { airlinePhoto } from './airline-photos.js?v=0.1.1608';

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
export function photoFor(type) { return type ? typePhoto(String(type).toUpperCase()) : null; }
// A flight's photo: that type in the airline's own livery (js/airline-photos.js) when we have one, else the type photo.
// The airline is the callsign's ICAO prefix (older saved catches only carry it in the key, F:ACA:CYYZ-KLAX).
const airlineIcao = (f) => f?.airlineIcao || (/^F:([A-Z]{3}):/.exec(f?.key || '') || [])[1] || (f?.callsign || '').slice(0, 3);
export function flightPhotoFor(f, type) { return (type && airlinePhoto(airlineIcao(f), type)) || photoFor(type); }
const credit = (ph) => `<span class="fc-credit">Photo: ${esc(ph.credit)}, ${esc(ph.licence)}</span>`;
const photoImg = (ph, cls, eager) => `<img class="${cls}" src="${esc(ph.url)}" alt="" ${eager ? '' : 'loading="lazy" '}decoding="async" draggable="false">`;
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

function shell(kind, tier, inner, label) {
  const t = tierOf(tier);
  return `<article class="fc fc--${kind} fc--${t}${['rare', 'epic', 'legendary'].includes(t) ? ' fc--gilt' : ''}" style="--tier:${TIERS[t].color}" aria-label="${esc(label)}">
  <div class="fc-rot"><div class="fc-face"><div class="fc-in">${inner}</div></div>${layers}</div>
</article>`;
}

function footer(caughtAt, right) {
  const time = caughtAt ? caughtAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase() : '';
  return `<div class="fc-foot"><span class="fc-check" aria-hidden="true">✓</span><span class="fc-foot-t">CAUGHT · ${dateLong(caughtAt)}</span><span class="fc-foot-n">${time}</span>
      <span class="fc-brand"><small>${esc(right)}</small>SKY COLLECTOR</span></div>`;
}

// opts: { caughtAt: Date, heightFt, sightings, type (ICAO, for older catches), planeName, eager }
export function flightCardHtml(f, opts = {}) {
  const type = f.type || opts.type || '', ph = flightPhotoFor(f, type), typeName = f.typeName || opts.planeName || '';
  const air = !f.air ? '—' : f.air.h ? `${f.air.h} h ${String(f.air.m).padStart(2, '0')}` : `${f.air.m} min`;
  const long = Math.max(f.from.city.length, f.to.city.length) > 11;
  const art = ph ? `${photoImg(ph, 'fc-photo', opts.eager)}${credit(ph)}` : skyPanel('jet', 'fc-sky', type);
  const inner = `
    <div class="fc-art${ph ? '' : ' fc-art--sky'}">
      <div class="fc-pic">${art}<span class="fc-holo" aria-hidden="true"></span>${tierPill(f.tier)}<span class="fc-set">${esc(f.set.toUpperCase())}</span></div>
      ${routeStrip(f, typeName)}
    </div>
    <h2 class="fc-name${long ? ' fc-name--long' : ''}"><span>${esc(f.from.city)} <i aria-label="to">→</i></span><span>${esc(f.to.city)}</span></h2>
    <div class="fc-id"><span class="fc-id-l">${esc(f.airline)}</span><span class="fc-id-r">FLIGHT ${esc(f.callsign || '—')}</span></div>
    <div class="fc-stats">${stat('DISTANCE', f.kmText, 'km')}${stat('IN THE AIR', air)}${stat('CAUGHT AT', feet(opts.heightFt), 'ft')}${stat('SEEN', opts.sightings ?? 1, '×')}</div>
    <p class="fc-fact">${rich(f.fact)}</p>
    ${footer(opts.caughtAt, type ? `TYPE ${type}` : 'FLIGHTS')}`;
  return shell('flight', f.tier, inner, `${f.from.city} to ${f.to.city}, ${f.airline}, ${TIERS[tierOf(f.tier)].label}`);
}

const planeFact = (p) => p.fact || (p.glyph === 'heli' ? 'Helicopters fly low and slow, so they’re among the hardest things in the sky to catch twice.'
  : p.glyph === 'prop' ? 'Propeller planes cruise lower and slower than jets, which makes them easier to spot and to hear.'
    : 'Every airline that flies this type past you adds a **stamp** to this card.');

// opts: { caughtAt, heightFt, speedKmh, awayKm, sightings, stamps (count), eager }
export function planeCardHtml(p, opts = {}) {
  const ph = photoFor(p.type), long = (p.name || '').length > 16;
  const art = ph ? `${photoImg(ph, 'fc-photo', opts.eager)}${credit(ph)}` : skyPanel(p.glyph, 'fc-sky fc-sky--big', p.type);
  const stamps = opts.stamps ?? (p.stamp ? 1 : 0);
  const inner = `
    <div class="fc-art fc-art--plane${ph ? '' : ' fc-art--sky'}">
      <div class="fc-pic">${art}<span class="fc-holo" aria-hidden="true"></span>${tierPill(p.tier)}<span class="fc-set">PLANES</span></div>
    </div>
    <h2 class="fc-name${long ? ' fc-name--long' : ''}"><span>${esc(p.name)}</span></h2>
    <div class="fc-id"><span class="fc-id-l">${esc(p.stamp ? `${p.stamp}${stamps > 1 ? ` + ${stamps - 1} more` : ''}` : p.glyph === 'heli' ? 'Helicopter' : 'Aircraft')}</span><span class="fc-id-r">${esc(p.type || '—')}${p.reg ? ` · ${esc(p.reg)}` : ''}</span></div>
    <div class="fc-stats">${stat('CAUGHT AT', feet(opts.heightFt), 'ft')}${stat('SPEED', opts.speedKmh ?? '—', 'km/h')}${stat('AWAY', opts.awayKm ?? '—', 'km')}${stat('STAMPS', stamps)}</div>
    <p class="fc-fact">${rich(planeFact(p))}</p>
    ${footer(opts.caughtAt, p.type ? `TYPE ${p.type}` : 'PLANES')}`;
  return shell('plane', p.tier, inner, `${p.name}, ${TIERS[tierOf(p.tier)].label}`);
}

// A small card for the Collection grid: the same frame, photo, rarity, title, identity, two stats and footer, laid out
// for ~110 px. e: { kind, card, type, last (ms), n (times seen), stamps (count) }. Returns the inner markup; the caller
// wraps it in its button.
export function miniCardHtml({ kind, card: c, type, last, n = 1, stamps = 0 }) {
  const t = tierOf(c.tier), ty = c.type || type || '', ph = kind === 'flight' ? flightPhotoFor(c, ty) : photoFor(ty);
  const glyph = kind === 'plane' ? c.glyph : 'jet';
  const pic = ph ? photoImg(ph, 'sct-photo') : skyPanel(glyph, 'fc-sky sct-sky');
  const gem = `<span class="sct-tier"><i aria-hidden="true">${TIERS[t].mark}</i>${TIERS[t].label.toUpperCase()}</span>`;
  const when = `<span class="sct-foot"><span>✓ ${dateShort(new Date(last))}</span><span>${n}×</span></span>`;
  if (kind === 'flight') {
    const air = !c.air ? '—' : c.air.h ? `${c.air.h}h${String(c.air.m).padStart(2, '0')}` : `${c.air.m} min`;
    return `<span class="sct-face sct--${t}" style="--tier:${TIERS[t].color}"><span class="sct-in">
      <span class="sct-art${ph ? '' : ' sct-art--sky'}">${pic}${gem}<span class="sct-route"><b>${esc(code(c.from))}</b><svg viewBox="0 0 40 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 9 Q20 -3 38 9"/></svg><b>${esc(code(c.to))}</b></span></span>
      <span class="sct-name">${esc(c.to.city)}</span>
      <span class="sct-sub">${esc(c.airline)}</span>
      <span class="sct-stats"><span><small>KM</small>${esc(c.kmText)}</span><span><small>AIR</small>${air}</span></span>
      ${when}</span><span class="sct-shine" aria-hidden="true"></span></span>`;
  }
  return `<span class="sct-face sct--${t}" style="--tier:${TIERS[t].color}"><span class="sct-in">
    <span class="sct-art${ph ? '' : ' sct-art--sky'}">${pic}${gem}</span>
    <span class="sct-name">${esc(c.name)}</span>
    <span class="sct-sub">${stamps ? `${stamps} airline${stamps === 1 ? '' : 's'}` : esc(c.glyph === 'heli' ? 'Helicopter' : 'Aircraft')}</span>
    <span class="sct-stats"><span><small>TYPE</small>${esc(c.type || '—')}</span><span><small>STAMPS</small>${stamps}</span></span>
    ${when}</span><span class="sct-shine" aria-hidden="true"></span></span>`;
}

// The new-card screen: the flight card (or the plane card when there's no route), plus the Planes strip.
// Returns a promise that resolves when it's closed.
export function showCatch({ flight, plane, isNewFlight, isNewPlane, heightFt, speedKmh, awayKm, flightSeen, planeSeen }) {
  const at = new Date();
  const el = document.createElement('section');
  el.className = 'fcatch'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'New card');
  const main = flight ? flightCardHtml(flight, { caughtAt: at, heightFt, sightings: flightSeen, type: plane?.type, planeName: plane?.name, eager: true })
    : planeCardHtml(plane, { caughtAt: at, heightFt, speedKmh, awayKm, sightings: planeSeen, eager: true });
  const head = flight ? (isNewFlight ? 'NEW FLIGHT' : 'SEEN AGAIN') : (isNewPlane ? 'NEW PLANE' : 'SEEN AGAIN');
  const xp = flight ? (isNewFlight ? 80 : 10) : (isNewPlane ? 60 : 10);
  const ph = photoFor(plane?.type);
  const strip = flight ? `<div class="fcatch-strip">
      <span class="fcatch-strip-art${ph ? ' has-photo' : ''}">${ph ? `<img src="${esc(ph.url)}" alt="">` : glyphSvg(plane.glyph)}</span>
      <span class="fcatch-strip-t"><span class="fcatch-strip-k">+ PLANES · ${isNewPlane ? 'NEW PLANE' : plane.stamp ? `${esc(plane.stamp.toUpperCase())} STAMP` : `SEEN ${planeSeen}×`}</span>
      <span class="fcatch-strip-n">${esc(plane.name)}</span></span></div>` : '';
  el.innerHTML = `<div class="fcatch-top"><span class="fcatch-k">${head} <span>· +${xp} XP</span></span>
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
