// What counts as "up" in Sky Collector, in one place (2026-11-20: the radar said "1 overhead" while Today said "Quiet
// sky"; the radar counted every plane above 0°, the look-down map 2°, Today 5°). The radar's "N overhead", the map at
// your feet and Today's Up now / Quiet sky all use this, so they always agree.
// positions: PlaneTracker.positions(obs) ([{ plane, az, el, rangeKm }]): planes the feed still has, above the horizon.
// Up means clear of trees and roofs ("Nothing above the trees right now"): more than UP_MIN_EL degrees up.
// Pure, no DOM (tests/sky-up.test.mjs).
export const UP_MIN_EL = 5;
export const isUp = (a) => !!a?.plane && a.az != null && Number.isFinite(a.el) && a.el > UP_MIN_EL;
export const planesUp = (positions) => (positions ?? []).filter(isUp);
// The first catch's wait (main.js skyFirstWait): the plane to steer to once one is up. One with room to line up (8° to
// 75°, the nearest) first, else the nearest that's up at all; null while nothing is up, so "No planes over you right now"
// stays only while it's true (Sky Build playtest v0.1.1809: it stayed 9 s with a catchable plane overhead).
export const firstUp = (positions) => { const up = planesUp(positions), byRange = (a, b) => (a.rangeKm ?? Infinity) - (b.rangeKm ?? Infinity);
  return up.filter((a) => a.el >= 8 && a.el <= 75).sort(byRange)[0] ?? up.slice().sort(byRange)[0] ?? null; };
