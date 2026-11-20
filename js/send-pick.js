// What the Send cards picker has picked (2026-11-20), apart from the page so it can be tested (tests/send-pick.test.mjs).
// Shared with Space Collector as is: no DOM, no Sky-only rules.
// Picks are two sets that live as long as the page is open: whole cards (By card) and days or nights (By day / By night).
// Switching the Planes / Flights tab, searching, filtering or switching By card <-> By day only changes what is shown;
// it never drops a pick. What is sent is every sighting of a picked card plus every sighting on a picked day.

export function createPicks({ kind = null, only = null } = {}) {
  return { tab: 'card', kind, query: '', set: 'all', rarity: 'all', sort: 'auto', cards: new Set(), nights: new Set(), gapNo: '', only };
}

/** Pick or unpick one key; returns whether it is now picked. */
export function toggle(set, key) { if (set.has(key)) { set.delete(key); return false; } set.add(key); return true; }

/** Every shown key is picked (and there is at least one). */
export const allPicked = (set, keys) => keys.length > 0 && keys.every((k) => set.has(k));

/** How many of the shown keys are picked. */
export const countPicked = (set, keys) => keys.reduce((n, k) => n + (set.has(k) ? 1 : 0), 0);

/** Select all / Select none on what is shown: picks every shown key, or, when they are all picked already, unpicks just
 *  those. Picks that are not shown (the other tab, outside the search) are left alone. Returns whether it picked. */
export function pickShown(set, keys) {
  if (allPicked(set, keys)) { for (const k of keys) set.delete(k); return false; }
  for (const k of keys) set.add(k);
  return true;
}

/** The sightings to send: a picked card's every sighting, and every sighting of a picked day (no repeats). */
export function pickedSightings(sightings, sel, dayOf) {
  if (sel.only) return sightings.filter((s) => sel.only.includes(s.cardKey));
  return sightings.filter((s) => sel.cards.has(s.cardKey) || (sel.nights.size > 0 && sel.nights.has(dayOf(s))));
}

/** "3 of 10 planes picked" (the count line over the grid). unit: [one, many]. */
export function countLine(picked, shown, unit = ['card', 'cards']) {
  return `${picked.toLocaleString('en-US')} of ${shown.toLocaleString('en-US')} ${shown === 1 ? unit[0] : unit[1]} picked`;
}

/** Any filter (not the search) is on: the Filters button's dot, as in the Collection. */
export const filtersOn = (sel) => sel.set !== 'all' || sel.rarity !== 'all' || (sel.sort ?? 'auto') !== 'auto';
