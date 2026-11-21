// The apps support iOS 15.0 (native-shell's App target), and the website any recent Safari. A regex lookbehind stops the
// whole module parsing on iOS 15.0–16.3, so the app never starts (Space found one, 2026-11-20). findLast/findLastIndex and
// Object.hasOwn arrive only in iOS 15.4. Array.at and canvas roundRect are filled in by index.html, so they're fine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir = new URL('../js/', import.meta.url);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
const BAD = [[/\(\?<[=!]/, 'regex lookbehind (iOS 16.4+)'], [/\.findLast(Index)?\(/, 'findLast (iOS 15.4+)'], [/Object\.hasOwn\(/, 'Object.hasOwn (iOS 15.4+)'], [/\bstatic\s*\{/, 'class static block (iOS 16.4+)']];
test('no syntax or functions iOS 15.0 lacks in js/', () => {
  const hits = [];
  for (const f of files) { const s = fs.readFileSync(new URL(f, dir), 'utf8'); for (const [re, what] of BAD) if (re.test(s)) hits.push(`${f}: ${what}`); }
  assert.deepEqual(hits, []);
});
