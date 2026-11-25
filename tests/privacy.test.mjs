// Privacy (2026-11-19): aircraft that aren't flying an airline flight are anonymous in Sky (js/planes.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const store = {}; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const { parsePlanes, isAnonymous, anonId } = await import('../js/planes.js');
const feed = JSON.parse(readFileSync(new URL('../scripts/perf/fixtures/planes-yyz.json', import.meta.url), 'utf8'));

test('the recorded Toronto feed: no private, flagged or military aircraft keeps a callsign, registration or real hex', () => {
  const planes = parsePlanes(feed), raw = new Map((feed.ac ?? feed.aircraft).map((a) => [a.hex, a]));
  let anon = 0, airline = 0;
  for (const p of planes) {
    if (p.anon) { anon++; assert.equal(p.callsign, ''); assert.equal(p.reg, ''); assert.match(p.hex, /^~/); assert.ok(!raw.has(p.hex)); }
    else { airline++; assert.match(p.callsign, /^[A-Z]{3}\d/); assert.ok(raw.has(p.hex)); assert.equal(Number(raw.get(p.hex).dbFlags ?? 0) & 13, 0); }
  }
  assert.ok(anon >= 5 && airline >= 10, `${anon} anonymous, ${airline} airline`);
  const ladd = (feed.ac ?? feed.aircraft).filter((a) => Number(a.dbFlags) & 8);
  assert.ok(ladd.length >= 5); for (const a of ladd) assert.ok(isAnonymous(a), a.r);
  assert.ok(!JSON.stringify(planes).includes('CGJLN') && !JSON.stringify(planes).includes('N342ZK'), 'no registration anywhere');
});

test('who is anonymous', () => {
  assert.equal(isAnonymous({ flight: 'ACA856' }), false);
  assert.equal(isAnonymous({ flight: 'CGJLN' }), true, 'a registration callsign');
  assert.equal(isAnonymous({ flight: 'N342ZK' }), true);
  assert.equal(isAnonymous({ flight: '' }), true);
  assert.equal(isAnonymous({ flight: 'EJA512', dbFlags: 8 }), true, 'LADD, even with an airline-style callsign');
  assert.equal(isAnonymous({ flight: 'XYZ1', dbFlags: 4 }), true, 'PIA');
  assert.equal(isAnonymous({ flight: 'RCH123', dbFlags: 1 }), true, 'military');
  assert.equal(isAnonymous({ flight: 'ACA1', dbFlags: 2 }), false, '"interesting" alone is not private');
  assert.equal(isAnonymous({ flight: 'TWY412', t: 'GLF6' }), true, 'a business-jet type under an airline-shaped callsign (bug pass 2026-11-25)');
  assert.equal(isAnonymous({ flight: 'WUP88', t: 'PC12' }), true, 'Wheels Up');
  assert.equal(isAnonymous({ flight: 'ACA856', t: 'A333' }), false);
});

test('the anonymous id is stable on one phone, different on another, and never the hex', () => {
  const a = anonId('c05a1b'); assert.equal(anonId('C05A1B'), a); assert.notEqual(a, 'c05a1b'); assert.match(a, /^~[0-9a-z]+$/);
  assert.notEqual(anonId('c05a1c'), a);
});
