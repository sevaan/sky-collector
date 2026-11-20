// Every type in the Military set prints a full card (2026-11-19): a plain name, a photo with its licence, at least two
// checked facts and verified specs (js/type-specs.js; some types have fewer than four cells, none have none).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { typeName } from '../js/sky-type-names.js';
import { typeFacts } from '../js/sky-facts.js';
import { typeSpecs } from '../js/type-specs.js';
import { photoFor } from '../js/flight-card.js';
import { SKY_SETS } from '../js/sky-sets.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MILITARY = ['C17', 'C130', 'C30J', 'C5M', 'A400', 'K35R', 'K35E', 'KC10', 'E3TF', 'E3CF', 'E6', 'B52', 'B1', 'B2', 'P8', 'C2', 'C295', 'V22', 'U2', 'F16', 'F18', 'F15', 'F35', 'EUFI', 'A10', 'H47', 'H53', 'H60', 'AN12', 'IL76'];
const set = SKY_SETS.find((s) => s.id === 'military');

test('the list here is the Military set', () => {
  for (const t of MILITARY) assert.ok(set.test(t), `${t} not in the set`);
});
test('every Military type has a plain name', () => {
  for (const t of MILITARY) { const n = typeName(t); assert.ok(n && n !== t && n.length <= 30, `${t}: ${n}`); /* longer names lose their end on the mini card */ }
});
test('every Military type has a photo file with a credit and a licence', () => {
  for (const t of MILITARY) {
    const ph = photoFor(t);
    assert.ok(ph, `${t}: no photo`);
    assert.ok(existsSync(ROOT + ph.url), `${t}: ${ph.url} missing`);
    assert.ok(ph.credit && ph.licence && /^https:\/\/commons\.wikimedia\.org\//.test(ph.source), `${t}: credit/licence/source`);
  }
});
test('every Military type has at least two facts', () => {
  for (const t of MILITARY) assert.ok(typeFacts(t).length >= 2, `${t}: ${typeFacts(t).length} facts`);
});
test('every Military type has verified specs', () => {
  for (const t of MILITARY) assert.ok(typeSpecs(t)?.cells.length >= 2, `${t}: no specs`);
});
