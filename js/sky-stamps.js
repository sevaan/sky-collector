// Stamps and levels for Sky Collector's cards (2026-11-15, Sevaan: catching a card again should stamp it, like Space
// Collector's fleet cards). Everything here is DERIVED from the catch records (js/catch-store.js allCatches): nothing
// is stored per tap, so catches made before stamps existed already have theirs. No DOM here.
//   Flight card (F:ROU:CYYZ-BIKF): one stamp per LOCAL calendar day you caught that flight.
//   Plane card (P:A321): one stamp per individual aircraft (hex) of that type, and the liveries it flew in, counted by
//   the callsign's 3-letter ICAO prefix (never the airline's name, which can be respelled).
// Levels: flights 1 / 5 / 15 days, plane types 1 / 10 / 50 aircraft.

// Where the "day" turns over. Midnight local for now; this one number is the place to move it to 4 AM later.
export const DAY_STARTS_AT_HOUR = 0;
export function localDay(ms) {
  const d = new Date(ms - DAY_STARTS_AT_HOUR * 3600e3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const LEVELS = ['none', 'bronze', 'silver', 'gold'];
export const THRESHOLDS = { flight: [1, 5, 15], plane: [1, 10, 50] };
export const levelFor = (kind, n) => { const [b, s, g] = THRESHOLDS[kind] ?? THRESHOLDS.flight; return n >= g ? 'gold' : n >= s ? 'silver' : n >= b ? 'bronze' : 'none'; };
export const levelRank = (l) => Math.max(0, LEVELS.indexOf(l));
// Stamps still needed for the next level, or 0 at gold.
export const toNextLevel = (kind, n) => { const t = (THRESHOLDS[kind] ?? THRESHOLDS.flight).find((x) => n < x); return t ? t - n : 0; };

// An airline-style callsign: three letters then a digit (ACA123, ROU1908). Anything else (N123AB, CFXYZ, "LIFEGUARD")
// has no airline, so its registration is just the callsign again and isn't worth showing or saving.
export const hasAirlineCallsign = (cs) => /^[A-Z]{3}\d/.test(String(cs ?? '').trim().toUpperCase());
// The 3-letter airline prefix of a catch ('' when none).
export function airlineOf(c) {
  const cs = String(c?.callsign ?? '').trim().toUpperCase();
  if (hasAirlineCallsign(cs)) return cs.slice(0, 3);
  return c?.flight?.airlineIcao || (/^F:([A-Z]{3}):/.exec(c?.flight?.key ?? c?.key ?? '') || [])[1] || '';
}
const hexOf = (c) => String(c?.hex || `anon:${c?.time}`).toLowerCase();

// The flight card's stamps: [{ day:'2026-11-15', time (first catch that day), hex }] oldest first, plus count and level.
export function flightStampInfo(list, key) {
  const days = new Map(), nights = new Set();
  for (const c of list ?? []) {
    if (c?.flight?.key !== key || !c.time) continue;
    const d = localDay(c.time), s = days.get(d);
    if (typeof c.sunEl === 'number' && c.sunEl < -6) nights.add(d); /* caught after dark: a night stamp (2026-11-19, #8) */
    if (!s || c.time < s.time) days.set(d, { day: d, time: c.time, hex: c.hex ?? '' });
  }
  const stamps = [...days.values()].sort((a, b) => a.time - b.time), count = stamps.length;
  return { kind: 'flight', key, count, level: levelFor('flight', count), toNext: toNextLevel('flight', count), stamps, nights: nights.size };
}

// The plane card's stamps: one per aircraft, [{ hex, time (first catch), airline }] oldest first; liveries = distinct prefixes.
export function planeStampInfo(list, key) {
  const jets = new Map(), days = new Set();
  for (const c of list ?? []) {
    if (c?.plane?.key !== key || !c.time) continue;
    days.add(localDay(c.time));
    const h = hexOf(c), a = airlineOf(c), s = jets.get(h);
    if (!s) jets.set(h, { hex: h, time: c.time, airline: a, airlines: new Set(a ? [a] : []) });
    else { if (c.time < s.time) s.time = c.time; if (a) { s.airlines.add(a); s.airline ||= a; } }
  }
  const stamps = [...jets.values()].sort((a, b) => a.time - b.time), count = stamps.length;
  const liveries = [...new Set(stamps.flatMap((s) => [...s.airlines]))];
  return { kind: 'plane', key, count, level: levelFor('plane', count), toNext: toNextLevel('plane', count), stamps, liveries, liveryCount: liveries.length, days: days.size };
}

// "7 A321s in 4 liveries" (a type with no airline colours, like a helicopter: "3 R44s").
export function planeLine(info, label) {
  const n = info.count, l = info.liveryCount ?? 0, name = label || 'aircraft';
  const base = `${n} ${name}${n === 1 ? '' : name === 'aircraft' ? '' : 's'}`;
  const seen = (info.days ?? 0) > n ? ` · seen on ${info.days} days` : ''; /* the local helicopter, a private plane: the days you've seen it (2026-11-19) */
  return (l ? `${base} in ${l} ${l === 1 ? 'livery' : 'liveries'}` : base) + seen;
}
export const levelWord = (l) => (l === 'none' ? '' : l.toUpperCase());

// What catching this would do, worked out from the records and the catch about to be made.
// probe: { time, hex, callsign, flight: {key}|null, plane: {key} }.
// Returns { kind: 'new'|'stamp'|'none', stampOn: 'flight'|'plane', level, levelUp, stampCount,
//           flightStamps, planeStamps (each { count, level, levelUp, gained, isNew, liveries? } or null) }.
//   new   = the card you're shown is new (a new flight, or a new plane when there's no route)
//   stamp = a card you own gains a stamp (a new day on the flight, or a new aircraft of the plane type)
//   none  = nothing changes: the same aircraft on the same local day
export function assess(list, probe) {
  const after = [...(list ?? []), probe];
  const part = (infoFn, key) => {
    const b = infoFn(list, key), a = infoFn(after, key), day = !!(infoFn === planeStampInfo && probe.plane?.daily && (a.days ?? 0) > (b.days ?? 0) && a.count === b.count), gained = a.count > b.count || day;
    /* day: a helicopter or a private plane you already have, on a new day: a small stamp (its days seen), so the local one is worth looking up at again (QA 2026-11-19, #7) */
    return { count: a.count, level: a.level, before: b.count, levelUp: gained && b.count > 0 && levelRank(a.level) > levelRank(b.level), gained, isNew: gained && b.count === 0,
      liveries: a.liveryCount, newLivery: (a.liveryCount ?? 0) > (b.liveryCount ?? 0) && b.count > 0, day, days: a.days, info: a };
  };
  const flightStamps = probe.flight ? part(flightStampInfo, probe.flight.key) : null;
  const planeStamps = probe.plane ? part(planeStampInfo, probe.plane.key) : null;
  const gained = !!(flightStamps?.gained || planeStamps?.gained);
  const main = flightStamps ?? planeStamps;
  const stampOn = !flightStamps || !flightStamps.gained ? 'plane' : 'flight';
  const shown = stampOn === 'plane' ? planeStamps : flightStamps;
  const kind = !gained ? 'none' : main?.isNew ? 'new' : 'stamp';
  return { kind, stampOn, level: shown?.level ?? 'none', levelUp: kind === 'stamp' && !!shown?.levelUp, stampCount: shown?.count ?? 0,
    flightStamps: flightStamps && { ...flightStamps, info: undefined }, planeStamps: planeStamps && { ...planeStamps, info: undefined } };
}
