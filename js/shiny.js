// Shiny captures: a rare variant earned when something special is happening in the real sky as you
// collect. Decided once, at the moment of the sighting (js/main.js recordSighting), and saved on it.
// No DOM.
export const SHINY = {
  eclipse: { label: 'Caught the fade', line: 'You caught it just as it slipped into Earth’s shadow.' },
  moon: { label: 'Moon crossing', line: 'Caught right beside the Moon.' },
  overhead: { label: 'Straight overhead', line: 'Caught passing almost straight overhead.' },
  fresh: { label: 'Fresh from launch', line: 'Caught within a month of its launch.' },
  fullmoon: { label: 'Full Moon', line: 'Collected under a full Moon.' },
  /* Sky Collector's plane moments (2026-11-19, review Part 2 E): real, rare, decided at the catch */
  golden: { label: 'Golden hour', line: 'Your first catch with the sun right on the horizon.' },
  colours: { label: 'New colours', line: 'Your first of this rare type in this airline’s colours.' },
};
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI;

// obj: the object; look: its look now ({ el, enu, sunlit, illum }); later: its look ~45 s from now (or null);
// moon: { enu, illum } or null; at: Date of the sighting. Returns a SHINY key or null.
export function shinyFor(obj, look, later, moon, at) {
  if (!look) return null;
  if (obj.type === 'moon') return look.illum >= 0.98 ? 'fullmoon' : null;
  const enu = look.enu;
  if (moon && enu && angle(enu, moon.enu) < (obj.natural ? 5 : 1)) return 'moon';
  if (obj.natural) return null;
  if (obj.family) return null; // mega-constellation members: one Starlink in shadow doesn’t make the whole fleet card shiny (2026-10-08, Sevaan)
  if (look.sunlit && later && !later.sunlit && later.el >= 0) return 'eclipse'; // still above the horizon: a satellite that sets isn't a fade (audit 2026-11-03)
  if (look.el >= 86) return 'overhead'; // was 80° (2026-10-12: too common)
  if (obj.launch && at - Date.parse(`${obj.launch}T00:00:00Z`) < 30 * 86400e3) return 'fresh';
  return null;
}

// A plane catch's shiny moment (Sky Collector, 2026-11-19), the same discipline as a satellite's: only something real
// and rare at that moment, no dice. planeEnu: where the plane is; moon: { enu } or null; sunEl: the sun's height (°);
// tier: the plane card's tier; newColours: the first of this type in this airline's colours (js/sky-stamps.js newLivery).
// The Moon first (within 1°, Space's own rule), then the sun on the horizon (between 1° below and 2° above: about ten
// minutes at dusk and dawn), then new colours on a Rare or rarer type only (on an A320 that's every other airline).
/* Golden hour is the first catch of the window only (2026-11-25, Sevaan: "Rarer"): every catch in a daily 20-minute window
   came out shiny, so a shiny was routine. goldenDone: a golden shiny already caught in this window (js/main.js goldenDone). */
export const GOLDEN_GAP_MS = 3 * 3600e3; /* dawn and dusk windows are far more than 3 hours apart */
export const goldenDone = (sightings, now = Date.now()) => (sightings ?? []).some((s) => s.shiny === 'golden' && !s.sim && now - (s.time ?? 0) < GOLDEN_GAP_MS);
export function shinyForPlane({ planeEnu = null, moon = null, sunEl = null, tier = 'common', newColours = false, goldenDone = false } = {}) {
  if (moon?.enu && planeEnu && angle(planeEnu, moon.enu) < 1) return 'moon';
  if (!goldenDone && Number.isFinite(sunEl) && sunEl >= -1 && sunEl <= 2) return 'golden';
  if (newColours && ['rare', 'epic', 'legendary'].includes(tier)) return 'colours';
  return null;
}
