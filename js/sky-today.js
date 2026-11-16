// Sky Collector's Today page (2026-11-15; docs/TONIGHT-PLAN.md, build steps 1–4). It takes over the Tonight panel:
//   Up now           the best catch overhead right now, then everything up, best first, with Show me
//   Coming over next planes that will climb above 15° in the next 15 minutes, projected from position, speed and track
//   Today so far     planes your phone has seen, by hour (only the hours the app was open: gaps are said, not guessed)
// The seen log is kept on the phone (localStorage 'skySeen': today's date, a set of hexes, counts by hour).
// No server. No DOM outside the container it's given.

import { aircraftName, isHelicopter, planePath } from './planes.js?v=0.1.1654';
import { glyphSvg } from './flight-card.js?v=0.1.1654';
import { catches } from './sky-catch.js?v=0.1.1654';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
export const dirWord = (az) => DIRS[Math.round(((az % 360) + 360) % 360 / 45) % 8];
const ft = (hKm) => `${(Math.round(hKm * 3280.84 / 100) * 100).toLocaleString('en-US')} ft`;

// ---------- seen log ----------
const SEEN = 'skySeen';
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function readSeen() {
  let s = null; try { s = JSON.parse(localStorage.getItem(SEEN) || 'null'); } catch {}
  if (!s || s.day !== dayKey()) s = { day: dayKey(), hexes: [], hours: Array(24).fill(0), open: Array(24).fill(0) };
  return s;
}
let seenCache = null, seenSaved = 0;
// Called with the planes above the horizon each poll (about every 10 s while Explore or Today is open).
export function logSeen(list) {
  const s = seenCache && seenCache.day === dayKey() ? seenCache : (seenCache = readSeen());
  const h = new Date().getHours(), have = new Set(s.hexes);
  s.open[h] = 1;
  for (const a of list ?? []) { const x = a.plane?.hex; if (x && !have.has(x)) { have.add(x); s.hexes.push(x); s.hours[h]++; } }
  if (Date.now() - seenSaved > 15000) { seenSaved = Date.now(); try { localStorage.setItem(SEEN, JSON.stringify(s)); } catch {} }
}

// ---------- what each plane is worth to you ----------
function worth(a, route, owned) {
  const p = a.plane, a3 = (p.callsign || '').slice(0, 3), full = route?.full;
  const fkey = full ? `F:${a3}:${full.from.icao}-${full.to.icao}` : null, pkey = `P:${p.type || (isHelicopter(p) ? 'HELI' : 'UNKNOWN')}`;
  const newFlight = !!fkey && !owned.has(fkey), newPlane = !owned.has(pkey);
  const name = full ? `To ${full.to.city}` : route?.airline ? `${route.airline} ${(p.callsign || '').replace(/^[A-Z]{3}/, '')}` : aircraftName(p) || (isHelicopter(p) ? 'Helicopter' : 'Aircraft');
  const type = aircraftName(p) || null;
  const sub = [full ? `${route.airline || a3} · from ${full.from.city}` : null, type && type !== name ? type : null].filter(Boolean).join(' · ');
  const tag = newFlight ? 'NEW FLIGHT' : newPlane ? 'NEW PLANE' : fkey ? 'IN YOUR COLLECTION' : 'SEEN BEFORE';
  const score = (newFlight ? 100 : 0) + (newPlane ? 60 : 0) + (isHelicopter(p) ? 25 : 0) + (full ? 10 : 0) + a.el / 10;
  return { name, sub, tag, score, isNew: newFlight || newPlane, glyph: isHelicopter(p) ? 'heli' : 'jet' };
}

// ---------- Coming over next: straight-line projection from position, speed and track ----------
function forecast(planes, obs, nowMs, visibleHexes) {
  const out = [];
  for (const p of planes) {
    if (visibleHexes.has(p.hex)) continue;
    const path = planePath(p, obs, nowMs, 0, 900, 15); // the next 15 minutes, every 15 s
    const i = path.findIndex((q) => q.el > 15);
    if (i < 0) continue;
    let peak = path[i]; for (let j = i; j < path.length && path[j].el >= peak.el; j++) peak = path[j];
    const az = (Math.atan2(path[i].enu[0], path[i].enu[1]) * 180 / Math.PI + 360) % 360;
    out.push({ p, inS: path[i].t, peakEl: peak.el, az });
  }
  return out.sort((a, b) => a.inS - b.inS).slice(0, 8);
}

// ---------- the empty hero: three different reasons for no planes ----------
// 'ok' with nothing up is a quiet sky; 'failing' is the feed being unreachable; 'loading' is still asking.
function skyState(ctx) {
  const st = ctx.planes?.status ?? (ctx.positions ? 'ok' : 'loading');
  if (st === 'failing') return `<h3>Can’t reach the plane feed</h3><p class="td-lead">No word from the plane feed${ctx.planes?.lastOk ? ` since ${new Date(ctx.planes.lastOk).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}. Check your connection, and we’ll keep trying.</p>`;
  if (st === 'loading' || !ctx.positions) return '<h3>Checking what’s flying</h3><p class="td-lead">Finding the planes near you…</p>';
  return '<h3>Quiet sky</h3><p class="td-lead">Nothing above the trees right now. Planes come and go every few minutes.</p>';
}

// ---------- render ----------
// ctx: { planes: PlaneTracker, obs, positions: [{plane, az, el, rangeKm}], route(callsign), show(hex), place }
export function renderToday(el, ctx) {
  const owned = new Set(); for (const c of catches()) { owned.add(c.key); if (c.planeKey) owned.add(c.planeKey); }
  const up = (ctx.positions ?? []).filter((a) => a.el > 5).map((a) => ({ a, w: worth(a, ctx.route(a.plane.callsign), owned) })).sort((x, y) => y.w.score - x.w.score);
  const best = up[0];
  const next = forecast(ctx.planes.planes ?? [], ctx.obs, Date.now(), new Set(up.map((u) => u.a.plane.hex)));
  const seen = readSeen(), total = seen.hexes.length, maxH = Math.max(1, ...seen.hours), nowH = new Date().getHours();
  const row = (u) => `<button type="button" class="td-row" data-hex="${esc(u.a.plane.hex)}">
      <span class="td-art">${glyphSvg(u.w.glyph)}</span>
      <span class="td-t"><b>${esc(u.w.name)}</b><span>${esc(u.w.sub || '')}</span><span class="td-where">${esc(dirWord(u.a.az))}, ${Math.round(u.a.el)}° up · ${ft(u.a.plane.hKm)}</span></span>
      <span class="td-tag${u.w.isNew ? ' new' : ''}">${u.w.tag}</span></button>`;
  el.innerHTML = `
    <section class="td-hero">${best ? `
      <p class="td-k">UP NOW · ${up.length} OVERHEAD</p>
      <h3>${esc(best.w.isNew ? 'Look up now' : 'Planes overhead')}</h3>
      <p class="td-lead">${esc(best.w.name)}${best.w.sub ? ` · ${esc(best.w.sub)}` : ''}. ${esc(dirWord(best.a.az))}, ${Math.round(best.a.el)}° up.</p>
      <button type="button" class="td-show" data-hex="${esc(best.a.plane.hex)}">SHOW ME</button>` : `
      <p class="td-k">UP NOW</p>${skyState(ctx)}`}
    </section>
    ${up.length > 1 ? `<p class="td-h">EVERYTHING UP <span>${up.length}</span></p><div class="td-list">${up.slice(0, 12).map(row).join('')}</div>` : ''}
    <p class="td-h">COMING OVER NEXT <span>${next.length ? 'NEXT 15 MIN' : ''}</span></p>
    <div class="td-list">${next.length ? next.map((n) => { const r = ctx.route(n.p.callsign), full = r?.full, nm = full ? `To ${full.to.city}` : r?.airline || aircraftName(n.p) || 'Aircraft';
      return `<div class="td-row td-row--next"><span class="td-when"><b>${Math.max(1, Math.round(n.inS / 60))} min</b><span>${esc(dirWord(n.az))}</span></span>
        <span class="td-t"><b>${esc(nm)}</b><span>${esc([r?.airline && full ? r.airline : null, aircraftName(n.p)].filter(Boolean).join(' · '))}</span><span class="td-where">climbs to ${Math.round(n.peakEl)}° up</span></span></div>`; }).join('')
      : '<p class="td-empty">Nothing heading your way in the next 15 minutes that we can see yet.</p>'}</div>
    <p class="td-h">TODAY SO FAR <span>${total.toLocaleString()} PLANE${total === 1 ? '' : 'S'} SEEN</span></p>
    <div class="td-chart" aria-label="Planes seen by hour">${seen.hours.map((n, h) => `<i class="${h === nowH ? 'now' : ''}${seen.open[h] ? '' : ' gap'}" style="height:${seen.open[h] ? Math.max(4, Math.round(n / maxH * 64)) : 4}px" title="${h}:00 · ${seen.open[h] ? n : 'app closed'}"></i>`).join('')}</div>
    <div class="td-axis"><span>12 AM</span><span>6</span><span>NOON</span><span>6</span><span>11 PM</span></div>
    <p class="td-note">Counts only the hours Sky Collector was open. Grey bars are hours it wasn’t.</p>`;
  /* a row opens that plane's card, as a Tonight row does in Space Collector (2026-11-15); the hero's Show me steers you to it */
  el.querySelectorAll('[data-hex]').forEach((b) => b.addEventListener('click', () => (b.classList.contains('td-row') && ctx.open ? ctx.open(b.dataset.hex, b.getBoundingClientRect()) : ctx.show(b.dataset.hex))));
}
