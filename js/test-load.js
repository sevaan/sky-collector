// Testing tools → Load cards (2026-11-21, Sevaan: "a testing option called Load cards which just loads a bunch of cards and
// passes so I can test"). Builds real catches the same way a catch does (js/flights.js cardsFor → js/sky-cards.js
// catchSightings), spread over the last three weeks: airline flights with routes from around the world (so the Passes tab and
// the route map fill up), repeats of a few types and routes (so levels and stamps show), and plane-only catches (private,
// business, military, a helicopter, a type the feed can't name). Each sighting is marked via: 'test-load'.

import { cardsFor } from './flights.js?v=0.1.1916';
import { catchSightings } from './sky-cards.js?v=0.1.1916';
import { airport } from './routes.js?v=0.1.1916';

// [callsign, type, from ICAO, to ICAO, airline, category, days ago]
const FLIGHTS = [
  ['ACA848', 'B789', 'CYYZ', 'EGLL', 'Air Canada', 'A5', 20], ['WJA657', 'B38M', 'CYYZ', 'CYYC', 'WestJet', 'A3', 19],
  ['DLH471', 'A359', 'CYYZ', 'EDDF', 'Lufthansa', 'A5', 18], ['KLM692', 'B77W', 'CYYZ', 'EHAM', 'KLM', 'A5', 17],
  ['ACA115', 'A321', 'CYYZ', 'CYVR', 'Air Canada', 'A3', 16], ['JZA8091', 'DH8D', 'CYYZ', 'CYOW', 'Jazz', 'A2', 15],
  ['AFR351', 'A359', 'CYUL', 'LFPG', 'Air France', 'A5', 14], ['ACA1', 'B77W', 'CYYZ', 'RJTT', 'Air Canada', 'A5', 13],
  ['UAL3802', 'E75L', 'KORD', 'CYYZ', 'United', 'A3', 12], ['DAL1928', 'A321', 'KDTW', 'KBOS', 'Delta', 'A3', 11],
  ['TSC572', 'A321', 'CYYZ', 'LPPT', 'Air Transat', 'A3', 10], ['AMX693', 'B738', 'MMMX', 'CYYZ', 'Aeroméxico', 'A3', 9],
  ['BAW98', 'B744', 'CYYZ', 'EGLL', 'British Airways', 'A5', 8], ['KAL74', 'B77W', 'CYYZ', 'RKSI', 'Korean Air', 'A5', 7],
  ['UAE242', 'A388', 'CYYZ', 'OMDB', 'Emirates', 'A5', 6], ['SWR41', 'A333', 'KSFO', 'LSZH', 'Swiss', 'A5', 5],
  ['ACA894', 'B763', 'CYUL', 'LIRF', 'Air Canada', 'A5', 4], ['JBU1501', 'A320', 'KJFK', 'KMCO', 'JetBlue', 'A3', 3],
  ['WJA1514', 'B38M', 'CYEG', 'KLAX', 'WestJet', 'A3', 2], ['POE213', 'E295', 'CYTZ', 'CYUL', 'Porter', 'A3', 1],
  // repeats: the same flights and types on other days, for stamps and levels
  ['ACA848', 'B789', 'CYYZ', 'EGLL', 'Air Canada', 'A5', 9], ['ACA848', 'B789', 'CYYZ', 'EGLL', 'Air Canada', 'A5', 3],
  ['JZA8091', 'DH8D', 'CYYZ', 'CYOW', 'Jazz', 'A2', 6], ['JZA8091', 'DH8D', 'CYYZ', 'CYOW', 'Jazz', 'A2', 0],
  ['WJA657', 'B38M', 'CYYZ', 'CYYC', 'WestJet', 'A3', 4],
];
// plane-only: [callsign, type, category, extra, days ago]
const PLANES = [
  ['CGABC', 'C172', 'A1', {}, 12], ['N650GD', 'GLF6', 'A2', {}, 8], ['CFPCT', 'PC12', 'A1', {}, 5],
  ['RCH431', 'C17', 'A5', { gov: true, cls: 'mil' }, 10], ['CGHEL', '', 'A7', { heli: true }, 6], ['', '', 'A5', {}, 2],
];
let n = 0;
const hex = () => `7e57${(++n).toString(16).padStart(2, '0')}`; // an invented address per aircraft, never a real one

export async function testCatches(now = Date.now(), where = { lat: 43.7, lon: -79.4 }) {
  const out = [], lat = where?.lat ?? null, lon = where?.lon ?? null;
  const at = (days) => now - days * 86400e3 - (n * 37 % 600) * 60e3;
  for (const [cs, type, a, b, airline, category, days] of FLIGHTS) {
    const [from, to] = await Promise.all([airport(a), airport(b)]);
    const p = { hex: hex(), callsign: cs, type, category, altFt: 31000, gs: 470 };
    const c = cardsFor(p, { callsign: cs, from, to }, airline);
    out.push(...catchSightings({ time: at(days), hex: p.hex, callsign: cs, type, altFt: 31000, gsKt: 470, rangeKm: 18, lat, lon, flight: c.flight, plane: c.plane, via: 'test-load' }));
  }
  for (const [cs, type, category, extra, days] of PLANES) {
    const p = { hex: hex(), callsign: cs, type, category, altFt: 4500, gs: 140, ...extra };
    const c = cardsFor(p, null, '');
    out.push(...catchSightings({ time: at(days), hex: p.hex, callsign: cs, type, altFt: 4500, gsKt: 140, rangeKm: 6, lat, lon, flight: c.flight, plane: c.plane, via: 'test-load' }));
  }
  return out;
}

/* The demo scene's collection (js/demo-boot.js, store filming, 2026-11-25): Load cards' three weeks, plus a Legendary (an
   An-124), a shiny (golden hour, the 787 to London), more patches' worth of variety, and yesterday afternoon's catches, so
   the morning's night pack is waiting to be opened. Everything is marked via: 'demo'. Nothing here is a real aircraft's address. */
const DEMO_YESTERDAY = [
  ['ACA856', 'A320', 'CYYZ', 'CYOW', 'Air Canada', 'A3'], ['BAW92', 'B788', 'CYYZ', 'EGLL', 'British Airways', 'A5'],
  ['KLM692', 'B77W', 'CYYZ', 'EHAM', 'KLM', 'A5'], ['FDX1702', 'B763', 'KMEM', 'CYYZ', 'FedEx', 'A5'],
  ['POE145', 'DH8D', 'CYTZ', 'CYOW', 'Porter', 'A2'], ['WJA1210', 'B38M', 'CYYZ', 'KMCO', 'WestJet', 'A3'],
];
export async function demoCatches(now = Date.now(), where = { lat: 43.65, lon: -79.38 }) {
  n = 0;
  const out = (await testCatches(now, where)).map((s) => ({ ...s, via: 'demo' }));
  const lat = where?.lat ?? null, lon = where?.lon ?? null;
  /* a Legendary: an Antonov An-124 into Toronto, caught 4 days ago (a plane card: no callsign kept) */
  { const p = { hex: hex(), callsign: '', type: 'A124', category: 'A5', altFt: 6500, gs: 210 }, c = cardsFor(p, null, '');
    out.push(...catchSightings({ time: now - 4 * 86400e3 - 95 * 60e3, hex: p.hex, callsign: '', type: 'A124', altFt: 6500, gsKt: 210, rangeKm: 9, lat, lon, flight: c.flight, plane: c.plane, via: 'demo' })); }
  /* a shiny: Air Canada's 787 to London at golden hour, 2 days ago */
  { const [from, to] = await Promise.all([airport('CYYZ'), airport('EGLL')]), p = { hex: hex(), callsign: 'ACA858', type: 'B789', category: 'A5', altFt: 12000, gs: 300 };
    const c = cardsFor(p, { callsign: 'ACA858', from, to }, 'Air Canada'), t = now - 2 * 86400e3 - 20 * 60e3;
    out.push(...catchSightings({ time: t, hex: p.hex, callsign: 'ACA858', type: 'B789', altFt: 12000, gsKt: 300, rangeKm: 11, lat, lon, flight: c.flight, plane: c.plane, via: 'demo' }).map((s) => ({ ...s, shiny: 'golden' }))); }
  /* yesterday afternoon, one catch every 20 minutes from 2:10 PM: today's night pack */
  const y = new Date(now - 86400e3); y.setHours(14, 10, 0, 0);
  for (const [i, [cs, type, a, b, airline, category]] of DEMO_YESTERDAY.entries()) {
    const [from, to] = await Promise.all([airport(a), airport(b)]), p = { hex: hex(), callsign: cs, type, category, altFt: 24000, gs: 420 };
    const c = cardsFor(p, { callsign: cs, from, to }, airline);
    out.push(...catchSightings({ time: y.getTime() + i * 20 * 60e3, hex: p.hex, callsign: cs, type, altFt: 24000, gsKt: 420, rangeKm: 22, lat, lon, flight: c.flight, plane: c.plane, via: 'demo' }));
  }
  return out;
}
