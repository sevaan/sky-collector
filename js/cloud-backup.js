// Backup without accounts (2026-10-16, Sevaan: "do we need account signups?"). In the iPhone app the sighting log and a
// few progress keys are kept in the player’s own iCloud key-value store (native plugin ICloudKV, native/ios/App/App/
// ICloudKV.swift), so a reinstall or an iPad gets the same collection back, with no sign-in and nothing sent to us.
// Android restores app data to a new phone with its own Auto Backup (allowBackup in the manifest). The website keeps
// everything on the device.
//   iCloud key 'sky-backup' = { v: 1, s: [sightings], gone: [ids deleted], st: { progress keys }, at }
// Sync merges both ways and never loses anything earned: sightings are a union by a stable id (time + card + object),
// minus ids someone deleted; progress keys merge as in the old account sync.
import { allSightings, addSighting, deleteSighting } from './store.js?v=0.1.1816';
import { plugin, onNative, isNative } from './native.js?v=0.1.1816';
import { backupId } from './gift.js?v=0.1.1816';
export { backupId };

const KEY = 'sky-backup'; /* Sky's own iCloud key (2026-11-16, decoupled from Space Collector's 'sc-backup') */
const STATE_KEYS = ['secrets', 'fossilFound', 'ufoFound', 'missionDeals', 'weekThemes', 'xpCarry2', 'patchSeen', 'patchDates', 'backEarned', 'rankFloor2'];
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
const json = (k, d) => { try { return JSON.parse(ls.get(k)) ?? d; } catch { return d; } };
const kv = () => (isNative() && /iP(hone|ad|od)|Mac/.test(navigator.userAgent) ? plugin('ICloudKV') : null);

/* Compressed (2026-11-19): iCloud key-value storage takes about 1 MB per key, and a Sky catch is two sightings that each carry
   their card's snapshot (route, airports, fact), about 3 KB, so a keen player would fill the key after about 300 catches and
   every backup after would fail. The JSON is very repetitive, so it's deflated: 'z1' + base64. Old plain backups still read. */
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (str) => { const s = atob(str), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
export async function packBackup(obj) { const j = JSON.stringify(obj); if (typeof CompressionStream !== 'function') return j; return `z1${b64(await pipe(new TextEncoder().encode(j), new CompressionStream('deflate-raw')))}`; }
export async function unpackBackup(v) { if (typeof v !== 'string') return null; if (!v.startsWith('z1')) return JSON.parse(v); return JSON.parse(new TextDecoder().decode(await pipe(unb64(v.slice(2)), new DecompressionStream('deflate-raw')))); }
const strip = (s) => { const { key, synced, cloudId, ...rest } = s; return JSON.parse(JSON.stringify(rest)); }; // local-only fields out

const listeners = new Set();
export const onBackupChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const backupAvailable = () => !!kv();
let running = null, again = false, timer = 0, failed = false, offUntil = 0; // offUntil: iCloud said it’s off, so don’t try every save (iOS playtest 2026-10-19)

// Where the collection is kept right now, for Settings (2026-10-16 playtest: the row said "Backed up to your iCloud"
// even with iCloud off). 'icloud' | 'icloud-off' (signed out, iCloud Drive off, or the last write failed) |
// 'android' (Auto Backup, if the player has Google backup on) | 'web'.
export async function backupStatus() {
  if (!isNative()) return 'web';
  const store = kv(); if (!store) return 'android';
  try { const r = await store.status(); return r?.available && !failed ? 'icloud' : 'icloud-off'; } catch { return 'icloud-off'; }
}

// Merge this phone with iCloud. Calls listeners with { added } when sightings arrived from iCloud.
export function backupNow() {
  if (!kv()) return Promise.resolve(null);
  if (running) { again = true; return running; }
  running = (async () => {
    const store = kv();
    if (Date.now() < offUntil) return null;
    try { const r = await store.status(); if (!r?.available) { offUntil = Date.now() + 5 * 60e3; failed = true; return null; } } catch {}
    let cloud = { v: 1, s: [], gone: [], st: {} };
    try { const r = await store.get({ key: KEY }); if (r?.found && r.value) cloud = { ...cloud, ...(await unpackBackup(r.value)) }; } catch (e) { console.warn('icloud read failed', e); return null; }
    const back = new Set(json('backupBack', [])); // sent back to this phone (a received pack, an undone Move): no longer deleted (2026-11-07)
    const gone = new Set([...(cloud.gone ?? []), ...json('backupGone', [])].filter((id) => !back.has(id)));
    const local = (await allSightings()).filter((s) => !s.sim);
    const here = new Map(local.map((s) => [backupId(s), s]));
    let added = 0;
    for (const [id, s] of here) if (gone.has(id)) { await deleteSighting(s.key); here.delete(id); }
    const theirs = new Map((cloud.s ?? []).map((s) => [backupId(s), s]));
    for (const [id, s] of theirs) if (!here.has(id) && !gone.has(id)) { await addSighting(s); added++; }
    const merged = new Map([...theirs].filter(([id]) => !gone.has(id))); for (const [id, s] of here) merged.set(id, strip(s));
    const st = mergeState(cloud.st ?? {});
    /* an id for this iCloud account's collection, so a pack sent between two phones on the same Apple ID can say so (2026-11-07) */
    const bid = cloud.bid ?? ls.get('backupBid') ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; ls.set('backupBid', bid);
    const out = { v: 1, bid, s: [...merged.values()], gone: [...gone].slice(-2000), st, at: Date.now() };
    try { await store.set({ key: KEY, value: await packBackup(out) }); failed = false; ls.set('backupGone', null); ls.set('backupBack', null); ls.set('backupAt', String(Date.now())); }
    catch (e) { failed = true; console.warn('icloud write failed', e?.message ?? e); }
    if (added) listeners.forEach((fn) => { try { fn({ added }); } catch {} });
    return { added, total: out.s.length };
  })().finally(() => { running = null; if (again) { again = false; backupSoon(2000); } });
  return running;
}
// After a catch: back up shortly (several catches in a row become one write).
export function backupSoon(ms = 4000) { if (!kv()) return; clearTimeout(timer); timer = setTimeout(() => backupNow().catch(() => {}), ms); }
// A sighting deleted on this phone stays deleted everywhere.
export function forgetSighting(s) { if (!s) return; ls.set('backupGone', JSON.stringify([...new Set([...json('backupGone', []), backupId(s)])])); backupSoon(); }
// Sightings that came back (a received pack, an undone Move) are no longer on the deleted list, or iCloud would delete
// them again (send-cards design, edge cases).
export function rememberSightings(list) {
  const ids = new Set(list.map(backupId));
  ls.set('backupGone', JSON.stringify(json('backupGone', []).filter((id) => !ids.has(id))));
  ls.set('backupBack', JSON.stringify([...new Set([...json('backupBack', []), ...ids])].slice(-5000)));
  backupSoon();
}
// This phone's iCloud collection id (null off iPhone, or before its first backup).
export const backupBid = () => (kv() ? ls.get('backupBid') : null);
// Reset everything: the iCloud copy goes too, or it would bring the old collection straight back.
export async function clearBackup() { try { await kv()?.remove({ key: KEY }); } catch {} }

// Progress kept in localStorage, merged so nothing earned on either device is lost.
function mergeState(cloud) {
  const merged = {};
  for (const k of STATE_KEYS) {
    const mine = json(k, null), theirs = cloud[k] ?? null;
    let v = mine ?? theirs;
    if (mine != null && theirs != null) {
      if (typeof mine === 'number' || typeof theirs === 'number') v = Math.max(Number(mine) || 0, Number(theirs) || 0);
      else if (Array.isArray(mine) || Array.isArray(theirs)) v = [...new Set([...(mine ?? []), ...(theirs ?? [])])];
      else if (typeof mine === 'object') { v = { ...theirs, ...mine }; for (const x of Object.keys(theirs)) if (typeof theirs[x] === 'number' && typeof mine[x] === 'number') v[x] = Math.min(mine[x], theirs[x]); } // earliest date wins
    }
    if (v != null) { merged[k] = v; ls.set(k, typeof v === 'string' ? v : JSON.stringify(v)); }
  }
  return merged;
}

// Start: merge once, again whenever the app comes back to the front, and when another device changes iCloud.
export function initBackup() {
  if (!kv()) return;
  backupNow().catch(() => {});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) backupSoon(1500); });
  onNative('ICloudKV', 'change', () => backupSoon(500));
}
