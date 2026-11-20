import { SETS, goldAlbums } from './sets.js?v=0.1.1795';
import { isPlus } from './plus.js?v=0.1.1795';
// Card backs you can choose (2026-10-16, design/card-backs.html, Sevaan liked all six). Mission Control is everyone’s;
// Plus unlocks the rest; two can also be earned free: Golden Record (find the Pale Blue Dot story) and Star Chart
// (complete 10 constellations); main.js writes what’s been earned to localStorage 'backEarned'. The choice is
// localStorage 'cardBack': a back’s id, or 'random' for a different unlocked one each time a card turns over.
export const CARD_BACKS = [
  // Sky Collector's backs (2026-11-15, Sevaan): painted with Nano Banana Pro like Space Collector's (scripts/art/gen-back.py,
  // prompts in scripts/art/back-prompts/). Flight Plan is the default (2026-11-16), Engine stays free; Airline Ticket, Turbofan and Cheatline were defaults before it; the rest
  // come with Plus, to be curated later.
  // Flight Plan (2026-11-16, Sevaan's design): Space Collector's Mission Control back redrawn for the sky, so it's the default
  // like Mission Control is there. scripts/art/source/back-flight-plan-original.webp is his file; the webp is cropped inside
  // its gold frame, the lower compass ticks redrawn from the top, then registered onto Mission Control by
  // scripts/art/register-back.py (Sevaan: "line up and overlay perfectly"): frame, rules, corner circles, ring and title land
  // on Mission Control's own positions; its oranges turned to Sky's red by scripts/art/orange-to-red.py.
  { id: 'flight-plan', bg: '#fdf6e9', name: 'Flight Plan', url: 'assets/art/backs/back-flight-plan.webp', title: 'middle', free: true },
  { id: 'engine', bg: '#5ca5ce', name: 'Engine', url: 'assets/art/backs/back-engine.webp', title: 'middle', free: true }, // the default 2026-11-15 to 11-16, stays free
  { id: 'airline-ticket', bg: '#f3ead2', name: 'Airline Ticket', url: 'assets/art/backs/back-airline-ticket.webp', title: 'middle' }, // classic playing-card back, design room 3 (Sevaan's default, 2026-11-15)
  { id: 'turbofan', bg: '#0d2238', name: 'Turbofan', url: 'assets/art/backs/back-turbofan.webp', title: 'middle' }, // the default before Airline Ticket
  { id: 'cheatline', bg: '#031622', name: 'Cheatline', url: 'assets/art/backs/back-cheatline.webp', title: 'middle' },
  { id: 'fleet', bg: '#66b7d4', name: 'The Fleet', url: 'assets/art/backs/back-fleet.webp', title: 'middle' },
  { id: 'first-class', bg: '#98a2a6', name: 'First Class', url: 'assets/art/backs/back-first-class.webp', title: 'middle' },
  { id: 'endpaper', bg: '#8abfcf', name: 'Endpaper', url: 'assets/art/backs/back-endpaper.webp', title: 'middle' },
  { id: 'contrail', bg: '#f9ebca', name: 'Contrail', url: 'assets/art/backs/back-contrail.webp', title: 'middle' },
  { id: 'aluminium', bg: '#5393c1', name: 'Aluminium', url: 'assets/art/backs/back-aluminium.webp', title: 'middle' },
  { id: 'window-seat', bg: '#f7e9c6', name: 'Window Seat', url: 'assets/art/backs/back-window-seat.webp', title: 'middle' },
  { id: 'airmail', bg: '#fcf2d7', name: 'Airmail', url: 'assets/art/backs/back-airmail.webp', title: 'middle' },
  { id: 'propeller-note', bg: '#fcf5e2', name: 'Propeller Note', url: 'assets/art/backs/back-propeller-note.webp', title: 'middle' },
  { id: 'wings-pin', bg: '#74a3be', name: 'Wings Pin', url: 'assets/art/backs/back-wings-pin.webp', title: 'middle' },
  { id: 'sky', bg: '#8bb2c3', name: 'Daylight Seal', url: 'assets/art/backs/back-sky.webp', title: 'middle' },
  { id: 'livery', bg: '#1c3550', name: 'House Livery', url: 'assets/art/backs/back-livery.webp', title: 'middle' }, // Sky Collector's own airline paint scheme (2026-11-15, Sevaan's idea)
  { id: 'golden-age', bg: '#0c1c34', name: 'Golden Age', url: 'assets/art/backs/back-golden-age.webp', title: 'middle' },
  { id: 'wings', bg: '#010e1a', name: 'Pilot Wings', url: 'assets/art/backs/back-wings.webp', title: 'middle' },
  { id: 'altimeter', bg: '#051723', name: 'Altimeter', url: 'assets/art/backs/back-altimeter.webp', title: 'middle' },
  { id: 'sky-blueprint', bg: '#164f86', name: 'Blueprint', url: 'assets/art/backs/back-sky-blueprint.webp', title: 'middle' },
];
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
export const backEarned = () => { try { return new Set(JSON.parse(read('backEarned', '[]'))); } catch { return new Set(); } };
export const backUnlocked = (b) => !!b && (b.free || isPlus() || backEarned().has(b.id));
export const chosenBack = () => read('cardBack', 'flight-plan');
export function chooseBack(id) { try { localStorage.setItem('cardBack', id); } catch {} last = null; next = pick(); preload(next); }
const pool = () => { const c = chosenBack(); if (c === 'random') { const u = CARD_BACKS.filter(backUnlocked); return u.length ? u : [CARD_BACKS[0]]; } const b = CARD_BACKS.find((x) => x.id === c); return [backUnlocked(b) ? b : CARD_BACKS[0]]; };
let last = null;
const pick = () => { const P = pool(); let b; do b = P[Math.floor(Math.random() * P.length)]; while (b === last && P.length > 1); return b; };
const preload = (b) => { const i = new Image(); i.decoding = 'async'; i.src = b.url; };

let next = pick();
preload(next);

// The very next back shown is this one, once (2026-10-24, Sevaan): the catch that earns a back is sealed in it.
let once = null;
export function showBackNext(id) { const b = CARD_BACKS.find((x) => x.id === id); if (!b) return; once = b; preload(b); }
// The back to show now ({ url, title }); queues and preloads the next one (a different one when Random is chosen).
export function nextBack() {
  if (once) { const b = once; once = null; last = b; return b; }
  const P = pool(); const b = P.includes(next) ? next : pick();
  last = b; next = pick(); preload(next);
  return b;
}

// Put a random back on an element (its background), marking where the poster’s title sits.
// o (optional): the card. A card from an album you’ve filled to gold wears that album’s back: the seal framed in the
// album’s colour with its name across the bottom (2026-10-10, playtest #17).
export function applyBack(el, o = null) {
  if (!el) return null;
  const b = nextBack();
  el.style.backgroundImage = `url('${b.url}')`; el.style.backgroundColor = b.bg ?? ''; // the picture's own edge colour fills any margin round it (2026-10-21: the reveal card is a little wider than the pictures)
  el.dataset.title = b.title;
  const set = o?.set && goldAlbums().has(o.set) ? SETS.find((s) => s.id === o.set) : null;
  el.classList.toggle('back--album', !!set);
  if (set) { el.dataset.album = `${set.name} · gold album`; el.style.setProperty('--album', set.color); } else { delete el.dataset.album; }
  return b;
}
