// Offline place search (js/cities.js + data/cities.json, GeoNames cities1000, 2026-11-20): rebuild the list with
// scripts/build-cities.py and these must still hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../data/cities.json', import.meta.url), 'utf8')) });
const { searchCities } = await import('../js/cities.js');
const top = async (q) => { const c = (await searchCities(q))[0]; return c && `${c.name}, ${c.region}, ${c.country}`; };
const all = async (q) => (await searchCities(q)).map((c) => `${c.name}, ${c.country}`);

test('small dark-sky towns are found', async () => {
  assert.equal(await top('banff'), 'Banff, Alberta, Canada');
  assert.equal(await top('canmore'), 'Canmore, Alberta, Canada');
  assert.equal(await top('tobermory'), 'Tobermory, Ontario, Canada');
  assert.equal(await top('inuvik'), 'Inuvik, Northwest Territories, Canada');
  assert.ok((await all('picton')).includes('Picton, Canada'));
  assert.equal(await top('moab'), 'Moab, Utah, United States');
  assert.equal(await top('marfa'), 'Marfa, Texas, United States');
});

test('big cities come first', async () => {
  assert.equal(await top('toronto'), 'Toronto, Ontario, Canada');
  assert.equal(await top('london'), 'London, England, United Kingdom');
  assert.equal(await top('paris'), 'Paris, Île-de-France, France');
  assert.equal(await top('sydney'), 'Sydney, New South Wales, Australia');
  assert.ok(!(await all('paris')).some((n) => /^Paris \d/.test(n)), 'no Paris districts');
});

test('partial typing still offers the big city', async () => {
  assert.equal(await top('toro'), 'Toronto, Ontario, Canada');
  assert.ok((await all('van')).slice(0, 2).includes('Vancouver, Canada'));
});

test('a region or country after the name', async () => {
  assert.equal(await top('paris, texas'), 'Paris, Texas, United States');
  assert.equal(await top('san jose ca'), 'San Jose, California, United States');
  assert.equal(await top('london uk'), 'London, England, United Kingdom');
  assert.equal(await top('washington dc'), 'Washington, District of Columbia, United States');
  assert.equal(await top('ft worth'), 'Fort Worth, Texas, United States');
});
