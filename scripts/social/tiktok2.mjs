// TikTok videos, v2 (2026-11-14): see scripts/social/tt-lib.mjs. One job per video.
// Usage: node scripts/social/tiktok2.mjs <light|pack|above|city> [--catalog=<fresher catalog.json>]
import { readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { ROOT, jumpToHero, stopFollow } from '../store/common.mjs';
import { rec, compose, mix, W, H, VW, VH } from './tt-lib.mjs';
import * as orbit from '../../js/orbit.js';

const args = process.argv.slice(2), which = args.find((a) => !a.startsWith('--'));
const catalog = args.find((a) => a.startsWith('--catalog='))?.slice(10) ?? null;
const CAT = JSON.parse(readFileSync(catalog ?? join(ROOT, 'data/catalog.json'), 'utf8')).objects, BY = new Map(CAT.map((o) => [String(o.id), o]));
const BACK = join(ROOT, 'assets/art/backs/back-collector.webp');
const pngSize = (f) => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const azel = (id, t, obs) => { const o = BY.get(String(id)); o.satrec ??= orbit.satrecFor(o); const l = orbit.look(o, orbit.frame(new Date(t), obs)); return l && [l.az, l.el]; };
const CX = VW / 2, CY = VH / 2; /* the app's circle sits at the centre of the screen */

/* ───────── 1 · "that's not a plane." ───────── */
async function light() {
  const s = await rec({ when: '2026-10-17T19:30:00-04:00' }), { p, w, take } = s;
  await jumpToHero(p); await stopFollow(p);
  const iss = await p.evaluate(() => { const st = window.__store.state, it = st.items.find((x) => x.obj.type === 'station' && x.look?.visible && !st.sightings.some((y) => String(y.objectId) === String(x.obj.id))); return it ? { id: it.obj.id, t: Date.now(), lat: st.observer.lat, lon: st.observer.lon } : null; });
  if (!iss) throw new Error('no station up');
  const obs = { lat: iss.lat, lon: iss.lon, heightKm: 0 };
  /* the streak: the sky clock runs ~15× for 1.7 s so the station visibly crosses the view, centred on where it'll be mid-way */
  const SPAN = 26e3, mid = azel(iss.id, iss.t + SPAN * 0.55, obs);
  await p.evaluate(([az, el]) => { const st = window.__store.state; st.pinnedId = null; window.__aim = null; st.drag.az = az; st.drag.el = el; document.body.classList.add('quiet'); }, mid);
  await w(900);
  const t1 = await take(async (mark) => { mark('in'); const t0 = Date.now(); while (Date.now() - t0 < 1700) { await p.clock.fastForward(Math.round(SPAN / 42)); await w(28); } mark('end'); });
  /* the circle slides onto it, locks, Collect */
  const id0 = iss.id; const t2 = await take(async (mark) => { await p.evaluate((id) => { window.__ease = 0.07; window.__aim = id; window.__store.state.pinnedId = id; }, iss.id); mark('aim');
    for (let i = 0, ok = 0; i < 160 && ok < 7; i++) { ok = (await p.evaluate((id) => window.__store.state.targetId === id && !!document.querySelector('#d-cta:not([hidden])'), id0)) ? ok + 1 : 0; await w(45); } /* the station has held the circle for ~0.3 s */
    await p.evaluate(() => document.body.classList.remove('quiet')); /* the panel only once it's the station: stars it passed on the way flashed their names */
    mark('locked'); await w(1700); mark('pre');
    const b = await s.box('#d-cta'); s.btn = b; mark('collect'); await p.click('#d-cta', { timeout: 3000 }).catch((e) => console.log('no Collect', e.message.slice(0, 50))); await w(250); mark('end'); });
  const front = join(s.tmp, 'card-25544.png'); await w(1500); await s.cardShot(front);
  await s.close();
  t1.dir = t2.dir = s.tmp; t1.sfx = t2.sfx = s.sfx;
  const [cw, ch] = pngSize(front);

  /* ── the edit ── */
  const A = 0, B = 1.7, lockAt = B + 0.55, collectAt = lockAt + 1.5, land = collectAt + 1.35, END = land + 4.6;
  const m2 = t2.marks;
  const shots = [
    { from: A, to: B, take: 0, map: [[A, t1.marks.in], [B, t1.marks.end]], cam: [[0, 1.75, 0.5, 0.5, 0], [B, 1.55, 0.5, 0.5, 0, 'lin']] },
    { from: B, to: collectAt + 0.12, take: 1, map: [[B, m2.aim], [lockAt, m2.locked, 'lin'], [collectAt, m2.collect]], /* the slide at ~2×, then real time */
      cam: [[B, 1.55, 0.5, 0.5, 0], [B + 0.35, 1.0, 0.5, 0.52, 0, 'out'], [lockAt - 0.05, 1.0, 0.5, 0.52, 0], [lockAt + 0.32, 1.32, 0.5, 0.5, 0, 'expo'], [collectAt - 0.6, 1.22, 0.5, 0.6, 0, 'io'], [collectAt, 1.3, 0.5, 0.62, 0, 'in']] },
    { from: collectAt + 0.12, to: END - 0.45 },
    { from: END - 0.45, to: END + 1, take: 0, map: [[END - 0.45, t1.marks.in], [END + 1, t1.marks.in + 0.01]], cam: [[0, 1.75, 0.5, 0.5, 0]] }, /* back to frame 1: it loops */
  ];
  const btn = s.btn ?? { x: W / 2, y: H * 0.8 };
  const bx = (btn.x / W - 0.5) * 1.22 + 0.5, by = (btn.y / H - 0.6) * 1.22 + 0.5; /* the button through the camera at collect (scale ~1.22, focus y .6) */
  const CW = 318, R = ch / cw;
  const scene = {
    dur: END, takes: [t1, t2], assets: [front, BACK],
    shots,
    stars: [[0, 0, 0, 0], [collectAt, 0, 0, 0], [collectAt + 0.15, 1, 0, 0], [END - 0.5, 1, -60, 40, 'lin'], [END - 0.45, 0, -60, 40]],
    zoomBlur: [{ from: collectAt - 0.18, to: collectAt + 0.14, x: 0.5, y: 0.5 }],
    flashes: [{ at: collectAt, dur: 0.26, x: 50, y: 50 }],
    rings: [{ at: lockAt, x: CX, y: CY, r0: 46, r1: 170, dur: 0.6 }, { type: 'ripple', at: collectAt - 0.12, x: bx * VW, y: by * VH, r0: 4, r1: 46, dur: 0.4 }],
    card3d: [{ from: collectAt + 0.08, to: END - 0.45, front: 'card-25544.png', back: 'back-collector.webp', ratio: R,
      keys: [[collectAt + 0.08, CX, CY, 34, 180, 30, 0, 1], [land, CX, 410, CW, 720, 0, 0, 1, 'expo'],
        [land + 1.1, CX, 404, CW, 728, -7, 1.5, 1, 'io'], [land + 2.2, CX, 414, CW, 709, 6, -1.5, 1, 'io'], [land + 3.3, CX, 404, CW, 724, -5, 1, 1, 'io'],
        [END - 0.75, CX, 410, CW, 716, 3, 0, 1, 'io'], [END - 0.45, CX, CY, 6, 700, 10, 0, 0, 'in']],
      sheen: [[land - 0.1, -0.2], [land + 0.8, 1.2, 'io'], [land + 2.4, 1.2], [land + 3.3, -0.2, 'io']], glow: [[land - 0.2, 0], [land, 34, 'out'], [land + 1, 12, 'io']], glowColor: '#4aa8ff' }],
    sparkles: [{ from: land, to: END - 0.6, n: 14, x: CX, y: 410, r: 190 }],
    leak: [[land - 0.1, 0], [land + 0.25, 0.55, 'out'], [land + 1.2, 0.0, 'io']],
    texts: [
      { from: 0, to: B + 0.45, text: 'that’s not a *plane.*', y: 120, size: 'big', instant: true },
      { from: lockAt - 0.05, to: collectAt + 0.1, text: 'it’s the *space station*', y: 120, size: 'big' },
      { from: land + 0.15, to: land + 2.2, text: 'people *live* up there', y: 92, size: 'big' },
      { from: land + 2.3, to: END - 0.6, text: 'it crosses canada in *12 minutes*', y: 92, size: 'big' },
      { from: END - 0.45, to: END + 1, text: 'that’s not a *plane.*', y: 120, size: 'big', instant: true },
    ],
  };
  const video = await compose('light', scene, s.tmp);
  const cues = [['boom', 0, -2], ['whoosh', 0.02, -6], ['twinkle', 0.3, -16], ['whoosh', 0.75, -9], ['whoosh', B - 0.05, -7],
    ['app:lock', lockAt, -2], ['sub', lockAt, -3], ['tick', lockAt, -8], ['riser', collectAt - 1.5, -6],
    ['impact', collectAt, -1], ['crack', collectAt, -4], ['app:collect', collectAt, -3], ['whoosh', collectAt + 0.2, -6], ['swell', land - 0.8, -12],
    ['app:r_rare', land, -1], ['sub', land, -2], ['tick', land + 0.15, -8], ['shimmer', land + 0.6, -14], ['shimmer', land + 3.2, -16], ['tick', land + 2.3, -8],
    ['swell', END - 1.25, -10], ['whoosh', END - 0.6, -6]];
  for (const music of [true, false]) console.log(mix('whats-that-light-v2', video, { dur: END, drop: collectAt, cues, music }));
}


/* One-liners for a card, true from the catalogue: a few named ones, else what it is and its year. */
const LINES = { 27386: 'dead since 2012. still up there.', 16908: 'a giant disco ball in orbit', 25544: 'people live on this one',
  39030: 'turkey’s spy satellite', 37673: 'it measured how salty the ocean is', 29092: 'one of china’s first radar satellites' }; /* each from its card's fact */
function line(o) { if (LINES[o.id]) return LINES[o.id]; const y = o.launch?.slice(0, 4) ?? o.year;
  if (o.type === 'rocket-body') return /^CZ-/.test(o.name) ? `a chinese rocket stage from ${y}` : `a rocket stage from ${y}. still up there.`;
  if (o.type === 'debris') return `space junk from ${y}`;
  if (/NOAA|METEOR|DMSP|TIROS|GOES/i.test(o.name)) return `a weather satellite from ${y}`;
  if (/COSMOS|KOSMOS/i.test(o.name)) return `a soviet satellite from ${y}`;
  return `a satellite from ${y}`; }
const ft = (t) => new Date(t).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }).replace('a.m.', 'am').replace('p.m.', 'pm');

/* ───────── 2 · the morning pack ───────── */
async function pack() {
  /* last night's real passes over the store's spot: four common or uncommon ones, then the Space Station */
  const eve = '2026-10-17T19:30:00-04:00';
  const n = await rec({ when: eve });
  const picks = await n.p.evaluate(() => { const st = window.__store.state, T = st.tonight, own = new Set(st.sightings.map((x) => String(x.cardKey))), seen = new Set(), out = [];
    const ps = T.passes.filter((x) => (x.peakEl >= 25 && x.mag <= 3.8) || (String(x.id) === '25544' && x.peakEl >= 15)).sort((a, b) => a.peakAt - b.peakAt);
    for (const x of ps) { const o = st.byId.get(x.id); if (!o || o.family || own.has(String(o.id)) || seen.has(o.name)) continue; const tier = st.cardModels.get(String(o.id))?.tier ?? o.tier;
      if (String(o.id) === '25544') { if (new Date(x.peakAt).getHours() < 12 && T.passes.some((y) => String(y.id) === '25544' && y.peakEl >= 15 && new Date(y.peakAt).getHours() >= 17 && y.peakAt !== x.peakAt)) continue; out.push({ id: o.id, t: x.peakAt, iss: 1 }); seen.add(o.name); continue; } /* its evening pass, not one at 5 am */
      if (!['common', 'uncommon'].includes(tier) || out.filter((y) => !y.iss).length >= 4) continue; out.push({ id: o.id, t: x.peakAt }); seen.add(o.name); }
    return out; });
  await n.close();
  const iss = picks.find((x) => x.iss), rest = picks.filter((x) => !x.iss).slice(0, 4);
  if (!iss || rest.length < 3) throw new Error('not enough passes: ' + JSON.stringify(picks));
  const here = { lat: 44.3, lon: -78.3 }, extra = [...rest, iss].map(({ id, t }) => { const o = BY.get(String(id)); return { time: t, cardKey: String(id), objectId: id, name: o.name, type: o.type ?? 'satellite', ...here }; });
  console.log('pack:', extra.map((x) => `${x.name} ${ft(x.time)}`).join(' · '));
  const morn = new Date('2026-10-18T08:30:00-04:00');
  const s = await rec({ when: morn.toISOString(), extra, hide: '#gift .gp-hint, #gift .gp-x, #gift .gp-head, #gift .gp-tags, #gift .gp-count2 { opacity: 0 !important; } #gift .gp-cue { display: none !important; } #gift .gp-pk, #gift .gp-deck { scale: .8; translate: 0 9%; }' }), { p, w, take } = s;
  for (let i = 0; i < 20 && !(await p.evaluate(() => [...document.querySelectorAll('.ticket')].some((x) => /in a pack/i.test(x.textContent)))); i++) await w(1000);
  await p.evaluate(() => [...document.querySelectorAll('.ticket')].find((x) => /in a pack/i.test(x.textContent))?.click());
  await w(2800);
  const pk = await p.locator('#gift .gp-pk').boundingBox();
  const top = () => p.evaluate(() => { const g = document.getElementById('gift'); if (!g || g.querySelector('.gp-haul')) return null; const d = [...g.querySelectorAll('.gp-dc')].at(-1); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, face: d.classList.contains('face'), left: g.querySelectorAll('.gp-dc').length }; });
  const dealt = [];
  const t1 = await take(async (mark) => { mark('in'); await w(500);
    /* tear it by hand across the top strip */
    const y = pk.y + pk.height * 0.1; await p.mouse.move(pk.x + pk.width * 0.06, y); await p.mouse.down(); mark('tear');
    for (let i = 1; i <= 16; i++) { await p.mouse.move(pk.x + pk.width * (0.06 + 0.9 * i / 16), y + Math.sin(i / 3) * 2); await w(28); } await p.mouse.up(); mark('torn');
    for (let i = 0; i < 40 && !(await top()); i++) await w(100); await w(2200); mark('dealt');
    for (let k = 0; k < rest.length; k++) { let c = await top(); await p.touchscreen.tap(c.x, c.y); mark('flip' + k); await w(1100); dealt.push(await p.evaluate(() => [...document.querySelectorAll('#gift .gp-dc')].at(-1)?.querySelector('.card')?.getAttribute('aria-label') ?? '')); c = await top(); if (c?.face) { await p.touchscreen.tap(c.x, c.y); mark('away' + k); await w(700); } }
    mark('last'); await w(2000); const c = await top(); mark('lastflip'); if (c) await p.touchscreen.tap(c.x, c.y); await w(1400); mark('end'); });
  /* the Space Station card as dealt, face up, flat */
  const front = join(s.tmp, 'card-iss.png');
  await p.addStyleTag({ content: '#gift { background: transparent !important; } #gift > :not(.gp-deck) { visibility: hidden !important; } #gift .gp-dc .card__glare, #gift .gp-dc .card__shine { opacity: 0 !important; } #sky, #hud { visibility: hidden !important; } html, body { background: transparent !important; }' });
  await p.mouse.move(2, 2); await w(1200);
  const el = await p.$('#gift .gp-dc.face .card'); if (el) await el.screenshot({ path: front, omitBackground: true }); else throw new Error('no face card');
  await s.close(); t1.dir = s.tmp; t1.sfx = s.sfx;
  const [cw, ch] = pngSize(front), m = t1.marks;
  const norm = (x) => String(x).toUpperCase().replace(/ROCKET STAGE|R\/B/g, '').replace(/[^A-Z0-9]/g, '');
  const order = dealt.map((lab) => { const t = norm(lab.split(',')[0]); return rest.find((x) => { const n = norm(BY.get(String(x.id)).name); return n && (t.startsWith(n) || n.startsWith(t)); }) ?? null; });
  console.log('dealt', dealt.map((x) => x.split(',')[0]), '→', order.map((x) => x && BY.get(String(x.id)).name));
  if (order.some((x) => !x)) throw new Error('couldn’t match a dealt card');
  const pkF = { x: (pk.x + pk.width / 2) / VW, y: (pk.y + pk.height * 0.18) / VH };

  /* ── the edit (≈10 s) ── */
  const T0 = 0, TORN = 0.75, DEALT = 1.2, PER = 0.5, LAST = DEALT + rest.length * PER, FLIP = LAST + 1.25, HERO = FLIP + 0.15, END = HERO + 4.6;
  const map = [[T0, m.tear + 0.12], [TORN, m.torn + 0.25], [DEALT, m.dealt - 0.1, 'lin']];
  rest.forEach((_, k) => map.push([DEALT + k * PER + PER * 0.55, m['flip' + k] + 0.55, 'lin'], [DEALT + (k + 1) * PER, (m['away' + k] ?? m['flip' + k] + 1) + 0.25, 'lin']));
  map.push([LAST, m.last + 0.1, 'lin'], [FLIP, m.lastflip, 'lin'], [HERO, m.lastflip + 0.25, 'lin']);
  const CW = 300, R = ch / cw, CXd = VW / 2, CYd = VH * 0.53;
  const sealed = { from: END - 0.4, to: END + 1, take: 0, map: [[END - 0.4, m.in + 0.2], [END + 1, m.in + 0.21]], cam: [[0, 1.7, pkF.x, pkF.y, 0]] };
  const scene = {
    dur: END, takes: [t1], assets: [front, BACK],
    shots: [
      { from: 0, to: HERO, take: 0, map, cam: [[0, 1.7, pkF.x, pkF.y, 0], [TORN - 0.1, 1.55, pkF.x, pkF.y + 0.05, 0, 'lin'], [DEALT, 1.0, 0.5, 0.5, 0, 'out'], [LAST, 1.0, 0.5, 0.5, 0], [FLIP - 0.05, 1.12, 0.5, 0.5, 0, 'io'], [FLIP + 0.15, 1.3, 0.5, 0.5, 0, 'expo']],
        shake: [[LAST, 0], [LAST + 0.3, 0.6], [FLIP - 0.1, 1.0, 'lin'], [FLIP, 0]] },
      { from: HERO, to: END - 0.4 }, sealed],
    stars: [[0, 0, 0, 0], [HERO - 0.05, 0, 0, 0], [HERO, 1, 0, 0], [END - 0.45, 1, -50, 30, 'lin'], [END - 0.4, 0, 0, 0]],
    flashes: [{ at: FLIP + 0.02, dur: 0.3, x: 50, y: 53 }],
    zoomBlur: [{ from: FLIP - 0.1, to: FLIP + 0.18, x: 0.5, y: 0.53 }],
    card3d: [{ from: HERO, to: END - 0.4, front: basename(front), back: 'back-collector.webp', ratio: R,
      keys: [[HERO, CXd, CYd, CW * 1.05, 0, 0, 0, 1], [HERO + 0.5, CXd, CYd - 6, CW, 6, -4, 1, 1, 'out'], [HERO + 1.6, CXd, CYd, CW, -9, 5, -1.5, 1, 'io'], [HERO + 2.8, CXd, CYd - 6, CW, 8, -3, 1.2, 1, 'io'],
        [END - 0.9, CXd, CYd, CW, -4, 2, 0, 1, 'io'], [END - 0.4, CXd, VH * 0.62, CW * 0.5, 0, 25, 0, 0, 'in']],
      sheen: [[HERO, -0.2], [HERO + 0.9, 1.2, 'io'], [HERO + 2.0, 1.2], [HERO + 2.9, -0.2, 'io']], glow: [[HERO, 40], [HERO + 1, 14, 'io']], glowColor: '#4aa8ff' }],
    sparkles: [{ from: HERO, to: END - 0.5, n: 16, x: CXd, y: CYd, r: 180 }],
    leak: [[HERO - 0.05, 0], [HERO + 0.2, 0.6, 'out'], [HERO + 1.1, 0, 'io']],
    texts: [
      { from: 0, to: DEALT + 0.2, text: 'opening *last night’s* sky pack', y: 108, size: 'big', instant: true },
      { from: 0, to: END + 1, kind: 'tag', text: 'night 1', y: 46, left: 26, instant: true },
      ...order.flatMap((x, k) => { const o = BY.get(String(x.id)), a = DEALT + k * PER + PER * 0.35; return [
        { from: a, to: a + PER, text: line(o), y: 112, instant: true },
        { from: a, to: a + PER, kind: 'sticker', text: `${k + 1}/${rest.length + 1}`, y: 640, left: 182, rot: -4 }]; }),
      { from: LAST + 0.15, to: FLIP, text: '*wait…*', y: 112, size: 'big' },
      { from: HERO + 0.25, to: HERO + 2.1, text: 'people *live* on this one', y: 92, size: 'big' },
      { from: HERO + 2.2, to: END - 1.35, text: new Date(iss.t).getHours() < 12 ? 'caught it *before sunrise*' : `caught it at *${ft(iss.t)}*`, y: 92, size: 'big' },
      { from: END - 1.3, to: END - 0.4, text: 'rate my pull */10*', y: 92, size: 'big' },
      { from: END - 0.4, to: END + 1, text: 'opening *last night’s* sky pack', y: 108, size: 'big', instant: true },
    ],
  };
  const video = await compose('pack', scene, s.tmp);
  const cues = [['boom', 0, -3], ['app:tear', 0.0, 2], /* Sevaan's tearing sound (2026-11-14) */ ['whoosh', TORN - 0.1, -7], ['impact', TORN, -6],
    ...rest.flatMap((_, k) => { const a = DEALT + k * PER; return [['app:flip', a + 0.12, -4], ['tick', a + 0.35, -9], ['pop', a + 0.35, -10], ['whoosh', a + PER - 0.12, -12]]; }),
    ['riser', FLIP - 1.5, -6], ['sub', LAST + 0.3, -8], ['sub', LAST + 0.75, -8],
    ['impact', FLIP, 0], ['crack', FLIP, -3], ['app:r_rare', FLIP + 0.05, -1], ['app:shiny', FLIP + 0.1, -6], ['tick', HERO + 0.25, -8], ['shimmer', HERO + 0.4, -14], ['tick', HERO + 2.2, -8], ['tick', END - 1.3, -8], ['swell', END - 1.1, -11], ['whoosh', END - 0.5, -6]];
  for (const music of [true, false]) console.log(mix('morning-pack-v2', video, { dur: END, drop: FLIP, cues, music }));
  console.log('caught', rest.map((x) => line(BY.get(String(x.id)))).join(' | '));
}

/* Aim the app's circle at something until it's held steady, recording; returns the take (marks: aim, locked). */
async function lockOn(s, aim, tid, hold = 700, ease = 0.12) {
  const { p, w, take } = s;
  return take(async (mark) => { await p.evaluate(([a, e]) => { document.body.classList.add('quiet'); window.__ease = e; window.__aim = a; }, [aim, ease]); mark('aim');
    for (let i = 0, ok = 0; i < 160 && ok < 6; i++) { ok = (await p.evaluate((id) => String(window.__store.state.targetId) === String(id), tid)) ? ok + 1 : 0; await w(40); }
    mark('locked'); await w(hold); mark('end'); });
}
/* Collect what's in the circle now and photograph its card from the reveal; then close the reveal. */
async function catchCard(s, file) {
  const { p, w } = s;
  await p.evaluate(() => document.body.classList.remove('quiet')); await w(300);
  await p.click('#d-cta', { timeout: 3000 }).catch(() => p.click('#d-hit', { timeout: 1000, force: true }).catch(() => {}));
  await w(1600); await s.cardShot(file);
  await p.evaluate(() => document.getElementById('reveal')?.querySelector('.x-close')?.click()); await w(900);
}
const typeLine = (o, st) => { if (o.natural === 'planet' || /^planet:/.test(o.key ?? '')) return `${o.name.toLowerCase()}. yes, *the planet*.`;
  const y = o.launch?.slice(0, 4) ?? o.year; if (String(o.id) === '25544') return 'a house with *people* in it';
  if (o.type === 'rocket-body') return `a rocket stage from *${y}*`; if (o.type === 'debris') return `space junk from *${y}*`;
  if (/COSMOS|KOSMOS/i.test(o.name) && y < 1992) return `a soviet satellite from *${y}*`; if (/NOAA|METEOR|DMSP|TIROS|GOES/i.test(o.name)) return `a weather satellite from *${y}*`;
  return `a satellite from *${y}*`; };

/* ───────── 3 · "things above you right now that aren't stars" ───────── */
async function above() {
  const s = await rec({ when: '2026-10-17T19:30:00-04:00' }), { p, w } = s;
  await jumpToHero(p); await stopFollow(p); await w(1500);
  const up = await p.evaluate(() => { const st = window.__store.state, own = new Set(st.sightings.map((x) => String(x.cardKey))), vis = st.items.filter((x) => x.look?.visible && x.look.el > 22 && !x.obj.family && !own.has(String(x.obj.id)));
    const pick = (f) => vis.filter(f).sort((a, b) => (a.obj.launch ?? '9').localeCompare(b.obj.launch ?? '9'))[0]?.obj;
    const stage = pick((x) => x.obj.type === 'rocket-body'), cold = pick((x) => /COSMOS|KOSMOS/i.test(x.obj.name) && x.obj.type !== 'rocket-body'), sat = pick((x) => x.obj.type !== 'rocket-body' && x.obj.type !== 'station' && !/COSMOS|KOSMOS/i.test(x.obj.name));
    const iss = vis.find((x) => x.obj.type === 'station' && String(x.obj.id) === '25544')?.obj;
    const pl = (st.naturals ?? []).filter((n) => n.look.el > 12 && /^planet:/.test(n.obj.key ?? '')).sort((a, b) => b.look.el - a.look.el)[0]?.obj;
    return [stage, cold ?? sat, sat, pl, iss].filter(Boolean).filter((o, i, a) => a.findIndex((x) => x.id === o.id) === i).map((o) => ({ id: o.id, key: o.key ?? null, name: o.name, type: o.type, launch: o.launch, year: o.year, natural: o.natural, planet: !!o.key }));
  });
  console.log('above:', up.map((x) => x.name).join(' · '));
  if (up.length < 4 || String(up.at(-1).id) !== '25544') throw new Error('not enough up: ' + up.map((x) => x.name));
  const takes = [], files = [];
  for (const [k, o] of up.entries()) { const tk = await lockOn(s, o.key ?? o.id, o.id, 650, k ? 0.16 : 0.1); tk.dir = s.tmp; tk.sfx = s.sfx; takes.push(tk); const f = join(s.tmp, `card-${k}.png`); await catchCard(s, f); files.push(f); }
  await s.close();
  const SEG = 1.4, HOOK = 0.0, n = up.length, END = n * SEG + 1.9;
  const shots = [], cards3 = [], texts = [{ from: 0, to: END + 1, text: 'things above you right now that *aren’t stars*', y: 58, instant: true }], rings = [], flashes = [], cues = [['boom', 0, -3]];
  up.forEach((o, k) => { const a = k * SEG, tk = takes[k], last = k === n - 1, dur = last ? SEG + 1.9 : SEG;
    const lockT = a + 0.45;
    shots.push({ from: a, to: a + dur, take: k, map: [[a, Math.max(tk.marks.aim, tk.marks.locked - 0.45)], [lockT, tk.marks.locked, 'lin'], [a + dur, tk.marks.locked + 0.6, 'lin']],
      cam: [[a, 1.15, 0.5, 0.5, 0], [lockT, 1.05, 0.5, 0.5, 0, 'out'], [lockT + 0.25, 1.28, 0.5, 0.5, 0, 'expo'], [a + dur, last ? 1.36 : 1.3, 0.5, 0.5, 0, 'lin']] });
    rings.push({ at: lockT, x: VW / 2, y: VH / 2, r0: 40, r1: 130, dur: 0.45 });
    const [cw, ch] = pngSize(files[k]), R = ch / cw, wpx = last ? 250 : 150, cx = last ? VW / 2 : VW * 0.66, cy = last ? VH * 0.6 : VH * 0.66;
    cards3.push({ from: lockT + 0.05, to: a + dur, front: basename(files[k]), back: 'back-collector.webp', ratio: R,
      keys: [[lockT + 0.05, VW / 2, VH / 2, 20, 160, 0, 0, 1], [lockT + 0.4, cx, cy, wpx, last ? 360 : 352, -4, last ? 0 : 4, 1, 'expo'], [a + dur, cx, cy - 6, wpx, last ? 354 : 345, 3, last ? 0 : 5, 1, 'io']],
      sheen: [[lockT + 0.3, -0.2], [lockT + 1.0, 1.2, 'io']], glow: [[lockT + 0.4, 24], [a + dur, 8, 'io']], glowColor: last ? '#4aa8ff' : '#fa8127' });
    texts.push({ from: lockT + 0.05, to: last ? a + dur - 1.3 : a + dur, text: `${k + 1}. ${typeLine(o)}`, y: 128, size: 'big', instant: true });
    cues.push(['whoosh', a + 0.02, -8], ['app:lock', lockT, -3], ['tick', lockT, -8], ['pop', lockT + 0.15, -6], ['sub', lockT + 0.05, -6]);
    if (last) { flashes.push({ at: lockT + 0.02, dur: 0.3, x: 50, y: 50 }); cues.push(['impact', lockT, -1], ['crack', lockT, -4], ['app:r_rare', lockT + 0.1, -2], ['shimmer', lockT + 0.5, -14]); }
  });
  texts.push({ from: END - 1.25, to: END, text: 'which one *surprised you?*', y: 128, size: 'big', instant: true });
  shots.push({ from: END, to: END + 1, take: 0, map: [[END, takes[0].marks.aim + 0.02], [END + 1, takes[0].marks.aim + 0.03]], cam: [[0, 1.15, 0.5, 0.5, 0]] });
  const scene = { dur: END, takes, assets: [...files, BACK], shots, card3d: cards3, rings, flashes, texts,
    sparkles: [{ from: (n - 1) * SEG + 0.9, to: END, n: 14, x: VW / 2, y: VH * 0.6, r: 150 }], leak: [[(n - 1) * SEG + 0.4, 0], [(n - 1) * SEG + 0.7, 0.5, 'out'], [(n - 1) * SEG + 1.6, 0, 'io']] };
  cues.push(['swell', END - 1.0, -12], ['whoosh', END - 0.35, -7]);
  const video = await compose('above', scene, s.tmp);
  for (const music of [true, false]) console.log(mix('things-above-you', video, { dur: END, drop: (n - 1) * SEG + 0.45, cues, music }));
}

/* ───────── 4 · "when is it over your city?" (Toronto, a real pass, today's orbits) ───────── */
async function city() {
  if (!catalog) throw new Error('pass --catalog=<today’s catalog.json>');
  const TOR = { latitude: 43.6532, longitude: -79.3832, tz: 'America/Toronto' }, obs = { lat: TOR.latitude, lon: TOR.longitude, heightKm: 0.08 };
  /* the next good evening pass over Toronto from the catalogue's orbits */
  const o = BY.get('25544'); o.satrec ??= orbit.satrecFor(o); o.stdMag = o.stdMag ?? -1.8;
  let pass = null; for (let t = Date.parse('2026-11-15T00:00:00-05:00'); t < Date.parse('2026-11-20T00:00:00-05:00') && !pass; t += 10e3) { const f = orbit.frame(new Date(t), obs), l = orbit.look(o, f);
    if (l?.visible && l.el > 35 && new Date(t).getHours() >= 17) { let a = t; while (orbit.look(o, orbit.frame(new Date(a - 10e3), obs))?.visible) a -= 10e3; let pk = t, best = l.el; for (let u = t; orbit.look(o, orbit.frame(new Date(u), obs))?.visible; u += 5e3) { const e = orbit.look(o, orbit.frame(new Date(u), obs)).el; if (e > best) { best = e; pk = u; } } pass = { start: a, peak: pk, el: best }; } }
  const startAz = azel(25544, pass.start, obs)[0], dir = orbit.compassPoint(startAz).toLowerCase(), word = { w: 'west', nw: 'northwest', sw: 'southwest', n: 'north', s: 'south', e: 'east', ne: 'northeast', se: 'southeast' }[dir.replace(/[^nsew]/g, '').slice(0, 2)] ?? dir;
  const day = new Date(pass.start).toLocaleDateString('en-CA', { weekday: 'long', timeZone: 'America/Toronto' }).toLowerCase(), when = ft(pass.start);
  console.log('city: pass', new Date(pass.start).toString(), 'peak', Math.round(pass.el), '°, from', word);
  /* its ground track for the 14 minutes before it rises here, to the peak */
  const track = []; for (let t = pass.start - 14 * 60e3; t <= pass.peak; t += 20e3) { const q = orbit.overEarth(o, new Date(t)); if (q) track.push([q.lat, q.lon]); }
  const s = await rec({ when: new Date(pass.start + 20e3).toISOString(), place: TOR, catalog }), { p, w, take } = s;
  await w(2500);
  const SPAN = Math.min(70e3, pass.peak - pass.start + 20e3), mid = azel(25544, pass.start + 20e3 + SPAN * 0.5, obs);
  await p.evaluate(([az, el]) => { const st = window.__store.state; st.drag.az = az; st.drag.el = el; document.body.classList.add('quiet'); }, mid); await w(900);
  const t1 = await take(async (mark) => { mark('in'); const t0 = Date.now(); while (Date.now() - t0 < 1700) { await p.clock.fastForward(Math.round(SPAN / 42)); await w(28); } mark('end'); }); t1.dir = s.tmp; t1.sfx = s.sfx;
  const t2 = await lockOn(s, 25544, 25544, 900, 0.08); t2.dir = s.tmp; t2.sfx = s.sfx;
  const front = join(s.tmp, 'card-city.png'); await catchCard(s, front); await s.close();
  const [cw, ch] = pngSize(front), R = ch / cw;
  /* ── the edit ── */
  const G = 3.2, B = G + 1.6, L = B + 1.0, HERO = L + 0.55, END = HERO + 3.2;
  const scene = { dur: END, takes: [t1, t2], assets: [front, BACK], earth: true,
    globe: { from: 0, to: G + 0.25, track, pin: [obs.lat, obs.lon],
      keys: [[0, VW / 2, VH * 0.56, 150, 20, -40], [1.4, VW / 2, VH * 0.56, 190, 34, -62, 'io'], [G, VW / 2, VH * 0.56, 1500, obs.lat, obs.lon, 'in']], trackKeys: [[0.2, 0], [2.2, 1, 'io']], fade: [[G - 0.15, 1], [G + 0.2, 0]] },
    stars: [[0, 1, 0, 0], [G, 1, -80, 40, 'lin'], [G + 0.2, 0, 0, 0]],
    shots: [{ from: 0, to: G, still: null }, { from: G, to: B, take: 0, map: [[G, t1.marks.in], [B, t1.marks.end]], cam: [[G, 1.55, 0.5, 0.5, 0], [B, 1.25, 0.5, 0.5, 0, 'lin']] },
      { from: B, to: HERO, take: 1, map: [[B, t2.marks.aim], [L, t2.marks.locked, 'lin'], [HERO, t2.marks.end]], cam: [[B, 1.25, 0.5, 0.5, 0], [L, 1.05, 0.5, 0.5, 0, 'out'], [L + 0.25, 1.32, 0.5, 0.5, 0, 'expo']] },
      { from: HERO, to: END - 0.4 }, { from: END - 0.4, to: END + 1, still: null }],
    flashes: [{ at: G, dur: 0.3, x: 50, y: 50 }, { at: HERO, dur: 0.28, x: 50, y: 50 }], zoomBlur: [{ from: G - 0.25, to: G + 0.1, x: 0.5, y: 0.56 }],
    rings: [{ at: L, x: VW / 2, y: VH / 2, r0: 46, r1: 160, dur: 0.55 }],
    card3d: [{ from: HERO, to: END - 0.4, front: basename(front), back: 'back-collector.webp', ratio: R,
      keys: [[HERO, VW / 2, VH / 2, 30, 180, 20, 0, 1], [HERO + 1.0, VW / 2, VH * 0.56, 290, 720, 0, 0, 1, 'expo'], [END - 0.8, VW / 2, VH * 0.55, 290, 712, 5, 1, 1, 'io'], [END - 0.4, VW / 2, VH * 0.56, 40, 700, 0, 0, 0, 'in']],
      sheen: [[HERO + 0.9, -0.2], [HERO + 1.8, 1.2, 'io']], glow: [[HERO + 0.9, 30], [END, 10, 'io']], glowColor: '#4aa8ff' }],
    sparkles: [{ from: HERO + 0.9, to: END - 0.5, n: 12, x: VW / 2, y: VH * 0.56, r: 170 }],
    texts: [
      { from: 0, to: G, text: `the space station flies over *toronto* ${day} at *${when}*`, y: 74, size: 'big', instant: true },
      { from: G, to: L, text: `look *${word}*`, y: 110, size: 'big' },
      { from: L, to: HERO, text: 'that’s it. brighter than any star.', y: 110 },
      { from: HERO + 0.9, to: END - 0.45, text: 'drop your city. i’ll tell you when it’s over *you*', y: 84 },
      { from: END - 0.4, to: END + 1, text: `the space station flies over *toronto* ${day} at *${when}*`, y: 74, size: 'big', instant: true }] };
  const cues = [['boom', 0, -3], ['twinkle', 0.3, -16], ['riser', G - 1.5, -8], ['whoosh', G - 0.25, -5], ['impact', G, -3], ['whoosh', G + 0.6, -10], ['app:lock', L, -3], ['sub', L, -4], ['tick', L, -8],
    ['impact', HERO, -1], ['crack', HERO, -4], ['app:collect', HERO, -4], ['app:r_rare', HERO + 0.95, -2], ['shimmer', HERO + 1.2, -14], ['tick', HERO + 0.9, -8], ['whoosh', END - 0.45, -6]];
  const video = await compose('city', scene, s.tmp);
  const name = `over-toronto-${new Date(pass.start).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }).toLowerCase().replace(/\s+/g, '')}`;
  for (const music of [true, false]) console.log(mix(name, video, { dur: END, drop: HERO, cues, music }));
}

const JOBS = { light, pack, above, city };
await JOBS[which]();
