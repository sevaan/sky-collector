// Where Sky Collector keeps your catches (2026-11-15). The real copy lives in IndexedDB (database 'sky-catches'), which
// survives far better than localStorage. localStorage 'skyCatches' stays as a mirror: it's what the Collection page
// (cards.html, in its own frame) and Today read synchronously, and writing it is how they hear about a new catch.
// On start the two are merged, so catches made before this existed (localStorage only) move into the database.
// The phone apps also put catches in the iCloud backup (js/cloud-backup.js). No DOM here.

const DB = 'sky-catches', STORE = 'catches', MIRROR = 'skyCatches';
const idOf = (c) => `${c.time}:${c.hex ?? ''}`;

let dbp = null;
function db() {
  dbp ??= new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error('catch store timed out')), 5000);
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => { clearTimeout(t); const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; d.onclose = () => { dbp = null; }; ok(d); };
    r.onerror = () => { clearTimeout(t); no(r.error); };
    r.onblocked = () => { clearTimeout(t); no(new Error('catch store blocked')); };
  }).catch((e) => { dbp = null; throw e; });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, no) => { const x = d.transaction(STORE, mode), s = x.objectStore(STORE); const r = fn(s); x.oncomplete = () => ok(r?.result); x.onerror = () => no(x.error); x.onabort = () => no(x.error); });
}

const readMirror = () => { try { return JSON.parse(localStorage.getItem(MIRROR) || '[]'); } catch { return []; } };
const writeMirror = (list) => { try { localStorage.setItem(MIRROR, JSON.stringify(list)); } catch {} };

let cache = readMirror();
export const allCatches = () => cache;

// Merge the database and the mirror (and anything from a backup), oldest first, one entry per catch.
function merge(...lists) {
  const m = new Map(); for (const l of lists) for (const c of l ?? []) if (c?.time) m.set(idOf(c), { ...c, id: idOf(c) });
  return [...m.values()].sort((a, b) => a.time - b.time);
}

export async function initCatches() {
  try {
    const stored = await tx('readonly', (s) => s.getAll());
    const merged = merge(stored, readMirror());
    const have = new Set((stored ?? []).map((c) => c.id));
    const missing = merged.filter((c) => !have.has(c.id));
    if (missing.length) await tx('readwrite', (s) => { for (const c of missing) s.put(c); });
    cache = merged; writeMirror(cache);
  } catch (e) { console.warn('catch store unavailable, using the mirror', e?.message ?? e); }
  return cache;
}

export async function addCatch(c) {
  const e = { ...c, id: idOf(c) };
  cache = merge(cache, [e]); writeMirror(cache);
  try { await tx('readwrite', (s) => s.put(e)); } catch (err) { console.warn('catch not saved to the database', err?.message ?? err); }
  return e;
}

// From the iCloud backup: add what this phone doesn't have yet. Returns how many were new.
export async function restoreCatches(list) {
  const before = new Set(cache.map(idOf)), fresh = (list ?? []).filter((c) => c?.time && !before.has(idOf(c)));
  if (!fresh.length) return 0;
  cache = merge(cache, fresh); writeMirror(cache);
  try { await tx('readwrite', (s) => { for (const c of fresh) s.put({ ...c, id: idOf(c) }); }); } catch {}
  return fresh.length;
}

export async function clearCatches() { cache = []; writeMirror(cache); try { await tx('readwrite', (s) => s.clear()); } catch {} }
