// Every Military set card is a type code the feed really sends (2026-11-19). adsb.lol's `t` field comes from the
// tar1090-db aircraft database (Mictronics + ADS-B Exchange), whose type codes are ICAO Doc 8643 designators:
//   designators: https://github.com/wiedehopf/tar1090-db/blob/master/db/icao_aircraft_types.js (2,788 codes, read 2026-11-19)
//   aircraft:    https://github.com/wiedehopf/tar1090-db/blob/csv/aircraft.csv.gz (which code real military airframes carry)
// FEED_CODES below is the military and military-relevant part of that designator list, copied as it is there.
// Not designators (so never cards): F18 (the feed sends F18H for the F/A-18A-D Hornet, F18S for the Super Hornet and the
// EA-18G Growler), KC10 (the KC-10A Extender is filed as DC10, told apart from a civil DC-10 only by the military flag,
// and the USAF retired it in 2024), C5 (C5M), KC46 (B762), C40 / C32 / C37A / C37B / VC25 (airliner and bizjet codes).
// H53 is the twin-engine CH-53A/D/G Sea Stallion; the three-engine CH-53E/K is H53S.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKY_SETS } from '../js/sky-sets.js';
import { MIL_TYPES } from '../js/plane-privacy.js';

const FEED_CODES = new Set(('A10 A400 AN12 B1 B2 B52 C130 C160 C17 C2 C295 C30J C5M CN35 DC10 E2 E3CF E3TF E6 EUFI F15 F16 F18H F18S F22 F35 ' +
  'GRIF H47 H53 H53S H60 HAWK IL76 K35E K35R MRF1 P8 R135 RFAL SB39 T38 T6 TEX2 TOR U2 V22').split(' '));

const set = SKY_SETS.find((s) => s.id === 'military');
/* the set's own codes, read from its test: /^(C17|K35[ER]|...)$/ with one-letter classes expanded */
const setCodes = () => {
  const m = /\^\(([^)]*)\)\$/.exec(set.test.toString());
  return m[1].split('|').flatMap((c) => { const k = /^(.*)\[(\w+)\](.*)$/.exec(c); return k ? [...k[2]].map((x) => k[1] + x + k[3]) : [c]; });
};

test('every Military set code is a designator the feed sends', () => {
  const codes = setCodes();
  assert.ok(codes.length >= 25, `only ${codes.length} codes read`);
  for (const t of codes) { assert.ok(FEED_CODES.has(t), `${t} is not a feed designator`); assert.ok(set.test(t)); }
});
test('the feed codes for military-only types are anonymous (plane-privacy MIL_TYPES)', () => {
  for (const t of setCodes()) assert.ok(MIL_TYPES.test(t), `${t} missing from MIL_TYPES`);
  for (const t of ['F18H', 'F18S', 'H53S', 'SB39']) assert.ok(MIL_TYPES.test(t), t);
  for (const t of ['F18', 'KC10']) assert.ok(MIL_TYPES.test(t), `${t}: old codes stay`);
});
test('the F/A-18 card is the Super Hornet, as its photo shows', () => {
  assert.ok(set.test('F18S') && !set.test('F18') && !set.test('KC10'));
});
