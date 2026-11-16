import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mergeFeeds } from '../relay/worker-planes.js';

const fx = (c, f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${c}-${f}.json`, import.meta.url)));

test('merge: union by hex, counts per feed, newest position wins', () => {
  for (const c of ['frankfurt', 'delhi', 'johannesburg']) {
    const lol = fx(c, 'adsblol'), fi = fx(c, 'adsbfi');
    const m = mergeFeeds([{ id: 'adsblol', j: lol }, { id: 'adsbfi', j: fi }, { id: 'airplaneslive', j: null }]);
    const hexes = new Set([...lol.ac, ...fi.ac].map((a) => a.hex));
    assert.equal(m.total, hexes.size);
    assert.deepEqual(m.sources, { adsblol: lol.ac.length, adsbfi: fi.ac.length, airplaneslive: 0, merged: hexes.size });
    assert.ok(m.total >= Math.max(lol.ac.length, fi.ac.length));
  }
});

test('merge: the fresher position wins, seen_pos re-based on the newest feed time', () => {
  const a = { now: 1_000_000, ac: [{ hex: 'abc', lat: 1, lon: 1, seen_pos: 5 }, { hex: 'only', lat: 2, lon: 2, seen_pos: 1 }] };
  const b = { now: 1_002_000, ac: [{ hex: 'abc', lat: 9, lon: 9, seen_pos: 0.5 }] };
  const m = mergeFeeds([{ id: 'adsblol', j: a }, { id: 'adsbfi', j: b }]);
  assert.equal(m.now, 1_002_000_000); // seconds-based feeds are normalised to ms
  const abc = m.ac.find((x) => x.hex === 'abc');
  assert.equal(abc.lat, 9);
  assert.ok(Math.abs(abc.seen_pos - 0.5) < 1e-6);
  assert.equal(m.total, 2);
});

test('merge: a stale feed does not overwrite a fresher one; positionless never beats positioned', () => {
  const a = { now: 2_000_000_000_000, ac: [{ hex: 'x', lat: 1, lon: 1, seen_pos: 0 }] };
  const b = { now: 2_000_000_030_000, ac: [{ hex: 'x', lat: 5, lon: 5, seen_pos: 40 }, { hex: 'y' }] };
  const m = mergeFeeds([{ id: 'adsblol', j: a }, { id: 'adsbfi', j: b }]);
  assert.equal(m.ac.find((x) => x.hex === 'x').lat, 1); // adsb.lol's fix is at t0, adsb.fi's is at t0-10 s: lol wins
  assert.ok(m.ac.find((x) => x.hex === 'y'));
});

test('merge: null when nothing answered; client parse shape kept', () => {
  assert.equal(mergeFeeds([{ id: 'adsblol', j: null }]), null);
  const m = mergeFeeds([{ id: 'adsblol', j: fx('delhi', 'adsblol') }]);
  assert.ok(m.now > 1e12 && Array.isArray(m.ac) && m.ac[0].hex && 'alt_baro' in m.ac[0]);
});
