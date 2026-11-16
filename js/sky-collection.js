// Sky Collector's Collection (2026-11-15): two tabs, Flights and Planes, built from the catches kept on the phone
// (localStorage 'skyCatches', written by js/sky-catch.js). Runs inside cards.html and takes over its main area; Space
// Collector's satellite grid stays in the page, hidden. Design: canvas row D (cream mini cards, gold frames for Rare+).

import { flightCardHtml, planeCardHtml, glyphSvg } from './flight-card.js?v=0.1.1586';
import { TIERS } from './flights.js?v=0.1.1586';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TIER_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const day = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
const when = (t) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function load() { try { return JSON.parse(localStorage.getItem('skyCatches') || '[]'); } catch { return []; } }

// Catches -> one entry per flight card and one per plane card, newest first.
function build(list) {
  const flights = new Map(), planes = new Map();
  for (const c of list) {
    if (c.flight) {
      const f = flights.get(c.flight.key) ?? { kind: 'flight', key: c.flight.key, card: c.flight, seen: [] };
      f.seen.push(c); flights.set(f.key, f);
    }
    if (c.plane) {
      const p = planes.get(c.plane.key) ?? { kind: 'plane', key: c.plane.key, card: c.plane, seen: [], stamps: new Set() };
      p.seen.push(c); if (c.airline) p.stamps.add(c.airline); planes.set(p.key, p);
    }
  }
  const order = (a, b) => b.seen.at(-1).time - a.seen.at(-1).time;
  return { flights: [...flights.values()].sort(order), planes: [...planes.values()].sort(order) };
}

const state = { tab: 'flights', filter: 'all', open: null };
const FLIGHT_SETS = ['Across Canada', 'North America', 'Across the Atlantic', 'Sun Destinations', 'Around the World', 'Cargo'];
const planeGroup = (e) => (e.card.glyph === 'heli' ? 'Helicopters' : e.card.glyph === 'prop' ? 'Propellers' : 'Jets');

function tierFrame(tier) { return ['rare', 'epic', 'legendary'].includes(tier) ? 'gold' : 'steel'; }
function tierPill(tier) { const T = TIERS[tier] ?? TIERS.common; return `<span class="sct-tier" style="color:${T.color}">${T.mark} ${T.label.toUpperCase()}</span>`; }

function tile(e) {
  const c = e.card, last = e.seen.at(-1).time, n = e.seen.length;
  if (e.kind === 'flight') {
    return `<button type="button" class="sct sct--${tierFrame(c.tier)}" data-key="${esc(e.key)}" aria-label="${esc(`${c.from.city} to ${c.to.city}, ${c.airline}`)}"><span class="sct-in">
      <span class="sct-art sct-art--route">${tierPill(c.tier)}<span class="sct-arc"><span></span></span><span class="sct-dot sct-dot--a"></span><span class="sct-dot sct-dot--b"></span><span class="sct-code">${esc(c.to.iata || c.to.icao)}</span></span>
      <span class="sct-name">${esc(c.to.city)}</span>
      <span class="sct-sub">${esc(c.airline)}</span>
      <span class="sct-row"><span>${esc(c.from.iata || c.from.icao)} → ${esc(c.to.iata || c.to.icao)}</span><span>${esc(c.kmText)} km</span></span>
      <span class="sct-when">✓ ${day(last)}${n > 1 ? ` · ${n}×` : ''}</span></span></button>`;
  }
  return `<button type="button" class="sct sct--${tierFrame(c.tier)}" data-key="${esc(e.key)}" aria-label="${esc(c.name)}"><span class="sct-in">
    <span class="sct-art sct-art--plane">${tierPill(c.tier)}${glyphSvg(c.glyph, 'sct-glyph')}</span>
    <span class="sct-name">${esc(c.name)}</span>
    <span class="sct-sub">${e.stamps.size ? `${e.stamps.size} airline${e.stamps.size === 1 ? '' : 's'}` : esc(c.type || 'Aircraft')}</span>
    <span class="sct-row"><span>${esc(c.type)}</span><span>${n}×</span></span>
    <span class="sct-when">✓ ${day(last)}</span></span></button>`;
}

function render() {
  const root = $('sky-col'); if (!root) return;
  const { flights, planes } = build(load());
  const all = state.tab === 'flights' ? flights : planes;
  const groups = state.tab === 'flights' ? FLIGHT_SETS.map((s) => [s, all.filter((e) => e.card.set === s).length]).filter(([, n]) => n)
    : ['Jets', 'Propellers', 'Helicopters'].map((g) => [g, all.filter((e) => planeGroup(e) === g).length]).filter(([, n]) => n);
  if (state.filter !== 'all' && !groups.some(([g]) => g === state.filter)) state.filter = 'all';
  const shown = state.filter === 'all' ? all : all.filter((e) => (state.tab === 'flights' ? e.card.set : planeGroup(e)) === state.filter);
  const total = flights.length + planes.length;
  root.innerHTML = `
    <div class="scc-intro"><p class="eyebrow">YOUR SKY LOG</p><h1>Everything that’s<br>flown over you.</h1>
      <p>${total ? `${flights.length} flight${flights.length === 1 ? '' : 's'} and ${planes.length} plane${planes.length === 1 ? '' : 's'} caught.` : 'Point your phone at a plane and tap Collect.'}</p></div>
    <div class="scc-tabs" role="tablist" aria-label="Collection">
      <button type="button" role="tab" aria-selected="${state.tab === 'flights'}" data-tab="flights">Flights <span>${flights.length}</span></button>
      <button type="button" role="tab" aria-selected="${state.tab === 'planes'}" data-tab="planes">Planes <span>${planes.length}</span></button>
    </div>
    ${groups.length > 1 ? `<div class="scc-chips">${[['all', all.length], ...groups].map(([g, n]) => `<button type="button" class="scc-chip" aria-pressed="${state.filter === g}" data-filter="${esc(g)}">${g === 'all' ? 'All' : esc(g)} ${n}</button>`).join('')}</div>` : ''}
    ${shown.length ? `<div class="scc-grid">${shown.map(tile).join('')}</div>`
      : `<div class="scc-empty"><h2>Your first ${state.tab === 'flights' ? 'flight' : 'plane'} is up there.</h2><p>${state.tab === 'flights' ? 'Catch a plane on a scheduled route and its flight lands here: the airline and where it’s going.' : 'Every catch adds its plane here, from airliners to helicopters and airships.'}</p><a href="./?resume=1">Explore the sky ↗</a></div>`}`;
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; state.filter = 'all'; render(); }));
  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.filter; render(); }));
  root.querySelectorAll('.sct').forEach((b) => b.addEventListener('click', () => openCard(all.find((e) => e.key === b.dataset.key))));
}

// The card up close, with every time you saw it.
function openCard(e) {
  if (!e) return;
  const last = e.seen.at(-1), dlg = $('sky-viewer');
  const html = e.kind === 'flight'
    ? flightCardHtml(e.card, { caughtAt: new Date(e.seen[0].time), heightFt: last.altFt, sightings: e.seen.length })
    : planeCardHtml(e.card, { caughtAt: new Date(e.seen[0].time), heightFt: last.altFt, speedKmh: Math.round((last.gsKt ?? 0) * 1.852), awayKm: Math.round(last.rangeKm ?? 0), sightings: e.seen.length });
  const rows = [...e.seen].reverse().slice(0, 30).map((s) => `<li><span>${esc(when(s.time))}</span><span>${esc([s.callsign, s.reg, s.altFt ? `${Math.round(s.altFt / 100) * 100} ft` : ''].filter(Boolean).join(' · '))}</span></li>`).join('');
  const stamps = e.kind === 'plane' && e.stamps.size ? `<p class="scv-k">AIRLINE STAMPS · ${e.stamps.size}</p><p class="scv-stamps">${[...e.stamps].map((a) => `<span>${esc(a)}</span>`).join('')}</p>` : '';
  dlg.querySelector('.scv-body').innerHTML = `<div class="scv-card">${html}</div>${stamps}<p class="scv-k">WHEN YOU SAW IT · ${e.seen.length} ${e.seen.length === 1 ? 'TIME' : 'TIMES'}</p><ul class="scv-list">${rows}</ul>`;
  if (!dlg.open) dlg.showModal();
}

function init() {
  if (!$('sky-col')) return;
  document.body.classList.add('sky-col-mode');
  const dlg = $('sky-viewer');
  dlg.querySelector('.scv-x').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
  render();
  // A catch on Explore writes localStorage; this page hears it and redraws.
  window.addEventListener('storage', (ev) => { if (ev.key === 'skyCatches') render(); });
  window.addEventListener('message', (ev) => { if (ev.origin === location.origin && ev.data?.sc === 'refresh') render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}
init();
