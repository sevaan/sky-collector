// The streak patch is 'Frequent Flyer' in Sky (Sevaan, 2026-11-20); 'Regular' stays the regular-flight patch. Same id, so earned state carries over.
import test from 'node:test';
import assert from 'node:assert/strict';
test('Sky has one Regular and one Frequent Flyer', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const m = await import('../js/progress.js');
  m.setSkyProgress(true);
  const list = m.activeAchievements();
  const names = list.map((x) => x.name);
  assert.equal(names.filter((n) => n === 'Regular').length, 1);
  assert.equal(list.find((x) => x.id === 'streak4').name, 'Frequent Flyer');
  assert.equal(list.find((x) => x.id === 'sky-regular').name, 'Regular');
  assert.equal(new Set(names).size, names.length, 'patch names are unique');
});
