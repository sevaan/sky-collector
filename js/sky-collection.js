// Sky Collector's Collection (2026-11-15): two tabs, Flights and Planes, built from the catches kept on the phone
// (localStorage 'skyCatches', written by js/sky-catch.js). Runs inside cards.html and takes over its main area; Space
// Collector's satellite grid stays in the page, hidden. Design: canvas row D (cream mini cards, gold frames for Rare+).

import { flightCardHtml, planeCardHtml, miniCardHtml } from './flight-card.js?v=0.1.1640';
import { attachTilt, attachFlip } from './card.js?v=0.1.1640';
import { applyBack } from './card-backs.js?v=0.1.1640';
import { flightStampInfo, planeStampInfo, hasAirlineCallsign } from './sky-stamps.js?v=0.1.1640';
import { standing } from './sky-progress.js?v=0.1.1640';

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
      p.seen.push(c); planes.set(p.key, p);
    }
  }
  // Stamps and levels are worked out from the catches every time (js/sky-stamps.js), never stored.
  for (const f of flights.values()) f.stampInfo = flightStampInfo(list, f.key);
  for (const p of planes.values()) { p.stampInfo = planeStampInfo(list, p.key); p.stamps = new Set(p.stampInfo.liveries); }
  const order = (a, b) => b.seen.at(-1).time - a.seen.at(-1).time;
  return { flights: [...flights.values()].sort(order), planes: [...planes.values()].sort(order) };
}

const state = { tab: 'flights', filter: 'all', open: null };
const FLIGHT_SETS = ['Across Canada', 'North America', 'Across the Atlantic', 'Sun Destinations', 'Around the World', 'Cargo'];
const planeGroup = (e) => (e.card.glyph === 'heli' ? 'Helicopters' : e.card.glyph === 'prop' ? 'Propellers' : 'Jets');

// A grid tile is a real mini card (js/flight-card.js miniCardHtml): frame by rarity, photo, title, stats, footer.
// Older catches kept the aircraft type only on the catch record, so it's passed along for the photo.
function tile(e) {
  const c = e.card, n = e.seen.length;
  const label = e.kind === 'flight' ? `${c.from.city} to ${c.to.city}, ${c.airline}` : c.name;
  return `<button type="button" class="sct" data-key="${esc(e.key)}" aria-label="${esc(`${label}, ${c.tier}, seen ${n} ${n === 1 ? 'time' : 'times'}${e.stampInfo?.level && e.stampInfo.level !== 'none' ? `, ${e.stampInfo.level} level, ${e.stampInfo.count} stamps` : ''}`)}">${miniCardHtml({
    kind: e.kind, card: c, type: c.type || e.seen.find((s) => s.type)?.type || '', last: e.seen.at(-1).time, n, stamps: e.stampInfo?.count ?? 0, stampInfo: e.stampInfo })}</button>`;
}

// Your rank at the top of the Collection, as Space Collector's (2026-11-15 alignment pass): its compact rank dial (the
// ring filling to the next rank, the rank, XP and how far to go), drawn on card paper for the daylight look.
function rankCard(list) {
  let st; try { st = standing(list); } catch { return ''; }
  const r = st.rank, into = r.next ? Math.max(0, Math.min(1, (st.xp - r.at) / (r.next - r.at))) : 1, pct = Math.round(into * 100);
  return `<div class="logbook sky-rank"><div class="lb-top"><span>Spotter rank</span></div>
    <div class="lb-dial"><span class="lbd-ring"><svg viewBox="0 0 74 74" aria-hidden="true"><circle cx="37" cy="37" r="32" fill="none" stroke="#d9e5ef" stroke-width="5"/><circle cx="37" cy="37" r="32" fill="none" stroke="#fa8127" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(into * 201.06).toFixed(1)} 202" transform="rotate(-90 37 37)"/></svg><b>${pct}%<small>to next</small></b></span>
    <span class="lbd-m"><span class="lbd-l"><span class="lbd-name">${esc(r.name)}</span><span class="lb-xp"><b>${st.xp.toLocaleString('en-US')}</b> XP</span></span>
    <span class="lbd-to">${r.next ? `${(r.next - st.xp).toLocaleString('en-US')} XP to <b>${esc(r.nextName ?? 'the next rank')}</b>` : 'Top rank. Every catch still counts.'}</span></span></div></div>`;
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
  root.innerHTML = `${rankCard(load())}
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
    ? flightCardHtml(e.card, { caughtAt: new Date(e.seen[0].time), heightFt: last.altFt, sightings: e.seen.length, type: e.seen.find((s) => s.type)?.type, planeName: last.plane?.name, eager: true, stampInfo: e.stampInfo })
    : planeCardHtml(e.card, { caughtAt: new Date(e.seen[0].time), heightFt: last.altFt, speedKmh: Math.round((last.gsKt ?? 0) * 1.852), awayKm: Math.round(last.rangeKm ?? 0), sightings: e.seen.length, stampInfo: e.stampInfo, callsign: last.callsign, eager: true });
  const rows = [...e.seen].reverse().slice(0, 30).map((s) => `<li><span>${esc(when(s.time))}</span><span>${esc([s.callsign, hasAirlineCallsign(s.callsign) ? s.reg : '', s.altFt ? `${Math.round(s.altFt / 100) * 100} ft` : ''].filter(Boolean).join(' · '))}</span></li>`).join('');
  const liveries = e.kind === 'plane' && e.stampInfo.liveries.length ? `<p class="scv-k">LIVERIES · ${e.stampInfo.liveries.length}</p><p class="scv-stamps">${e.stampInfo.liveries.map((a) => `<span>${esc(a)}</span>`).join('')}</p>` : '';
  viewerTilt?.destroy(); viewerTilt = null;
  dlg.querySelector('.scv-body').innerHTML = `<div class="scv-card">${html}</div>${liveries}<p class="scv-k">WHEN YOU SAW IT · ${e.seen.length} ${e.seen.length === 1 ? 'TIME' : 'TIMES'}</p><ul class="scv-list">${rows}</ul>`;
  // The card tilts under the finger, its foil and glare following (the page still scrolls).
  const card = dlg.querySelector('.scv-card .fc');
  if (card) {
    viewerTilt = attachTilt(card, { scroll: true });
    /* Double-tap flips it to its card back, as in Space Collector (js/card.js attachFlip; 2026-11-15, Sevaan) */
    const back = document.createElement('div'); back.className = 'card__back'; card.append(back);
    viewerFlip?.destroy(); viewerFlip = attachFlip(card, { onBack: (b) => applyBack(b), onTap: null });
  }
  if (!dlg.open) dlg.showModal();
}
let viewerTilt = null, viewerFlip = null;

// Open the card with this key (a flight or plane key), switching to its tab: View card on Explore and View in collection.
function showKey(key) {
  const { flights, planes } = build(load()), e = flights.find((x) => x.key === key) ?? planes.find((x) => x.key === key); if (!e) return;
  const tab = flights.includes(e) ? 'flights' : 'planes'; if (state.tab !== tab) { state.tab = tab; state.filter = 'all'; render(); }
  openCard(e);
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
  window.addEventListener('message', (ev) => { if (ev.origin !== location.origin) return; if (ev.data?.sc === 'refresh') render(); if (ev.data?.sc === 'show' && ev.data.key) showKey(ev.data.key); });
  { let k = ''; try { k = decodeURIComponent(location.hash.slice(1)); } catch {} if (k) showKey(k); } /* opened straight onto a card (View card, View in collection) */
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}
init();
