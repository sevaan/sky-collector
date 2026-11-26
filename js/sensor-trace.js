// A compass trace a tester can send (2026-11-18: two Android testers said the app thought they pointed west while they
// pointed south). Records both orientation streams side by side for a while, as they arrive, with what the app made of
// them, so we stop guessing: Settings → Testing tools → "Record a compass trace" (7 taps on the version line unlock
// them in a store build). Nothing leaves the phone until the tester shares the file. No DOM besides the listeners.
// Shared with Sky Collector (no app-specific imports).
//
// Each row: [ms since start, stream, alpha, beta, gamma, extra]
//   stream 'A' = deviceorientationabsolute (Android: rotation vector, gyro + accelerometer + magnetometer)
//   stream 'R' = deviceorientation (Android: game rotation vector, no magnetometer; iPhone: relative + webkitCompassHeading)
//   extra: iPhone { h: webkitCompassHeading, acc: webkitCompassAccuracy }, else the event's absolute flag
// Plus a sample of what the app used every 100 ms: ['S', source, heading of the view (°), offset (°), nudge (°)].

const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

/** Records for `seconds`, then resolves the trace (an object ready for JSON). onTick(secondsLeft) for a countdown.
 *  sample(): what the app is using now, { source, heading, offset, nudge } (optional). */
export function recordTrace(seconds = 30, { sample, onTick } = {}) {
  return new Promise((resolve) => {
    const t0 = performance.now(), rows = [], counts = { A: 0, R: 0 };
    const at = () => Math.round(performance.now() - t0);
    const onA = (e) => { counts.A++; rows.push([at(), 'A', r1(e.alpha), r1(e.beta), r1(e.gamma), e.absolute === true ? 1 : 0]); };
    const onR = (e) => {
      counts.R++;
      const extra = typeof e.webkitCompassHeading === 'number' ? { h: r1(e.webkitCompassHeading), acc: r1(e.webkitCompassAccuracy) } : (e.absolute === true ? 1 : 0);
      rows.push([at(), 'R', r1(e.alpha), r1(e.beta), r1(e.gamma), extra]);
    };
    addEventListener('deviceorientationabsolute', onA); addEventListener('deviceorientation', onR);
    const tick = setInterval(() => {
      try { const s = sample?.(); if (s) rows.push([at(), 'S', s.source, r1(s.heading), r1(s.offset), r1(s.nudge)]); } catch {}
    }, 100);
    const count = setInterval(() => onTick?.(Math.max(0, Math.ceil(seconds - (performance.now() - t0) / 1000))), 1000);
    setTimeout(() => {
      removeEventListener('deviceorientationabsolute', onA); removeEventListener('deviceorientation', onR); clearInterval(tick); clearInterval(count);
      resolve({
        kind: 'compass-trace', v: 1, at: new Date().toISOString(), seconds,
        ua: navigator.userAgent, screen: { w: screen.width, h: screen.height, angle: screen.orientation?.angle ?? window.orientation ?? 0 },
        counts, rows,
      });
    }, seconds * 1000);
  });
}

/** A one-line summary for the Settings row: how many of each stream arrived, and how far the absolute heading wandered
 *  against the relative one (the thing a magnetometer glitch would show). */
export function traceSummary(tr) {
  const az = (a, b, g) => { /* the camera's azimuth from W3C Euler angles (same frame as js/sensors.js basisFromEuler) */
    const R = Math.PI / 180, cA = Math.cos(a * R), sA = Math.sin(a * R), cB = Math.cos(b * R), sB = Math.sin(b * R), cG = Math.cos(g * R), sG = Math.sin(g * R);
    const x = -(cA * sG + cG * sA * sB), y = -(sA * sG - cA * cG * sB); return (Math.atan2(x, y) / R + 360) % 360;
  };
  let lastR = null, min = Infinity, max = -Infinity, n = 0, d0 = null; /* each difference measured from the first, so a wander across ±180° isn't counted as a full turn */
  for (const r of tr.rows) {
    if (r[1] === 'R' && r[2] != null) lastR = az(r[2], r[3], r[4]);
    else if (r[1] === 'A' && r[2] != null && lastR != null) { const raw = az(r[2], r[3], r[4]) - lastR; if (d0 == null) d0 = raw; const d = ((raw - d0 + 540) % 360) - 180; if (d < min) min = d; if (d > max) max = d; n++; }
  }
  const spread = n ? Math.round(max - min) : null;
  return `${tr.counts.A} absolute, ${tr.counts.R} relative${spread != null ? ` · compass wandered ${spread}° against the gyro` : ''}`;
}
