import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { PlaneTracker, loadAirlines, airlineName } from '../js/planes.js';

await loadAirlines();

test('airlines outside the hand list resolve to a name', () => {
  for (const [cs, name] of [['RYR8123', /ryanair/i], ['IGO123', /indigo/i], ['QFA7', /qantas/i], ['EZY12AB', /easyjet/i], ['AXM123', /airasia/i], ['VJC12', /vietjet/i], ['ETH500', /ethiopian/i]]) {
    assert.match(airlineName(cs), name, cs);
  }
  assert.equal(airlineName('ACA511'), 'Air Canada'); // hand list keeps its nicer names
  assert.equal(airlineName('C-GWUQ'), '');
  assert.equal(airlineName('N123AB'), '');
});

test('route() gives any airline-style callsign an airline', () => {
  const t = new PlaneTracker();
  assert.equal(t.route('RYR8123').airline, 'Ryanair');
  assert.equal(t.route('IGO123').airline, 'IndiGo');
  assert.equal(t.route('N123AB'), null);
});

test('share of airline callsigns in the research samples that get a name', { skip: !existsSync(new URL('../data/research/samples-2026-11-15.jsonl.gz', import.meta.url)) }, () => {
  const txt = gunzipSync(readFileSync(new URL('../data/research/samples-2026-11-15.jsonl.gz', import.meta.url))).toString();
  let total = 0, named = 0; const miss = new Map();
  for (const line of txt.split('\n').filter(Boolean)) for (const a of JSON.parse(line).ac ?? []) {
    const cs = (a[1] ?? '').trim();
    if (!/^[A-Z]{3}\d/.test(cs)) continue;
    total++;
    if (airlineName(cs)) named++; else miss.set(cs.slice(0, 3), (miss.get(cs.slice(0, 3)) ?? 0) + 1);
  }
  const pct = (100 * named / total).toFixed(1);
  console.log(`airline callsigns named: ${named}/${total} = ${pct}%; unnamed prefixes:`, [...miss].slice(0, 15));
  assert.ok(named / total >= 0.95, `${pct}% named`);
});
