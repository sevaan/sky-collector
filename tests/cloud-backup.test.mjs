// The iCloud backup's packing (2026-11-19): deflated so a big plane collection fits in one key-value entry (about 1 MB);
// an old plain backup still reads.
import test from 'node:test';
import assert from 'node:assert/strict';
test('a big Sky collection packs well under iCloud’s 1 MB, and reads back the same; plain JSON still reads', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const { packBackup, unpackBackup } = await import('../js/cloud-backup.js');
  const snap = (i) => ({ key: `F:ACA:CYYZ-K${i % 40}`, sky: 'flight', name: `Toronto to City ${i % 40}`, tier: 'common', from: { icao: 'CYYZ', iata: 'YYZ', city: 'Toronto', lat: 43.68, lon: -79.63, cc: 'CA' }, to: { icao: `K${i % 40}`, iata: 'XXX', city: `City ${i % 40}`, lat: 40, lon: -75, cc: 'US' }, fact: 'Toronto to City is **1,234 km**, about 2 h 05 m in the air, on a Boeing 737 MAX 8.', airline: 'Air Canada' });
  const s = Array.from({ length: 2000 }, (_, i) => ({ time: 1.79e12 + i * 6e5, cardKey: `F:ACA:CYYZ-K${i % 40}`, objectId: `F:ACA:CYYZ-K${i % 40}`, type: 'flight', stampKey: `DAY:${i}`, hex: `~abc${i}`, callsign: `ACA${i}`, altFt: 36000, gsKt: 450, rangeKm: 22, cardSnapshot: snap(i) }));
  const out = { v: 1, bid: 'x', s, gone: [], st: {}, at: 1 };
  const plain = JSON.stringify(out), packed = await packBackup(out);
  assert.ok(plain.length > 1e6, 'the plain one would not fit');
  assert.ok(packed.startsWith('z1') && packed.length < 3e5, `packed ${packed.length} chars`);
  assert.deepEqual(await unpackBackup(packed), out);
  assert.deepEqual(await unpackBackup(plain), out);
});
