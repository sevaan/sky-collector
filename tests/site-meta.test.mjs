// skycollector.app's schema (scripts/site-meta.mjs, 2026-11-27): the help page's FAQPage comes from the page itself and
// keeps up with new sections and anchors; nothing in the markup says Sky is in a store, or carries a price or a rating.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { helpFaq, helpJsonLd, homeJsonLd, pageTags, answerText, LLMS_TXT } from '../scripts/site-meta.mjs';

const parse = (block) => JSON.parse(block.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const help = readFileSync(new URL('../help.html', import.meta.url), 'utf8');

test('every question on the help page is in the FAQ, word for word, with its answer', () => {
  const qs = [...help.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim());
  const ld = parse(helpJsonLd(help, '2026-11-27'));
  assert.equal(ld['@type'], 'FAQPage');
  assert.deepEqual(ld.mainEntity.map((q) => q.name), qs);
  for (const q of ld.mainEntity) assert.ok(q.acceptedAnswer.text.length > 20, q.name);
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
