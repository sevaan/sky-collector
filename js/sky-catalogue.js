// The plane cards there are to collect (2026-11-17), so an album shows what's missing as Space Collector's do: one card for
// each aircraft type the game knows well (the Common, Uncommon, Epic and Legendary lists of js/sky-tiers.js that have a
// name in js/planes.js). Rare types and all flight cards have no list: they appear when you catch them. No DOM.
import { COMMON_TYPES, UNCOMMON_TYPES, EPIC_TYPES, LEGENDARY_TYPES } from './sky-tiers.js?v=0.1.1768';
import { cardsFor, retier } from './flights.js?v=0.1.1768';
import { aircraftName } from './planes.js?v=0.1.1768';
import { skyModel } from './sky-cards.js?v=0.1.1768';
let memo = null;
export function skyCatalogue() {
  if (memo) return memo.map((c) => ({ ...c }));
  const out = [];
  for (const type of [...COMMON_TYPES, ...UNCOMMON_TYPES, ...EPIC_TYPES, ...LEGENDARY_TYPES]) {
    if (!aircraftName({ type })) continue; // no name we can print: it gets a card when it's caught
    const card = retier(skyModel(cardsFor({ type, callsign: '', reg: '' }, null, '').plane, 'plane'));
    card.setName = card.set; card.set = card.setId;
    out.push(card);
  }
  memo = out; return out.map((c) => ({ ...c }));
}
