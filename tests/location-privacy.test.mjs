// Location privacy (2026-11-20): the phone's own fix is used only on the phone. Every plane request (adsb.lol from the
// phone, Sky's relay as the backup, the website's relay) carries a position rounded to a 0.05° grid, with the radius
// padded so the real spot's circle is still covered (js/planes.js feedPoint).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
// a native app: CapacitorHttp records each request
globalThis.document = { hidden: false, addEventListener() {}, documentElement: { classList: { add() {}, toggle() {} } } };
const asked = [];
globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', nativePromise: async (name, method, opts) => { if (name === 'CapacitorHttp') { asked.push(opts.url); return { status: 200, data: { now: Date.now(), ac: [] }, headers: {} }; } throw new Error('no plugin'); } };
const fetched = [];
globalThis.fetch = async (u) => { fetched.push(String(u)); return { ok: true, json: async () => ({ now: Date.now(), ac: [] }) }; };
const { PlaneTracker, feedPoint, adsbUrl, relayQuery, FEED_GRID, FEED_PAD_NM } = await import('../js/planes.js');
const settle = () => new Promise((r) => setTimeout(r, 20));

const RAD = Math.PI / 180;
const nm = (a, b) => { // great-circle distance in nautical miles
  const h = Math.sin((b.lat - a.lat) * RAD / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin((b.lon - a.lon) * RAD / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h)) / 1.852;
};
const onGrid = (s) => { const v = Number(s); return Math.abs(v / FEED_GRID - Math.round(v / FEED_GRID)) < 1e-9 && /^-?\d+\.\d{2}$/.test(s); };
// the precise fixes a phone might have (Toronto, London, Sydney, near the date line and the pole)
const FIXES = [{ lat: 43.651234, lon: -79.383456 }, { lat: 51.507351, lon: -0.127758 }, { lat: -33.868820, lon: 151.209290 }, { lat: 64.83776, lon: -147.71639 }, { lat: -16.98761, lon: 179.98913 }, { lat: 89.99, lon: 12.3456 }];
const coordsIn = (url) => (url.match(/-?\d+\.\d+/g) ?? []);

test('feedPoint: on the 0.05° grid, never the fix itself', () => {
  for (const f of FIXES) {
    const p = feedPoint(f);
    assert.ok(onGrid(p.lat) && onGrid(p.lon), `${p.lat},${p.lon}`);
    assert.ok(Math.abs(Number(p.lat) - f.lat) <= FEED_GRID / 2 + 1e-9);
    assert.ok(coordsIn(adsbUrl(f)).every((c) => /\.\d{2}$/.test(c) && onGrid(c)), adsbUrl(f));
  }
  assert.deepEqual(feedPoint({ lat: 43.651234, lon: -79.383456 }), { lat: '43.65', lon: '-79.40', dist: 43 });
  assert.equal(feedPoint({ lat: 0.01, lon: -0.01 }).lon, '0.00', 'no "-0.00"');
  assert.equal(feedPoint({ lat: -16.98761, lon: 179.98913 }).lon, '180.00');
  assert.equal(feedPoint({ lat: 10, lon: 190 }).lon, '-170.00', 'a longitude past 180 wraps');
});

test('the padded radius still covers every plane within 40 nm of the real spot', () => {
  let worst = 0;
  for (let i = 0; i < 20000; i++) {
    const f = { lat: -85 + Math.random() * 170, lon: -180 + Math.random() * 360 }, p = feedPoint(f);
    const d = nm(f, { lat: Number(p.lat), lon: Number(p.lon) }); worst = Math.max(worst, d);
    assert.ok(d + 40 <= p.dist, `${d.toFixed(2)} nm off at ${f.lat},${f.lon}`);
  }
  assert.ok(worst <= FEED_PAD_NM && worst > 1.5, `worst offset ${worst.toFixed(2)} nm`);
  assert.ok(40 + FEED_PAD_NM <= 80 / 1.852, 'within the relay\'s 80 km cap (server/planes-relay.js MAX_KM)');
});

test('the app\'s requests (adsb.lol from the phone, and the relay) carry only the rounded point', async () => {
  const fix = { lat: 43.651234, lon: -79.383456 };
  const t = new PlaneTracker();
  t.update(fix); await settle();
  const feed = asked.filter((u) => /adsb\.lol|\/planes\?/.test(u)); // (the other request is the pacing dial, with no place in it)
  assert.ok(asked.every((u) => feed.includes(u) || !/\d+\.\d+/.test(u)), asked.join(' '));
  assert.deepEqual(feed, ['https://api.adsb.lol/v2/point/43.65/-79.40/43']);
  // the relay URL as updateApp builds it for the backup
  const r = relayQuery('https://api-ybymfwdlgq-uc.a.run.app/planes', fix);
  assert.equal(r, 'https://api-ybymfwdlgq-uc.a.run.app/planes?lat=43.65&lon=-79.40&dist=43');
  for (const u of [...feed, r]) assert.ok(!u.includes('43.6512') && !u.includes('79.3834') && !u.includes('-79.38'), u);
});

test('the website\'s relay request carries only the rounded point', async () => {
  store.planeRelay = 'http://relay.invalid/planes'; // the web path (no CapacitorHttp)
  const t = new PlaneTracker();
  t.update({ lat: 51.507351, lon: -0.127758 }); await settle();
  assert.equal(fetched.at(-1), 'http://relay.invalid/planes?lat=51.50&lon=-0.15&dist=43');
  delete store.planeRelay;
});

test('weather asks for a 0.1° square, never the fix', () => {
  const src = readFileSync(new URL('../js/weather.js', import.meta.url), 'utf8');
  for (const m of src.matchAll(/https:\/\/api\.open-meteo\.com[^`]*`/g)) assert.ok(!/toFixed\(2\)/.test(m[0]), 'open-meteo gets 1 decimal');
  for (const m of src.matchAll(/\/wx\?[^`]*`/g)) assert.ok(!/toFixed\(2\)/.test(m[0]), '/wx gets 1 decimal');
});

test('no request in the app sends the observer with more than 2 decimals', () => {
  // every URL template in js/ that interpolates a latitude or longitude goes through feedPoint or toFixed(1)
  for (const f of ['planes.js', 'weather.js', 'main.js', 'pack-flight.js', 'native.js', 'field-notes.js', 'server.js']) {
    const src = readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/(?:fetch|request)\(\s*`[^`]*`/g)) assert.ok(!/obs(?:erver)?\.(?:lat|lon)\b(?!\.toFixed\(1\))/.test(m[0]), `${f}: ${m[0].slice(0, 90)}`);
  }
});
