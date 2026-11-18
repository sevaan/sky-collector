import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPE_FACTS, typeFact, typeFacts } from '../js/sky-facts.js';
import { COMMON_TYPES, UNCOMMON_TYPES, EPIC_TYPES, LEGENDARY_TYPES } from '../js/sky-tiers.js';

const entries = Object.entries(TYPE_FACTS).flatMap(([code, f]) => (Array.isArray(f) ? f : [f]).map((x, i) => [i ? `${code}#${i + 1}` : code, x])); /* every fact, a type's list flattened */
const BANNED = /\b(crash(es|ed)?|accidents?|grounded|grounding|wars?|killed)\b/i;

test('there are at least 120 facts', () => assert.ok(entries.length >= 120, `only ${entries.length}`));
test('keys are valid upper-case type codes', () => {
  for (const code of Object.keys(TYPE_FACTS)) assert.match(code, /^[A-Z][A-Z0-9]{1,3}$/, code);
});
test('every fact is 60-200 characters with exactly one **bold** pair', () => {
  for (const [code, f] of entries) {
    assert.ok(f.length >= 60 && f.length <= 200, `${code}: ${f.length} chars`);
    assert.equal((f.match(/\*\*[^*]+\*\*/g) || []).length, 1, `${code}: bold pairs`);
    assert.equal((f.match(/\*\*/g) || []).length, 2, `${code}: stray asterisks`);
  }
});
test('no banned words', () => {
  for (const [code, f] of entries) assert.ok(!BANNED.test(f), `${code}: ${f}`);
});
test('no marketing openers', () => {
  for (const [code, f] of entries) assert.ok(!/did you know/i.test(f), code);
});
test('every Common and Uncommon type has a fact', () => {
  for (const t of [...COMMON_TYPES, ...UNCOMMON_TYPES]) assert.ok(TYPE_FACTS[t], `missing ${t}`);
});
test('every Epic and Legendary type has a fact', () => {
  for (const t of [...EPIC_TYPES, ...LEGENDARY_TYPES]) assert.ok(TYPE_FACTS[t], `missing ${t}`);
});
test('typeFact is case-insensitive and null for unknown or empty', () => {
  assert.equal(typeFact('b738'), typeFacts('B738')[0]);
  assert.equal(typeFact('ZZZZ'), null);
  assert.equal(typeFact(''), null);
  assert.equal(typeFact(undefined), null);
});
test('each different aircraft turns the card to the next fact, round again after the last', () => {
  const [code, list] = Object.entries(TYPE_FACTS).find(([, f]) => Array.isArray(f) && f.length > 1) ?? [];
  if (!code) return; // no type has several facts yet
  assert.equal(typeFact(code, 1), list[0]); assert.equal(typeFact(code, 2), list[1]); assert.equal(typeFact(code, list.length + 1), list[0]);
});
test('a type\'s facts are all different', () => {
  for (const [code, f] of Object.entries(TYPE_FACTS)) if (Array.isArray(f)) assert.equal(new Set(f).size, f.length, code);
});
