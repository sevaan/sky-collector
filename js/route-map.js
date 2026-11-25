// Sky Collector's route map (2026-11-21, Sevaan picked take 2 of design/collection-panel/collection-panel-2026-11-21.html):
// the second card at the top of the Collection, in Space Collector's satellite-globe slot. A map seen from over the North
// Pole with a great-circle arc for every boarding pass you hold, airports as dots, gold passes in gold and the longest
// route drawn bold with a little jet flying it. It shows airports and routes only, never where you were standing.
// Pure: builds SVG markup from the passes (no DOM), so js/cards-page.js can draw it and tests/route-map.test.mjs check it.
// Coastlines: js/coast.js (Natural Earth 1:110m land, public domain), the same outlines as the orbit globe.

import { COAST } from './coast.js?v=0.1.1921';

const R = Math.PI / 180, EARTH_KM = 40075;
const vec = (lon, lat) => [Math.cos(lat * R) * Math.cos(lon * R), Math.cos(lat * R) * Math.sin(lon * R), Math.sin(lat * R)];
export const kmBetween = (a, b) => {
  const h = Math.sin((b.lat - a.lat) * R / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin((b.lon - a.lon) * R / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};
// Points along the great circle from a to b, as [lon, lat].
export function greatCircle(a, b, n = 48) {
  const p = vec(a.lon, a.lat), q = vec(b.lon, b.lat), d = Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  if (d < 1e-6) return [[a.lon, a.lat], [b.lon, b.lat]];
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, s1 = Math.sin((1 - t) * d) / Math.sin(d), s2 = Math.sin(t * d) / Math.sin(d), v = [0, 1, 2].map((i) => s1 * p[i] + s2 * q[i]);
    out.push([Math.atan2(v[1], v[0]) / R, Math.asin(Math.max(-1, Math.min(1, v[2]))) / R]);
  }
  return out;
}
const ok = (a) => a && Number.isFinite(a.lat) && Number.isFinite(a.lon);
// The passes the map can draw: both airports known and not the same place. pass: a flight card ({ key, from, to, tier, airline, callsign }).
export const mappable = (passes) => (passes ?? []).filter((p) => ok(p?.from) && ok(p?.to) && kmBetween(p.from, p.to) > 1);

// The view: an azimuthal equidistant projection centred on the North Pole, turned so your routes' middle longitude points
// down the card, scaled and moved to fit every arc with a margin. One short domestic route doesn't zoom in past a span of
// about 28° of latitude, so the coast around it still reads as a map.
function viewFor(arcs, W, H) {
  let sx = 0, sy = 0; for (const a of arcs) for (const [lon] of a) { sx += Math.cos(lon * R); sy += Math.sin(lon * R); }
  const rot = Math.atan2(sy, sx) / R;
  const raw = (lon, lat) => { const r = 90 - lat, t = (lon - rot) * R; return [r * Math.sin(t), r * Math.cos(t)]; };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const a of arcs) for (const [lon, lat] of a) { const [x, y] = raw(lon, lat); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const pad = 0.16, minSpan = 28;
  let w = Math.max(x1 - x0, minSpan), h = Math.max(y1 - y0, minSpan * H / W);
  const s = Math.min(W * (1 - 2 * pad) / w, H * (1 - 2 * pad) / h);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return (lon, lat) => { const [x, y] = raw(lon, lat); return [W / 2 + (x - cx) * s, H / 2 + (y - cy) * s + H * 0.03]; };
}
const pathOf = (pts, proj, close = false) => {
  let d = ''; for (let i = 0; i < pts.length; i++) { const [x, y] = proj(pts[i][0], pts[i][1]); d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
  return d + (close ? 'Z' : '');
};
// A coast ring broken into short steps, so its straight edges bend with the projection.
/* longitudes unwrapped first: a ring that crosses the date line (Russia, Alaska) jumps from 180 to -180, and stepping
   across that jump drew a full circle of latitude round the pole */
const dense = (ring0) => { const ring = []; for (const [lon, lat] of ring0) { let l = lon; const prev = ring[ring.length - 1]; if (prev) while (l - prev[0] > 180) l -= 360; if (prev) while (prev[0] - l > 180) l += 360; ring.push([l, lat]); }
  const out = []; for (let i = 0; i < ring.length - 1; i++) { const a = ring[i], b = ring[i + 1], n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 3)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return out; };
const JET = 'M-14 1.5L10 1.5C13 1.5 15 .4 15-.6 15-1.6 13-2.4 10-2.4L-9-2.4-12.5-7-15.5-7-13.5-2C-15-1.5-15 1.5-14 1.5ZM-3 0L3 0 -2 6 -5 6Z';
const code = (a) => a.iata || a.icao || '';
const rank = (t) => ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(t);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// -> null with no mappable pass, else { svg, count, airports, longest: { pass, km }, earths }.
// opts: { W, H, anim (draw the arcs in one by one), uid (keeps ids unique when two maps are on the page) }
export function routeMap(passes, { W = 335, H = 196, anim = true, uid = 'rm' } = {}) {
  const list = mappable(passes); if (!list.length) return null;
  /* the same two airports (either way round, any airline) are one arc, drawn bolder the more passes fly it: a few dozen
     regulars would otherwise stack dozens of identical lines. Short routes need fewer points. */
  const byPair = new Map();
  for (const p of list) {
    const k = [p.from.icao || code(p.from), p.to.icao || code(p.to)].sort().join('-'), km = kmBetween(p.from, p.to), r = byPair.get(k);
    if (r) { r.n++; if (rank(p.tier) > rank(r.p.tier)) r.p = p; } else byPair.set(k, { p, km, n: 1 });
  }
  const withKm = [...byPair.values()].map((x) => ({ ...x, arc: greatCircle(x.p.from, x.p.to, Math.max(8, Math.min(48, Math.round(x.km / 220)))) }));
  const top = withKm.reduce((m, x) => (x.km > m.km ? x : m));
  const proj = viewFor(withKm.map((x) => x.arc), W, H);
  const land = COAST.filter((ring) => ring.reduce((s, [, lat]) => s + lat, 0) / ring.length > -50) /* not Antarctica: from over the North Pole it wraps the whole card */
    .map((ring) => pathOf(dense(ring), proj, true)).join('');
  const tierCls = (t) => (t === 'legendary' || t === 'epic' || t === 'rare' ? 'gold' : '');
  /* Only the first 30 arcs draw in (with hundreds, animating every one janked and took too long); the rest are just there.
     Lots of routes get thinner, fainter lines so the busy corridors read as density, not a solid mass. */
  const others = withKm.filter((x) => x !== top), busy = withKm.length > 60 ? ' rm-busy' : '';
  const arcs = others.map((x, i) => `<path d="${pathOf(x.arc, proj)}" class="rm-arc ${tierCls(x.p.tier)}${x.n > 1 ? ' rm-rep' : ''}${i >= 30 ? ' rm-still' : ''}"${i < 30 ? ` style="animation-delay:${Math.min(i * 0.07, 1.4).toFixed(2)}s"` : ''}/>`).join('')
    + `<path id="${uid}-top" d="${pathOf(top.arc, proj)}" class="rm-arc rm-top" style="animation-delay:${Math.min(others.length * 0.07, 1.4).toFixed(2)}s"/>`;
  const visits = new Map(); for (const { p } of withKm) for (const a of [p.from, p.to]) { const k = a.icao || code(a); const v = visits.get(k) ?? { a, n: 0 }; v.n++; visits.set(k, v); }
  /* hollow dots for your busiest airports: four or more routes, and only the top eight, so a big map isn't all rings */
  const hubMin = Math.max(4, [...visits.values()].map((v) => v.n).sort((x, y) => y - x)[7] ?? 0);
  const dots = [...visits.values()].map(({ a, n }) => { const [x, y] = proj(a.lon, a.lat), hub = n >= hubMin; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hub ? 3.4 : busy ? 1.6 : 2.1}" class="rm-apt${hub ? ' rm-hub' : ''}"/>`; }).join('');
  // Labels: the longest route's two ends, then the busiest airports, as long as they don't crowd one another.
  const want = [top.p.from, top.p.to, ...[...visits.values()].sort((a, b) => b.n - a.n).map((v) => v.a)], placed = [], labs = [];
  for (const a of want) {
    if (labs.length >= 7) break;
    const [x, y] = proj(a.lon, a.lat); if (x < 14 || x > W - 14 || y < 22 || y > H - 8) continue;
    if (placed.some(([px, py]) => Math.abs(px - x) < 30 && Math.abs(py - y) < 12)) continue;
    placed.push([x, y]); const right = x < W - 40;
    labs.push(`<text x="${(x + (right ? 5 : -5)).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}" class="rm-lab${a === top.p.to || a === top.p.from ? ' rm-lab--top' : ''}">${esc(code(a))}</text>`);
  }
  const begin = anim ? (Math.min(others.length * 0.07, 1.4) + 1.1).toFixed(1) : '0';
  const jet = `<g class="rm-jet"><path d="${JET}" transform="scale(.62)"/><animateMotion dur="7s" begin="${begin}s" repeatCount="indefinite" rotate="auto"><mpath href="#${uid}-top"/></animateMotion></g>`;
  const svg = `<svg class="rm-svg${anim ? ' rm-draw' : ''}${busy}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path d="${land}" class="rm-land"/><g>${arcs}</g>${dots}${labs.join('')}${jet}</svg>`;
  const km = list.reduce((s, p) => s + kmBetween(p.from, p.to), 0);
  return { svg, count: list.length, routes: withKm.length, airports: visits.size, longest: { pass: top.p, km: top.km }, earths: km / EARTH_KM };
}
