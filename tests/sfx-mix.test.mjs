// Sevaan's by-ear sound mix of 2026-11-19 (the mixer artifact): js/sfx.js NORM must hold exactly these values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const MIX = {"arrive": 0.85, "coinroll": 0.93, "collect": 0.85, "complete": 1.32, "flip": 0.52, "fossil": 1.16, "levelup": 1.18, "lock": 0.75, "mission": 1.05, "page": 1.88, "patch": 1.1, "plane": 0.76, "r_common": 0.9, "r_epic": 1.28, "r_legend": 1.25, "r_rare": 1.37, "r_uncommon": 0.9, "rankup": 1.12, "rattle": 0.9, "secret": 0.89, "seen": 1.15, "shiny": 2.27, "stamp": 1.23, "step": 1.46, "swipe": 0.84, "tear": 0.75, "toast": 1.58, "toggle": 1.88, "ufo": 1.49, "welcome": 0.61, "xp": 0.41};
test('NORM is the 2026-11-19 mix, and every sound file has a level', () => {
  const src = readFileSync(new URL('../js/sfx.js', import.meta.url), 'utf8');
  assert.deepEqual(JSON.parse(src.match(/const NORM = (\{[^}]*\});/)[1]), MIX);
  assert.match(src, /const LEVEL = 0\.25/);
});
