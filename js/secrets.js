// More secrets (2026-10-08, design/easter-eggs.html): Santa’s sleigh, Starman’s Roadster, a shooting star, Voyager’s
// golden record and Dizzy. None is mentioned anywhere; each earns a secret patch. Found ones: localStorage 'secrets'.
export const SECRET_PATCHES = {
  // Not a secret: the Plus Member patch (2026-10-16, Sevaan), earned by joining Plus and kept on the wall if Plus ends.
  plus: { id: 'plus', name: 'Plus Member', text: 'You joined Space Collector Plus. Thank you for supporting the game.' },
  santa: { id: 'santa', name: 'Nice List', text: 'You waved at Santa on Christmas Eve.' },
  roadster: { id: 'roadster', name: "Don’t Panic", text: 'You found Starman and his Roadster, still driving round the Sun.' },
  meteor: { id: 'meteor', name: 'Make a Wish', text: 'You caught a shooting star.' },
  voyager: { id: 'voyager', name: 'Pale Blue Dot', text: 'You found Voyager 1 and its golden record, nearly 26 billion km away.' },
  dizzy: { id: 'dizzy', name: 'Dizzy', text: 'Three full turns. The compass needs a sit-down.' },
  // Deep-space probes and a famous signal (2026-10-09, Sevaan): fixed spots among the stars, invisible until one is in
  // your circle, so you stumble on them. Directions from JPL Horizons, Oct 2026 (they drift less than 0.1° a year).
  voyager2: { id: 'voyager2', name: 'Grand Tour', text: 'You found Voyager 2, the only probe to visit Uranus and Neptune. It carries a golden record too.' },
  pioneer10: { id: 'pioneer10', name: 'The Plaque', text: 'You found Pioneer 10 and its plaque: a drawing of us, and a map to the Sun.' },
  pioneer11: { id: 'pioneer11', name: 'Ringside', text: 'You found Pioneer 11, the first visitor to Saturn. It went quiet in 1995 and keeps coasting outward.' },
  newhorizons: { id: 'newhorizons', name: 'Heart of Pluto', text: 'You found New Horizons, which flew past Pluto in 2015 and kept going.' },
  wow: { id: 'wow', name: 'Wow!', text: 'You aimed where the 1977 Wow! signal came from. It has never been heard again.' },
  // The Pillars of Creation (2026-11-05, Sevaan): in the Eagle Nebula (M16), Serpens. Low in the south on summer evenings.
  // Four more (2026-11-05, Sevaan), one for most seasons; the Deep Field never sets from Canada.
  hdf: { id: 'hdf', name: 'Hubble Deep Field', text: 'You aimed at the Hubble Deep Field: a speck of sky that holds thousands of galaxies.' },
  m87bh: { id: 'm87bh', name: 'First Black Hole Photo', text: 'You aimed at M87, home of the first black hole ever photographed.' },
  crab: { id: 'crab', name: 'The Crab Nebula', text: 'You aimed at the Crab Nebula, what is left of a star seen exploding in 1054.' },
  kepler: { id: 'kepler', name: 'Kepler’s Field', text: 'You aimed at the patch of sky the Kepler telescope watched for planets.' },
  pillars: { id: 'pillars', name: 'Pillars of Creation', text: 'You aimed at the Pillars of Creation in the Eagle Nebula, where new stars are forming.' },
  // Story secrets (2026-10-14, js/stories.js): each also gives a story card.
  arecibo: { id: 'arecibo', name: 'Hello From Earth', text: 'You found where the 1974 Arecibo message is heading: the Hercules Cluster.' },
  halley: { id: 'halley', name: 'Way Home', text: 'You found Halley’s Comet, far out and falling back towards the Sun. Due in 2061.' },
  sputnik: { id: 'sputnik', name: 'Beep-Beep', text: 'You heard Sputnik on the anniversary of its launch, 4 October 1957.' },
  laika: { id: 'laika', name: 'Good Dog', text: 'You remembered Laika on the anniversary of Sputnik 2, 3 November 1957.' },
  apollo11: { id: 'apollo11', name: 'One Small Step', text: 'You looked at the Moon on 20 July, the day people first landed on it.' },
  twohomes: { id: 'twohomes', name: 'Two Homes', text: 'You caught the ISS and Tiangong within ten minutes of each other.' },
  // Halloween (2026-10-25, Sevaan; design/come-back.html 05): one night a year a long-dead satellite haunts the sky. A new
  // patch each year (next year can be a different ghost).
  ghost2026: { id: 'ghost2026', name: 'Ghost Satellite', text: 'You caught a dead satellite on Halloween 2026: silent for years, and still going round.' },
};
for (const p of Object.values(SECRET_PATCHES)) { p.secret = true; p.icon = ''; }
// Secrets that give a story card (js/stories.js) give no patch (2026-10-14, Sevaan). Patches already earned before this
// change are kept: a found time before STORY_PATCH_CUTOFF still shows on the wall.
export const STORY_SECRETS = new Set(['hdf', 'm87bh', 'crab', 'kepler', 'pillars', 'wow', 'voyager', 'voyager2', 'pioneer10', 'pioneer11', 'newhorizons', 'roadster', 'arecibo', 'halley', 'sputnik', 'laika', 'apollo11', 'twohomes']);
export const STORY_PATCH_CUTOFF = 1792031581700;
export const hasPatch = (id, foundAt) => !STORY_SECRETS.has(id) || (foundAt != null && foundAt < STORY_PATCH_CUTOFF);
export function found() { try { return JSON.parse(localStorage.getItem('secrets')) || {}; } catch { return {}; } }
export function markFound(id) { const f = found(); f[id] ??= Date.now(); try { localStorage.setItem('secrets', JSON.stringify(f)); } catch {} }

// Santa: Christmas Eve night only, a two-minute crossing at the start of every 20 minutes.
let santaForced = null;
export function santa(t) {
  if (santaForced && t < santaForced.end) return santaForced;
  const d = new Date(t); if (!(d.getMonth() === 11 && (d.getDate() === 24 || (d.getDate() === 25 && d.getHours() < 6)))) return null;
  const start = Math.floor(t / 1200e3) * 1200e3; if (t > start + 120e3) return null;
  return { start, end: start + 120e3, az0: (start / 1200e3 * 73) % 360 };
}
export function summonSanta(t) { santaForced = { start: t, end: t + 120e3, az0: Math.random() * 360 }; }
export const santaWhere = (f, t) => { const k = (t - f.start) / (f.end - f.start); return { az: (f.az0 + 160 * k) % 360, el: 8 + 42 * Math.sin(Math.PI * k) }; };

// Shooting star: during a meteor shower, every few minutes while you’re looking up, one streaks through near the circle.
let nextMeteor = 0, meteor = null;
export function meteorAt(t, active, aimAz, aimEl) {
  if (meteor && t < meteor.end + 400) return meteor;
  meteor = null;
  if (!active) return null;
  if (!nextMeteor) nextMeteor = t + (60 + Math.random() * 120) * 1000;
  if (t < nextMeteor) return null;
  nextMeteor = t + (180 + Math.random() * 300) * 1000;
  const ang = Math.random() * Math.PI * 2, off = Math.random() * 3; // passes within 3° of where you’re aiming
  const cAz = aimAz + Math.cos(ang) * off, cEl = aimEl + Math.sin(ang) * off, dir = Math.random() * Math.PI * 2;
  return (meteor = { start: t, end: t + 700, from: [cAz - Math.cos(dir) * 9, cEl - Math.sin(dir) * 9], to: [cAz + Math.cos(dir) * 5, cEl + Math.sin(dir) * 5] });
}
export function summonMeteor() { nextMeteor = 1; meteor = null; }

// Voyager 1: RA 17h13m, Dec +12° (it barely moves).
export const VOYAGER = { ra: 258.2, dec: 12.1 };
// The other deep-space spots: [id, ra°, dec°, title, sub line, colour].
export const DEEP = [
  ['voyager2', 302.41, -59.72, 'Voyager 2', 'Grand Tour · 144 AU out', '#e2b53c'],
  ['pioneer10', 79.53, 26.09, 'Pioneer 10', 'The plaque · 142 AU out', '#e2b53c'],
  ['pioneer11', 283.97, -8.91, 'Pioneer 11', 'First to Saturn · drifting outward', '#e2b53c'],
  ['newhorizons', 288.84, -20.29, 'New Horizons', 'Past Pluto · 66 AU out', '#8fd0ff'],
  ['wow', 291.8, -27.0, 'Wow!', 'Big Ear radio telescope · 15 Aug 1977', '#ff6b6b'],
  ['arecibo', 250.42, 36.46, 'Hello from Earth', 'Arecibo message · sent 1974', '#3fc7b5'], // the Hercules Cluster (M13), where the message is going
  ['halley', 124.0, 1.5, "Halley’s Comet", 'Heading home · due 2061', '#8fd0ff'],
  ['hdf', 189.21, 62.22, 'Hubble Deep Field', 'Ursa Major · about 3,000 galaxies', '#9fc4ff'], // RA 12h 36.8m, Dec +62° 13′; never sets from Canada
  ['m87bh', 187.71, 12.39, 'M87*', 'First black hole photo · 55 million light-years', '#ff9a3c'], // RA 12h 30.8m, Dec +12° 23′ (Virgo)
  ['crab', 83.63, 22.01, 'Crab Nebula', 'Supernova of 1054 · Taurus', '#7fd6c9'], // M1: RA 5h 34.5m, Dec +22° 01′
  ['kepler', 290.67, 44.50, 'Kepler’s field', 'Cygnus and Lyra · 150,000 stars watched', '#ffd27a'], // centre of the field: RA 19h 22.7m, Dec +44° 30′
  ['pillars', 274.70, -13.82, 'Pillars of Creation', 'Eagle Nebula · about 6,500 light-years', '#c9a4ff'], // M16 in Serpens: RA 18h 18.8m, Dec −13° 49′ // in Hydra, near the far end of its orbit (2026)
];
// Anniversary crossings (2026-10-14): Sputnik on 4 October, Sputnik 2 (Laika) on 3 November. That evening and night, a
// ghost crosses for two minutes at the start of every 20 (like Santa). Tap it.
export const DATED = [['sputnik', 9, 4, 'Sputnik 1', 'Beep · beep · 4 Oct 1957', '#e8e3c8', 'Tap to listen'], ['laika', 10, 3, 'Sputnik 2', 'Laika · 3 Nov 1957', '#ffc93d', 'Tap to remember']];
export function datedCrossing(t, month, day, seed) {
  const d = new Date(t), y = new Date(t - 6 * 3600e3); // the night counts until 6 am
  if (!((d.getMonth() === month && d.getDate() === day) || (y.getMonth() === month && y.getDate() === day && d.getHours() < 6))) return null;
  const start = Math.floor(t / 1200e3) * 1200e3; if (t > start + 120e3) return null;
  return { start, end: start + 120e3, az0: (start / 1200e3 * 61 + seed) % 360 };
}

// Dizzy: three full turns (1,080°) within 30 seconds.
// A running sum (perf pass 2026-11-10: re-adding up to 30 s of samples every frame was ~8% of the sky's script), and a
// still phone adds nothing.
const turns = [];
let lastHeading = null, sum = 0, head = 0;
export function dizzyStep(t, heading) {
  if (lastHeading != null) { const dh = ((heading - lastHeading + 540) % 360) - 180; if (Math.abs(dh) < 40 && dh !== 0) { turns.push([t, dh]); sum += dh; } }
  lastHeading = heading;
  while (head < turns.length && t - turns[head][0] > 30000) sum -= turns[head++][1];
  if (head > 512) { turns.splice(0, head); head = 0; }
  if (Math.abs(sum) >= 1080) { turns.length = 0; head = 0; sum = 0; return true; }
  return false;
}
