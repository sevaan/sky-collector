// skycollector.app's schema (scripts/site-meta.mjs, 2026-11-27): the help page's FAQPage comes from the page itself and
// keeps up with new sections and anchors; nothing in the markup says Sky is in a store, or carries a price or a rating.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { helpFaq, helpJsonLd, homeJsonLd, pageTags, answerText, siteHelp, LLMS_TXT } from '../scripts/site-meta.mjs';

const parse = (block) => JSON.parse(block.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const help = readFileSync(new URL('../help.html', import.meta.url), 'utf8');

test('every question on the help page is in the FAQ, word for word, with its answer', () => {
  const qs = [...help.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim());
  const ids = [...help.matchAll(/<details id="([^"]+)"/g)].map((m) => m[1]);
  const ld = parse(helpJsonLd(help, '2026-11-27'));
  assert.equal(ld['@type'], 'FAQPage');
  assert.ok(qs.length >= 30);
  assert.deepEqual(ld.mainEntity.map((q) => q.name), qs);
  assert.deepEqual(ld.mainEntity.map((q) => q.url), ids.map((id) => `https://skycollector.app/help#${id}`)); // every answer has its address
  assert.equal(new Set(ids).size, ids.length, 'anchors are unique');
  for (const q of ld.mainEntity) assert.ok(q.acceptedAnswer.text.length > 20, q.name);
  assert.ok(!/data-find|\{#/.test(JSON.stringify(ld)), 'search words and anchors stay out of the answers');
});

test('new sections, anchors, <details> and lists are read', () => {
  const html = `<main><h1>Help</h1><h2>New part</h2><h3 id="compass">Why is it off?</h3><p>Try this:</p><ol><li>Open <b>Settings</b>.</li><li>Tap Line up.</li></ol>
    <details id="free"><summary>Is it free?</summary><p>Yes &amp; no ads. See <a href="/privacy">privacy</a>.</p></details><h2>Contact</h2><p>Loose text.</p></main>`;
  const f = helpFaq(html);
  assert.deepEqual(f.map((x) => [x.id, x.q]), [['compass', 'Why is it off?'], ['free', 'Is it free?']]);
  assert.equal(f[0].a, 'Try this:\n1. Open Settings.\n2. Tap Line up.');
  assert.equal(f[1].a, 'Yes & no ads. See <a href="https://skycollector.app/privacy">privacy</a>.');
  const ld = parse(helpJsonLd(html, '2026-11-27'));
  assert.equal(ld.mainEntity[0].url, 'https://skycollector.app/help#compass');
});

test('a "</script>" in an answer cannot end the block', () => {
  assert.doesNotThrow(() => parse(helpJsonLd('<main><h3>Q?</h3><p>a &lt;/script&gt; b</p></main>', '2026-11-27')));
  assert.equal(answerText('<p>x &lt;/script&gt;</p>'), 'x </script>');
});

test('before release: no app block, no store, no price, no rating; publisher is Sky Collector', () => {
  const all = homeJsonLd() + helpJsonLd(help, '2026-11-27') + pageTags(help, '/help');
  for (const bad of ['MobileApplication', 'VideoGame', 'SoftwareApplication', 'offers', '"price', 'priceCurrency', 'aggregateRating', 'Rating', 'installUrl', 'apps.apple.com', 'play.google.com', 'Sevaan']) assert.ok(!all.includes(bad), bad);
  const home = parse(homeJsonLd());
  assert.deepEqual(home['@graph'].map((n) => n['@type']), ['Organization', 'WebSite']);
  assert.equal(home['@graph'][0].name, 'Sky Collector');
  assert.match(LLMS_TXT, /coming soon/);
});

test('two lists in one answer are numbered and dashed on their own', () => {
  assert.equal(answerText('<ol><li>a</li><li>b</li></ol><p>x</p><ul><li>c</li></ul>'), '1. a\n2. b\nx\n- c');
});

test('help v3 (2026-11-27): Content\'s anchors are on the page, and nothing says Sky is in a store yet', () => {
  for (const id of ['compass', 'motion', 'location', 'no-planes', 'cant-catch', 'no-route', 'no-alert', 'restore', 'pack-problem', 'plus', 'reset']) assert.match(help, new RegExp(`<details id="${id}"><summary><h3>|<details id="${id}" `), id);
  const shown = siteHelp(help).replace(/data-find="[^"]*"/g, '');
  for (const bad of [/on iPhone now/i, /available (on|in) the/i, /download (it|Sky)/i, /on sale/i]) assert.ok(!bad.test(shown), String(bad));
});

test('pre-launch: the website’s help says Sky isn’t out yet and has #release; the app’s own help never does', () => {
  assert.ok(!/isn’t out yet|id="release"|come out\?/.test(help), 'help.html is the app copy: no pre-launch words');
  const site = siteHelp(help, true);
  assert.match(site, /<p class="lede">[\s\S]*?<\/p>\n\s*<!-- PRELAUNCH[^>]*--><p class="soon" id="prerelease">Sky Collector isn’t out yet/);
  assert.ok(site.indexOf('id="release"') > site.indexOf('id="today"') && site.indexOf('id="release"') < site.indexOf('id="free"'), '#release sits where Content put it');
  assert.equal(parse(helpJsonLd(site, '2026-11-27')).mainEntity.length, helpFaq(help).length + 1);
  assert.equal(siteHelp(help, false), help, 'launch day: one switch drops both');
});
