// The two-card pack opening (js/pack-reveal.js, on for everyone since 2026-11-21): the timing table and the switch's default.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PACK_VARIANTS, PACK_FLIP, PACK_SHORT_AFTER, packChoice, packPlan, packFoil, packSetting } from '../js/pack-reveal.js';

test('the switch is off unless a variant is picked', () => {
  for (const raw of [null, undefined, '', 'off', 'b', 'D', 'toString', 'constructor', 0, 1]) assert.equal(packChoice(raw), '');
  for (const v of ['A', 'B', 'C']) assert.equal(packChoice(v), v);
  assert.equal(packPlan(''), null); assert.equal(packPlan('off'), null); assert.equal(packPlan(null), null);
  assert.equal(packSetting(), 'B'); // no localStorage here: on for everyone, B (2026-11-21)
  for (const on of ['on', '1', true]) assert.equal(packChoice(on), 'B'); // turned on without a variant: B
});

test('each variant reaches the first face when planned: A 1.8 s, B 2.1 s, C 2.6 s (within 0.1 s)', () => {
  const want = { A: 1800, B: 2100, C: 2600 };
  for (const [v, ms] of Object.entries(want)) { const p = packPlan(v, 0); assert.ok(Math.abs(p.face - ms) <= 100, `${v}: ${p.face}`); assert.equal(p.short, false); }
  const B = packPlan('B', 0); // the beats of the plan
  assert.deepEqual([B.tearAt, B.riseAt, B.settleAt, B.flipAt, B.face], [300, 650, 1200, 1600, 1600 + PACK_FLIP]);
  assert.ok(packPlan('C').tear > packPlan('B').tear && packPlan('B').tear > packPlan('A').tear); // C has the longer tear
  for (const v of Object.keys(PACK_VARIANTS)) { const p = packPlan(v); assert.ok(p.tearAt < p.riseAt && p.riseAt < p.settleAt && p.settleAt < p.flipAt && p.flipAt < p.face); }
});

test('after five packs, the short cut drops the settle beat (B about 1.6 s)', () => {
  assert.equal(packPlan('B', PACK_SHORT_AFTER - 1).short, false);
  const s = packPlan('B', PACK_SHORT_AFTER); assert.equal(s.short, true); assert.equal(s.settle, 0); assert.equal(s.flipAt, s.settleAt);
  assert.ok(Math.abs(s.face - 1600) <= 100, String(s.face));
  for (const v of ['A', 'B', 'C']) assert.ok(packPlan(v, 99).face < packPlan(v, 0).face);
});

test('the pack shows the best rarity inside and a glint for a shiny', () => {
  assert.deepEqual(packFoil([{ tierKey: 'common' }, { tierKey: 'rare' }]), { tier: 'rare', shiny: false });
  assert.deepEqual(packFoil([{ o: { tier: 'legendary' } }, { tierKey: 'uncommon', shiny: { label: 'Sunset' } }]), { tier: 'legendary', shiny: true });
  assert.deepEqual(packFoil([{ tierKey: 'mystery' }, {}]), { tier: 'common', shiny: false });
});
