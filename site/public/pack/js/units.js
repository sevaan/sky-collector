// Settings → Units, readable from any page (the Collection is its own page): imperial, metric, or auto by the phone's
// region, the same rule as main.js setUnits (2026-10-22: cards and the Collection follow it too).
// The phone's region is worked out once per language; the setting itself is cheap to read (perf audit 2026-10-29).
const region = new Map();
export function useMiles() {
  let v = 'auto'; try { v = localStorage.getItem('units') || 'auto'; } catch {}
  if (v !== 'auto') return v === 'imperial';
  const l = navigator.language; if (!region.has(l)) { let r = false; try { r = ['US', 'LR', 'MM'].includes(new Intl.Locale(l).maximize().region); } catch {} region.set(l, r); }
  return region.get(l);
}

// Distances and speeds in the player's units (Sky Collector, 2026-11-17). Height stays in feet for everyone: it is how
// aircraft height is given everywhere, and Space Collector's own plane ticket already says "24,800 ft up · 10 km away".
// dist(1234) → { v: '1,234', u: 'km' } or { v: '767', u: 'mi' }; speed(km/h) → { v, u: 'km/h' | 'mph' }.
const fmt = (n) => (n == null || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US'));
export const dist = (km) => (useMiles() ? { v: fmt(km == null ? null : km * 0.621371), u: 'mi' } : { v: fmt(km), u: 'km' });
export const distText = (km) => { const d = dist(km); return `${d.v} ${d.u}`; };
export const speed = (kmh) => (useMiles() ? { v: fmt(kmh == null ? null : kmh * 0.621371), u: 'mph' } : { v: fmt(kmh), u: 'km/h' });
// A round figure for a goal ("more than 3,000 km" → "more than 1,900 mi", not 1,864): two significant figures.
// distIn: a distance as a number in the player's units; distGoal: the same round figure distRound writes, as a number (a
// progress bar under "25,000 mi" counts to 25,000, QA round 5).
export const distIn = (km) => (useMiles() ? km * 0.621371 : km);
export const distGoal = (km) => { if (!useMiles()) return km; const mi = km * 0.621371, step = 10 ** (Math.floor(Math.log10(mi)) - 1); return Math.round(mi / step) * step; };
export const distRound = (km) => `${fmt(distGoal(km))} ${useMiles() ? 'mi' : 'km'}`;
