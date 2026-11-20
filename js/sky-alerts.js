// Heads-up plane alerts in the apps (2026-11-19, playtest idea #1, Sevaan: "do them all"): opt-in (Settings →
// Notifications → Plane alerts, off until you turn it on). Planes can only be foreseen a few minutes ahead, from the feed
// while Sky is open (js/sky-today.js upcoming), so the alert is set when you leave the app: one plane that would give
// you a new card, or a rare visitor, coming over in the next 10 minutes on a steady course (sure), told 2 minutes before. A regular flight you
// don't have yet (js/sky-regulars.js) can be told a few minutes before its usual time. Rate-limited: at most 3 a day,
// 30 minutes apart, never in quiet hours. Space Collector's notifyAt does the rest (js/native.js). No DOM here.
export const MAX_A_DAY = 3, MIN_GAP = 30 * 60e3, LEAD = 2 * 60e3, SOONEST = 3 * 60e3, HORIZON = 10 * 60e3;
/* Only planes whose straight-line forecast is likely to hold (Sky Tester 2026-11-20, Sevaan: a rare Airbus alert, and
   tapping it said the plane had gone out of range). upcoming() carries each plane along its track and climb rate for up to
   15 minutes, but the feed reaches ~75 km, so a cruising jet heading at you is over you in about 2.5 min: the planes that
   could be 3+ minutes out were mostly slow and low, near an airport, climbing out or coming down to land, which turn and
   level off. Told only for one that is level, fast, not turning, from a fresh fix, coming well up in your sky (peak 25°+,
   above 15° for a minute or more), and at most 10 minutes out. n: an upcoming() row { p, inS, peakEl, upS }; t: now. */
export const FIX_MAX_AGE = 90e3, SURE = { minKt: 120, minFt: 5000, maxClimb: 1000, maxTurn: 0.5, minPeak: 25, minUpS: 60 };
export function sure(n, t) {
  const p = n?.p; if (!p || !Number.isFinite(p.at) || t - p.at > FIX_MAX_AGE) return false;
  if (!(n.inS * 1000 <= HORIZON)) return false;
  if (p.heli || (p.gs ?? 0) < SURE.minKt || (p.altFt ?? 0) < SURE.minFt) return false; /* hovering, circling, taking off, landing */
  if (!p.climbKnown || Math.abs(p.climb ?? 0) > SURE.maxClimb) return false; /* climbing out or coming down: it levels off or lands */
  if (!Number.isFinite(p.turn) || Math.abs(p.turn) > SURE.maxTurn) return false; /* turning, or seen only once (can't tell yet) */
  return (n.peakEl ?? 0) >= SURE.minPeak && (n.upS ?? 0) >= SURE.minUpS;
}
const dayKey = (t) => new Date(t).toDateString();
// log: [ms of alerts already set]. True when one more may be set for time t.
export function allowed(log, t) {
  const day = (log ?? []).filter((x) => dayKey(x) === dayKey(t));
  return day.length < MAX_A_DAY && (log ?? []).every((x) => Math.abs(t - x) >= MIN_GAP);
}
// cands: [{ arrive (ms over you), name, dir, rare, isNew, sure }]. The one to tell about, with its words, or null. Only
// sure ones (sure() above): a notification that turns out wrong is worse than none.
export function pickAlert(cands, log, now, inQuiet = () => false) {
  const ok = (cands ?? []).filter((c) => c.sure && (c.rare || c.isNew) && c.arrive - LEAD - now >= SOONEST - LEAD && c.arrive - now <= HORIZON)
    .map((c) => ({ ...c, at: Math.max(now + 60e3, c.arrive - LEAD) }))
    .filter((c) => !inQuiet(c.at) && allowed(log, c.at))
    .sort((a, b) => Number(b.rare) - Number(a.rare) || a.arrive - b.arrive);
  const c = ok[0]; if (!c) return null;
  /* a clock time, not "in N min": Android delivers inside a window and may be a few minutes early (js/native.js notifyAt) */
  const clock = new Date(c.arrive).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const kind = c.rare ? c.typeName || c.name : c.name, art = /^[AEIOU]/i.test(kind) ? 'An' : 'A', flight = c.rare && c.typeName && c.name !== c.typeName ? ` (${c.name})` : '';
  return { at: c.at, title: c.rare ? `Rare visitor: ${art.toLowerCase()} ${kind}` : `${c.name} is coming over`, body: `${c.rare ? `${art} ${kind}${flight}` : 'It'} should be over you about ${clock}, to the ${c.dir}, if it keeps its course.${c.isNew ? ' A new card for your collection.' : ''}` };
}
// A regular you don't have yet ([{ callsign, minute, next, name }]): told 5 minutes before its usual time.
export function pickRegular(regs, log, now, inQuiet = () => false) {
  for (const r of (regs ?? []).slice().sort((a, b) => a.next - b.next)) {
    const at = r.next - 5 * 60e3; if (at - now < SOONEST || at - now > 20 * 3600e3 || inQuiet(at) || !allowed(log, at)) continue;
    return { at, title: `${r.name} usually comes over soon`, body: `It's usually over you about ${r.clock}, and it isn't in your collection yet.` };
  }
  return null;
}
