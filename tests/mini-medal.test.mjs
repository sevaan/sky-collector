// The level medal on mini cards (2026-11-19, Sevaan: "Go with B"): a levelled card's mini carries a disc of its level's
// metal with the catch count; an unlevelled one carries none.
import test from 'node:test';
import assert from 'node:assert/strict';
const store = { units: 'metric' }; globalThis.localStorage ??= { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const { flightCardHtml, planeCardHtml } = await import('../js/flight-card.js');
const plane = { kind: 'plane', key: 'P:B38M', name: 'Boeing 737 MAX 8', type: 'B38M', tier: 'uncommon', glyph: 'jet', set: 'Narrowbodies' };
const flight = { kind: 'flight', key: 'F:ACA:CYYZ-EGLL', tier: 'rare', callsign: 'ACA856', airline: 'Air Canada', airlineIcao: 'ACA', type: 'A333', from: { icao: 'CYYZ', iata: 'YYZ', city: 'Toronto' }, to: { icao: 'EGLL', iata: 'LHR', city: 'London' }, km: 5708, air: { h: 7, m: 40 } };
const si = (level, count) => ({ level, count, days: count, nights: 0, liveryCount: 1 });
for (const [name, html] of [['plane', (o) => planeCardHtml(plane, o)], ['flight', (o) => flightCardHtml(flight, o)]]) {
  for (const [level, count] of [['bronze', 1], ['silver', 5], ['gold', 15]]) {
    test(`${name} mini at ${level} carries a ${level} medal with ${count}`, () => {
      const h = html({ small: true, stampInfo: si(level, count), caughtAt: new Date() });
      assert.match(h, new RegExp(`class="sct-lvl sct-lvl--${level}"[^>]*><i>${count}</i>`));
    });
  }
  test(`${name} mini with no level carries no medal`, () => {
    assert.doesNotMatch(html({ small: true, stampInfo: si('none', 0), caughtAt: new Date() }), /sct-lvl/);
    assert.doesNotMatch(html({ small: true }), /sct-lvl/);
  });
  test(`${name} full card carries no mini medal`, () => assert.doesNotMatch(html({ stampInfo: si('gold', 15), caughtAt: new Date() }), /sct-lvl/));
}
