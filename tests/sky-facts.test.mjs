import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPE_FACTS, typeFact } from '../js/sky-facts.js';
import { COMMON_TYPES, UNCOMMON_TYPES, EPIC_TYPES, LEGENDARY_TYPES } from '../js/sky-tiers.js';

const entries = Object.entries(TYPE_FACTS);
const BANNED = /\b(crash(es|ed)?|accidents?|grounded|grounding|wars?|killed)\b/i;

test('there are at least 120 facts', () => assert.ok(entries.length >= 120, `only ${entries.length}`));
test('keys are valid upper-case type codes', () => {
  for (const [code] of entries) assert.match(code, /^[A-Z][A-Z0-9]{1,3}$/, code);
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
  assert.equal(typeFact('b738'), TYPE_FACTS.B738);
  assert.equal(typeFact('ZZZZ'), null);
  assert.equal(typeFact(''), null);
  assert.equal(typeFact(undefined), null);
});
