// What counts as "up" in Sky Collector, in one place (2026-11-20: the radar said "1 overhead" while Today said "Quiet
// sky"; the radar counted every plane above 0°, the look-down map 2°, Today 5°). The radar's "N overhead", the map at
// your feet and Today's Up now / Quiet sky all use this, so they always agree.
// positions: PlaneTracker.positions(obs) ([{ plane, az, el, rangeKm }]): planes the feed still has, above the horizon.
// Up means clear of trees and roofs ("Nothing above the trees right now"): more than UP_MIN_EL degrees up.
// Pure, no DOM (tests/sky-up.test.mjs).
export const UP_MIN_EL = 5;
export const isUp = (a) => !!a?.plane && a.az != null && Number.isFinite(a.el) && a.el > UP_MIN_EL;
export const planesUp = (positions) => (positions ?? []).filter(isUp);
