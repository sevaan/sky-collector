// Daily usage totals (2026-11-20, ported from Space Collector's functions/daily.js, 5f591d4b; Sevaan: keep daily totals
// forever, delete raw usage rows after 90 days). One doc per Toronto day in Firestore 'sky_daily'. No install ids
// anywhere: distinct counts that can't be added up later ("installs since launch", return rates) are kept as counts on
// the install's FIRST day (its cohort). Test installs are left out exactly as on the stats page (prep in stats-page.js).
//
// A day's doc is rewritten on every stats render while the day is inside the raw window (the last 90 days), so a phone
// flagged as a test later drops out of its past days; once the day leaves the window it is marked final and never
// written again, and the page reads it from here. Writing the same day twice gives the same doc (set by day id).
// Sky: days, not nights (firstDay, days1/2/3/7: caught on at least N different days); per-platform cohorts at the top
// level (byPlatform.ios / .android; the website is always a test); a 'final' flag.
import { prep, dayNum, numOf, dayOf } from './stats-page.js';

export const WINDOW_DAYS = 90; /* Sevaan 2026-11-20: raw usage notes are kept 90 days (Space 1c595988) */
// The first whole day the raw rows cover when they are read from `at - 90 days`: earlier days come from sky_daily.
export const windowStart = (at) => dayNum(dayOf(at - WINDOW_DAYS * 86400e3)) + 1;

const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const blank = () => ({ installs: 0, played: 0, firstDay: 0, back1: 0, back7: 0, back28: 0, days1: 0, days2: 0, days3: 0, days7: 0 });

// rows: raw usage rows (as stored). Returns { [YYYY-MM-DD]: doc } for every day from the first counted row (on or after
// `from`) to yesterday. Every doc returned is inside the window, so final is false; the server sets it when a day leaves.
export function dailyDocs(rows, { now = Date.now(), from = null } = {}) {
  const { ev, installs, today } = prep(rows, { now, from });
  const days = new Map();
  const day = (d) => { let x = days.get(d); if (!x) days.set(d, (x = { iids: new Set(), catchers: new Set(), buyers: new Set(), catches: 0, newCards: new Set(), events: {}, tiers: {} })); return x; };
  for (const e of ev) {
    if (e.day >= today) continue;
    const x = day(e.day); x.iids.add(e.iid); x.events[e.name] = (x.events[e.name] ?? 0) + 1;
    if (e.name === 'catch') { x.catches++; x.catchers.add(e.iid); if (e.d.n === 1) { x.newCards.add(`${e.ts}${e.iid}`); if (TIERS.includes(e.d.t)) x.tiers[e.d.t] = (x.tiers[e.d.t] ?? 0) + 1; } }
    if (e.name === 'plus' && e.d.s === 'buy') x.buyers.add(e.iid);
  }
  // a player that day: an install that wasn't a throwaway run (the page's rule: played !== false)
  const played = new Map(installs.map((p) => [p.iid, p.played]));
  const fc = new Map(); for (const e of ev) if (e.name === 'catch' && !fc.has(e.iid)) fc.set(e.iid, e.ts);
  const out = {};
  for (const d of [...days.keys()].sort((a, b) => a - b)) {
    const x = days.get(d), cohort = { ...blank(), firstMs: [] }, byPlatform = { ios: blank(), android: blank() };
    for (const p of installs.filter((q) => q.iday === d)) {
      for (const c of [cohort, byPlatform[p.p]]) {
        if (!c) continue;
        c.installs++;
        if (p.played) { c.played++; if (p.firstNight) c.firstDay++; for (const k of [1, 7, 28]) if (p.back(k)) c[`back${k}`]++; }
        for (const k of [1, 2, 3, 7]) if (p.nights.size >= k) c[`days${k}`]++; /* p.nights: the days it caught something (Sky's nightOf is the calendar day) */
      }
      const f = fc.get(p.iid); if (f >= p.install) cohort.firstMs.push(f - p.install);
    }
    cohort.firstMs.sort((a, b) => a - b);
    out[numOf(d)] = {
      day: numOf(d), v: 1, final: false,
      players: [...x.iids].filter((i) => played.get(i) !== false).length,
      installs: cohort.installs, installsPlayed: cohort.played,
      caught: x.catchers.size,
      catches: x.catches, newCards: x.newCards.size, plusBuys: x.buyers.size,
      byPlatform, events: x.events, tiers: x.tiers, cohort,
    };
  }
  return out;
}
