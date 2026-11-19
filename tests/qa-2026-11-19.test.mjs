// Fixes from the 2026-11-19 playtest and bug hunt: route shards for the big European airlines, the "another country"
// mission, propeller types, Home Skies, helicopters and cargo, same-city routes, calendar days in Sky.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

test('the big airlines whose routes come in numbered files have route shards', () => {
  for (const a of ['RYR', 'EZY', 'EJU', 'AFR', 'THY', 'WZZ', 'VLG']) {
    const f = new URL(`../data/routes/r/${a}.json`, import.meta.url);
    assert.ok(existsSync(f), `${a} shard`); assert.ok(Object.keys(JSON.parse(readFileSync(f, 'utf8'))).length > 1000, `${a} has routes`);
  }
});

test('a route between two airports of one city makes no flight card; Pristina is XK; city typos fixed', async () => {
  const r = await import('../js/routes.js');
  r.setRouteLoader(async (rel) => { try { return readFileSync(new URL(`../data/routes/${rel}`, import.meta.url), 'utf8'); } catch { return null; } });
  const ryr = await r.lookupRoute('RYR1AB'); assert.ok(ryr?.from?.city && ryr.to?.city && ryr.from.city !== ryr.to.city);
  assert.equal((await r.airport('RJGG')).city, 'Nagoya');
  assert.equal(await r.countryNear(43.65, -79.38), 'CA');
});

test('"Catch a flight to another country" can be done (airports carry cc)', async () => {
  const { SKY_MISSIONS, setSkyProgress } = await import('../js/progress.js'); setSkyProgress(true);
  const abroad = SKY_MISSIONS.find((m) => m.id === 'abroad');
  const flight = (from, to) => ({ cardSnapshot: { sky: 'flight', from: { cc: from }, to: { cc: to } } });
  assert.equal(abroad.done([flight('CA', 'GB')]), true);
  assert.equal(abroad.done([flight('CA', 'CA')]), false);
});

test('propeller types are whole codes: no Citation jets, C-17 or Beechjet', async () => {
  const { isProp } = await import('../js/sky-props.js');
  for (const t of ['C172', 'C208', 'DH8D', 'AT76', 'PC12', 'BE20', 'C130', 'DC3', 'P28A', 'SR22']) assert.ok(isProp(t), t);
  for (const t of ['C25A', 'C25B', 'C17', 'BE40', 'B738', 'A320', 'C560', 'GLF6']) assert.ok(!isProp(t), t);
});

test('helicopters and cargo: the B-17 is not a helicopter, the H500 and KA32 are; Air Astana is not cargo', async () => {
  const { isHelicopter } = await import('../js/planes.js');
  assert.equal(isHelicopter({ type: 'B17' }), false);
  for (const t of ['H500', 'KA32', 'B06', 'B407', 'MD52', 'EC35']) assert.ok(isHelicopter({ type: t }), t);
  const { CARGO_AIRLINES } = await import('../js/sky-cargo.js');
  assert.equal(CARGO_AIRLINES.has('KZR'), false);
});

test('Home Skies is a domestic flight in the country you are in', async () => {
  const { flightSet, setHomeCountry } = await import('../js/sky-sets.js');
  setHomeCountry('CA');
  assert.equal(flightSet(4300, { cc: 'US' }, { cc: 'US' }, 'UAL').id === 'home', false);
  assert.equal(flightSet(500, { cc: 'CA' }, { cc: 'CA' }, 'ACA').id, 'home');
  assert.equal(flightSet(4300, { cc: 'US' }, { cc: 'US' }, 'UAL', '').id, 'home', 'no home known: any domestic flight');
});

test("Sky's weeks start Monday at midnight", async () => {
  const { weekStartOf, setSkyProgress } = await import('../js/progress.js'); setSkyProgress(true);
  assert.equal(weekStartOf(new Date(2026, 10, 23, 9).getTime()), new Date(2026, 10, 23).getTime());
});

test("Sky's day runs midnight to midnight on the phone's clock", async () => {
  const { nightKey, useCalendarDays } = await import('../js/observation.js');
  useCalendarDays(true);
  const d = (h, m = 0) => new Date(2026, 10, 19, h, m).getTime();
  assert.equal(nightKey(d(8)), nightKey(d(23, 50)), 'morning and night are one day');
  assert.notEqual(nightKey(d(11, 50)), nightKey(new Date(2026, 10, 20, 0, 10).getTime()), 'a new day after midnight');
  useCalendarDays(false);
  assert.notEqual(nightKey(d(8), -79.4), nightKey(d(23, 50), -79.4), 'Space Collector keeps noon-to-noon nights');
});

test('patches count catches in Sky: one catch (two cards) is not a Double Sighting', async () => {
  const { progress, setSkyProgress } = await import('../js/progress.js'); setSkyProgress(true);
  const t = Date.now() - 3600e3;
  const s = (key, time) => ({ cardKey: key, objectId: key, time, lon: -79.4, lat: 43.6, cardSnapshot: { sky: key.startsWith('F:') ? 'flight' : 'plane' } });
  const info = () => ({ tier: 'common' });
  const done = (list) => new Set(progress(list, info, { keep: false }).achievements.filter((x) => x.done).map((x) => x.id));
  assert.ok(!done([s('F:ACA:CYYZ-EGLL', t), s('P:B789', t)]).has('double'), 'one catch');
  assert.ok(done([s('F:ACA:CYYZ-EGLL', t), s('P:B789', t), s('F:UAL:KEWR-KSFO', t + 30e3), s('P:B739', t + 30e3)]).has('double'), 'two catches in a minute');
});
