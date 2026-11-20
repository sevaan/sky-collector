// Precise location in Sky (2026-11-20, Sevaan: "Yes, precise"): js/native.js getPosition asks for precise the first
// time, never re-asks by itself once the player chose Approximate (Android's "change to precise?" loop, QA 2026-10-11),
// asks again only from Settings → Use precise location, and says which one the fix is.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { addEventListener() {}, activeElement: null };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
let platform = 'android', perm = { location: 'prompt', coarseLocation: 'prompt' }, answer = null, accuracy = 20;
const calls = [];
globalThis.Capacitor = {
  isNativePlatform: () => true, getPlatform: () => platform,
  nativePromise: async (name, method, opts) => {
    if (name !== 'Geolocation') throw new Error('no plugin');
    calls.push([method, opts]);
    if (method === 'checkPermissions') return { ...perm };
    if (method === 'requestPermissions') { perm = answer(opts.permissions); return { ...perm }; }
    if (method === 'getCurrentPosition') return { coords: { latitude: 43.6512, longitude: -79.3834, accuracy } };
    throw new Error(method);
  },
};
const { getPosition, locationPrecision } = await import('../js/native.js');
const reset = (p, a, plat = 'android', acc = 20) => { perm = p; answer = a; platform = plat; accuracy = acc; calls.length = 0; };
const asked = () => calls.filter(([m]) => m === 'requestPermissions').map(([, o]) => o.permissions.join());
const fixOpts = () => calls.find(([m]) => m === 'getCurrentPosition')[1];

test('first ask: precise, and a precise fix with high accuracy', async () => {
  reset({ location: 'prompt', coarseLocation: 'prompt' }, () => ({ location: 'granted', coarseLocation: 'granted' }));
  await getPosition({ timeout: 15000 });
  assert.deepEqual(asked(), ['location']);
  assert.equal(fixOpts().enableHighAccuracy, true);
  assert.equal(locationPrecision(), 'precise');
});

test('the player picks Approximate: the app works, says approximate, and never re-asks by itself', async () => {
  reset({ location: 'prompt', coarseLocation: 'prompt' }, () => ({ location: 'denied', coarseLocation: 'granted' }));
  await getPosition({ timeout: 15000 });
  assert.equal(fixOpts().enableHighAccuracy, false, 'high accuracy would make the plugin ask for fine again');
  assert.equal(locationPrecision(), 'approximate');
  reset(perm, () => assert.fail('asked again'));
  for (let i = 0; i < 3; i++) await getPosition({ timeout: 15000 });
  assert.deepEqual(asked(), []);
  assert.equal(locationPrecision(), 'approximate');
});

test('Settings → Use precise location asks again; yes makes it precise, no keeps approximate', async () => {
  reset({ location: 'denied', coarseLocation: 'granted' }, () => ({ location: 'granted', coarseLocation: 'granted' }));
  await getPosition({}, { askPrecise: true });
  assert.deepEqual(asked(), ['location']); assert.equal(locationPrecision(), 'precise');
  reset({ location: 'denied', coarseLocation: 'granted' }, () => ({ location: 'denied', coarseLocation: 'granted' }));
  await getPosition({}, { askPrecise: true });
  assert.equal(locationPrecision(), 'approximate');
});

test('denied entirely: code 1', async () => {
  reset({ location: 'prompt', coarseLocation: 'prompt' }, () => ({ location: 'denied', coarseLocation: 'denied' }));
  await assert.rejects(getPosition({}), (e) => e.code === 1);
});

test('iPhone: always asks for a real fix (else the plugin sets 3 km), and Precise Location: Off shows in the accuracy', async () => {
  reset({ location: 'granted', coarseLocation: 'granted' }, () => assert.fail('no ask'), 'ios', 15);
  await getPosition({});
  assert.equal(fixOpts().enableHighAccuracy, true); assert.equal(locationPrecision(), 'precise');
  reset({ location: 'granted', coarseLocation: 'granted' }, () => assert.fail('no ask'), 'ios', 3000);
  await getPosition({}, { askPrecise: true });
  assert.deepEqual(asked(), [], 'iPhone can only change it in Settings');
  assert.equal(locationPrecision(), 'approximate');
});

test('a build without FINE in its manifest still gets a location (coarse)', async () => {
  reset({ location: 'prompt', coarseLocation: 'prompt' }, (p) => { if (p.includes('location')) throw new Error('Missing the following permissions in AndroidManifest.xml'); return { location: 'denied', coarseLocation: 'granted' }; });
  await getPosition({});
  assert.deepEqual(asked(), ['location', 'coarseLocation']);
  assert.equal(locationPrecision(), 'approximate');
});
