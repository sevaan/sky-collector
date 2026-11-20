// QA round 3 on Sky's missions (2026-11-20): a quiet sky's easy one and no-repeat, week themes checked against their own
// need, the hour rule before the log knows the hours, a patch that drew blank, and one catch finishing two.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const P = await import('../js/progress.js');
const L = await import('../js/sky-local.js');
const { patchIcon, addSecretArt } = await import('../js/patches.js');
const { SKY_PATCH_ART } = await import('../js/sky-patches.js');
const { registerSkySecrets } = await import('../js/sky-secrets.js');
P.setSkyProgress(true);

// QA's feed: six airliner types cruising over, about 1.5 an hour (js/sky-local.js localStats shape, a week in)
const QA6 = { sky: 'quiet', soonSky: 'quiet', total: 70, hours: 40, days: 7, perHour: 1.5, soonOpen: 7, soonN: 7, soonRate: 1,
  types7: new Map([['B738', 20], ['A320', 20], ['B38M', 9], ['A21N', 7], ['B789', 6], ['E75L', 4]]),
  flags7: { airline: 66, high: 58, wide: 6, boeing: 35, airbus: 27, routed: 66, abroad: 7, cont: 6, far: 50, ocean: 6, newtype: 16, overhead: 3, rise: 9 },
  flagsSoon: { airline: 7, high: 6, boeing: 4, airbus: 3, routed: 7, far: 5, newtype: 2 }, byHour: { 8: 7, 12: 7, 16: 8 } };
// a realistic quiet place: the same rate, with a regional, a turboprop, light planes by day and the odd business jet
const QUIET2 = { ...QA6, perHour: 1.8, soonRate: 1.5, soonN: 9,
  types7: new Map([['B738', 15], ['A320', 15], ['B38M', 6], ['A21N', 5], ['B789', 3], ['B77W', 3], ['A333', 2], ['E75L', 4], ['CRJ9', 3], ['DH8D', 3], ['C172', 4], ['P28A', 2], ['C25B', 1]]),
  flags7: { ...QA6.flags7, regional: 7, prop: 9, low: 7, biz: 1, short: 6, oldtype: 2 }, flagsSoon: { ...QA6.flagsSoon, regional: 1, prop: 1, low: 1 } };
const base = (k) => String(k).split(':')[0];
const mission = (k) => base(k);
function run(st, days = 74, n0 = 30000) {
  const deals = [];
  for (let d = 0; d < days; d++) {
    const night = String(n0 + d), can = P.skyPossible(st, { owned: true, hour: 8, nearLevel: d % 9 === 0 });
    const recent = []; for (let k = 1; k <= 7; k++) recent.push(deals[d - k] ?? []);
    const deal = P.skyDeal(night, { possible: can, st, hz: st.soonSky, recent, quietNight: st.soonRate < 2, owned: true, nearLevel: can.has('cardlevel') });
    assert.ok(deal, night); deals.push(deal.ids.filter((x) => !x.startsWith('ch:')));
  }
  return deals;
}

for (const [name, st, minSets] of [['QA’s six-type feed', QA6, 6], ['a realistic quiet feed', QUIET2, 15]]) {
  test(`a quiet sky (${name}): a genuinely easy one every day, never yesterday's set, nothing three days running`, () => {
    const deals = run(st); const sets = new Set();
    deals.forEach((ids, d) => {
      const e = ids[0], b = base(e);
      const easy = (['again', 'newflights2', 'airlines3'].includes(b) && Number(e.split(':')[1] ?? 1) <= 2) || (P.shareOf(b, st) ?? P.weekShare(b, st) ?? 0) >= 0.5;
      assert.ok(easy, `day ${d}: ${ids}`);
      sets.add(ids.map(mission).sort().join('|'));
      if (d) assert.notEqual(ids.map(mission).sort().join('|'), deals[d - 1].map(mission).sort().join('|'), `day ${d} repeats yesterday: ${ids}`);
      if (d > 1) for (const k of ids) assert.ok(!(deals[d - 1].some((x) => base(x) === base(k)) && deals[d - 2].some((x) => base(x) === base(k))), `day ${d}: ${k} three days running`);
    });
    /* QA: every day "two plane families" and "a Boeing and an Airbus" */
    const both = deals.filter((ids) => ids.some((k) => base(k) === 'families2') && ids.some((k) => base(k) === 'boeingairbus')).length;
    assert.ok(both < deals.length / 2, `${both} of ${deals.length} days dealt both`);
    assert.ok(sets.size >= minSets, `${sets.size} different sets`); /* QA6 can only make about ten that one catch can't double up */
  });
}

test('the one-catch "any plane" easy one no longer blocks every one-catch mission: its two-catch size pairs with them', () => {
  assert.equal(P.partners({ base: 'newflights2', k: 1 }, { base: 'far', k: 1 }), true);
  assert.equal(P.partners({ base: 'again', k: 2 }, { base: 'far', k: 1 }), false);
  const deals = run(QA6, 30); assert.ok(deals.some((ids) => ids[0] === 'again:2' && ids.some((k) => P.catchesNeeded(base(k)) === 1 && base(k) !== 'again')), 'again:2 beside a one-catch mission');
});

test('no repeats: yesterday’s missions stay out whenever another set fits', () => {
  const can = P.skyPossible(QA6, { owned: true, hour: 8 }), y = ['newflights2:1', 'families2:2', 'boeingairbus'];
  for (let n = 31000; n < 31060; n++) {
    const d = P.skyDeal(String(n), { possible: can, st: QA6, hz: 'quiet', recent: [y], quietNight: true, owned: true });
    assert.ok(d.ids.filter((k) => !k.startsWith('ch:') && y.map(base).includes(base(k))).length <= 1, `${n}: ${d.ids}`);
  }
});

test('week themes are checked against their own need: how many, and how different', () => {
  const st = (o) => ({ sky: 'quiet', soonSky: 'quiet', total: 80, hours: 30, flags7: { airline: 40, routed: 30 }, types7: new Map([['A320', 30]]), ...o });
  assert.equal(P.skyWeekPossible('sky-props', st({ flags7: { prop: 1 } })), false, 'one propeller plane is not three');
  assert.equal(P.skyWeekPossible('sky-props', st({ flags7: { prop: 3 } })), true);
  assert.equal(P.skyWeekPossible('sky-heavy', st({ types7: new Map([['B789', 2], ['A320', 30]]) })), false, 'two of one wide-body type');
  assert.equal(P.skyWeekPossible('sky-heavy', st({ types7: new Map([['B789', 2], ['B77W', 1]]) })), false, 'two different types');
  assert.equal(P.skyWeekPossible('sky-heavy', st({ types7: new Map([['B789', 2], ['B77W', 1], ['A333', 1]]) })), true);
  assert.equal(P.skyWeekPossible('sky-airlines', st({ airlines7: 4 })), false); assert.equal(P.skyWeekPossible('sky-airlines', st({ airlines7: 5 })), true);
  assert.equal(P.skyWeekPossible('sky-passport', st({ countries7: 3 })), false); assert.equal(P.skyWeekPossible('sky-passport', st({ countries7: 4 })), true);
  assert.equal(P.skyWeekPossible('sky-longhaul', st({ flags7: { routed: 30, ocean: 2 } })), false); assert.equal(P.skyWeekPossible('sky-longhaul', st({ flags7: { routed: 30, ocean: 3 } })), true);
  assert.equal(P.skyWeekPossible('sky-families', st({ types7: new Map([['A320', 9], ['B738', 9], ['B789', 1]]) })), false);
  /* the rotation's Propeller week after one propeller plane: swapped */
  let ws = new Date(2026, 10, 23).getTime(); while (P.weekThemeFor(ws, {}).id !== 'sky-props') ws += 7 * 864e5;
  assert.notEqual(P.chooseSkyWeek(ws, {}, st({ flags7: { airline: 40, prop: 1 } }), { owned: true }), 'sky-props');
});

test('the local log keeps which airlines and countries flew over (by the day, not the hour) and the week’s types', () => {
  store.clear(); L._resetLocal(null);
  L.noteLocal([{ type: 'A320', flags: ['airline', 'al:ACA'] }, { type: 'B738', flags: ['airline', 'al:WJA'] }, { type: 'A320', flags: ['airline', 'al:ACA'] }], true, 14, [{ flags: ['routed', 'to:US'] }, { flags: ['routed', 'to:GB'] }]);
  const st = L.localStats();
  assert.equal(st.airlines7, 2); assert.equal(st.countries7, 2); assert.equal(st.types7.get('A320'), 2);
  const fh = Object.values(JSON.parse(localStorage.getItem('skyLocal') ?? '{"d":{}}').d)[0]?.fh ?? {};
  assert.ok(!Object.values(fh).some((h) => Object.keys(h).some((k) => k.includes(':'))), 'never by the hour');
});

test('before the log knows the hours: no propellers, low planes or helicopters from 6 PM, unless seen then; two in 10 minutes only at 3 an hour', () => {
  const st = { sky: 'quiet', soonSky: 'quiet', total: 40, hours: 6, days: 2, perHour: 2.5, soonOpen: 1, soonRate: 2.5, flags7: { airline: 30, prop: 4, low: 5, heli: 1, high: 20 }, flagsSoon: {} };
  for (const h of [18, 19, 21, 23, 3]) { const can = P.skyPossible(st, { owned: true, hour: h }); for (const id of ['prop', 'low', 'heli', 'bands']) assert.equal(can.has(id), false, `${id} at ${h}:00`); }
  for (const id of ['prop', 'low', 'heli']) assert.ok(P.skyPossible(st, { owned: true, hour: 13 }).has(id), `${id} at 1 PM`);
  assert.ok(P.skyPossible({ ...st, flagsSoon: { prop: 1 } }, { owned: true, hour: 19 }).has('prop'), 'a propeller plane seen at these hours');
  assert.equal(P.skyPossible(st, { owned: true, hour: 13 }).has('three10'), false, '2.5 an hour');
  assert.equal(P.skyPossible({ sky: 'new', perHour: 2.5 }, { owned: true }).has('three10'), false, 'day 2 at 2.5 an hour');
  assert.ok(P.skyPossible({ sky: 'new', perHour: 4 }, { owned: true }).has('three10'));
  for (let n = 32000; n < 32100; n++) { const can = P.skyPossible({ sky: 'new', perHour: 2.5 }, { owned: true }); assert.notEqual(P.skyDeal(String(n), { possible: can, st: { sky: 'new', soonSky: 'new', perHour: 2.5 }, hz: 'new', owned: true }).challenge, 'pair10', `${n}`); }
});

test('one catch can’t do two: a long flight climbing out, a turboprop on a short hop, a regional jet abroad, a business jet low', () => {
  for (const [a, b] of [['ocean', 'up'], ['far', 'up'], ['far', 'landing'], ['continent', 'down'], ['far', 'low'], ['wide', 'low'], ['prop', 'short'], ['prop', 'landing'], ['regional', 'abroad'], ['newtype', 'down'], ['newtype', 'landing'], ['biz', 'low'], ['biz', 'up']])
    assert.equal(P.partners({ base: a, k: 1 }, { base: b, k: 1 }), true, `${a} + ${b}`);
});

test('every patch on Sky’s wall draws a picture (Cleared for Takeoff was blank)', () => {
  const S = {}; registerSkySecrets(S, addSecretArt, SKY_PATCH_ART);
  const pr = P.progress([{ cardKey: 'P:A320', objectId: 'x', typeCode: 'A320', time: Date.now() - 1e6, cardSnapshot: { sky: 'plane' } }], () => ({ tier: 'common' }), { keep: false, albums: [{ id: 'airliners', name: 'Airliners', keys: [], goal: 10 }] });
  const drawn = (svg) => /<(path|circle|rect|polygon|polyline|ellipse|image|line|use)\b/.test(svg) || /<text[^>]*>\s*[^<\s][^<]*<\/text>/.test(svg);
  const all = [...pr.achievements, ...Object.values(S), { id: 'ambassador', name: 'Ambassador', icon: '' }];
  assert.ok(all.length > 120, `${all.length}`);
  for (const a of all) assert.ok(drawn(patchIcon(a)), `${a.id} (${a.name}) draws nothing`);
});
