// The sample pack's flight card (js/pack-flight.js): the time zone to city mapping and the flight picker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cityForZone, rankFlights, normalize, nearestCanned, findLiveFlight, liveTag, seenTag, seenWhen } from '../js/pack-flight.js';
import { PACK_FLIGHTS } from '../js/pack-flights.js';

test('a time zone gives its city, and an unknown zone a big city in the same part of the world', () => {
  assert.equal(cityForZone('America/Toronto').name, 'Toronto');
  assert.equal(cityForZone('Europe/London').name, 'London');
  assert.equal(cityForZone('Asia/Tokyo').name, 'Tokyo');
  assert.equal(cityForZone('Australia/Sydney').name, 'Sydney');
  assert.equal(cityForZone('Africa/Lagos').name, 'Lagos');
  assert.equal(cityForZone('America/Nowhere_Made_Up').name, 'New York');
  assert.equal(cityForZone('Europe/Atlantis').name, 'London');
  assert.equal(cityForZone('').name, 'London');
  assert.equal(cityForZone(undefined).name, 'London');
  const c = cityForZone('Asia/Kolkata'); assert.ok(Math.abs(c.lat - 28.61) < 0.01 && Math.abs(c.lon - 77.21) < 0.01, 'a city centre, nothing finer');
});

const plane = (o) => ({ callsign: 'ACA123', type: 'A321', category: 'A3', altFt: 20000, gs: 400, lat: 43.7, lon: -79.4, ...o });
const art = (a3, type) => a3 !== 'NOP' && type !== 'NOPE';
test('the picker keeps airliners with a photo and logo, airborne and moving, nearest first', () => {
  const C = { lat: 43.65, lon: -79.38 };
  const list = [
    plane({ callsign: 'CGABC', type: 'C172' }), // a registration, not an airline: no route, no flight card
    plane({ callsign: 'ACA1', type: 'EC35', category: 'A7' }), // a helicopter
    plane({ callsign: 'ACA2', altFt: 900 }), // just off the runway
    plane({ callsign: 'ACA3', gs: 60 }), // not moving
    plane({ callsign: 'NOP4' }), // no art for the airline
    plane({ callsign: 'ACA5', type: 'NOPE' }), // no art for the type
    plane({ callsign: 'ACA6', lat: 44.2 }), // far
    plane({ callsign: 'ACA7', lat: 43.66 }), // near and high
    plane({ callsign: 'ACA8', lat: 43.65, altFt: 4000 }), // nearest, but low: after a high one nearby
    plane({ callsign: '', type: 'B738' }), // no callsign
  ];
  assert.deepEqual(rankFlights(list, C, art).map((p) => p.callsign), ['ACA7', 'ACA8', 'ACA6']);
  assert.deepEqual(rankFlights([], C, art), []);
  assert.deepEqual(rankFlights(null, C, art), []);
});

test('the relay answer is read like the game reads it', () => {
  const ps = normalize({ now: 1795000000, ac: [{ hex: 'a', flight: 'aca855  ', t: 'B789', category: 'A5', lat: 1, lon: 2, alt_baro: 35000, alt_geom: 35500, gs: 480, track: 90 }, { hex: 'b', lat: 1, lon: 2, alt_baro: 'ground' }, { hex: 'c', alt_baro: 1000 }] });
  assert.equal(ps.length, 1);
  assert.equal(ps[0].callsign, 'ACA855'); assert.equal(ps[0].altFt, 35500); assert.equal(ps[0].at, 1795000000000);
  assert.deepEqual(normalize(null), []);
});

test('the stand-in is the recorded flight nearest the city, and its tag never says "right now"', () => {
  assert.ok(PACK_FLIGHTS.length >= 20, 'recorded flights for most hubs');
  for (const f of PACK_FLIGHTS) {
    assert.ok(f.hub && f.seen && f.plane?.callsign && f.route?.from?.city && f.route?.to?.city, `${f.hub}: complete`);
    assert.match(f.plane.callsign, /^[A-Z]{3}\d/, `${f.hub}: an airline callsign`);
    assert.notEqual(f.route.from.icao, f.route.to.icao, `${f.hub}: a real route`);
  }
  const t = PACK_FLIGHTS.find((f) => f.hub === 'Toronto');
  if (t) assert.equal(nearestCanned(cityForZone('America/Toronto'), PACK_FLIGHTS).hub, 'Toronto');
  assert.equal(nearestCanned({ lat: 0, lon: 0 }, []), null);
  assert.doesNotMatch(seenTag('Toronto', seenWhen(Date.now() - 864e5 * 3)), /right now/);
  assert.equal(liveTag('Toronto'), 'Over Toronto right now');
  assert.equal(seenWhen(Date.now()), 'today');
  assert.match(seenWhen(Date.UTC(2026, 10, 18, 12), Date.UTC(2026, 10, 25, 12), 'en-GB'), /^on 18 November$/);
});

const relay = (ac) => async () => ({ ok: true, json: async () => ({ now: Date.now(), ac }) });
const rec = (o) => ({ hex: 'x', flight: 'ACA855', t: 'B789', category: 'A5', lat: 43.66, lon: -79.4, alt_baro: 30000, gs: 450, track: 90, ...o });
const route = { from: { icao: 'EGLL', city: 'London' }, to: { icao: 'CYYZ', city: 'Toronto' } };
const deps = (o) => ({ lookupRoute: async (cs) => (cs === 'ACA855' ? route : null), airlineName: () => 'Air Canada', hasArt: () => true, timeoutMs: 300, ...o });
const C = { name: 'Toronto', lat: 43.65, lon: -79.38 };
test('a live flight needs a route the bundled data knows; otherwise none', async () => {
  const f = await findLiveFlight(C, deps({ fetch: relay([rec({ flight: 'ACA999' }), rec({ lat: 43.7 })]) }));
  assert.equal(f.plane.callsign, 'ACA855'); assert.equal(f.route.to.city, 'Toronto'); assert.equal(f.airline, 'Air Canada');
  assert.equal(await findLiveFlight(C, deps({ fetch: relay([rec({ flight: 'ACA999' })]) })), null, 'no route, no flight card');
  assert.equal(await findLiveFlight(C, deps({ fetch: relay([]) })), null);
});
test('a relay that fails, errs or hangs gives none, within the timeout, never an error', async () => {
  assert.equal(await findLiveFlight(C, deps({ fetch: async () => ({ ok: false }) })), null);
  assert.equal(await findLiveFlight(C, deps({ fetch: async () => { throw new Error('offline'); } })), null);
  assert.equal(await findLiveFlight(C, deps({ fetch: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } }) })), null);
  const t = Date.now();
  const hang = (url, { signal } = {}) => new Promise((_, no) => signal?.addEventListener('abort', () => no(new Error('aborted'))));
  assert.equal(await findLiveFlight(C, deps({ fetch: hang, timeoutMs: 200 })), null);
  assert.ok(Date.now() - t < 1500, 'gave up on time');
  let asked = ''; await findLiveFlight(C, deps({ fetch: async (u) => { asked = u; return { ok: false }; } }));
  assert.match(asked, /\?lat=43\.65&lon=-79\.38&dist=40$/, 'only the city centre is sent');
});
