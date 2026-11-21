// Fresh satellite data for the phone apps (2026-10-25, Sevaan: "How often do I have to do builds to have up to date
// satellite data?" — never). The apps carry the catalogue from build day; orbits drift and new launches are missing
// after a few weeks. So once a day the app fetches today's catalogue from our server (/catalog, built daily by the
// repo's GitHub Action) and keeps it in IndexedDB; the next launch uses whichever copy is newer, the kept one or the
// one in the app. The website always loads its own (it's redeployed with every catalogue). No DOM.
import { SERVER } from './server.js?v=0.1.1820';
import { isNative, plugin } from './native.js?v=0.1.1820';
const DB = 'sc-data', STORE = 'files';
const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const get = async (k) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE).objectStore(STORE).get(k); t.onsuccess = () => res(t.result ?? null); t.onerror = () => rej(t.error); }); };
const put = async (k, v) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); };
const btMark = (n) => { try { (globalThis.__bt ??= []).push([n, Math.round(performance.now())]); } catch {} };
const on = () => { try { return isNative() && !!SERVER; } catch { return false; } };
// The catalogue URL to load: a blob of the kept copy when it's newer than the one in the app, else the app's own.
// The kept copy is a plain file in the app's own storage (Capacitor Filesystem, Directory.DATA) with its date and address in
// localStorage 'keptCatalog' { at, uri } (2026-11-11, startup timings on an iPhone 14: the first IndexedDB answer of a launch
// takes ~440 ms on iOS, and the catalogue check was paying it before anything else could start). Older apps kept it in
// IndexedDB: that copy is used once and moved to the file.
const KEPT = 'keptCatalog', FILE = 'catalog.json';
const readKept = () => { try { const v = JSON.parse(localStorage.getItem(KEPT) || 'null'); return v?.uri && v.at ? v : null; } catch { return null; } };
const fileSrc = (uri) => { try { return globalThis.Capacitor?.convertFileSrc?.(uri) ?? null; } catch { return null; } };
async function keepAsFile(text, at) {
  const fs = plugin('Filesystem'); if (!fs) return false;
  await fs.writeFile({ path: FILE, data: text, directory: 'DATA', encoding: 'utf8' });
  const { uri } = await fs.getUri({ path: FILE, directory: 'DATA' });
  try { localStorage.setItem(KEPT, JSON.stringify({ at, uri })); } catch {}
  return true;
}
export async function catalogUrl(bundled = 'data/catalog.json', bundledAt = 0) {
  if (!on()) return bundled;
  const k = readKept();
  if (k) { const src = k.at > bundledAt ? fileSrc(k.uri) : null; btMark(src ? 'kept catalogue: file' : 'kept catalogue: the app\'s own is newer'); return src ?? bundled; }
  /* not moved yet: the old IndexedDB copy, this once (Blob first, then the older text form), moved to a file in the background */
  btMark('kept catalogue: checking the old store');
  try { const m = await get('catalogMeta'); btMark('kept catalogue: database answered');
    if (m?.at) { const b = await get('catalogBlob'); if (b instanceof Blob && b.size > 1000) { setTimeout(() => b.text().then((t) => keepAsFile(t, m.at)).then((ok) => ok && put('catalogBlob', null)).catch(() => {}), 20000); if (m.at > bundledAt) return URL.createObjectURL(b); } return bundled; } } catch {}
  try { const t = await get('catalog'); if (t?.text) { setTimeout(() => keepAsFile(t.text, t.at).then((ok) => ok && put('catalog', null)).catch(() => {}), 20000); if (t.at > bundledAt) return URL.createObjectURL(new Blob([t.text], { type: 'application/json' })); } } catch {}
  return bundled;
}
// After start: if the newest copy is over 20 hours old, fetch today's and keep it for next time (quietly; best effort).
export async function refreshCatalog(haveAt) {
  if (!on() || Date.now() - haveAt < 20 * 3600e3) return;
  try {
    const r = await fetch(`${SERVER}/catalog`, { signal: AbortSignal.timeout?.(30000) }); if (!r.ok) return;
    const text = await r.text(), at = Date.parse(/"generated"\s*:\s*"([^"]+)"/.exec(text.slice(0, 2000))?.[1] ?? '') || 0;
    // Keep it only if it really is a catalogue (bug hunt 2026-10-26: a bad copy used to be kept and loaded forever).
    if (at > haveAt) { const j = JSON.parse(text); if (Array.isArray(j?.objects) && j.objects.length > 1000) { if (!(await keepAsFile(text, at).catch(() => false))) { await put('catalogBlob', new Blob([text], { type: 'application/json' })); await put('catalogMeta', { at }); } } }
  } catch {}
}
// The kept copy failed to load: forget it, so the app's own copy is used (boot() retries with it at once).
export async function dropCatalog() { try { localStorage.removeItem(KEPT); } catch {} try { await put('catalogMeta', null); await put('catalogBlob', null); await put('catalog', null); } catch {} }
