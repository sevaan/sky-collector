// Send cards (2026-11-07, Sevaan; design/send-cards.html and design/booster-pack.html): cards move from one phone to
// another inside a link. No accounts and no server: the sightings ride in the link's # part, which browsers never send
// anywhere, compressed. A card is never stored as itself, only worked out from its sightings, so sending only ever adds
// or removes sightings; nothing on the other phone is overwritten and every card fact stays true.
// This module is the rules and the link format (no DOM); the screens are js/send-cards.js (sending, in the Collection)
// and js/gift-pack.js (receiving, the booster pack). Tests: tests/gift.test.mjs.
import { nightKey } from './observation.js?v=0.1.1580';

export const GIFT_HOST = 'https://skycollector.app/c/';
export const SAME_MOMENT_MS = 10 * 60e3; // a sent sighting of the same object within 10 min of one you have = the same moment (you were out together)
export const MAX_LINK = 60000; // characters; far more than a normal send (1,700 sightings is about 15,000)

// The id a sighting keeps on every phone and in the iCloud backup: its time, card and object. (js/cloud-backup.js uses it.)
export function backupId(s) {
  let h = 2166136261; for (const c of `${s.time}|${s.cardKey}|${s.objectId ?? ''}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `${s.time}-${h.toString(36)}`;
}

// ---------- the link ----------
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) : null); // tenths, as integers
const un1 = (x) => (x == null ? undefined : x / 10);
const int = (x) => (Number.isFinite(x) ? Math.round(x) : null);
// Rows are arrays, the card keys and objects listed once, times as gaps from the one before: about a third of the
// size of plain JSON before compression.
export function packGift(sightings, { from = '', bid = null, deals = {}, themes = {} } = {}) {
  const rows = sightings.filter((s) => s && !s.sim).slice().sort((a, b) => a.time - b.time);
  const keys = [], kIx = new Map(), objs = [], oIx = new Map(), strs = [], sIx = new Map();
  const K = (k) => { k = String(k); if (!kIx.has(k)) { kIx.set(k, keys.length); keys.push(k); } return kIx.get(k); };
  const S = (v) => { if (v == null || v === '') return -1; v = String(v); if (!sIx.has(v)) { sIx.set(v, strs.length); strs.push(v); } return sIx.get(v); };
  const O = (s) => { const id = String(s.objectId ?? s.cardKey); if (!oIx.has(id)) { oIx.set(id, objs.length); objs.push([id, s.name ?? '', s.type ?? '', s.year ?? null]); } return oIx.get(id); };
  let prev = 0;
  const out = rows.map((s) => { const r = [s.time - prev, K(s.cardKey), O(s), S(s.stampKey), r1(s.lat), r1(s.lon), int(s.az), int(s.el), r1(s.mag), int(s.rangeKm), S(s.shiny), S(s.phase)]; prev = s.time; return r; });
  const nights = new Set(rows.map((s) => String(nightKey(s.time, s.lon ?? 0))));
  const d = Object.fromEntries(Object.entries(deals ?? {}).filter(([k]) => nights.has(String(k))));
  return { v: 1, f: String(from ?? '').slice(0, 40), m: 0, b: bid ?? null, at: Date.now(), k: keys, o: objs, s: strs, r: out, d, w: themes ?? {} };
}
export function unpackGift(g) {
  if (!g || typeof g !== 'object') throw new Error('bad');
  if (g.v !== 1) throw new Error('newer');
  let t = 0;
  const list = (g.r ?? []).map((r) => {
    t += r[0];
    const o = g.o[r[2]] ?? [], s = { objectId: o[0], cardKey: g.k[r[1]], time: t, name: o[1] || undefined, type: o[2] || undefined, year: o[3] ?? undefined,
      lat: un1(r[4]), lon: un1(r[5]), az: r[6] ?? undefined, el: r[7] ?? undefined, mag: un1(r[8]), rangeKm: r[9] ?? undefined, sim: false };
    if (r[3] >= 0) s.stampKey = g.s[r[3]];
    if (r[10] >= 0) s.shiny = g.s[r[10]];
    if (r[11] >= 0) s.phase = g.s[r[11]];
    if (g.f) s.from = g.f;
    for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
    return s;
  });
  if (list.some((s) => !s.cardKey || !Number.isFinite(s.time))) throw new Error('bad');
  return { from: g.f || '', bid: g.b ?? null, at: g.at ?? null, sightings: list, deals: g.d ?? {}, themes: g.w ?? {} };
}
// base64url of the deflated JSON. CompressionStream is in every browser the app runs in (iOS 16.4+, Android WebView 80+).
const b64u = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '~').replace(/=+$/, ''); }; /* '~', not base64url's '_': chats and markdown read _x_ as italics and drop the underscores (2026-11-07, a test link arrived cut short) */
const unb64u = (str) => { const s = atob(str.replace(/-/g, '+').replace(/[_~]/g, '/')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
export async function giftCode(g) { return `g1${b64u(await pipe(new TextEncoder().encode(JSON.stringify(g)), new CompressionStream('deflate-raw')))}`; }
export async function readGiftCode(code) {
  const m = /^g(\d)([A-Za-z0-9_~-]+)$/.exec(String(code ?? '').trim()); // one digit of version: the code itself can start with a digit
  if (!m) throw new Error('bad');
  if (m[1] !== '1') throw new Error('newer');
  let json; try { json = new TextDecoder().decode(await pipe(unb64u(m[2]), new DecompressionStream('deflate-raw'))); } catch { throw new Error('cut'); } // a link a chat app cut short won't inflate
  let g; try { g = JSON.parse(json); } catch { throw new Error('cut'); }
  return unpackGift(g);
}
export const giftLink = (code) => `${GIFT_HOST}#${code}`;
// Short links (2026-11-07): the pack is stored on our server (functions/index.js /api/pack) and the link carries only its
// 7-character id: https://skycollector.app/c/<id>, skycollector://c/<id>, or ?p=<id>.
export const packLink = (id) => `https://skycollector.app/c/${id}`;
export function packIdFrom(url) { const m = /(?:\/c\/|[?&]p=)([A-Za-z0-9]{7})(?![A-Za-z0-9])/.exec(String(url ?? '')); return m ? m[1] : null; }
// The code in anything that might carry one: the https link, the app's own skycollector://c#… link, or a page hash.
export function codeFrom(url) { const m = /(?:#|[?&]g=)(g\d[A-Za-z0-9_~-]+)/.exec(String(url ?? '')); return m ? m[1] : null; } // ?g= too: an Android intent link can't carry a #

// ---------- receiving ----------
// What a received pack adds: sightings this phone has already (same id) are skipped, and so is a sighting of an object
// within 10 minutes of one this phone has (both phones caught it together). Returns { add, dup, same }.
export function planImport(existing, incoming) {
  const ids = new Set(existing.filter((s) => !s.sim).map(backupId)), byObj = new Map();
  for (const s of existing) { if (s.sim) continue; const k = String(s.objectId ?? s.cardKey); (byObj.get(k) ?? byObj.set(k, []).get(k)).push(s.time); }
  const add = [], seen = new Set(); let dup = 0, same = 0;
  for (const s of incoming.slice().sort((a, b) => a.time - b.time)) {
    const id = backupId(s);
    if (ids.has(id) || seen.has(id)) { dup++; continue; }
    const k = String(s.objectId ?? s.cardKey);
    if ((byObj.get(k) ?? []).some((t) => Math.abs(t - s.time) < SAME_MOMENT_MS)) { same++; continue; }
    seen.add(id); add.push(s);
  }
  return { add, dup, same };
}
// What each card gains, for the pack's tags and the list after it. levelOf(sightings, card) → 'none'|'bronze'|'silver'|'gold'.
export function summarizeImport(existing, add, { cardOf = () => null, levelOf = () => 'none' } = {}) {
  const mine = new Map(), adds = new Map();
  for (const s of existing) if (!s.sim) (mine.get(s.cardKey) ?? mine.set(s.cardKey, []).get(s.cardKey)).push(s);
  for (const s of add) (adds.get(s.cardKey) ?? adds.set(s.cardKey, []).get(s.cardKey)).push(s);
  const nights = (l) => new Set(l.map((s) => nightKey(s.time, s.lon ?? 0))).size, stamps = (l) => new Set(l.map((s) => s.stampKey).filter(Boolean));
  const out = [];
  for (const [key, a] of adds) {
    const before = mine.get(key) ?? [], after = [...before, ...a], card = cardOf(key);
    const st0 = stamps(before), st1 = stamps(after), shiny0 = before.some((s) => s.shiny), shiny1 = after.some((s) => s.shiny);
    out.push({ key, card, sightings: after, added: a.length, isNew: !before.length, nightsFrom: nights(before), nightsTo: nights(after),
      stampsGain: st1.size - st0.size, moon: key === 'moon', shinyGain: !shiny0 && shiny1 && !card?.launches,
      levelFrom: before.length ? levelOf(before, card) : 'none', levelTo: levelOf(after, card) });
  }
  return out;
}
// Tags for a card in the pack: New, +2 nights, Now Silver, +2 phases, +3 launches, Shiny.
export function giftTags(x) {
  const t = [];
  if (x.isNew) t.push(['new', 'New']);
  else if (x.card?.launches && x.stampsGain) t.push(['up', `+${x.stampsGain} launch${x.stampsGain === 1 ? '' : 'es'}`]);
  else if (x.moon && x.stampsGain) t.push(['up', `+${x.stampsGain} phase${x.stampsGain === 1 ? '' : 's'}`]);
  else if (x.nightsTo > x.nightsFrom) t.push(['up', `+${x.nightsTo - x.nightsFrom} night${x.nightsTo - x.nightsFrom === 1 ? '' : 's'}`]);
  else t.push(['up', `+${x.added} sighting${x.added === 1 ? '' : 's'}`]);
  const rank = { none: 0, bronze: 1, silver: 2, gold: 3 };
  if (!x.isNew && rank[x.levelTo] > rank[x.levelFrom] && rank[x.levelTo] >= 2) t.push(['up', `Now ${x.levelTo[0].toUpperCase()}${x.levelTo.slice(1)}`]);
  if (x.shinyGain) t.push(['shiny', 'Shiny']);
  return t;
}
const TIER_N = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
// The cards dealt one by one (the rest arrive in the grid after): every new Rare or better, then level-ups and shines,
// then new cards, up to 7; dealt from the least to the best, so the pack ends on its best card.
export function pickHighlights(summary, n = 7) {
  const score = (x) => (x.isNew ? 100 : 0) + (TIER_N[x.card?.tier] ?? 0) * 30 + (x.shinyGain ? 60 : 0) + (x.levelTo !== x.levelFrom && !x.isNew ? 25 : 0) + Math.min(10, x.added);
  return summary.slice().sort((a, b) => score(b) - score(a)).slice(0, n).sort((a, b) => score(a) - score(b));
}

// ---------- sending ----------
// The send's own words, so the sheet, the toast and the button never disagree.
export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
