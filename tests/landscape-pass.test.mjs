// The landscape boarding pass (2026-11-21, design/pass-landscape/ round 3b): the end band carries the flight, the stub a
// real QR code (js/qr.js) for a well-known music video.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flightCardHtml } from '../js/flight-card.js';
import { qrEncode } from '../js/qr.js';

const f = { key: 'F:ACA:CYYZ-CYUL', callsign: 'ACA412', airline: 'Air Canada', airlineIcao: 'ACA', from: { iata: 'YYZ', city: 'Toronto' }, to: { iata: 'YUL', city: 'Montréal' }, km: 507, air: { h: 0, m: 55 }, type: 'BCS3', tier: 'uncommon', setName: 'Home Skies' };

test('the full pass is the landscape one, with the end band and the QR code', () => {
  const h = flightCardHtml(f, { caughtAt: new Date(2026, 10, 21, 11, 56), heightFt: 21300, sightings: 1 });
  assert.match(h, /class="fc fc--flight fc--land/);
  assert.match(h, /class="lp-band"[\s\S]*FLIGHT<b>ACA412<\/b>/);
  assert.match(h, /class="lp-qr"/);
  assert.match(h, /NOV 21, 2026/);
  assert.doesNotMatch(h, /undefined|NaN/);
});

test('the Collection mini is still the small pass', () => {
  assert.doesNotMatch(flightCardHtml(f, { small: true }), /fc--land/);
});

test('the QR code: the rickroll link fits version 3 at level L, 29 x 29 with its finder patterns', () => {
  const q = qrEncode('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'L');
  assert.equal(q.version, 3); assert.equal(q.size, 29);
  for (const [x, y] of [[0, 0], [22, 0], [0, 22]]) for (let i = 0; i < 7; i++) { assert.equal(q.modules[y][x + i], true); assert.equal(q.modules[y + i][x], true); }
});
