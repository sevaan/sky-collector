// Sky's own words where a Sky player can see them (content audit items 1-5 and the patch and mission wording pass,
// 2026-11-20; Space Collector's /content/content-audit.md, Sky's content/sky-*-2026-11-20.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, String(v)); }, removeItem(k) { this.m.delete(k); } };
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const { setSkyProgress, RANKS, ACHIEVEMENTS, activeAchievements, SKY_MISSIONS, SKY_CHALLENGES } = await import('../js/progress.js');
const { SKY_SECRET_PATCHES } = await import('../js/sky-secrets.js');
const { noteSkipWord } = await import('../js/native.js');

test('Sky ranks: Sevaan\'s ladder at the same thresholds, none a patch name, all short enough for the rank card', () => {
  setSkyProgress(true);
  assert.deepEqual(RANKS.map((r) => r[1]), ['Skywatcher', 'Spotter', 'Type Spotter', 'Plane Expert', 'Sky Scholar', 'Sky Master', 'Sky Legend', 'Hall of Fame']);
  assert.deepEqual(RANKS.map((r) => r[0]), [0, 480, 2000, 4000, 10000, 25000, 50000, 90000]);
  const patchNames = new Set([...activeAchievements(), ...Object.values(SKY_SECRET_PATCHES)].map((x) => x.name));
  for (const [, n] of RANKS) { assert.ok(!patchNames.has(n), `${n} is also a patch`); assert.ok(n.length <= 12, n); }
});

test('Sky patches and missions say catch and patch, not sighting, badge or Zenith', () => {
  setSkyProgress(true);
  const all = [...activeAchievements(), ...Object.values(SKY_SECRET_PATCHES)];
  const by = new Map(all.map((x) => [x.id, x]));
  assert.equal(by.get('sightings100').name, 'Hundred Catches'); assert.equal(by.get('double').name, 'Double Catch');
  assert.equal(by.get('overhead').name, 'Straight Up');
  assert.equal(by.get('twilight').text, 'Catch a plane between 5 and 9 PM'); assert.equal(by.get('dawn').text, 'Catch a plane between 4 and 7 AM');
  assert.equal(by.get('months3').text, 'Catch a plane in 3 different months'); assert.equal(by.get('roadtrip').text, 'Catch planes from two places more than 100 km apart');
  assert.equal(by.get('firebird').text, 'You caught a water bomber, a plane built to scoop up water from a lake.');
  for (const x of all) assert.doesNotMatch(`${x.name} ${x.text} ${x.sub ?? ''}`, /sighting|badge|zenith|shortest path|\blog\b/i, x.id);
  for (const m of [...SKY_MISSIONS, ...SKY_CHALLENGES]) assert.doesNotMatch(m.text, /plane type|sighting/i, m.id);
  setSkyProgress(false); assert.equal(ACHIEVEMENTS.find((x) => x.id === 'sightings100').name, 'Hundred Sightings'); /* Space's own stays */
});

test('no Space wording on the Sky screens fixed in the content audit', () => {
  const main = src('js/main.js'), cards = src('cards.html'), page = src('js/cards-page.js');
  assert.match(main, /SKY_ONLY \? 'Plane data could not load\. Check your connection, then try again\.'/);
  assert.match(main, /textContent=SKY_ONLY \? 'Try again'/);
  assert.doesNotMatch(cards, /ORBITAL|cosmos|field guide/i, 'the Collection\'s first paint');
  assert.match(page, /SKY \? '<span class="empty__orbit"[^']*Your first card is flying by/);
  for (const line of page.split('\n').filter((l) => /field guide|ISS is a good/.test(l) && /notice\(|innerHTML/.test(l))) assert.match(line, /SKY \?|!SKY/, line.trim().slice(0, 80));
  assert.match(main, /function scheduleNotes\(T\) \{ if \(SKY_ONLY\) return/, 'Space\'s Tonight notifications never scheduled in Sky');
  assert.equal(noteSkipWord(true), 'Not today'); assert.equal(noteSkipWord(false), 'Not tonight');
});

test("'who's flying it' is gone: true when a route isn't known", () => {
  for (const f of ['scripts/build-site.mjs', 'site/pack-src/index.html', 'js/main.js']) assert.doesNotMatch(src(f), /who’s flying|who's flying|plane flying it/, f);
  assert.match(src('scripts/build-site.mjs'), /Most airline flights also show the airline and the route\./);
  assert.match(src('site/pack-src/index.html'), /Every plane overhead gets a card for its <strong>type<\/strong>\. Most airline flights get a second one, with the airline and the&nbsp;route\./);
  assert.match(src('js/main.js'), /Every plane up there is a card\. Most airline flights get a second one with the airline and route\. Catch jets, helicopters, even airships/);
});

test('support email on the privacy page and the site', () => {
  assert.match(src('privacy.html'), /Questions, or an aircraft you would like left out\? Email <a href="mailto:hello@skycollector\.app">hello@skycollector\.app<\/a>/);
  assert.match(src('scripts/build-site.mjs'), /mailto:hello@skycollector\.app/);
});
