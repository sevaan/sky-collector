import test from 'node:test';
import assert from 'node:assert/strict';
import { XP, xpLedger, totalXp, rankFor, standing, progressAfter } from '../js/sky-progress.js';
import { assess } from '../js/sky-stamps.js';
import { RANKS } from '../js/progress.js';

const DAY = 86400e3, T0 = new Date(2026, 10, 1, 12, 0).getTime();
const FK = 'F:ROU:CYYZ-BIKF', PK = 'P:A321';
const mk = (dayN, hex = 'aaa001', { f = FK, p = PK, dt = 0 } = {}) => ({ time: T0 + dayN * DAY + dt, hex, callsign: 'ROU1', flight: f ? { key: f } : null, plane: p ? { key: p } : null });

test('XP sums from a list: new flight + new plane, then stamps', () => {
  assert.equal(totalXp([]), 0);
  assert.equal(totalXp([mk(0)]), XP.newFlight + XP.newPlane); // first catch opens both cards
  assert.equal(totalXp([mk(0), mk(1, 'aaa001')]), 140 + 10); // new day on the flight is a stamp; same plane again is nothing
  assert.equal(totalXp([mk(0), mk(0, 'bbb002', { dt: 3600e3 })]), 140 + 10); // other aircraft, same day: plane stamp only
  assert.equal(totalXp([mk(0, 'a1', { f: null })]), 60); // no route: plane card only
  assert.equal(totalXp([mk(0, 'a1', { f: null }), mk(0, 'b2', { f: 'F:ACA:CYYZ-CYVR', p: 'P:B38M' })]), 60 + 80 + 60);
});

test('same aircraft on the same local day gives 0, next day stamps', () => {
  const a = mk(0), b = mk(0, 'aaa001', { dt: 2 * 3600e3 });
  assert.equal(xpLedger([a, b])[1].xp, 0);
  assert.equal(progressAfter([a], b).gained, 0);
  assert.equal(xpLedger([a, mk(1)])[1].xp, XP.stamp);
});

test('level-up bonus: Silver on the 5th flight day, Gold on the 15th', () => {
  const days = Array.from({ length: 15 }, (_, i) => mk(i));
  const led = xpLedger(days).map((e) => e.xp);
  assert.deepEqual(led.slice(0, 4), [140, 10, 10, 10]);
  assert.equal(led[4], 10 + XP.levelUp.silver);
  assert.deepEqual(led.slice(5, 14), Array(9).fill(10));
  assert.equal(led[14], 10 + XP.levelUp.gold);
  assert.equal(xpLedger(days)[4].parts.find((p) => p.kind === 'levelUp').level, 'silver');
  // plane type: 10th aircraft is Silver
  const jets = Array.from({ length: 10 }, (_, i) => mk(0, `hex${i}`, { f: null }));
  assert.equal(xpLedger(jets)[9].xp, 10 + 40);
});

test('rank-up crossing: bar shape, prev, rankUp name', () => {
  assert.equal(rankFor(0).name, 'Spotter'); assert.equal(rankFor(499).name, 'Spotter'); assert.equal(rankFor(500).name, 'Plane Spotter');
  assert.equal(rankFor(90000).next, null);
  assert.equal(rankFor(RANKS.at(-1)[0]).name, 'Sky Legend');
  // 4 flights (each its own new flight+plane = 140) = 560 crosses 500 on the 4th
  const L = ['A', 'B', 'C', 'D'].map((x, i) => mk(i, `h${i}`, { f: `F:${x}:X-Y`, p: `P:${x}` }));
  const r3 = progressAfter(L.slice(0, 3));
  assert.equal(r3.gained, 140); assert.equal(r3.rankUp, null); assert.equal(r3.rank.prev, undefined);
  const r4 = progressAfter(L); // newest is the 4th, already in the list
  assert.equal(r4.rank.from, 420); assert.equal(r4.rank.to, 560);
  assert.equal(r4.rankUp, 'Plane Spotter'); assert.equal(r4.rank.name, 'Plane Spotter');
  assert.deepEqual(r4.rank.prev, { name: 'Spotter', at: 0, next: 500 });
  assert.equal(r4.rank.at, 500); assert.equal(r4.rank.next, 1500);
  assert.equal(progressAfter(L.slice(0, 3), L[3]).gained, 140); // newCatch not yet in the list works too
  const s = standing(L); assert.equal(s.xp, 560); assert.equal(s.toNext, 940);
});

test('reload = same total (order, copies and JSON round trip do not matter)', () => {
  const list = [mk(0), mk(1), mk(1, 'bbb', { dt: 5 }), mk(2, 'ccc', { f: null, p: 'P:E190' })];
  const t = totalXp(list);
  assert.equal(totalXp(JSON.parse(JSON.stringify(list))), t);
  assert.equal(totalXp([...list].reverse()), t);
  assert.equal(totalXp(list.map((c) => ({ ...c, id: `${c.time}:${c.hex}` }))), t);
});

test('agrees with sky-stamps assess: a catch earns XP exactly when assess says it changes something', () => {
  const list = [];
  for (const c of [mk(0), mk(0, 'aaa001', { dt: 1000 }), mk(0, 'zzz9', { dt: 2000 }), mk(1), mk(1, 'k', { f: null, p: 'P:C172' }), mk(2, 'k', { f: null, p: 'P:C172' })]) {
    const out = assess(list, c), e = xpLedger([...list, c]).at(-1);
    assert.equal(e.xp > 0, out.kind !== 'none', `${c.time}`);
    list.push(c);
  }
});
