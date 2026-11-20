// The patch total is fixed (QA round 5, Sevaan's option 1): every Sky album's patch is listed from the start, locked until
// filled, so "N of M patches earned" only moves when a patch is earned. And no patch, mission, challenge or week-theme
// text writes a distance in fixed units: each goes through distText (js/units.js distRound), so US phones read miles.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, String(v)); }, removeItem(k) { this.m.delete(k); } };
const { albumList, useSets } = await import('../js/sets.js');
const { SKY_ALBUM_SETS } = await import('../js/sky-sets.js');
const P = await import('../js/progress.js');

test('every Sky album is listed before it has a card, so the patch total does not move as cards arrive', () => {
  useSets(SKY_ALBUM_SETS); P.setSkyProgress(true);
  const none = albumList([]), some = albumList([{ key: 'P:B789', setId: 'twinaisle' }, { key: 'P:A320', setId: 'a320' }]);
  assert.equal(none.length, SKY_ALBUM_SETS.length); assert.equal(some.length, none.length);
  assert.deepEqual(some.find((a) => a.id === 'twinaisle').keys, ['P:B789']);
  for (const a of none) assert.ok(a.goal >= 1 && a.keys.length === 0, `${a.id} has a gold goal and no cards`);
  const info = () => ({ tier: 'common' }), t = Date.now() - 3600e3;
  const total = (list, albums) => P.progress(list, info, { albums, keep: false }).achievements.length;
  const s = (key) => ({ cardKey: key, objectId: key, time: t, lon: -79.4, lat: 43.6, cardSnapshot: { sky: key.startsWith('F:') ? 'flight' : 'plane' } });
  assert.equal(total([], none), total([s('P:B789'), s('P:A320')], some));
  const al = P.progress([], info, { albums: none, keep: false }).achievements.filter((x) => x.album);
  assert.equal(al.length, SKY_ALBUM_SETS.length); assert.ok(al.every((x) => !x.done && x.name && x.text), 'locked, with a name and how to earn it');
});

test('no literal distances: patch, mission, challenge and week-theme text follow Settings → Units', () => {
  P.setSkyProgress(true);
  const texts = () => [...P.activeAchievements(), ...P.SKY_MISSIONS, ...P.SKY_POOL, ...P.SKY_STARTER, ...P.SKY_CHALLENGES, ...P.WEEK_THEMES].map((x) => [x.id, String(x.text ?? '')]);
  for (const [units, bad] of [['metric', /\d\s?(mi|miles)\b/], ['imperial', /\d\s?(km|kilomet\w*)\b(?!\/h)/]]) {
    localStorage.setItem('units', units);
    for (const [id, tx] of texts()) assert.doesNotMatch(tx, bad, `${id} (${units}): ${tx}`);
  }
  localStorage.setItem('units', 'imperial');
  const by = Object.fromEntries(P.activeAchievements().map((x) => [x.id, x.text]));
  for (const id of ['sky-hopper', 'sky-globetrotter', 'sky-coast', 'sky-world', 'sky-moon', 'roadtrip']) assert.match(by[id], /\d mi\b/, id);
  localStorage.removeItem('units');
});

test('distance bars count in the player\'s units, to the round figure the goal names; Jet Stream\'s speed follows them too', async () => {
  P.setSkyProgress(true);
  const { SKY_SECRET_PATCHES, registerSkySecrets } = await import('../js/sky-secrets.js');
  const by = () => Object.fromEntries(P.activeAchievements().map((x) => [x.id, x]));
  localStorage.setItem('units', 'imperial');
  const world = by()['sky-world'], moon = by()['sky-moon'];
  assert.match(world.text, /25,000 mi/); assert.match(moon.text, /240,000 mi/);
  const { freshSky2 } = await import('../js/sky-patches.js'); const at = (km) => ({ sky2: { ...freshSky2(), distance: km } });
  assert.deepEqual(world.prog(at(16093.4)), [10000, 25000]); assert.deepEqual(moon.prog(at(0)), [0, 240000]);
  localStorage.setItem('units', 'metric'); assert.deepEqual(by()['sky-world'].prog(at(10000)), [10000, 40075]); localStorage.setItem('units', 'imperial');
  assert.match(SKY_SECRET_PATCHES.jetstream.text, /faster than 621 mph/);
  const reg = {}; registerSkySecrets(reg, null); assert.match(reg.jetstream.text, /mph/);
  localStorage.setItem('units', 'metric'); assert.match(reg.jetstream.text, /faster than 1,000 km\/h/, 'the registered copy follows a units change');
  localStorage.removeItem('units');
});
