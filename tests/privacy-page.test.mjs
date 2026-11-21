// The privacy page for the store release (2026-11-20): privacy.html is Part 1 of content/sky-privacy-page-v2-2026-11-20.md
// word for word. The only differences allowed are the date and Part 1b's sentences chosen for what is live with 0.1.1819:
// ① the after-fix sentence with its dated bracket (already in Part 1), ② MET Norway (the app's /wx switch ships with it),
// ⑦ the true-today sentence (the 90-day expiry isn't live), ⑧ the true-today list (no "camera" yet). The apps bundle no
// copy of the page (js/native.js opens skycollector.app/privacy), so this one page covers the website and both apps.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const md = src('content/sky-privacy-page-v2-2026-11-20.md'), page = src('privacy.html');
const words = (s) => s.replace(/\s+/g, ' ').trim().split(' ');

const DATE = ['[date]', '20 November 2026'];
const WEATHER = ['The forecast comes from Open-Meteo, asked with a position rounded to about 10 km.', 'The forecast comes from MET Norway, through our own server, asked with a position rounded to about 10 km.'];

const part1 = () => md.split('## Part 1. The page')[1].split('\n---\n')[0];
const mdText = (s) => s.replace(/^#+ /gm, '').replace(/^- /gm, '').replace(/\*\*?/g, '').replace(/[①②③④⑤⑥⑦⑧]/g, '');
const pageText = (s) => s.split('<body>')[1].replace(/<span class="eyebrow">[^<]*<\/span>/, '') /* the header, as on help.html */.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

const RET = ['used only to improve the game.', 'used only to improve the game. Each note is deleted after 90 days. We keep daily totals, such as how many people played, which hold no IDs.']; /* ⑦: the 90-day sentence, live since 2026-11-20 */

test('the chosen Part 1b sentences are the source file\'s own', () => {
  const table = md.split('## Part 1b.')[1].split('## Part 2.')[0];
  for (const s of WEATHER) assert.ok(table.includes(s), s);
  assert.ok(part1().includes('Last updated [date].'));
  assert.ok(part1().includes('(Until 20 December 2026, some older request logs'), '① stays as Part 1 has it until 20 December 2026');
});

test('privacy.html is Part 1 word for word, apart from the date and the chosen Part 1b sentences', () => {
  const want = words(mdText(part1()).replace(DATE[0], DATE[1]).replace(WEATHER[0], WEATHER[1]).replace(RET[0], RET[1]));
  const got = words(pageText(page));
  const diffs = [];
  for (let i = 0; i < Math.max(want.length, got.length); i++) if (want[i] !== got[i]) { diffs.push(`word ${i}: want ${JSON.stringify(want.slice(i, i + 6).join(' '))}, got ${JSON.stringify(got.slice(i, i + 6).join(' '))}`); break; }
  assert.deepEqual(diffs, []);
  assert.equal(got.length, want.length);
});

test('privacy.html: true-today sentences, and notes for the swaps to come', () => {
  assert.match(page, /used only to improve the game\. Each note is deleted after 90 days\. We keep daily totals, such as how many people played, which hold no IDs\.<\/p>/); /* ⑦ live */
  assert.match(page, /<li>No use of your contacts, photos or microphone\.<\/li>/);
  assert.doesNotMatch(page, /Open-Meteo|test version|left out\?/);
  assert.doesNotMatch(page, /PENDING/);
});

test('the apps open the site\'s page, with no bundled copy', () => {
  assert.match(src('js/native.js'), /else if \(\/\^privacy\\\.html\/i\.test\(href\)\) url = 'https:\/\/skycollector\.app\/privacy';/);
  assert.match(src('scripts/build-site.mjs'), /sitePage\('privacy\.html'\)/);
});
