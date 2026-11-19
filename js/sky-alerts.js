// Heads-up plane alerts in the apps (2026-11-19, playtest idea #1, Sevaan: "do them all"): opt-in (Settings →
// Notifications → Plane alerts, off until you turn it on). Planes can only be foreseen a few minutes ahead, from the feed
// while Sky is open (js/sky-today.js upcoming), so the alert is set when you leave the app: one plane that would give
// you a new card, or a rare visitor, coming over in the next 15 minutes, told 2 minutes before. A regular flight you
// don't have yet (js/sky-regulars.js) can be told a few minutes before its usual time. Rate-limited: at most 3 a day,
// 30 minutes apart, never in quiet hours. Space Collector's notifyAt does the rest (js/native.js). No DOM here.
export const MAX_A_DAY = 3, MIN_GAP = 30 * 60e3, LEAD = 2 * 60e3, SOONEST = 3 * 60e3, HORIZON = 15 * 60e3;
const dayKey = (t) => new Date(t).toDateString();
// log: [ms of alerts already set]. True when one more may be set for time t.
export function allowed(log, t) {
  const day = (log ?? []).filter((x) => dayKey(x) === dayKey(t));
  return day.length < MAX_A_DAY && (log ?? []).every((x) => Math.abs(t - x) >= MIN_GAP);
}
// cands: [{ arrive (ms over you), name, dir, rare, isNew }]. The one to tell about, with its words, or null.
export function pickAlert(cands, log, now, inQuiet = () => false) {
  const ok = (cands ?? []).filter((c) => (c.rare || c.isNew) && c.arrive - LEAD - now >= SOONEST - LEAD && c.arrive - now <= HORIZON)
    .map((c) => ({ ...c, at: Math.max(now + 60e3, c.arrive - LEAD) }))
    .filter((c) => !inQuiet(c.at) && allowed(log, c.at))
    .sort((a, b) => Number(b.rare) - Number(a.rare) || a.arrive - b.arrive);
  const c = ok[0]; if (!c) return null;
  /* a clock time, not "in N min": Android delivers inside a window and may be a few minutes early (js/native.js notifyAt) */
  const clock = new Date(c.arrive).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const kind = c.rare ? c.typeName || c.name : c.name, art = /^[AEIOU]/i.test(kind) ? 'An' : 'A', flight = c.rare && c.typeName && c.name !== c.typeName ? ` (${c.name})` : '';
  return { at: c.at, title: c.rare ? `Rare visitor: ${art.toLowerCase()} ${kind}` : `${c.name} is coming over`, body: `${c.rare ? `${art} ${kind}${flight}` : 'It'} will be over you about ${clock}, to the ${c.dir}.${c.isNew ? ' A new card for your collection.' : ''}` };
}
// A regular you don't have yet ([{ callsign, minute, next, name }]): told 5 minutes before its usual time.
export function pickRegular(regs, log, now, inQuiet = () => false) {
  for (const r of (regs ?? []).slice().sort((a, b) => a.next - b.next)) {
    const at = r.next - 5 * 60e3; if (at - now < SOONEST || at - now > 20 * 3600e3 || inQuiet(at) || !allowed(log, at)) continue;
    return { at, title: `${r.name} usually comes over soon`, body: `It's usually over you about ${r.clock}, and it isn't in your collection yet.` };
  }
  return null;
}
