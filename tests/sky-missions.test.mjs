// Sky's missions, round 2 (2026-11-20, design/missions-draft.md; Sevaan: "Build it with the 7 cuts", "Yes, scale down").
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const P = await import('../js/progress.js');
const K = await import('../js/sky-kinds.js');
const { cardsFor } = await import('../js/flights.js');
const { catchSightings } = await import('../js/sky-cards.js');
const { scrubSighting } = await import('../js/plane-privacy.js');
const { nightKey } = await import('../js/observation.js');
P.setSkyProgress(true);

const A = (icao, iata, cc, lat, lon) => ({ icao, iata, name: iata, city: iata, cc, lat, lon });
const AP = { YOW: A('CYOW', 'YOW', 'CA', 45.32, -75.67), YUL: A('CYUL', 'YUL', 'CA', 45.47, -73.74), YYZ: A('CYYZ', 'YYZ', 'CA', 43.68, -79.63), LHR: A('EGLL', 'LHR', 'GB', 51.47, -0.45),
  LAX: A('KLAX', 'LAX', 'US', 33.94, -118.41), HNL: A('PHNL', 'HNL', 'US', 21.32, -157.92), EWR: A('KEWR', 'EWR', 'US', 40.69, -74.17) };
let hexN = 0;
// One catch, saved as main.js capturePlane saves it: its flight and plane sightings at the same moment.
function catchOf({ t, type, cs = '', r = null, alt = 30000, heli = false, ...extra }) {
  const p = { hex: (0xb00000 + hexN++).toString(16), callsign: cs, type, category: heli ? 'A7' : 'A3', heli, anon: !cs };
  const route = r ? { from: AP[r[0]], to: AP[r[1]], callsign: cs } : null;
  const { flight, plane } = cardsFor(p, route, cs.slice(0, 3));
  const out = catchSightings({ time: t, hex: extra.hex ?? p.hex, callsign: cs, type, altFt: alt, gsKt: 400, rangeKm: 8, airline: cs.slice(0, 3), flight, plane });
  for (const s of out) Object.assign(s, extra);
  return out;
}
const info = () => ({ tier: 'common' });
const DAY = new Date(2026, 11, 2, 12, 0).getTime(); // a Wednesday in December (round 2 is on)
const at = (d, h = 12, m = 0) => DAY + d * 864e5 + (h - 12) * 3600e3 + m * 60e3;
const nk = (t) => String(nightKey(t));
// A busy airport's local log (js/sky-local.js localStats shape) with all the flags
const BUSY = { sky: 'busy', soonSky: 'busy', total: 900, hours: 40, days: 6, perHour: 22, soonOpen: 8, soonN: 160, soonRate: 20,
  flags7: { airline: 300, high: 80, low: 120, wide: 20, prop: 30, heli: 4, giant: 1, regional: 80, biz: 12, mil: 1, boeing: 90, airbus: 110, oldtype: 10, newtype: 60, up: 60, down: 60, overhead: 9, rise: 50, routed: 200, abroad: 40, cont: 8, far: 30, ocean: 6, short: 90, landing: 70 },
  flagsSoon: { airline: 120, high: 30, low: 50, wide: 4, prop: 14, heli: 2, giant: 0, regional: 40, biz: 5, mil: 1, boeing: 40, airbus: 50, oldtype: 5, newtype: 30, up: 30, down: 30, overhead: 4, rise: 20, routed: 90, abroad: 15, cont: 3, far: 12, ocean: 2, short: 40, landing: 30 },
  byHour: { 12: 20, 13: 20, 14: 20, 15: 20 } };
const QUIET = { sky: 'quiet', soonSky: 'quiet', total: 60, hours: 30, days: 6, perHour: 2.5, soonOpen: 6, soonN: 15, soonRate: 2.5,
  types7: new Map([['B738', 15], ['A320', 15], ['B789', 4], ['B77W', 3], ['A333', 3], ['B38M', 10], ['A21N', 10]]),
  flags7: { airline: 50, high: 45, wide: 10, boeing: 20, airbus: 20, routed: 30, abroad: 10, far: 25, ocean: 6, newtype: 8 }, flagsSoon: { airline: 12, high: 11, wide: 3, boeing: 5, airbus: 5, routed: 10, abroad: 3, far: 7, ocean: 2, newtype: 2 } };
const dealFor = (night, st, opts = {}) => { const can = P.skyPossible(st, { owned: true, hour: 12, dark: true, golden: true, nearLevel: true, newAirline: true, ...opts }); return { can, deal: P.skyDeal(night, { possible: can, st, hz: st.soonSky, owned: true, nearLevel: true, dark: true, ...opts }) }; };

test('the pool: 35 daily missions, 8 bonus challenges, 12 week themes, and the 7 extra cuts left out', () => {
  assert.equal(P.SKY_POOL.length, 35);
  for (const id of ['region', 'countries3', 'golden', 'jetprop', 'sameairline', 'newalbum', 'cargo', 'firstflight', 'island', 'fast', 'slow', 'light', 'twofour', 'leaving', 'newcountry', 'decades3']) assert.ok(!P.SKY_POOL.includes(id), id);
  assert.equal(P.SKY_CHALLENGES.length, 8);
  assert.equal(P.WEEK_THEMES.length, 12);
  assert.deepEqual(P.SKY_STARTER.map((m) => m.id), ['firstcard', 'types2', 'catches3']);
  for (const id of ['sky-shinyall', 'sky-trijet', 'sky-weeks12', 'silver', 'gold3', 'compass', 'oldtimer', 'decades']) assert.ok(P.activeAchievements().some((a) => a.id === id), id);
});

test('no single catch finishes two of the day’s missions: partner groups, and real catches of each kind', () => {
  // the draft's "one plane does them all" kinds, each as one catch on its own, with everything a catch can carry
  const kinds = [
    { type: 'B789', cs: 'ACA856', r: ['YYZ', 'LHR'], alt: 37000 }, { type: 'A21N', cs: 'ACA401', r: ['YOW', 'YYZ'], alt: 34000 },
    { type: 'E75L', cs: 'JZA8613', r: ['YUL', 'YOW'], alt: 3000, climb: -1200, nearTo: true }, { type: 'CRJ9', cs: 'JZA700', r: ['YOW', 'YUL'], alt: 6000, climb: 2000 },
    { type: 'C172', alt: 2500 }, { type: 'EC35', alt: 1200, heli: true }, { type: 'C130', alt: 3000 }, { type: 'C25B', alt: 41000 }, { type: 'B748', cs: 'CLX793', r: ['LAX', 'LHR'], alt: 36000 },
  ];
  let checked = 0;
  for (const [st, n0] of [[BUSY, 21000], [QUIET, 22000]]) for (let night = n0; night < n0 + 120; night++) {
    const { deal } = dealFor(String(night), st); assert.ok(deal, `${night}`);
    const opts = deal.ids.map((k) => ({ base: k.split(':')[0], k: Number(k.split(':')[1] ?? 1) }));
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.equal(P.partners(opts[i], opts[j]), false, `${night}: ${deal.ids}`);
    if (night % 10) continue;
    // score each kind as the day's only catch (an old card from last week, so it isn't day one)
    const t = Number(nk(DAY)) === night ? DAY : DAY; void t;
    for (const kd of kinds) {
      const old = catchOf({ t: at(-6), type: 'DC3' }), today = catchOf({ t: at(0, 18), sunEl: -20, el: 80, az: 10, upFor: 30, ...kd });
      const deals = { [nk(at(0))]: deal.ids };
      const pr = P.progress([...old, ...today], info, { deals, now: at(0, 19), keep: false });
      assert.ok(pr.missions.filter((m) => m.done).length <= 1, `${night} ${kd.type}: ${pr.missions.filter((m) => m.done).map((m) => m.text)}`); checked++;
    }
  }
  assert.ok(checked > 100);
});

test('dealt missions fit the hour and the last 7 days', () => {
  for (let night = 23000; night < 23200; night++) { const { can, deal } = dealFor(String(night), BUSY); for (const k of deal.ids) assert.ok(can.has(k.split(':')[0]), k); }
  const noHeliNow = { ...BUSY, flagsSoon: { ...BUSY.flagsSoon, heli: 0, mil: 0, overhead: 0, rise: 0 } };
  const can = P.skyPossible(noHeliNow, { owned: true, hour: 13 });
  for (const id of ['heli', 'military', 'overhead', 'quick', 'dark', 'shiny', 'cardlevel', 'newairline']) assert.equal(can.has(id), false, id);
  // military: only from what flew at these hours, never the week's tally
  assert.equal(P.skyPossible({ ...BUSY, soonOpen: 0 }, { hour: 13 }).has('military'), false);
  assert.ok(P.skyPossible(BUSY, { hour: 13 }).has('military'));
  // days 2 and 3 (no local log yet): only what any sky gives
  assert.deepEqual([...P.skyPossible({ sky: 'new', perHour: 5 }, { owned: true })].sort(), ['again', 'airlines3', 'boeingairbus', 'families2', 'high', 'newflights2', 'three10']);
});

test('after day one: one easy, one medium, one stretch', () => {
  for (let night = 24000; night < 24200; night++) {
    const { deal } = dealFor(String(night), BUSY);
    assert.deepEqual(deal.tiers, ['easy', 'medium', 'stretch']);
    const [e, m, s] = deal.ids.map((k) => P.tierOf(k.split(':')[0], BUSY));
    assert.equal(e, 'easy', deal.ids); assert.equal(m, 'medium', deal.ids); assert.equal(s, 'stretch', deal.ids);
  }
  const { deal } = dealFor('24500', { sky: 'new', soonSky: 'new', perHour: 5 }); // day 2 at a new place
  assert.deepEqual(deal.ids.map((k) => P.tierOf(k.split(':')[0])), ['easy', 'medium', 'stretch']);
});

test('a stretch eases in a quiet sky: two in 10 minutes instead of three (five at a busy one)', () => {
  const sized = (hz) => { for (let n = 25000; n < 25400; n++) { const st = { ...QUIET, soonSky: hz, soonRate: 9 }; const d = P.skyDeal(String(n), { possible: new Set(['three10', 'high', 'families2']), st, hz }); const k = d?.ids.find((x) => x.startsWith('three10')); if (k) return k; } return null; };
  assert.equal(sized('quiet'), 'three10:2'); assert.equal(sized('steady'), 'three10:3'); assert.equal(sized('busy'), 'three10:5');
  const deals = { [nk(at(0))]: ['high', 'families2:2', 'three10:2'] };
  const two = [...catchOf({ t: at(0, 12), type: 'A320', cs: 'ACA1' }), ...catchOf({ t: at(0, 12, 8), type: 'B738', cs: 'WJA2' })];
  const pr = P.progress([...catchOf({ t: at(-3), type: 'DC3' }), ...two], info, { deals, now: at(0, 13), keep: false });
  assert.equal(pr.missions[2].text, 'Catch two planes in 10 minutes'); assert.equal(pr.missions[2].done, true);
});

test('no repeats: not yesterday’s missions, unless the pool is too small', () => {
  const night = 26000, y = dealFor(String(night - 1), BUSY).deal.ids;
  const d = P.skyDeal(String(night), { possible: dealFor('1', BUSY).can, st: BUSY, hz: 'busy', recent: [y], owned: true });
  for (const k of d.ids) assert.ok(!y.map((x) => x.split(':')[0]).includes(k.split(':')[0]), `${k} was dealt yesterday`);
});

test('the week’s theme: one this sky can’t give is swapped, from the same 7-day flags', () => {
  const L = P.WEEK_THEMES.map((t) => t.id);
  let ws = new Date(2026, 10, 23).getTime(); while (P.weekThemeFor(ws, {}).id !== 'sky-heavy') ws += 7 * 864e5;
  const noWide = { ...QUIET, flags7: { ...QUIET.flags7, wide: 0 }, types7: new Map([...QUIET.types7].filter(([t]) => !/^(B78|B77|A33)/.test(t))) };
  const id = P.chooseSkyWeek(ws, {}, noWide, { owned: true, dark: true, makers: 5 });
  assert.equal(id, 'sky-longhaul'); /* Propeller week, next in the rotation, can't be given here either (no propellers) */
  assert.equal(P.chooseSkyWeek(ws, {}, QUIET, { owned: true, dark: true, makers: 5 }), 'sky-heavy');
  assert.equal(P.chooseSkyWeek(ws, { [ws]: 'sky-props' }, noWide, {}), null); // kept for the week once chosen
  // New cards week sized to the sky
  let wn = ws; while (P.weekThemeFor(wn, {}).id !== 'sky-newcards') wn += 7 * 864e5;
  const q = P.chooseSkyWeek(wn, {}, QUIET, { owned: true }); assert.equal(q, 'sky-newcards:4');
  assert.equal(P.weekThemeFor(wn, { [wn]: q }).need, 4); assert.equal(P.weekThemeFor(wn, { [wn]: q }).text, 'Collect four new cards.');
  // a week before round 2 keeps the old eight-theme rotation
  const old = new Date(2026, 10, 16).getTime(); assert.ok(L.slice(0, 8).includes(P.weekThemeFor(old, {}).id));
});

test('levels are per card: a flight on its 5th day, a plane type’s 10th aircraft (not all cards together)', () => {
  const ACA = (d) => catchOf({ t: at(d), type: 'A320', cs: 'ACA401', r: ['YOW', 'YYZ'] });
  const flights = [0, 1, 2, 3].flatMap((d) => ACA(d - 10));
  let pr = P.progress(flights, info, { now: at(-6), keep: false }); assert.equal(pr.achievements.find((a) => a.id === 'silver').done, false);
  // five different flights on five days: no card is silver
  const many = [0, 1, 2, 3, 4].flatMap((d) => catchOf({ t: at(d - 10), type: `B7${3 + d}8`, cs: `${['WJA', 'ACA', 'POE', 'JZA', 'TSC'][d]}1`, r: ['YOW', 'YUL'] }));
  pr = P.progress(many, info, { now: at(-4), keep: false }); assert.equal(pr.achievements.find((a) => a.id === 'silver').done, false);
  const fifth = ACA(0), all = [...flights, ...fifth], deals = { [nk(at(0))]: ['high', 'families2:2', 'cardlevel'] };
  pr = P.progress(all, info, { deals, now: at(0, 13), keep: false });
  assert.equal(pr.missions[2].done, true); assert.equal(pr.achievements.find((a) => a.id === 'silver').done, true); assert.equal(pr.achievements.find((a) => a.id === 'gold').done, false);
  // ten different aircraft of one type: the plane card turns silver on the 10th
  const ten = Array.from({ length: 10 }, (_, i) => catchOf({ t: at(-20 + i), type: 'C172' }));
  pr = P.progress(ten.slice(0, 9).flat(), info, { now: at(-11), keep: false }); assert.equal(pr.achievements.find((a) => a.id === 'silver').done, false);
  pr = P.progress(ten.flat(), info, { now: at(-10, 13), keep: false }); assert.equal(pr.achievements.find((a) => a.id === 'silver').done, true);
});

test('catches, not sightings: one tap is one (Hundred Sightings, two in 10 minutes, Marathon)', () => {
  const one = catchOf({ t: at(0), type: 'A320', cs: 'ACA1', r: ['YOW', 'YYZ'] });
  assert.equal(one.length, 2); assert.equal(P.catchesOf(one).length, 1);
  const pair10 = P.SKY_CHALLENGES.find((c) => c.id === 'pair10');
  assert.equal(pair10.done(one), false); // the old rule passed with one catch (two sightings at the same moment)
  assert.equal(pair10.done([...one, ...catchOf({ t: at(0, 12, 5), type: 'B738', cs: 'WJA1' })]), true);
  const fifty = Array.from({ length: 50 }, (_, i) => catchOf({ t: at(-60 + i), type: 'A320', cs: `ACA${i}`, r: ['YOW', 'YYZ'] })).flat();
  assert.equal(fifty.length, 100);
  const h = (l) => P.progress(l, info, { now: at(0), keep: false }).achievements.find((a) => a.id === 'sightings100');
  assert.equal(h(fifty).done, false); assert.deepEqual(h(fifty).prog, [50, 100]); assert.equal(h(fifty).text, 'Catch 100 planes');
  const more = Array.from({ length: 50 }, (_, i) => catchOf({ t: at(-60 + i, 13), type: 'B738', cs: `WJA${i}` })).flat();
  assert.equal(h([...fifty, ...more]).done, true);
});

test('continents by country code, Hawaii’s airports in Oceania', () => {
  for (const c of ['HNL', 'OGG', 'KOA', 'LIH', 'ITO']) assert.equal(K.continentOfAirport({ iata: c, cc: 'US' }), 'OC', c);
  assert.equal(K.continentOfAirport({ icao: 'PHNL', cc: 'US' }), 'OC');
  assert.equal(K.continentOfAirport(AP.LAX), 'NA'); assert.equal(K.continentOfAirport(AP.LHR), 'EU');
  const cont = P.SKY_MISSIONS.find((m) => m.id === 'continent');
  assert.equal(cont.done(catchOf({ t: at(0), type: 'A21N', cs: 'AAL31', r: ['LAX', 'HNL'] })), true);
  assert.equal(cont.done(catchOf({ t: at(0), type: 'A21N', cs: 'AAL32', r: ['EWR', 'LAX'] })), false);
});

test('missions that need what a catch didn’t save are never judged on it, and never dealt without it', () => {
  const plain = catchOf({ t: at(0), type: 'A320', cs: 'ACA1', r: ['YOW', 'YYZ'], alt: 3000 }); // a catch from before 2026-11-20
  for (const id of ['overhead', 'up', 'down', 'quick', 'landing']) assert.equal(P.SKY_MISSIONS.find((m) => m.id === id).done(plain), false, id);
  assert.equal(P.SKY_CHALLENGES.find((c) => c.id === 'compass').done([...plain, ...catchOf({ t: at(0, 13), type: 'B738', cs: 'WJA1' })]), false);
  const saved = catchOf({ t: at(0), type: 'A320', cs: 'ACA2', r: ['YYZ', 'YOW'], alt: 3000, el: 75, climb: -1100, upFor: 40, nearTo: true });
  for (const id of ['overhead', 'down', 'quick', 'landing']) assert.equal(P.SKY_MISSIONS.find((m) => m.id === id).done(saved), true, id);
  assert.equal(P.SKY_MISSIONS.find((m) => m.id === 'up').done(saved), false);
  const noFields = { ...BUSY, flagsSoon: { ...BUSY.flagsSoon, overhead: 0, up: 0, down: 0, rise: 0, landing: 0 } };
  const can = P.skyPossible(noFields, { owned: true, hour: 12 });
  for (const id of ['overhead', 'up', 'down', 'quick', 'landing']) assert.equal(can.has(id), false, id);
  // the new fields are anonymous flight data: a private catch keeps them, and still loses who it was
  const priv = scrubSighting({ ...catchOf({ t: at(0), type: 'C172', cs: 'N123AB', el: 50, az: 90, climb: 500 })[0] });
  assert.equal(priv.callsign, ''); assert.equal(priv.el, 50); assert.equal(priv.az, 90);
});

test('a sample of mission checks: every fact true, never a guessed year', () => {
  const M = (id) => P.SKY_MISSIONS.find((m) => m.id === id);
  // first flew: the model's own year; no year, no count; "last 10 years" rolls each January
  assert.equal(M('oldtype').done(catchOf({ t: at(0), type: 'C172' })), true);
  assert.equal(M('oldtype').done(catchOf({ t: at(0), type: 'B738', cs: 'WJA1' })), false);
  assert.equal(M('oldtype').done(catchOf({ t: at(0), type: 'B732', cs: 'XXX1' })), false); // no verified year: never guessed
  assert.equal(K.firstFlew('ZZZZ'), null);
  assert.equal(K.isNewType('A21N', new Date(2026, 5, 1).getTime()), true); assert.equal(K.isNewType('A21N', new Date(2027, 0, 2).getTime()), false);
  assert.equal(K.isNewType('B39M', new Date(2027, 0, 2).getTime()), true);
  // route missions never read a private or military catch
  const hidden = catchOf({ t: at(0), type: 'C25B', cs: 'N55XY' }).map((s) => ({ ...s, cardSnapshot: { ...s.cardSnapshot, sky: 'flight', from: AP.YOW, to: AP.LHR, km: 5400 } }));
  for (const id of ['abroad', 'continent', 'far', 'ocean']) assert.equal(M(id).done(hidden), false, id);
  // military by type only, whatever its callsign
  assert.equal(M('military').done(catchOf({ t: at(0), type: 'C17' })), true);
  assert.equal(M('military').done(catchOf({ t: at(0), type: 'B738', cs: 'RCH123' })), false);
  assert.equal(M('boeingairbus').done(catchOf({ t: at(0), type: 'B38M', cs: 'WJA1' })), false);
  assert.equal(M('boeingairbus').done([...catchOf({ t: at(0), type: 'B38M', cs: 'WJA1' }), ...catchOf({ t: at(0, 13), type: 'BCS3', cs: 'ACA9' })]), true);
  assert.equal(M('boeingairbus').done([...catchOf({ t: at(0), type: 'B38M', cs: 'WJA1' }), ...catchOf({ t: at(0, 13), type: 'A400' })]), false);
  assert.equal(K.engines('MD11'), 3); assert.equal(K.engines('C172'), 1); assert.equal(K.engines('B744'), 4); assert.equal(K.engines('ZZZZ'), null);
  assert.equal(K.makerOf('C130'), 'Lockheed'); assert.equal(K.makerOf('C172'), 'Cessna'); assert.equal(K.makerOf('TBM9'), null); /* changed hands: left out */
  // history flags: a new airline, new colours on a type you own
  const hist = [...catchOf({ t: at(-2), type: 'A320', cs: 'ACA1' }), ...catchOf({ t: at(0), type: 'A320', cs: 'WJA5' })], deals = { [nk(at(0))]: ['newairline', 'livery:1', 'three10:2'] };
  const pr = P.progress(hist, info, { deals, now: at(0, 13), keep: false });
  assert.deepEqual(pr.missions.map((m) => m.done), [true, true, false]);
});

test('existing saved progress loads: old deals, an old first day, patches already earned', () => {
  const old = [...catchOf({ t: new Date(2026, 10, 18, 9).getTime(), type: 'A320', cs: 'ACA1', r: ['YOW', 'YYZ'] }), ...catchOf({ t: new Date(2026, 10, 19, 9).getTime(), type: 'B77W', cs: 'ACA2', r: ['YYZ', 'LHR'] })];
  const d19 = nk(new Date(2026, 10, 19, 9).getTime()), deals = { [d19]: ['wide', 'high', 'again'] };
  let pr = P.progress(old, info, { deals, now: new Date(2026, 10, 19, 10).getTime(), keep: false });
  assert.deepEqual(pr.missions.map((m) => m.id), ['wide', 'high', 'again']); assert.equal(pr.missions[0].done, true);
  // a first day before round 2 keeps its three (with "a plane on its way somewhere")
  pr = P.progress(old.slice(0, 2), info, { now: new Date(2026, 10, 18, 10).getTime(), keep: false });
  assert.deepEqual(pr.missions.map((m) => m.id), ['firstcard', 'firstflight', 'types2']);
  // a patch earned under the old rule stays earned
  store.set('patchDates', JSON.stringify({ sightings100: 1700000000000 }));
  pr = P.progress(old, info, { now: new Date(2026, 10, 19, 10).getTime() });
  assert.equal(pr.achievements.find((a) => a.id === 'sightings100').done, true);
  store.delete('patchDates');
});

test('day one: one step per catch', () => {
  const first = catchOf({ t: at(0, 9), type: 'A320', cs: 'ACA1', r: ['YOW', 'YYZ'] });
  let pr = P.progress(first, info, { now: at(0, 10), keep: false });
  assert.deepEqual(pr.missions.map((m) => m.id), ['firstcard', 'types2', 'catches3']);
  assert.equal(pr.missions.filter((m) => m.done).length, 1);
  pr = P.progress([...first, ...catchOf({ t: at(0, 9, 10), type: 'E75L', cs: 'JZA1' })], info, { now: at(0, 10), keep: false });
  assert.equal(pr.missions.filter((m) => m.done).length, 2);
});
