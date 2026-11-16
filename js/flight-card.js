// Sky Collector's flight and plane cards (design: canvas row D "Light Touch, daylight", 2026-11-15): Space Collector's
// card anatomy (gold frame, four stats, Georgia fact, collected footer) in cream with navy ink. The art is the route:
// a dashed arc from the origin airport to the destination. Plane cards show a top-down silhouette until real photos.

import { TIERS } from './flights.js?v=0.1.1580';

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

const tierPill = (tier) => { const T = TIERS[tier] ?? TIERS.common; return `<span class="fc-tier" style="color:${T.color}">${T.mark} ${T.label.toUpperCase()}</span>`; };
const stat = (label, value, unit = '') => `<div class="fc-stat"><span class="fc-stat-l">${label}</span><span class="fc-stat-v">${esc(value)}${unit ? `<small>${unit}</small>` : ''}</span></div>`;

// opts: { caughtAt: Date, heightFt, sightings }
export function flightCardHtml(f, opts = {}) {
  const when = opts.caughtAt ? opts.caughtAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '';
  const air = f.air ? `${f.air.h} h ${String(f.air.m).padStart(2, '0')}` : '—';
  return `<article class="fc fc--flight fc--${f.tier}">
  <div class="fc-in">
    <div class="fc-art fc-art--route">
      ${tierPill(f.tier)}<span class="fc-set">${esc(f.set.toUpperCase())}</span>
      <div class="fc-arc"><div></div></div>
      <span class="fc-dot fc-dot--a"></span><span class="fc-dot fc-dot--b"></span>
      <span class="fc-code fc-code--a">${esc(f.from.iata || f.from.icao)}</span><span class="fc-code fc-code--b">${esc(f.to.iata || f.to.icao)}</span>
    </div>
    <h2 class="fc-name">${esc(f.from.city)} →<br>${esc(f.to.city)}</h2>
    <div class="fc-id"><span>${esc(f.airline)}</span><span class="fc-id-r">FLIGHT ${esc(f.callsign)}</span></div>
    <div class="fc-stats">${stat('DISTANCE', f.kmText, 'km')}${stat('IN THE AIR', air)}${stat('CAUGHT AT', opts.heightFt ? Math.round(opts.heightFt / 100) * 100 >= 1000 ? (Math.round(opts.heightFt / 100) * 100).toLocaleString('en-US') : String(opts.heightFt) : '—', 'ft')}${stat('SEEN', opts.sightings ?? 1, '×')}</div>
    <p class="fc-fact">${rich(f.fact)}</p>
    <div class="fc-foot"><span class="fc-check">✓</span><span class="fc-foot-t">CAUGHT ${when}</span><span class="fc-brand">SKY COLLECTOR</span></div>
  </div>
</article>`;
}

export function planeCardHtml(p, opts = {}) {
  const when = opts.caughtAt ? opts.caughtAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '';
  return `<article class="fc fc--plane fc--${p.tier}">
  <div class="fc-in">
    <div class="fc-art fc-art--plane">${tierPill(p.tier)}<span class="fc-set">PLANES</span>${glyphSvg(p.glyph, 'fc-glyph')}</div>
    <h2 class="fc-name">${esc(p.name)}</h2>
    <div class="fc-id"><span>${esc(p.stamp || 'Aircraft')}</span><span class="fc-id-r">${esc(p.type)}${p.reg ? ` · ${esc(p.reg)}` : ''}</span></div>
    <div class="fc-stats">${stat('CAUGHT AT', opts.heightFt ? (Math.round(opts.heightFt / 100) * 100).toLocaleString('en-US') : '—', 'ft')}${stat('SPEED', opts.speedKmh ?? '—', 'km/h')}${stat('AWAY', opts.awayKm ?? '—', 'km')}${stat('SEEN', opts.sightings ?? 1, '×')}</div>
    <div class="fc-foot"><span class="fc-check">✓</span><span class="fc-foot-t">CAUGHT ${when}</span><span class="fc-brand">SKY COLLECTOR</span></div>
  </div>
</article>`;
}

// The new-card screen: the flight card (or the plane card when there's no route), plus the Planes strip.
// Returns a promise that resolves when it's closed.
export function showCatch({ flight, plane, isNewFlight, isNewPlane, heightFt, speedKmh, awayKm, flightSeen, planeSeen }) {
  const at = new Date();
  const el = document.createElement('section');
  el.className = 'fcatch'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'New card');
  const main = flight ? flightCardHtml(flight, { caughtAt: at, heightFt, sightings: flightSeen }) : planeCardHtml(plane, { caughtAt: at, heightFt, speedKmh, awayKm, sightings: planeSeen });
  const head = flight ? (isNewFlight ? 'NEW FLIGHT' : 'SEEN AGAIN') : (isNewPlane ? 'NEW PLANE' : 'SEEN AGAIN');
  const xp = flight ? (isNewFlight ? 80 : 10) : (isNewPlane ? 60 : 10);
  const strip = flight ? `<div class="fcatch-strip">
      <span class="fcatch-strip-art">${glyphSvg(plane.glyph)}</span>
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
