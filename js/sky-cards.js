// Flights and planes as Space Collector cards (Milestone 1.5, 2026-11-15, Sevaan: "the gameplay should pretty much be
// identical to Space Collector"). A plane catch is saved as Space Collector sightings (js/store.js), one per card it
// touches: its flight card (F:ROU:CYYZ-BIKF) and its plane card (P:A321). Each sighting carries the card itself as
// cardSnapshot, the way Space Collector keeps a satellite that has left the catalogue, so the Collection, the viewer,
// the reveal and progress all read plane cards through Space Collector's own code.
// Cards behave like Space Collector's fleet cards: a flight's stamps are the days you caught it, a plane type's are the
// individual aircraft (hex). Levels: flights 1 / 5 / 15, plane types 1 / 10 / 50 (js/sky-stamps.js). No DOM here.

import { localDay, levelFor, flightStampInfo, planeStampInfo } from './sky-stamps.js?v=0.1.1641';

export const isSkyCard = (o) => o?.sky === 'flight' || o?.sky === 'plane';
export const skyKindOfKey = (key) => (/^F:/.test(String(key)) ? 'flight' : /^P:/.test(String(key)) ? 'plane' : null);

// A flight or plane card (js/flights.js cardsFor) as a Space Collector card model.
export function skyModel(card, kind) {
  return { ...card, key: card.key, id: card.key, sky: kind, name: card.name ?? (kind === 'flight' ? `${card.from?.city} to ${card.to?.city}` : card.typeName), tier: card.tier ?? 'common' };
}

// The stamp a catch lands on that card: the local day for a flight, the aircraft for a plane type.
export const skyStampKey = (kind, t, hex) => (kind === 'flight' ? `DAY:${localDay(t)}` : `HEX:${String(hex || `anon:${t}`).toLowerCase()}`);

// One catch → the Space Collector sightings it makes (the flight's, when it had a route, and the plane's).
// c: { time, hex, callsign, reg, type, altFt, gsKt, rangeKm, lat, lon, flight, plane } (js/sky-catch.js collect).
export function catchSightings(c) {
  const base = { time: c.time, hex: c.hex, callsign: c.callsign ?? '', reg: c.reg ?? '', typeCode: c.type ?? c.plane?.type ?? '', altFt: c.altFt, gsKt: c.gsKt, rangeKm: c.rangeKm, lat: c.lat, lon: c.lon, ...(c.via ? { via: c.via } : {}) };
  const out = [];
  if (c.flight?.key) { const m = skyModel(c.flight, 'flight'); out.push({ ...base, objectId: m.key, cardKey: m.key, stampKey: skyStampKey('flight', c.time, c.hex), name: m.name, type: 'flight', cardSnapshot: m, flight: { key: m.key }, plane: c.plane?.key ? { key: c.plane.key, name: c.plane.name } : null }); }
  if (c.plane?.key) { const m = skyModel(c.plane, 'plane'); out.push({ ...base, objectId: m.key, cardKey: m.key, stampKey: skyStampKey('plane', c.time, c.hex), name: m.name, type: 'plane', cardSnapshot: m, plane: { key: m.key, name: m.name } }); }
  return out;
}

// Stamps and level of a plane card from its sightings (Space Collector sightings carry flight/plane keys, hex and callsign,
// which is all js/sky-stamps.js reads).
export function skyStampInfo(o, sightings) {
  const list = (sightings ?? []).filter((s) => !s.sim && s.via !== 'gift');
  return o.sky === 'flight' ? flightStampInfo(list, o.key) : planeStampInfo(list, o.key);
}
// The aircraft type code of a plane card model (an early import wrote 'flight'/'plane' over it; P:A321's code is in its key).
export function skyTypeCode(o, sightings) {
  if (o.type && !/^(flight|plane)$/.test(o.type)) return o.type;
  const last = (sightings ?? []).filter((s) => s.typeCode).sort((a, b) => b.time - a.time)[0];
  return last?.typeCode || (/^P:(.+)$/.exec(o.key ?? '') || [])[1] || '';
}
export const skyLevel = (o, sightings) => levelFor(o.sky, skyStampInfo(o, sightings).count);
