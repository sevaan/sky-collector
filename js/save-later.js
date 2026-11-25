// A throttled save that still lands (bug pass 2026-11-25: the sky logs saved at most every 15 s with no write after the
// last change, so a 10-second visit kept nothing). later(write, ms) returns a function that schedules one write ms from
// now, and every pending write runs at once when the page is hidden or closed. No DOM beyond the two events.
const pending = new Set();
const flush = () => { for (const run of [...pending]) run(); };
try { if (typeof addEventListener === 'function') addEventListener('pagehide', flush); if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); }); } catch {}
export function later(write, ms = 15000) {
  let t = null;
  const run = () => { if (t) clearTimeout(t); t = null; pending.delete(run); try { write(); } catch {} };
  return () => { if (t) return; pending.add(run); t = setTimeout(run, ms); t?.unref?.(); };
}
