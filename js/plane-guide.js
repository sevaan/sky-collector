// The plane Show me is steering you to (main.js state.planeGuide: { hex, name, lostAt, wait }), when to let go of it.
// Pure, no DOM (tests/plane-guide.test.mjs).
//
// Space Collector's rule (its main.js letGoOf, 2026-10-18): once you've collected what you were steered to, let go of it,
// so the circle goes back to naming whatever is in it. Sky's capture skipped it (2026-11-20, Sevaan: "caught the plane but
// the plane is still selected"): the turn hint, the edge arrow, the radar ring and the name stayed on a plane already caught.
// A plane catch saves its flight and plane cards together (main.js capturePlane), so this runs once, after both are saved.
export function letGoAfterCatch(guide, caughtHex) {
  return guide && caughtHex != null && guide.hex === caughtHex ? null : guide;
}

// A plane gone from the feed or below the horizon (not in the positions list) is let go of after LOST_MS, so the arrow
// never points at nothing (Space lets a set satellite go after a minute; planes after 5 s, 2026-11-19, Sevaan). Back
// in time: the clock restarts. Returns the guide to keep, or null. Mutates guide.lostAt.
export const LOST_MS = 5000;
export function keepWhileUp(guide, present, t, ms = LOST_MS) {
  if (!guide) return null;
  if (present) { guide.lostAt = null; return guide; }
  guide.lostAt ??= t;
  return t - guide.lostAt > ms ? null : guide;
}
