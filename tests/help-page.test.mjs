// The help page (2026-11-20): a Help row in Settings opens skycollector.app/help, and the site builds the page from
// help.html (scripts/build-site.mjs), with links to the privacy page and the support email.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('Settings has a Help row in its Help section that opens skycollector.app/help', () => {
  const html = src('index.html'), row = /<a class="set-row" id="set-help" href="([^"]+)"[^>]*>[\s\S]*?<\/a>/.exec(html);
  assert.ok(row, 'no #set-help row');
  assert.equal(row[1], 'https://skycollector.app/help');
  assert.match(row[0], /target="_blank"/); // a new tab on the web; js/native.js opens any https link in the in-app browser
  const help = html.indexOf('<h3>Help</h3>'), about = html.indexOf('<h3>About</h3>'), at = html.indexOf('id="set-help"');
  assert.ok(help > 0 && help < at && at < about, 'the row sits in the Help section');
});

test('help.html is built into the site and links to /privacy and the support email', () => {
  const page = src('help.html'), build = src('scripts/build-site.mjs');
  assert.match(page, /<h1>Help<\/h1>/);
  assert.match(page, /<a href="privacy\.html">skycollector\.app\/privacy<\/a>/);
  assert.match(page, /<a href="mailto:hello@skycollector\.app">hello@skycollector\.app<\/a>/);
  assert.match(build, /sitePage\('help\.html'[,)]/);
  assert.match(build, /\['\/help', changed\('help\.html'\)\]/); // in the sitemap, with its date
  assert.match(build, /replaceAll\('href="privacy\.html"', 'href="\/privacy"'\)/);
});
