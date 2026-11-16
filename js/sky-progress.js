// XP and rank for Sky Collector (2026-11-15). Everything here is DERIVED from the catch records (js/catch-store.js
// allCatches) by replaying them oldest first with the same stamp rules as js/sky-stamps.js, so nothing is stored per
// tap: a reload, a restore from the iCloud backup or a second phone gives the same total. No DOM, no storage.
//   new flight card 80 · new plane card 60 · new stamp 10 (each stamp: a new day on a flight, a new aircraft of a plane type)
//   level-up bonus on top of the stamp: Silver 40, Gold 100 · same aircraft on the same local day: 0
// A catch that opens a new flight AND a new plane type earns both (140); a catch can also earn a flight stamp and a plane stamp.
// Ranks are Sky Collector's own list in js/progress.js (RANKS, same [xp, name] table Space Collector uses).
import { RANKS } from './progress.js?v=0.1.1648';
import { localDay, levelFor, levelRank } from './sky-stamps.js?v=0.1.1648';

export const XP = { newFlight: 80, newPlane: 60, stamp: 10, levelUp: { silver: 40, gold: 100 } };

const idOf = (c) => `${c?.time}:${c?.hex ?? ''}`;
const hexOf = (c) => String(c?.hex || `anon:${c?.time}`).toLowerCase(); // as sky-stamps.js

// Replay the catches oldest first. Returns [{ catch, xp, parts: [{ kind: 'newFlight'|'newPlane'|'stamp'|'levelUp', on: 'flight'|'plane', xp, level? }] }].
export function xpLedger(list) {
  const sorted = [...(list ?? [])].filter((c) => c?.time).sort((a, b) => a.time - b.time);
  const flights = new Map(), planes = new Map(); // key -> Set of local days / Set of hexes
  const out = [];
  const step = (map, key, member, kind, on, parts) => {
    if (!key) return;
    let set = map.get(key); if (!set) map.set(key, (set = new Set()));
    if (set.has(member)) return; // same aircraft on the same day (flight) / the aircraft again (plane): nothing
    const before = set.size, lvBefore = levelFor(kind, before); set.add(member); const n = set.size, lv = levelFor(kind, n);
    if (before === 0) parts.push({ kind: on === 'flight' ? 'newFlight' : 'newPlane', on, xp: on === 'flight' ? XP.newFlight : XP.newPlane });
    else {
      parts.push({ kind: 'stamp', on, xp: XP.stamp });
      if (levelRank(lv) > levelRank(lvBefore) && XP.levelUp[lv]) parts.push({ kind: 'levelUp', on, level: lv, xp: XP.levelUp[lv] });
    }
  };
  for (const c of sorted) {
    const parts = [];
    step(flights, c.flight?.key, localDay(c.time), 'flight', 'flight', parts);
    step(planes, c.plane?.key, hexOf(c), 'plane', 'plane', parts);
    out.push({ catch: c, xp: parts.reduce((s, p) => s + p.xp, 0), parts });
  }
  return out;
}

export const totalXp = (list) => xpLedger(list).reduce((s, e) => s + e.xp, 0);

// Rank for an XP total, in the shape js/progress.js gives: { name, index, at, next, nextName }.
export function rankFor(xp) {
  let i = 0; for (let k = 0; k < RANKS.length; k++) if (xp >= RANKS[k][0]) i = k;
  return { name: RANKS[i][1], index: i, at: RANKS[i][0], next: RANKS[i + 1]?.[0] ?? null, nextName: RANKS[i + 1]?.[1] ?? null };
}

// Where you stand now: { xp, rank, pct (0-100 through the current rank), toNext (XP left, 0 at the top), cards? }.
export function standing(list) {
  const xp = totalXp(list), rank = rankFor(xp);
  const pct = rank.next ? Math.round(((xp - rank.at) / (rank.next - rank.at)) * 100) : 100;
  return { xp, rank, pct, toNext: rank.next ? rank.next - xp : 0 };
}

// What one catch earned. `list` is the catches with or without newCatch in it (collect() saves before it shows, so
// it is usually already there); newCatch defaults to the newest catch. Returns what playReveal wants:
//   { xp (= gained), gained, parts, rank: { from, to, name, at, next, prev? }, rankUp: name|null, bar: { from, to, pct } }
// rank is playReveal's rank bar shape; prev is set on a rank-up so the bar fills the old rank first.
export function progressAfter(list, newCatch = null) {
  const all = [...(list ?? [])], nc = newCatch ?? all.at(-1);
  const rest = nc ? all.filter((c) => idOf(c) !== idOf(nc)) : all;
  const before = totalXp(rest), led = xpLedger([...rest, ...(nc ? [nc] : [])]);
  const mine = nc ? led.find((e) => idOf(e.catch) === idOf(nc)) : null;
  const gained = mine?.xp ?? 0, after = before + gained;
  const rb = rankFor(before), ra = rankFor(after), rankUp = ra.index > rb.index;
  const pct = (v, r) => (r.next ? Math.round(Math.max(0, Math.min(1, (v - r.at) / (r.next - r.at))) * 100) : 100);
  return { xp: gained, gained, parts: mine?.parts ?? [], rankUp: rankUp ? ra.name : null,
    rank: { from: before, to: after, name: ra.name, at: ra.at, next: ra.next, ...(rankUp ? { prev: { name: rb.name, at: rb.at, next: rb.next } } : {}) },
    bar: { from: pct(before, rb), to: pct(after, ra) } };
}
