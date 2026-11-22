// Send cards (2026-11-07, Sevaan; design/send-cards.html and design/booster-pack.html): cards move from one phone to
// another inside a link. No accounts and no server: the sightings ride in the link's # part, which browsers never send
// anywhere, compressed. A card is never stored as itself, only worked out from its sightings, so sending only ever adds
// or removes sightings; nothing on the other phone is overwritten and every card fact stays true.
// This module is the rules and the link format (no DOM); the screens are js/send-cards.js (sending, in the Collection)
// and js/gift-pack.js (receiving, the booster pack). Tests: tests/gift.test.mjs.
import { nightKey } from './observation.js?v=0.1.1889';
import { scrubSightings } from './plane-privacy.js?v=0.1.1889';

export const GIFT_HOST = 'https://skycollector.app/c/';

// A card is a card (2026-11-11, design/morning-pack.html): a card someone sent you is in your collection like any
// other, but it isn't a sighting of yours. Received sightings carry via: 'gift' and no place; they make the card
// yours (and bring its launch stamps and shine), but never your dates, nights, levels, XP, missions or stats.
export const isGift = (s) => s?.via === 'gift';
export const ownSightings = (list) => (list ?? []).filter((s) => s && !s.sim && !isGift(s));
// Received before the mark existed: your own catches are logged as they happen; a received one was logged when its
// pack was opened, usually days later. Story cards keep the time their secret was found, so they're never counted.
export const LATE_LOG_MS = 3600e3;
export const looksReceived = (s) => !!s && !s.via && !s.sim && s.type !== 'story' && Number.isFinite(s.loggedAt) && Number.isFinite(s.time) && s.loggedAt - s.time > LATE_LOG_MS;
// What a received sighting keeps: the card, the object, its time (so opening the same link twice adds nothing), a launch
// stamp, a shine, a Moon phase. Never the sender's place.
export function asGift(s) { const g = { ...s, via: 'gift' }; for (const k of ['lat', 'lon', 'az', 'el', 'rangeKm']) delete g[k]; return g; }
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
// Rows are arrays, the card keys and objects listed once, times as gaps from the one before: about a third of the
// size of plain JSON before compression.
export function packGift(sightings, { from = '', bid = null, deals = {}, themes = {}, kind = '' } = {}) {
  const rows = scrubSightings(sightings.filter((s) => s && !s.sim)).list.sort((a, b) => a.time - b.time); /* never a private, business, military or government aircraft's callsign, registration, real id or operator (QA 2026-11-19: catches saved before the privacy rules) */
  const keys = [], kIx = new Map(), objs = [], oIx = new Map(), strs = [], sIx = new Map();
  const K = (k) => { k = String(k); if (!kIx.has(k)) { kIx.set(k, keys.length); keys.push(k); } return kIx.get(k); };
  const S = (v) => { if (v == null || v === '') return -1; v = String(v); if (!sIx.has(v)) { sIx.set(v, strs.length); strs.push(v); } return sIx.get(v); };
  const O = (s) => { const id = String(s.objectId ?? s.cardKey); if (!oIx.has(id)) { oIx.set(id, objs.length); objs.push([id, s.name ?? '', s.type ?? '', s.year ?? null]); } return oIx.get(id); };
  let prev = 0;
  const out = rows.map((s) => { const r = [s.time - prev, K(s.cardKey), O(s), S(s.stampKey), null, null, null, null, r1(s.mag), null, S(s.shiny), S(s.phase)]; /* no places: a sent card is a card, not your night (2026-11-11) */ prev = s.time; return r; });
  void deals; void themes; /* missions no longer travel: a sent card doesn't count toward the receiver's nights */
  /* Sky Collector's plane cards are drawn from the snapshot taken when they were caught (js/sky-cards.js skyModel), which
     a satellite's card never needed: one copy per card goes along (2026-11-19, review Part 2 A: without it a sent plane
     card arrived with nothing to draw). Older apps ignore 'c'. */
  const snaps = {}; for (const r of rows) if (r.cardSnapshot && typeof r.cardSnapshot === 'object' && !(r.cardKey in snaps)) snaps[r.cardKey] = r.cardSnapshot;
  return { v: 1, f: String(from ?? '').slice(0, 40), m: 0, b: bid ?? null, at: Date.now(), k: keys, o: objs, s: strs, r: out, d: {}, w: {}, ...(Object.keys(snaps).length ? { c: snaps } : {}), ...(kind ? { n: String(kind).slice(0, 12) } : {}) }; /* n: what the pack is ('night': Share my night; older apps ignore it) */
}
export const MAX_ROWS = 20000; // sightings in one pack; a link is untrusted input
export function unpackGift(g) {
  if (!g || typeof g !== 'object') throw new Error('bad');
  if (g.v !== 1) throw new Error('newer');
  /* A link is untrusted (a hostile or corrupt one must not freeze the app or store junk): bounded size, array tables,
     whole-number indexes, and every kept field of the right type and a sane length (the deep review, 2026-11-12). */
  const arr = (x) => (Array.isArray(x) ? x : []), K = arr(g.k), O = arr(g.o), S = arr(g.s), R = arr(g.r);
  if (R.length > MAX_ROWS) throw new Error('bad');
  const at = (a, i) => (Number.isInteger(i) && i >= 0 && i < a.length ? a[i] : undefined);
  const str = (x, n) => (typeof x === 'string' && x.length <= n ? x : undefined), num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
  const from = typeof g.f === 'string' ? g.f.slice(0, 40) : '', late = Date.now() + 2 * 86400e3;
  let t = 0;
  const list = R.map((r) => {
    if (!Array.isArray(r)) throw new Error('bad');
    t += r[0];
    const o = arr(at(O, r[2])), oid = o[0], s = { objectId: typeof oid === 'number' && Number.isFinite(oid) ? oid : str(oid, 80), cardKey: str(at(K, r[1]), 80), time: t, name: str(o[1], 120) || undefined, type: str(o[2], 40) || undefined, year: num(o[3]),
      lat: un1(num(r[4])), lon: un1(num(r[5])), az: num(r[6]), el: num(r[7]), mag: un1(num(r[8])), rangeKm: num(r[9]), sim: false };
    if (r[3] >= 0) s.stampKey = str(at(S, r[3]), 80);
    if (r[10] >= 0) s.shiny = str(at(S, r[10]), 24);
    if (r[11] >= 0) s.phase = str(at(S, r[11]), 24) ?? num(at(S, r[11]));
    if (from) s.from = from;
    for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
    return s;
  });
  if (list.some((s) => !s.cardKey || !Number.isFinite(s.time) || s.time < 1e12 || s.time > late)) throw new Error('bad'); /* 1e12 = Sept 2001: a real sighting time in ms */
  /* plane card snapshots (packGift 'c'): untrusted too, so only plain data of a bounded size, for a card that's in the pack */
  const C = g.c && typeof g.c === 'object' && !Array.isArray(g.c) ? g.c : null;
  if (C) { const inPack = new Set(list.map((x) => x.cardKey)); let n = 0;
    for (const [k, v] of Object.entries(C)) { if (++n > 2000) break; if (!inPack.has(k) || !v || typeof v !== 'object' || Array.isArray(v)) continue;
      let j; try { j = JSON.stringify(v); } catch { continue; } if (j.length > 8000) continue;
      const snap = JSON.parse(j); if (snap.key !== k || !['flight', 'plane'].includes(snap.sky)) continue;
      for (const x of list) if (x.cardKey === k) x.cardSnapshot = snap; } }
  const safe = scrubSightings(list).list; /* a pack from an older app can't bring a private aircraft's details in (QA 2026-11-19) */
  return { from, bid: typeof g.b === 'string' ? g.b.slice(0, 80) : null, at: num(g.at) ?? null, sightings: safe, deals: g.d && typeof g.d === 'object' ? g.d : {}, themes: g.w && typeof g.w === 'object' ? g.w : {}, kind: typeof g.n === 'string' ? g.n.slice(0, 12) : '' };
}
// base64url of the deflated JSON. CompressionStream is in every browser the app runs in (iOS 16.4+, Android WebView 80+).
const b64u = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '~').replace(/=+$/, ''); }; /* '~', not base64url's '_': chats and markdown read _x_ as italics and drop the underscores (2026-11-07, a test link arrived cut short) */
const unb64u = (str) => { const s = atob(str.replace(/-/g, '+').replace(/[_~]/g, '/')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
/* inflate with a ceiling: a small hostile link can unpack to tens of megabytes */
export const MAX_CODE = 400000, MAX_JSON = 6e6;
async function inflate(bytes) {
  const rd = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (n > MAX_JSON) { try { await rd.cancel(); } catch {} throw new Error('big'); } parts.push(value); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
export async function giftCode(g) { return `g1${b64u(await pipe(new TextEncoder().encode(JSON.stringify(g)), new CompressionStream('deflate-raw')))}`; }
export async function readGiftCode(code) {
  const m = /^g(\d)([A-Za-z0-9_~-]+)$/.exec(String(code ?? '').trim()); // one digit of version: the code itself can start with a digit
  if (!m || m[2].length > MAX_CODE) throw new Error('bad');
  if (m[1] !== '1') throw new Error('newer');
  let json; try { json = new TextDecoder().decode(await inflate(unb64u(m[2]))); } catch { throw new Error('cut'); } // a link a chat app cut short won't inflate
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
  // What you already have: cards, launch stamps, shines (a sent sighting that adds none of these adds nothing).
  const cards = new Set(), stamps = new Set(), shines = new Set();
  for (const s of existing) { if (s.sim) continue; cards.add(s.cardKey); if (s.stampKey) stamps.add(`${s.cardKey}|${s.stampKey}`); if (s.shiny) shines.add(s.cardKey); }
  const add = [], seen = new Set(); let dup = 0, same = 0, have = 0;
  for (const s of incoming.slice().sort((a, b) => a.time - b.time)) {
    const id = backupId(s);
    if (ids.has(id) || seen.has(id)) { dup++; continue; }
    const k = String(s.objectId ?? s.cardKey);
    if ((byObj.get(k) ?? []).some((t) => Math.abs(t - s.time) < SAME_MOMENT_MS)) { same++; continue; }
    const st = s.stampKey ? `${s.cardKey}|${s.stampKey}` : null;
    if (cards.has(s.cardKey) && !(st && !stamps.has(st)) && !(s.shiny && !shines.has(s.cardKey))) { have++; continue; }
    cards.add(s.cardKey); if (st) stamps.add(st); if (s.shiny) shines.add(s.cardKey);
    seen.add(id); add.push(asGift(s));
  }
  return { add, dup, same, have };
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
// Tags for a card in the pack: New, +3 launches, +2 phases, Shiny. (No nights or levels: those are your own nights.)
export function giftTags(x) {
  const t = [];
  if (x.isNew) t.push(['new', 'New']);
  else if (x.card?.launches && x.stampsGain) t.push(['up', `+${x.stampsGain} launch${x.stampsGain === 1 ? '' : 'es'}`]);
  else if (x.moon && x.stampsGain) t.push(['up', `+${x.stampsGain} phase${x.stampsGain === 1 ? '' : 's'}`]);
  if (x.shinyGain) t.push(['shiny', 'Shiny']);
  return t;
}
const TIER_N = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
// The cards dealt one by one (the rest arrive in the grid after): every new Rare or better, then level-ups and shines,
// then new cards, up to 7; dealt from the least to the best, so the pack ends on its best card.
export function pickHighlights(summary, n = 7) {
  const score = (x) => x.score ?? ((x.isNew ? 100 : 0) + (TIER_N[x.card?.tier] ?? 0) * 30 + (x.shinyGain ? 60 : 0) + (x.stampsGain ? 20 : 0));
  return summary.slice().sort((a, b) => score(b) - score(a)).slice(0, n).sort((a, b) => score(a) - score(b));
}

// ---------- sending ----------
// The send's own words, so the sheet, the toast and the button never disagree.
export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
