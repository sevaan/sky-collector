// Sky Collector's rank card picture (2026-11-20, Sevaan chose design/rank-card/rank-options.html B, "climb profile"):
// every rank is a flight level, from the runway (the first rank) up to FL410 (the top one), and your plane sits on a
// real climb, its height between your rank's level and the next set by your XP. Pure: builds SVG markup and works out
// where the plane is, so js/cards-page.js can draw it and animate it, and tests/rank-climb.test.mjs can check it.

export const FLIGHT_LEVELS = ['GND', 'FL050', 'FL100', 'FL180', 'FL240', 'FL300', 'FL360', 'FL410'];
const flOf = (i, n) => FLIGHT_LEVELS.length === n ? FLIGHT_LEVELS[i] : i ? `FL${String(Math.round((410 * i) / (n - 1) / 10) * 10).padStart(3, '0')}` : 'GND';
// Side view of a jet, nose right (the mock's SIDE path).
const SIDE = 'M-14 1.5L10 1.5C13 1.5 15 .4 15-.6 15-1.6 13-2.4 10-2.4L-9-2.4-12.5-7-15.5-7-13.5-2C-15-1.5-15 1.5-14 1.5ZM-3 0L3 0 -2 6 -5 6Z';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Where the plane is, in levels (0 = the runway, n-1 = the top rank): your rank's level plus how far you are to the next.
export function climbLevel(index, into, n) {
  const top = n - 1, i = Math.max(0, Math.min(top, index | 0));
  return i >= top ? top : i + Math.max(0, Math.min(1, Number(into) || 0));
}
// The same from a plain XP number and the rank thresholds (for animating from an older XP).
export function xpLevel(xp, thresholds) {
  let i = 0; for (let k = 0; k < thresholds.length; k++) if (xp >= thresholds[k]) i = k;
  const next = thresholds[i + 1]; return next == null ? i : i + Math.max(0, Math.min(1, (xp - thresholds[i]) / (next - thresholds[i])));
}

// The picture's geometry: level lines evenly spaced up the card, and a climb that is steep after take-off and flattens
// near the top. Altitude along the climb is linear in levels, so the plane's height is exactly its level's height.
export function climbGeom(n, W = 358, H = 196) {
  const top = n - 1, y0 = H - 24, step = (y0 - 25) / top, gx = Math.round(W * 0.42), gw = W - 12 - gx;
  const y = (lv) => y0 - lv * step;
  const at = (t) => [gx + gw * t, y(top * (1 - (1 - t) ** 2))];
  const tOf = (lv) => 1 - Math.sqrt(Math.max(0, 1 - lv / top));
  const poly = (t0, t1) => { let d = ''; for (let k = 0; k <= 40; k++) { const p = at(t0 + ((t1 - t0) * k) / 40); d += `${k ? ' L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`; } return d; };
  // The plane at a level: its point, heading (nose up, never steeper than 24 degrees) and the SVG transform. On the
  // runway it sits on the tarmac, nose a little up, ready to go.
  const plane = (lv) => {
    const t = Math.min(0.92, tOf(lv)), P = at(t), /* at the top the climb is all but level: stop short of the edge so the plane is whole (under a pixel lower) */ Q = at(Math.min(1, t + 0.01)), R = at(Math.max(0, t - 0.01));
    let ang = Math.max(-24, (Math.atan2(Q[1] - R[1], Q[0] - R[0]) * 180) / Math.PI), x = P[0], yy = P[1];
    if (lv < 0.04) { ang = -6; yy -= 6; }
    return { x, y: yy, ang, t, transform: `translate(${x.toFixed(1)} ${yy.toFixed(1)}) rotate(${ang.toFixed(0)}) scale(1.25)` };
  };
  return { n, top, W, H, gx, gw, y, at, tOf, poly, plane };
}

// The whole picture. ranks: [[xp, name], ...] (js/progress.js RANKS); index: your rank; into: 0..1 toward the next.
/* Clouds (2026-11-22, Sevaan: "could be better"; Space Collector's technique via Space Max): soft noise pictures made by
   js/cloud-pic.js (the caller passes them, so this stays pure): a lighter copy nudged up for lit tops, then the cloud, faded
   out towards the rank names on the left and towards the runway at the bottom. No pictures (tests, no canvas): no clouds. */
let cloudId = 0;
function clouds(W, H, pics) {
  if (!pics?.cloud) return '';
  const id = `lbcc${++cloudId}`;
  return `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset=".22" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity="1"/></linearGradient>`
    + `<linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset=".05" stop-color="#000"/><stop offset=".2" stop-color="#fff"/><stop offset=".7" stop-color="#fff"/><stop offset=".95" stop-color="#000"/></linearGradient>`
    + `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#${id}v)"/></mask>`
    + `<mask id="${id}h" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#${id}g)"/></mask></defs>`
    + `<g class="lbc-clouds" mask="url(#${id}h)"><g mask="url(#${id}m)">`
    + (pics.lit ? `<image href="${pics.lit}" x="0" y="-4" width="${W}" height="${H}" preserveAspectRatio="none" class="lbc-cloud-lit"/>` : '')
    + `<image href="${pics.cloud}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" class="lbc-cloud-img"/></g></g>`;
}
export function climbSvg({ ranks, index, into, xp, W = 358, H = 196, clouds: pics = null }) {
  const n = ranks.length, G = climbGeom(n, W, H), lv = climbLevel(index, into, n), pl = G.plane(lv), cur = Math.min(index, G.top);
  const next = ranks[cur + 1];
  const rows = ranks.map(([, name], i) => {
    const st = i < cur ? 'past' : i === cur ? 'cur' : i === cur + 1 ? 'next' : 'fut';
    const nm = name.toUpperCase().replace('CONTROLLER', 'CTRL'), [cx, cy] = G.at(G.tOf(i)), yy = G.y(i).toFixed(1);
    return `<g class="lbc-row lbc-${st}"><line x1="10" x2="${W - 8}" y1="${yy}" y2="${yy}" class="lbc-line"/>`
      + `<text x="10" y="${(G.y(i) - 4).toFixed(1)}" class="lbc-fl">${flOf(i, n)}</text>`
      + `<text x="44" y="${(G.y(i) - 4).toFixed(1)}" class="lbc-nm">${esc(nm)}</text>`
      + (i ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" class="lbc-dot"/>` : '') + '</g>';
  }).join('');
  // "Next" on the next level's line, at the right; when the climb is already over there (the last ranks), just left of it.
  let tag = '';
  if (next) {
    const cx = G.at(G.tOf(cur + 1))[0], txt = `NEXT · ${fmt(next[0] - xp)} XP TO GO`, end = cx > W * 0.62 ? cx - 10 : W - 10;
    tag = `<text x="${end.toFixed(1)}" y="${(G.y(cur + 1) - 4).toFixed(1)}" text-anchor="end" class="lbc-tag">${txt}</text>`;
  } else tag = `<text x="${G.gx}" y="${(G.y(G.top) - 4).toFixed(1)}" class="lbc-tag">TOP RANK · CRUISING</text>`;
  const rw = G.gx - 22;
  return `<svg class="lb-ladder lbc" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" data-n="${n}" data-w="${W}" data-h="${H}" data-lv="${lv.toFixed(4)}" aria-hidden="true">
    ${clouds(W, H, pics)}
    ${rows}
    <rect x="${rw}" y="${(G.y(0) + 1).toFixed(1)}" width="62" height="6" rx="1" class="lbc-rwy"/><path d="M${rw + 4} ${(G.y(0) + 4).toFixed(1)}h54" class="lbc-rwy-c"/>
    <path d="${G.poly(pl.t, 1)}" class="lbc-ahead"/>
    <path d="${G.poly(0, pl.t)}" class="lbc-trail"/>
    <g class="lbc-plane" transform="${pl.transform}"><path d="${SIDE}"/></g>
    ${tag}
  </svg>`;
}
