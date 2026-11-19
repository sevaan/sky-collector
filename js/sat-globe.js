// Your satellites, live (2026-10-27, Sevaan: a second card beside the rank card at the top of the Collection, swiped
// between with two dots). Every satellite, station, stage and piece of debris you own, where it is this second (the
// sky's own model, satellite.js), around a blueprint Earth (design/earth-styles.html C) that turns slowly, you marked.
// Dots are in the card's rarity colour; the rarest few in view are named. Tap a dot to open its card. Draws only while
// it's on screen. Fleet cards (Starlink and co.) aren't on it yet.
import * as sat from './lib/satellite.js?v=0.1.1737';
import { satrecFor } from './orbit.js?v=0.1.1737';
import { COAST } from './coast.js?v=0.1.1737';
import { TIER_INFO } from './rarity.js?v=0.1.1737';
import { earthMap } from './orbit-view.js?v=0.1.1737';
import { placeName } from './geo.js?v=0.1.1737';

const RAD = Math.PI / 180, RE = 6371, TILT = 20 * RAD;
// A dot's name: whole words up to about 18 letters ("THOR AGENA D", not "THOR AGENA D ROCKET ST").
const SHORT = [[/^International Space Station/i, 'ISS'], [/^Tiangong Space Station/i, 'TIANGONG'], [/^Hubble Space Telescope/i, 'HUBBLE']];
const shortLabel = (t) => { for (const [re, n] of SHORT) if (re.test(t)) return n; const w = String(t).replace(/\s*\([^)]*\)/g, '').replace(/ Rocket Stage$/i, ' stage').toUpperCase().split(' '); /* no brackets, famous ones short (playtest 2026-10-27: "INTERNATIONAL", "OPS 6182 (DMSP") */ let o = ''; for (const x of w) { if ((o + ' ' + x).trim().length > 18 && o) break; o = (o + ' ' + x).trim(); } return o; };
const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
// How high a dot sits off the surface: true up to 2,000 km, squeezed beyond so high orbits stay in the picture.
const lift = (h) => (h < 2000 ? h : 2000 + Math.min(h - 2000, 40000) * 0.04) / RE;

// cards: owned card models with orbits; host: the element to draw into; me: { lat, lon } or null; onPick(key).
// Returns { set(cards), where() } — where(): one line about one of them, a different one each call.
export function satGlobe(host, { me = null, onPick = null } = {}) {
  const cv = document.createElement('canvas'); cv.className = 'sg-canvas'; host.appendChild(cv);
  const ctx = cv.getContext('2d');
  let rc = null, rimg = null, sunV = [1, 0, 0];
  let items = [], rot = me ? me.lon : -80, last = 0, raf = 0, shown = false, posAt = 0, turn = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const io = new IntersectionObserver(([e]) => { shown = e.isIntersecting; if (shown && !raf) raf = requestAnimationFrame(draw); }, { threshold: 0.05 });
  io.observe(cv);
  let geo = null, gb = null, texAt = 0, px0 = null;
  /* perf pass 2026-11-10: the globe ran at 60 fps for as long as the Collection was open, reading its size and querying
     for dialogs every frame. Now 30 fps, size from a ResizeObserver, the dialog check twice a second, and a covered globe
     waits on a 250 ms timer instead of a frame loop. */
  let globeFont = '', dlgOpen = false, dlgAt = 0, cw = cv.clientWidth, ch = cv.clientHeight, drawnAt = 0;
  try { new ResizeObserver(() => { cw = cv.clientWidth; ch = cv.clientHeight; }).observe(cv); } catch {}
  const away = () => { const t = performance.now(); if (t - dlgAt > 500) { dlgAt = t; dlgOpen = !!document.querySelector('dialog[open]'); } return document.hidden || document.documentElement.classList.contains('away') || dlgOpen; }; /* covered by a dialog (Send cards, a card): nothing to draw */
  const later = () => { raf = -1; setTimeout(() => { raf = 0; if (shown && cv.isConnected) raf = requestAnimationFrame(draw); }, 250); };
  function place(t) {
    const g = sat.gstime(new Date(t));
    { const sv = sat.sunPos(sat.jday(new Date(t))).rsun, n = Math.hypot(...sv) || 1, x = sv[0] / n, y = sv[1] / n; sunV = [x * Math.cos(g) + y * Math.sin(g), -x * Math.sin(g) + y * Math.cos(g), sv[2] / n]; } // the Sun over the turning Earth
    for (const it of items) { const pv = sat.propagate(it.s, new Date(t)); if (!pv?.position || !Number.isFinite(pv.position.x)) { it.ok = false; continue; }
      const geo = sat.eciToGeodetic(pv.position, g); it.lat = geo.latitude / RAD; it.lon = geo.longitude / RAD; it.h = geo.height; it.ok = true; }
  }
  function draw(ts) {
    raf = 0; if (!shown || !cv.isConnected) return;
    if (away()) { later(); return; }
    if (ts - drawnAt < 30) { raf = requestAnimationFrame(draw); return; } drawnAt = ts;
    const W = cw, H = ch, d = Math.min(2, devicePixelRatio || 1);
    if (!W || !H) { raf = requestAnimationFrame(draw); return; }
    if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, W, H);
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts; if (!still) rot += dt * 6; // a slow turn, 6° a second
    if (ts - posAt > 1000 || !posAt) { place(Date.now()); posAt = ts; }
    const cx = W / 2, cy = H / 2 + 4, R = Math.min(W * 0.36, H * 0.4);
    const P = (lat, lon, h = 0) => { const la = lat * RAD, lo = (lon - rot) * RAD, r = 1 + h;
      const x = Math.cos(la) * Math.sin(lo) * r, y0 = Math.sin(la) * r, z0 = Math.cos(la) * Math.cos(lo) * r;
      const y = y0 * Math.cos(TILT) - z0 * Math.sin(TILT), z = y0 * Math.sin(TILT) + z0 * Math.cos(TILT);
      return { x: cx + x * R, y: cy - y * R, z, behind: z < 0 && x * x + y * y < 1 }; };
    const disc = () => { ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); };
    // the blueprint Earth: dark navy, a fine grid, cream coastlines, shade on the far side, a cream rim
    // the realistic Earth (2026-10-27, Sevaan's pick, design/earth-styles.html F): NASA's Blue Marble map on the globe, lit by the real Sun
    const map = earthMap();
    const glow = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.14); glow.addColorStop(0, 'rgba(120,170,255,.45)'); glow.addColorStop(0.35, 'rgba(120,170,255,.15)'); glow.addColorStop(1, 'rgba(120,170,255,0)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2); ctx.fill();
    if (!map) { ctx.fillStyle = '#163a5e'; disc(); ctx.fill(); } else {
      const N = Math.max(80, Math.min(256, Math.round(R * 2 * Math.min(1.5, d)))); /* 256 at most (perf budget 2026-11-10: the 320 texture cost up to 67 ms a redraw at 4x CPU) */ if (!rc || rc.width !== N) { rc = document.createElement('canvas'); rc.width = rc.height = N; rimg = rc.getContext('2d').createImageData(N, N); }
      // Per-pixel geometry is fixed for a size, since the Earth only turns about its axis: work it out once, then each
      // frame is a rotation (no trig per pixel) and a map lookup. The texture redraws ~10 times a second, not every frame
      // (perf review 2026-11-10: the full asin/atan2/sqrt loop cost 22-35 ms a frame and held Collection near 30 fps).
      /* Built a few rows a frame, ~4 ms each, with a plain disc meanwhile (perf budget 2026-11-10: in one go it was a
         117 ms frame at 4x CPU as the Collection opened). */
      if (!geo || geo.N !== N || geo.mw !== map.w) {
        if (!gb || gb.N !== N || gb.mw !== map.w) gb = { N, mw: map.w, j: 0, idx: [], cb: [], sb: [], cl: [], sl: [], sh: [], row: [], b: [] };
        const ct = Math.cos(TILT), st = Math.sin(TILT), t0 = performance.now();
        for (; gb.j < N && performance.now() - t0 < 4; gb.j++) { const j = gb.j, yv = 1 - (j + 0.5) / N * 2; for (let i = 0; i < N; i++) { const xv = (i + 0.5) / N * 2 - 1, rr = xv * xv + yv * yv; if (rr > 1) continue;
          const zv = Math.sqrt(1 - rr), y0 = yv * ct + zv * st, z0 = -yv * st + zv * ct, lat = Math.asin(Math.max(-1, Math.min(1, y0))), b = Math.atan2(xv, z0);
          gb.idx.push((j * N + i) * 4); gb.cb.push(Math.cos(b)); gb.sb.push(Math.sin(b)); gb.cl.push(Math.cos(lat)); gb.sl.push(Math.sin(lat)); gb.sh.push(0.55 + 0.45 * zv);
          gb.row.push(Math.min(map.h - 1, Math.floor((0.5 - lat / Math.PI) * map.h)) * map.w); gb.b.push(b); } }
        if (gb.j < N) { ctx.fillStyle = '#163a5e'; disc(); ctx.fill(); }
        else { geo = { N, mw: map.w, n: gb.idx.length, idx: Int32Array.from(gb.idx), cb: Float32Array.from(gb.cb), sb: Float32Array.from(gb.sb), cl: Float32Array.from(gb.cl), sl: Float32Array.from(gb.sl), sh: Float32Array.from(gb.sh), row: Int32Array.from(gb.row), b: Float32Array.from(gb.b) };
          gb = null; px0 = rimg.data; px0.fill(0); texAt = 0; }
      }
      if (geo && geo.N === N && geo.mw === map.w) {
      if (ts - texAt > 100 || !texAt) { texAt = ts;
        const px = rimg.data, r0 = rot * RAD, cr = Math.cos(r0), sr = Math.sin(r0), TAU = 2 * Math.PI, mw = map.w, md = map.d;
        for (let k = 0; k < geo.n; k++) {
          const cL = geo.cb[k] * cr - geo.sb[k] * sr, sL = geo.sb[k] * cr + geo.cb[k] * sr; // cos/sin of (b + rot)
          const f = ((r0 + geo.b[k]) / TAU + 0.5) % 1, u = Math.floor((f < 0 ? f + 1 : f) * mw), q = (geo.row[k] + u) * 4, o = geo.idx[k];
          const sun = geo.cl[k] * (cL * sunV[0] + sL * sunV[1]) + geo.sl[k] * sunV[2], day = Math.min(1, Math.max(0, (sun + 0.12) / 0.24)), lit = (0.34 + 0.66 * day) * geo.sh[k]; /* night side dimmed, not black */
          px[o] = md[q] * lit * (1 - 0.25 * (1 - day)); px[o + 1] = md[q + 1] * lit * (1 - 0.1 * (1 - day)); px[o + 2] = Math.min(255, md[q + 2] * lit + (1 - day) * 22); px[o + 3] = 255;
        }
        rc.getContext('2d').putImageData(rimg, 0, 0); }
      ctx.save(); disc(); ctx.clip(); ctx.drawImage(rc, cx - R, cy - R, R * 2, R * 2); ctx.restore();
      }
    }
    const at = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.01); at.addColorStop(0, 'rgba(120,180,255,0)'); at.addColorStop(1, 'rgba(140,195,255,.35)'); ctx.fillStyle = at; disc(); ctx.fill();
    let youAt = null;
    if (me) { const p = P(me.lat, me.lon); if (p.z > 0) { youAt = p; ctx.save(); ctx.fillStyle = 'rgba(255,77,77,.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ff4d4d'; ctx.strokeStyle = '#fff2b3'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.font = '700 9.5px "SC Label", "Barlow Condensed", sans-serif'; ctx.fillStyle = '#ff6a6a'; ctx.fillText('YOU', p.x + 8, p.y + 3); ctx.restore(); /* you: red with a cream ring, unlike any satellite dot (2026-10-27, Sevaan) */ } }
    // your satellites: behind the Earth faint, in front bright, the rarest few in front named
    const front = [];
    for (const it of items) { if (!it.ok) continue; const p = P(it.lat, it.lon, lift(it.h)); it.p = p;
      ctx.globalAlpha = p.behind ? 0.22 : 1; ctx.fillStyle = it.col;
      if (!p.behind && it.rank >= 2) { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(p.x, p.y, it.rank >= 3 ? 7 : 5.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } /* a soft halo, not shadowBlur (slow on phones) */
      ctx.beginPath(); ctx.arc(p.x, p.y, it.rank >= 3 ? 3.4 : it.rank >= 2 ? 2.8 : 2.1, 0, Math.PI * 2); ctx.fill();
      if (!p.behind && p.z > -0.2) front.push(it); }
    ctx.globalAlpha = 1;
    if (ctx.font !== globeFont) { ctx.font = '600 9.5px "SC Label", "Barlow Condensed", sans-serif'; globeFont = ctx.font; } ctx.fillStyle = '#fff2b3';
    const named = [];
    for (const it of front.sort((a, b) => b.rank - a.rank || b.icon - a.icon).slice(0, 8)) { if (named.length >= 3) break;
      if (named.some((n) => Math.abs(n.p.x - it.p.x) < 70 && Math.abs(n.p.y - it.p.y) < 14)) continue;
      if (youAt && Math.abs(youAt.y - it.p.y) < 14 && it.p.x - 10 < youAt.x + 30 && it.p.x + 110 > youAt.x) continue; // not on top of YOU
      const w = ctx.measureText(it.label).width, left = it.p.x + 6 + w > W - 4; ctx.fillText(it.label, left ? it.p.x - 6 - w : it.p.x + 6, it.p.y + 3); named.push(it); }
    raf = requestAnimationFrame(draw);
  }
  // a tap (not a swipe) on a dot opens its card
  let down = null;
  cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointerup', (e) => { if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down = null; return; } down = null;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 18;
    for (const it of items) { if (!it.ok || !it.p || it.p.behind) continue; const dd = Math.hypot(it.p.x - x, it.p.y - y); if (dd < bd) { bd = dd; best = it; } }
    if (best && onPick) onPick(best.key); });
  return {
    set(cards) {
      items = cards.map((c) => { const s = c.satrec ?? satrecFor(c); if (!s) return null; const rank = RANK[c.tier] ?? 0;
        return { key: c.key, s, rank, icon: c.icon ? 1 : 0, col: TIER_INFO[c.tier]?.color ?? '#fff2b3', label: shortLabel(c.short ?? c.title ?? c.name ?? ''), name: c.title ?? c.name }; }).filter(Boolean);
      place(Date.now()); posAt = 0;
      if (shown && !raf) raf = requestAnimationFrame(draw);
      return items.length;
    },
    where() { // "Hubble is over the Pacific": the rarest first, then round the rest
      const ok = items.filter((i) => i.ok).sort((a, b) => b.rank - a.rank || b.icon - a.icon); if (!ok.length) return '';
      const it = ok[turn++ % Math.min(ok.length, 6)]; return `${it.name} is over ${placeName(it.lat, it.lon)}`;
    },
  };
}
