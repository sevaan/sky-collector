// The approved loop rules (docs/DESIGN-LOOP.md, 2026-11-17): tiers, sets, "Rare here", sized missions, Sky's XP and ranks.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, String(v)); }, removeItem(k) { this.m.delete(k); } };
const { typeTier } = await import('../js/sky-tiers.js');
const { planeSet, flightSet, setLevel, PLANE_SETS } = await import('../js/sky-sets.js');
const { flightTier, retier, cardsFor } = await import('../js/flights.js');
const { noteLocal, localStats, rareHere, _resetLocal } = await import('../js/sky-local.js');
const { SKY_MISSIONS, setSkySize, setSkyProgress, RANKS } = await import('../js/progress.js');

test('plane tiers: one tier everywhere, icons lifted by hand', () => {
  assert.equal(typeTier('B738'), 'common'); assert.equal(typeTier('B789'), 'common'); // long-haul twins are in the world's top 15
  assert.equal(typeTier('DH8D'), 'uncommon'); assert.equal(typeTier('L410'), 'rare');
  assert.equal(typeTier('B744'), 'epic'); assert.equal(typeTier('A388'), 'epic'); assert.equal(typeTier('A124'), 'legendary');
  assert.equal(typeTier('EC35', true), 'rare'); assert.equal(typeTier(''), 'common');
});
test('flight tiers: distance bands, cargo is Rare not Epic, ultra-long is Legendary', () => {
  assert.equal(flightTier(400, 'ACA'), 'common'); assert.equal(flightTier(3000, 'ACA'), 'uncommon'); assert.equal(flightTier(6000, 'ACA'), 'rare');
  assert.equal(flightTier(11000, 'ACA'), 'epic'); assert.equal(flightTier(15300, 'SIA'), 'legendary');
  assert.equal(flightTier(900, 'FDX'), 'rare'); assert.equal(flightTier(11000, 'FDX'), 'epic'); assert.equal(flightTier(null, 'ACA'), 'common');
});
test('plane sets: families, and the Cessna 172 is not a C-17', () => {
  assert.equal(planeSet('C172').id, 'light'); assert.equal(planeSet('C17').id, 'giants'); assert.equal(planeSet('B744').id, 'giants');
  assert.equal(planeSet('B38M').id, 'b737'); assert.equal(planeSet('A21N').id, 'a320'); assert.equal(planeSet('B77W').id, 'twinaisle');
  assert.equal(planeSet('E75L').id, 'regional'); assert.equal(planeSet('DH8D').id, 'props'); assert.equal(planeSet('C56X').id, 'bizjets');
  assert.equal(planeSet('EC35', true).id, 'helicopters'); assert.equal(planeSet('ZZZZ').id, 'others');
  for (const s of PLANE_SETS) assert.ok(s.goals[0] <= s.goals[1] && s.goals[1] <= s.goals[2]);
});
test('flight sets: measured from the flight, the same in any country', () => {
  const ap = (cc) => ({ cc });
  assert.equal(flightSet(300, ap('FR'), ap('FR'), 'AFR').id, 'hops'); assert.equal(flightSet(900, ap('JP'), ap('JP'), 'ANA').id, 'home');
  assert.equal(flightSet(800, ap('FR'), ap('DE'), 'DLH').id, 'nextdoor'); assert.equal(flightSet(6000, ap('GB'), ap('US'), 'BAW').id, 'crossings');
  assert.equal(flightSet(11000, ap('AE'), ap('US'), 'UAE').id, 'longway'); assert.equal(flightSet(700, ap('US'), ap('US'), 'FDX').id, 'cargo');
  assert.equal(flightSet(3000, ap('CA'), ap('MX'), 'ACA').id, 'world'); assert.equal(setLevel({ goals: [2, 3, 5] }, 3), 2);
});
test('a card saved under old rules takes today\'s tier and set', () => {
  const old = { sky: 'flight', key: 'F:FDX:KMEM-CYYZ', km: 1500, tier: 'epic', set: 'Cargo', from: { cc: 'US' }, to: { cc: 'CA' }, airlineIcao: 'FDX' };
  retier(old); assert.equal(old.tier, 'rare'); assert.equal(old.setId, 'cargo');
  const pl = retier({ sky: 'plane', key: 'P:B789', tier: 'common' }); assert.equal(pl.tier, 'common'); assert.equal(pl.setId, 'twinaisle');
  const made = cardsFor({ type: 'B744', callsign: 'BAW93', reg: 'G-CIVB' }, null, 'British Airways').plane; assert.equal(made.tier, 'epic'); assert.equal(made.setId, 'giants');
});
test('"Rare here": under 1% of 200+ aircraft seen at this place', () => {
  _resetLocal({ d: {} });
  noteLocal(Array.from({ length: 150 }, () => ({ type: 'B738', flags: ['airline'] })), true);
  assert.equal(rareHere('A359'), false); // not enough seen yet
  noteLocal([...Array.from({ length: 60 }, () => ({ type: 'A320' })), { type: 'A359', flags: ['wide', 'high'] }], true);
  const st = localStats(); assert.equal(st.total, 211); assert.equal(st.hours, 2);
  assert.equal(rareHere('A359'), true); assert.equal(rareHere('B738'), false); assert.equal(rareHere(''), false); assert.equal(rareHere('B748'), true); // never seen here
  assert.equal(st.flags7.wide, 1); assert.equal(st.sky, 'new'); // under 3 open hours: no size yet
});
test('missions sized to the sky', () => {
  const m = SKY_MISSIONS.find((x) => x.id === 'airlines3'), cs = (a) => ({ callsign: `${a}123` });
  setSkySize('quiet'); assert.match(m.text, /an airline flight/); assert.equal(m.done([cs('ACA')]), true);
  setSkySize('busy'); assert.match(m.text, /five different airlines/); assert.equal(m.done([cs('ACA'), cs('WJA'), cs('DAL')]), false);
  setSkySize('steady'); assert.equal(m.done([cs('ACA'), cs('WJA'), cs('DAL')]), true);
  assert.equal(SKY_MISSIONS.find((x) => x.id === 'rarehere').done([{ rareHere: true }]), true);
});
test('Sky ranks: the first two stretched, Space Collector\'s restored when off', () => {
  setSkyProgress(true); assert.deepEqual(RANKS.slice(0, 4).map((r) => r[0]), [0, 700, 2000, 4000]); assert.equal(RANKS[1][1], 'Plane Spotter');
  setSkyProgress(false); assert.deepEqual(RANKS.slice(0, 3).map((r) => r[0]), [0, 500, 1500]); assert.equal(RANKS[1][1], 'Spotter');
});
