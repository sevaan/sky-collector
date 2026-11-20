// Playtest 2026-11-20 (design/playtest/PLAYTEST-2026-11-20.md): airport vehicles never become cards, the Collection's
// frame sees tallies another page saved, and the feed's generic codes have names.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

test('airport vehicles (categories C1-C7, SERV/EMER types) are not planes, even with a height', async () => {
  const { parsePlanes } = await import('../js/planes.js');
  const r = parsePlanes({ now: Date.now(), ac: [
    { hex: 'c1e964', flight: 'ESC155', t: 'SERV', alt_baro: 300, lat: 43.6, lon: -79.6, category: 'C2' },
    { hex: 'c1e965', flight: 'FIRE1', alt_baro: 250, lat: 43.6, lon: -79.6, category: 'C1' },
    { hex: 'c1e966', flight: 'X', t: 'EMER', alt_baro: 250, lat: 43.6, lon: -79.6 },
    { hex: 'a1b2c3', flight: 'ACA101', t: 'A320', alt_baro: 9000, lat: 43.6, lon: -79.6, category: 'A3' },
  ] });
  assert.deepEqual(r.map((p) => p.hex), ['a1b2c3']);
});

test('localStats picks up tallies saved by another page after it first loaded', async () => {
  const { localStats } = await import('../js/sky-local.js');
  assert.equal(localStats().total, 0); // first read: nothing saved yet
  const d = new Date(), key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  store.set('skyLocal', JSON.stringify({ d: { [key]: { h: 1, t: { B738: 3 }, f: {} } } }));
  const real = Date.now; Date.now = () => real() + 5000; // past the re-read pause
  try { assert.equal(localStats().byType.get('B738'), 3); } finally { Date.now = real; }
});

test('the feed\'s generic codes have names', async () => {
  const { typeName } = await import('../js/sky-type-names.js');
  assert.equal(typeName('GLID'), 'Glider');
  assert.equal(typeName('ULAC'), 'Ultralight');
});
