// A week of Sky missions, simulated (2026-11-20, design/missions-draft.md; Sevaan: "Build it with the 7 cuts"):
// a busy sky near a mid-size airport and a quiet rural sky under an airway. Seeded, so every run prints the same.
// Planes pass by the hour; the app is open at set times and notes what flies (js/sky-local.js, as js/sky-today.js
// logSeen does); each day's three missions and bonus are dealt as main.js skyDealMissions deals them (js/progress.js
// skyPossible + skyDeal); catches are saved the way main.js capturePlane saves them and scored by js/progress.js.
//   node scripts/sim/missions.mjs            prints the result (Markdown) to stdout
//   node scripts/sim/missions.mjs --write    also writes design/missions-sim.md
import { writeFileSync } from 'node:fs';
const store = { units: 'metric' }; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
let simNow = new Date(2026, 10, 23, 6, 0).getTime(); const realNow = Date.now; Date.now = () => simNow;
const P = await import('../../js/progress.js'); P.setSkyProgress(true);
const L = await import('../../js/sky-local.js');
const { cardsFor } = await import('../../js/flights.js');
const { catchSightings } = await import('../../js/sky-cards.js');
const { nightKey } = await import('../../js/observation.js');
const K = await import('../../js/sky-kinds.js');
const { planeSet } = await import('../../js/sky-sets.js');

let seed = 1;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pickW = (l) => { const tot = l.reduce((s, x) => s + x.w, 0); let r = rnd() * tot; for (const x of l) { r -= x.w; if (r <= 0) return x; } return l[l.length - 1]; };

const A = (icao, iata, city, cc, lat, lon) => ({ icao, iata, name: city, city, cc, lat, lon });
const AP = {
  YOW: A('CYOW', 'YOW', 'Ottawa', 'CA', 45.32, -75.67), YYZ: A('CYYZ', 'YYZ', 'Toronto', 'CA', 43.68, -79.63), YUL: A('CYUL', 'YUL', 'Montreal', 'CA', 45.47, -73.74),
  YVR: A('CYVR', 'YVR', 'Vancouver', 'CA', 49.19, -123.18), YYC: A('CYYC', 'YYC', 'Calgary', 'CA', 51.13, -114.01), YHZ: A('CYHZ', 'YHZ', 'Halifax', 'CA', 44.88, -63.51),
  LHR: A('EGLL', 'LHR', 'London', 'GB', 51.47, -0.45), FRA: A('EDDF', 'FRA', 'Frankfurt', 'DE', 50.03, 8.56), AMS: A('EHAM', 'AMS', 'Amsterdam', 'NL', 52.31, 4.76),
  EWR: A('KEWR', 'EWR', 'Newark', 'US', 40.69, -74.17), ORD: A('KORD', 'ORD', 'Chicago', 'US', 41.98, -87.9), DTW: A('KDTW', 'DTW', 'Detroit', 'US', 42.21, -83.35),
  JFK: A('KJFK', 'JFK', 'New York', 'US', 40.64, -73.78), CUN: A('MMUN', 'CUN', 'Cancun', 'MX', 21.04, -86.87), HKG: A('VHHH', 'HKG', 'Hong Kong', 'HK', 22.31, 113.91),
  LAX: A('KLAX', 'LAX', 'Los Angeles', 'US', 33.94, -118.41),
};
// A plane that passes: type, airline prefix (or none: private), route [from, to] or none, how it flies here
const T = (type, a3, r, fly, w, extra = {}) => ({ type, a3, r, fly, w, ...extra });
const BUSY = { name: 'Busy airport sky', where: 'about 10 km from a mid-size airport (Ottawa-like), November', obs: { lat: 45.4, lon: -75.6 }, open: [[7, 8], [12, 13], [17, 19]], perOpenHour: 5,
  traffic: (h) => (h < 6 ? 2 : h < 22 ? 18 : 6), planes: [
    T('A320', 'ACA', ['YOW', 'YYZ'], 'dep', 6), T('A320', 'ACA', ['YYZ', 'YOW'], 'arr', 6), T('B38M', 'WJA', ['YOW', 'YYC'], 'dep', 3), T('B38M', 'WJA', ['YVR', 'YOW'], 'arr', 2),
    T('E75L', 'JZA', ['YOW', 'YUL'], 'dep', 3), T('CRJ9', 'JZA', ['EWR', 'YOW'], 'arr', 3), T('DH8D', 'JZA', ['YHZ', 'YOW'], 'arr', 3), T('A21N', 'ACA', ['YOW', 'YVR'], 'dep', 2),
    T('A21N', 'POE', ['YOW', 'CUN'], 'dep', 1), T('E75L', 'UAL', ['ORD', 'YOW'], 'arr', 2), T('B789', 'ACA', ['YOW', 'LHR'], 'dep', 0.6), T('B77W', 'ACA', ['YYZ', 'YHZ'], 'cruise', 0.6),
    T('A333', 'DLH', ['FRA', 'ORD'], 'cruise', 0.5), T('B748', 'CLX', ['ORD', 'AMS'], 'cruise', 0.15), T('B738', 'WJA', ['YYZ', 'YHZ'], 'cruise', 2), T('A319', 'ACA', ['YUL', 'YYZ'], 'cruise', 2),
    T('C172', '', null, 'low', 2, { day: true }), T('P28A', '', null, 'low', 1, { day: true }), T('C25B', '', null, 'dep', 0.6), T('EC35', '', null, 'heli', 0.5, { day: true }),
    T('C130', '', null, 'cruiselow', 0.08, { mil: true }), T('B763', 'FDX', ['YOW', 'EWR'], 'dep', 0.4, { night: true }),
  ] };
const RURAL = { name: 'Quiet rural sky', where: 'under an airway, 1 to 4 planes an hour, mostly cruising, November', obs: { lat: 46.6, lon: -79.2 }, open: [[8, 9], [16, 18]], perOpenHour: 3,
  traffic: (h) => (h < 6 ? 1 : h < 22 ? 3 : 1), planes: [
    T('B738', 'WJA', ['YYZ', 'YVR'], 'cruise', 3), T('A320', 'ACA', ['YUL', 'YYC'], 'cruise', 3), T('B789', 'ACA', ['YYZ', 'HKG'], 'cruise', 1), T('B77W', 'ACA', ['YUL', 'YVR'], 'cruise', 1),
    T('A333', 'DAL', ['DTW', 'AMS'], 'cruise', 0.6), T('B38M', 'WJA', ['YHZ', 'YYC'], 'cruise', 1.5), T('A21N', 'ACA', ['YUL', 'LAX'], 'cruise', 1), T('E75L', 'JZA', ['YYZ', 'YUL'], 'cruiselow', 0.5),
    T('C172', '', null, 'low', 0.4, { day: true }), T('EC35', '', null, 'heli', 0.1, { day: true }),
  ] };

/* QA round 3 (2026-11-20): two more quiet skies, run for 74 days. QA's own feed had only six types at under 2 planes an hour
   (so "quiet hours", js/progress.js skyDeal quietNight); a realistic quiet sky is that rate with the mix a rural place
   gets: airliners cruising over, a regional or two, light planes by day, now and then a helicopter or a business jet. */
const QA6 = { name: 'QA’s six-type sky', where: 'six types only, about 1.5 planes an hour, all airliners', obs: { lat: 46.6, lon: -79.2 }, open: [[8, 9], [12, 13], [16, 18], [19, 21]], perOpenHour: 2,
  traffic: (h) => (h < 6 ? 0 : h < 22 ? 1 + (h % 2) * 0.5 : 0), planes: [
    T('B738', 'WJA', ['YYZ', 'YVR'], 'cruise', 3), T('A320', 'ACA', ['YUL', 'YYC'], 'cruise', 3), T('B38M', 'WJA', ['YHZ', 'YYC'], 'cruise', 1.5), T('A21N', 'ACA', ['YUL', 'LAX'], 'cruise', 1),
    T('B789', 'ACA', ['YYZ', 'HKG'], 'cruise', 1), T('E75L', 'JZA', ['YYZ', 'YUL'], 'cruiselow', 0.7),
  ] };
const QUIET2 = { name: 'Realistic quiet sky', where: 'rural, 1 to 3 planes an hour: airliners over, a regional, light planes by day, a rare helicopter', obs: { lat: 46.6, lon: -79.2 }, open: [[7, 8], [12, 13], [17, 18], [20, 21]], perOpenHour: 2,
  traffic: (h) => (h < 6 ? 0 : h < 9 ? 1.5 : h < 20 ? 2.5 : h < 22 ? 1 : 0), planes: [
    T('B738', 'WJA', ['YYZ', 'YVR'], 'cruise', 2.5), T('A320', 'ACA', ['YUL', 'YYC'], 'cruise', 2.5), T('B38M', 'WJA', ['YHZ', 'YYC'], 'cruise', 1.2), T('A21N', 'ACA', ['YUL', 'LAX'], 'cruise', 1),
    T('B789', 'ACA', ['YYZ', 'HKG'], 'cruise', 0.6), T('B77W', 'ACA', ['YUL', 'YVR'], 'cruise', 0.5), T('A333', 'DAL', ['DTW', 'AMS'], 'cruise', 0.3), T('A319', 'ACA', ['YUL', 'YYZ'], 'cruise', 0.6),
    T('E75L', 'JZA', ['YYZ', 'YUL'], 'cruiselow', 0.6), T('CRJ9', 'JZA', ['YYZ', 'YHZ'], 'cruiselow', 0.4), T('DH8D', 'JZA', ['YYZ', 'YOW'], 'cruiselow', 0.4),
    T('C172', '', null, 'low', 0.5, { day: true }), T('P28A', '', null, 'low', 0.3, { day: true }), T('EC35', '', null, 'heli', 0.08, { day: true }), T('C25B', '', null, 'cruise', 0.15),
  ] };

// The sun, November at 45° N: up from about 7:15 to 16:30
const sunEl = (h) => (h >= 7.2 && h <= 16.5 ? 26 * Math.sin(Math.PI * (h - 7.2) / 9.3) : -Math.min(50, 10 * Math.min(Math.abs(h - 16.5), Math.abs(h - 7.2), Math.abs(h + 24 - 16.5))));
const flagsOf = (pl, x) => { const f = [], st = planeSet(pl.type, pl.fly === 'heli').id, alt = x.altFt;
  if (st === 'helicopters') f.push('heli'); if (st === 'twinaisle' || st === 'giants') f.push('wide'); if (st === 'props' || st === 'light') f.push('prop'); if (alt >= 35000) f.push('high'); if (alt < 5000) f.push('low'); if (pl.a3) f.push('airline');
  if (st === 'giants') f.push('giant'); if (st === 'regional') f.push('regional'); if (st === 'bizjets') f.push('biz'); if (st === 'military' || pl.mil) f.push('mil'); if (K.isBoeing(pl.type)) f.push('boeing'); if (K.isAirbus(pl.type)) f.push('airbus');
  if (K.isOldType(pl.type)) f.push('oldtype'); if (K.isNewType(pl.type, simNow)) f.push('newtype'); if (alt < 15000 && x.climb >= 1000) f.push('up'); if (alt < 15000 && x.climb <= -1000) f.push('down'); if (x.maxEl > 70) f.push('overhead'); if (x.rose) f.push('rise');
  if (pl.a3) f.push(`al:${pl.a3}`); /* which airline and, below, which country it's going to (js/sky-today.js logSeen) */
  if (x.r) { const [a, b] = x.r.map((k) => AP[k]); f.push('routed', `to:${b.cc}`); const km = hav(a, b); if (a.cc !== b.cc) f.push('abroad'); if (K.continentOfAirport(a) !== K.continentOfAirport(b)) f.push('cont'); if (km > 3000) f.push('far'); if (km > 5000) f.push('ocean'); if (km < 500) f.push('short'); if (hav(SKY.obs, b) <= 30) f.push('landing'); }
  return f; };
const hav = (a, b) => { const R = Math.PI / 180, s = Math.sin((b.lat - a.lat) * R / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin((b.lon - a.lon) * R / 2) ** 2; return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s))); };
const pass = (pl, i) => { const fly = pl.fly, alt = fly === 'cruise' ? 35000 + Math.round(rnd() * 4) * 1000 : fly === 'cruiselow' ? 22000 + Math.round(rnd() * 8000) : fly === 'heli' ? 1200 : fly === 'low' ? 2500 + Math.round(rnd() * 2000) : 2000 + Math.round(rnd() * 9000);
  /* an airport's own flights go to many places: the far end varies, so new flight cards keep coming as at a real airport */
  const ends = ['YYZ', 'YUL', 'YVR', 'YYC', 'YHZ', 'EWR', 'ORD', 'DTW', 'JFK', 'CUN', 'LAX'], r = pl.r && (fly === 'dep' || fly === 'arr') && rnd() < 0.6 ? (fly === 'dep' ? [pl.r[0], ends[Math.floor(rnd() * ends.length)]] : [ends[Math.floor(rnd() * ends.length)], pl.r[1]]) : pl.r;
  return { pl, r: r && r[0] === r[1] ? pl.r : r, hex: `${(0xa00000 + i).toString(16)}`, altFt: alt, climb: fly === 'dep' ? 1500 + Math.round(rnd() * 1500) : fly === 'arr' ? -(800 + Math.round(rnd() * 900)) : 0, maxEl: Math.round(rnd() ** 2 * 88), az: Math.round(rnd() * 359), rose: rnd() < 0.5 }; };

let SKY = BUSY;
function runSky(sky, sd, days = 8) {
  SKY = sky; seed = sd; for (const k of Object.keys(store)) delete store[k]; store.units = 'metric'; L._resetLocal(null);
  const start = new Date(2026, 10, 23, 0, 0).getTime(), sightings = [], deals = {}, out = [], tiers = new Map(); let hexN = 0, dayCatch = 0;
  P.setSkySize('new');
  for (let d = 0; d < days; d++) {
    const day0 = start + d * 864e5, night = String(nightKey(day0 + 12 * 3600e3)); let dealt = null, caught = 0, flown = 0; const todays = [];
    for (let h = 0; h < 24; h++) {
      const open = sky.open.some(([a, b]) => h >= a && h < b), tr = sky.traffic(h), n = Number.isInteger(tr) ? tr + Math.round((rnd() - 0.5) * tr * 0.4) : Math.round(tr * (0.4 + rnd() * 1.2)); /* a fractional rate: anywhere from under half to well over it */
      const passes = []; for (let k = 0; k < n; k++) { let pl = pickW(sky.planes); let tries = 0; while (((pl.day && (h < 8 || h > 16)) || (pl.night && h > 6 && h < 22)) && tries++ < 5) pl = pickW(sky.planes); passes.push(pass(pl, hexN++)); }
      if (!open) continue;
      simNow = day0 + h * 3600e3 + 60e3; flown += passes.length;
      L.noteLocal(passes.map((x) => ({ type: x.pl.type, flags: flagsOf(x.pl, x) })), true, h);
      if (!dealt) { /* the deal, as main.js skyDealMissions makes it at the day's first open */
        const st = L.localStats(simNow), own = sightings, owned = own.length > 0; P.setSkySize(st.sky);
        { const ws = P.weekStartOf(simNow), ch = P.readWeekThemes(), id = P.chooseSkyWeek(ws, ch, st, { owned, dark: true, makers: 5 }); if (id) store.weekThemes = JSON.stringify({ ...ch, [ws]: id }); }
        const soon = Array.from({ length: Math.min(4, 24 - h) }, (_, i) => h + i), known = (st.soonOpen ?? 0) >= 2, planesAt = (x) => !known || (st.byHour?.[x] ?? 0) > 0;
        const dark = soon.some((x) => sunEl(x + 0.5) < -6 && planesAt(x)), golden = soon.some((x) => [0, 0.17, 0.33, 0.5, 0.67, 0.83].some((m) => { const e = sunEl(x + m); return e >= -1 && e <= 2; }) && planesAt(x));
        const can = P.skyPossible(st, { owned, hour: h, dark, golden, nearLevel: P.nearLevelUp(own, simNow), newAirline: d > 0 && d < 4 });
        const recent = []; for (let k = 1; k <= 7; k++) recent.push(deals[String(Number(night) - k)] ?? []);
        const deal = P.skyDeal(night, { possible: can, st, hz: st.soonSky, recent, quietNight: known && st.soonRate < 2, owned, nearLevel: can.has('cardlevel'), dark });
        deals[night] = deal ? [...deal.ids, `ch:${deal.challenge}`] : []; dealt = { deal, hz: st.soonSky, quiet: known && st.soonRate < 2, real: deal ? deal.ids.map((k) => P.tierOf(k.split(':')[0], st)) : [] };
      }
      const pick = passes.slice().sort(() => rnd() - 0.5).slice(0, sky.perOpenHour);
      const mins = pick.map(() => Math.floor(rnd() * 59) + 1).sort((p1, p2) => p1 - p2); /* each plane passes at its own minute; you catch it then */
      for (const [j, x] of pick.entries()) {
        const t = day0 + h * 3600e3 + mins[j] * 60e3;
        const pl = x.pl, p = { hex: x.hex, callsign: pl.a3 ? `${pl.a3}${100 + (sky.planes.indexOf(pl) * 7) % 900}` : '', type: pl.type, category: pl.fly === 'heli' ? 'A7' : 'A3', heli: pl.fly === 'heli', anon: !pl.a3, gov: !!pl.mil };
        const route = x.r ? { from: AP[x.r[0]], to: AP[x.r[1]], callsign: p.callsign } : null;
        const { flight, plane } = cardsFor(p, route, pl.a3 ? pl.a3 : '');
        const all = catchSightings({ time: t, hex: p.hex, callsign: p.callsign, type: pl.type, altFt: x.altFt, gsKt: 400, rangeKm: 8, airline: pl.a3, flight, plane });
        const el = Math.round(x.maxEl * (0.5 + rnd() * 0.5)), up = x.rose && rnd() < 0.5 ? Math.round(rnd() * 240) : null, sun = sunEl(h + mins[j] / 60);
        for (const s of all) { s.sunEl = sun; s.el = el; s.az = x.az; s.climb = x.climb; if (up != null) s.upFor = up; if (s.type === 'flight') s.nearTo = hav(sky.obs, route.to) <= 30; tiers.set(s.cardKey, s.cardSnapshot.tier); }
        if (sun >= -1 && sun <= 2) all[all.length - 1].shiny = 'golden';
        sightings.push(...all); caught++; todays.push(all);
      }
    }
    simNow = day0 + 23.5 * 3600e3;
    const pr = P.progress(sightings, (k) => ({ tier: tiers.get(k) }), { deals, now: simNow, keep: false });
    /* did one catch on its own finish two of the day's missions? (each catch scored alone, after one old catch so it isn't day one) */
    let two = null; if (d > 0 && dealt?.deal) for (const one of todays) { const p1 = P.progress([sightings[0], ...one], (k) => ({ tier: tiers.get(k) }), { deals: { [night]: deals[night] }, now: simNow, keep: false }); const dn = p1.missions.filter((m) => m.done); if (dn.length >= 2) { two = dn.map((m) => m.text); break; } }
    out.push({ d, night, ids: deals[night], dealt, missions: pr.missions, challenge: pr.challenge, caught, flown, week: pr.week, xp: pr.xp, two });
    dayCatch += caught;
  }
  return out;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'];
const lines = ['# Sky missions: a simulated week', '', 'Made by `node scripts/sim/missions.mjs --write` (seeded: the same every run). Planes pass by the hour; the app is open at set times; the player catches a few of what passes, at random (no mission hunting). Deals as main.js makes them, scored by js/progress.js.', '', '✓ done · ✗ not done · E / M / S easy, medium, stretch', ''];
let totals = [];
for (const [sky, sd] of [[BUSY, 11], [RURAL, 23]]) {
  const res = runSky(sky, sd); let done = 0, dealtN = 0, sDone = 0, sN = 0;
  lines.push(`## ${sky.name}`, '', `${sky.where}. App open ${sky.open.map(([a, b]) => `${a}:00 to ${b}:00`).join(', ')}.`, '');
  lines.push(`Week theme: ${res[0].week.name} (${res[0].week.text.replace(/\.$/, '')}). By Sunday: ${res[6].week.have} of ${res[6].week.need}.`, '');
  for (const r of res) {
    lines.push(`**Day ${r.d + 1} · ${DAYS[r.d]}** · ${r.caught} caught of ${r.flown} seen${r.d === 0 ? ' · first day' : ` · sky ${r.dealt?.hz ?? '?'}`}`);
    r.missions.forEach((m, i) => { const t = r.d === 0 ? '1st' : (r.dealt?.deal?.tiers?.[i] ?? '?')[0].toUpperCase(); lines.push(`- ${m.done ? '✓' : '✗'} ${t} · ${m.text}`); if (r.d) { dealtN++; if (m.done) done++; if (t === 'S') { sN++; if (m.done) sDone++; } } });
    if (r.challenge) lines.push(`- ${r.challenge.done ? '✓' : '✗'} bonus · ${r.challenge.text}`);
    lines.push('');
  }
  lines.push(`Days 2 to 8: ${done} of ${dealtN} missions done; stretch ${sDone} of ${sN}.`, '');
  { /* next week's theme here, from this week's flags (main.js skyChooseWeek) */ simNow = new Date(2026, 10, 30, 7, 0).getTime(); const ws = P.weekStartOf(simNow), st = L.localStats(simNow), wk = { ...P.readWeekThemes() }; delete wk[ws];
    const id = P.chooseSkyWeek(ws, wk, st, { owned: true, dark: true, makers: new Set([...st.byType.keys()].map(K.makerOf).filter(Boolean)).size }), rot = P.weekThemeFor(ws, {});
    lines.push(`Next week: ${P.weekThemeFor(ws, { [ws]: id }).name}${id.split(':')[0] !== rot.id ? ` (swapped: ${rot.name} can't be done here)` : ' (the rotation’s own)'}.`, ''); }
  totals.push(`${sky.name}: ${done}/${dealtN} done, stretch ${sDone}/${sN}`);
}
/* QA round 3: many days, several seeds. Repeats (yesterday's very set, or any one of yesterday's missions), the easy /
   medium / stretch mix, and how often one catch finished two of a day's missions. */
const base = (k) => String(k).split(':')[0];
lines.push('## Many days: repeats, the mix, and one catch finishing two', '', '74 days from 23 November, three seeds per sky (so 219 dealt days each). "Same as yesterday": all three missions repeated. "One repeated": at least one of yesterday’s back. "Quiet hours": dealt for coming hours under 2 planes an hour.', '',
  '| Sky | Deals | Same as yesterday | One repeated | Three days running | Easy / medium / stretch (each mission’s own tier here) | Has an easy | Different sets | Quiet hours | One catch did two |', '|---|---|---|---|---|---|---|---|---|---|');
const twoPairs = new Map();
for (const sky of [BUSY, RURAL, QUIET2, QA6]) {
  let n = 0, same = 0, one = 0, run3 = 0, easy = 0, quiet = 0, two = 0; const mix = { easy: 0, medium: 0, stretch: 0 }, sets = new Set();
  for (const sd of [23, 41, 77]) {
    const res = runSky(sky, sd, 75);
    if (process.env.SIM_DUMP === sky.name && sd === 23) for (const r of res) console.error(r.d, r.ids?.join(' '), r.dealt?.real?.join('/')); /* SIM_DUMP='<sky name>': each day's deal, to stderr */
    for (let i = 1; i < res.length; i++) {
      const r = res[i], ids = (r.ids ?? []).filter((x) => !String(x).startsWith('ch:')); if (!r.dealt?.deal) continue; n++;
      const prev = new Set(i > 1 ? (res[i - 1].ids ?? []).filter((x) => !String(x).startsWith('ch:')).map(base) : []), b = ids.map(base);
      if (i > 1 && b.every((x) => prev.has(x))) same++; if (i > 1 && b.some((x) => prev.has(x))) one++;
      if (i > 2) { const p2 = new Set((res[i - 2].ids ?? []).map(base)); if (b.some((x) => prev.has(x) && p2.has(x))) run3++; }
      for (const t of r.dealt.real) mix[t]++; if (r.dealt.real.includes('easy')) easy++; /* each mission's own tier here (js/progress.js tierOf), not the slot it was dealt in */ if (r.dealt.quiet) quiet++; sets.add(b.slice().sort().join('|'));
      if (r.two) { two++; const k = r.two.join(' + '); twoPairs.set(k, (twoPairs.get(k) ?? 0) + 1); }
    }
  }
  const pc = (x, of = n) => `${x} (${(100 * x / Math.max(1, of)).toFixed(1)}%)`;
  lines.push(`| ${sky.name} | ${n} | ${pc(same)} | ${pc(one)} | ${pc(run3)} | ${mix.easy} / ${mix.medium} / ${mix.stretch} | ${pc(easy)} | ${sets.size} | ${quiet} | ${pc(two)} |`);
}
lines.push('', 'Before QA round 3’s fixes (commit 7dfb74f0, the same runs): busy 0% same as yesterday, 14.4% one catch did two; quiet rural 5.4% same, 19.8% one repeated, 93% had an easy; realistic quiet 22.4% same, 56.6% one repeated, an easy on 14% of days, 30 different sets; QA’s six-type sky 49.5% same, 96.7% one repeated, an easy on 3% of days (mostly medium, medium, medium), 10 different sets.',
  '', 'Why the 8-day rural run above never showed it: it deals only 7 days, and at about 3 planes an hour its coming hours are never under 2 an hour, so the "quiet hours" rule (the easy one cut to "Collect a new card" or "Catch a plane you’ve caught before", which one catch could finish with any one-catch mission) never ran; and its ten types, mostly cruising high, kept other easy ones in the pool. QA’s sky had six types at under 2 an hour.',
  '', 'What’s left: in QA’s six-type sky every plane is an airliner cruising high on a long route, so every one-catch mission there is a partner of every other (the long-haul group, or "any plane"). Each day then needs two of the three two-plane missions (two plane families, a Boeing and an Airbus, two planes you’ve caught before), and two days running always share one. It never deals yesterday’s set, and a mission three days running only when nothing else fits. One catch doing two: a wide-body on a short hop (the simulation picks a random far end for an airport’s flights; real wide-bodies rarely fly under 500 km).');
lines.push('', twoPairs.size ? `One catch did two: ${[...twoPairs].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join('; ')}.` : 'One catch never did two.', '');
const md = lines.join('\n');
Date.now = realNow;
if (process.argv.includes('--write')) writeFileSync(new URL('../../design/missions-sim.md', import.meta.url), md + '\n');
console.log(md);
