// Option (a) for Android pointing (2026-11-18, proposed, NOT used by the app yet: Sevaan sees the findings first).
// Today Android draws the sky straight from deviceorientationabsolute (the rotation vector, which includes the
// magnetometer), so a disturbed or uncalibrated magnetometer swings the sky at once: a tester pointing south saw west.
// Proposed: draw from the relative stream (game rotation vector: gyro + accelerometer, smooth, no magnetometer) and
// learn only the HEADING OFFSET (absolute azimuth − relative azimuth) from the absolute stream, with the iPhone's rules:
// learn while the phone is upright, ignore a sudden big disagreement unless it lasts and the phone is moving, follow
// small differences slowly (the gyro drifts a little). Pure: no DOM, no clocks; js/sensors.js would call it per event.
// Tests: tests/heading-fuse.test.mjs. Shared with Sky Collector.

export const FUSE = {
  jumpDeg: 30,     // a disagreement bigger than this is a "jump": only taken if it lasts
  holdMs: 1500,    // how long a jump must last before it's believed
  moveDps: 6,      // ...and the phone must be turning at least this fast (a correction hides in your own motion)
  follow: 0.02,    // small differences: share taken per event (gyro drift)
  quietDeg: 2.5,   // differences under this are ignored when steady
  earlyMs: 8000,   // the first seconds: follow the compass closely (it's just woken up)
};

const wrap = (d) => ((d % 360) + 540) % 360 - 180;
const blend = (prev, next, k) => (prev + wrap(next - prev) * k + 360) % 360;

export const freshFuse = () => ({ offset: null, since: 0, jumpSince: 0, jumpTo: null, n: 0 });

/** One pair of readings. s: the state (freshFuse()). m: { t (ms), relAz, absAz (camera azimuths, °), upright (bool),
 *  dps (turn rate, °/s) }. Returns the new state; s.offset is what to add to the relative azimuth to get north. */
export function fuseStep(s, m, cfg = FUSE) {
  const st = { ...s }, measured = (m.absAz - m.relAz + 360) % 360;
  if (st.offset == null) { if (!m.upright) return st; st.offset = measured; st.since = m.t; st.n = 1; return st; }
  if (!m.upright) { st.jumpSince = 0; st.jumpTo = null; return st; } /* pointing high or flat: azimuth is unreliable, hold */
  const diff = Math.abs(wrap(measured - st.offset)); st.n++;
  if (m.t - st.since < cfg.earlyMs) { st.offset = diff > 8 ? measured : blend(st.offset, measured, 0.2); return st; }
  if (diff > cfg.jumpDeg) {
    if (!st.jumpSince || st.jumpTo == null || Math.abs(wrap(measured - st.jumpTo)) > cfg.jumpDeg) { st.jumpSince = m.t; st.jumpTo = measured; return st; } /* a new jump starts */
    st.jumpTo = blend(st.jumpTo, measured, 0.2);
    if (m.t - st.jumpSince >= cfg.holdMs && m.dps >= cfg.moveDps) { st.offset = st.jumpTo; st.jumpSince = 0; st.jumpTo = null; }
    return st;
  }
  st.jumpSince = 0; st.jumpTo = null;
  if (diff < cfg.quietDeg || m.dps < cfg.moveDps) return st; /* still, or tiny: the sky stays put */
  st.offset = blend(st.offset, measured, cfg.follow);
  return st;
}
