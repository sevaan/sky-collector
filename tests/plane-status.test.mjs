import test from 'node:test';
import assert from 'node:assert/strict';

const store = { planeRelay: 'http://bad.invalid/a http://good.invalid/b' };
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem() {} };
const calls = [];
let good = false;
globalThis.fetch = async (u) => { calls.push(u); if (u.startsWith('http://good') && good) return { ok: true, json: async () => ({ now: Date.now(), ac: [], sources: { merged: 0 } }) }; throw new Error('down'); };
const { PlaneTracker } = await import('../js/planes.js');
const obs = { lat: 50, lon: 8.5 };
const settle = () => new Promise((r) => setTimeout(r, 20));

test('status: loading, then failing, then ok through the second relay', async () => {
  const t = new PlaneTracker();
  assert.equal(t.status, 'loading');
  t.update(obs); await settle();
  assert.equal(t.status, 'failing');
  assert.equal(calls.length, 2); // both relays tried, in order
  assert.ok(calls[0].startsWith('http://bad') && calls[1].startsWith('http://good'));
  good = true; t.lastFetch = 0; t.update(obs); await settle();
  assert.equal(t.status, 'ok'); assert.ok(t.lastOk > 0); assert.deepEqual(t.sources, { merged: 0 });
});
