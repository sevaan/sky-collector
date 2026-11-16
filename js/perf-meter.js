// Performance meter (2026-11-10, Testing tools only: SC Tester / dev mode). Records real frame times on the phone, which
// headless test browsers can't (no GPU), plus timings of named steps (the sky frame's script, the cloud layer's WebGL
// render and copy, the Milky Way photo's upload). Start it, use the app normally for a minute, stop it: a text summary
// says how smooth it was and what was on screen when frames dropped. Results are kept in localStorage 'perfMeter'.
const S = { on: false, gaps: [], worst: [], named: new Map(), ctx: () => '', at: 0, raf: 0, last: 0, marks: [] };
export const pmOn = () => S.on;
// What happened during a frame: page changes and background jobs leave a mark (with their own time when they're spans),
// and a slow frame lists the marks that fell inside it.
export function pmMark(name) { if (S.on) { S.marks.push([performance.now(), name]); if (S.marks.length > 200) S.marks.splice(0, 100); } }
export function pmSpan(name, fn) { if (!S.on) return fn(); const t0 = performance.now(); try { return fn(); } finally { const ms = performance.now() - t0; pmTime(name, ms); S.marks.push([t0, `${name} ${Math.round(ms)} ms`]); } }
if (typeof window !== 'undefined') window.__pm = { mark: pmMark, span: pmSpan, time: (n, ms) => pmTime(n, ms) }; /* for the Collection frame */
export function pmTime(name, ms) {
  if (!S.on) return;
  let n = S.named.get(name); if (!n) S.named.set(name, (n = { n: 0, t: 0, max: 0, over16: 0 }));
  n.n++; n.t += ms; if (ms > n.max) n.max = ms; if (ms > 16) n.over16++;
}
export function pmStart(ctxFn) {
  S.on = true; S.gaps = []; S.worst = []; S.named.clear(); S.marks = []; S.ctx = ctxFn ?? (() => ''); S.at = Date.now(); S.last = 0;
  const loop = (t) => {
    if (!S.on) return;
    if (S.last && !document.hidden) { const g = t - S.last; if (g < 1000) { S.gaps.push(g); if (g > 40) { const inside = S.marks.filter(([mt]) => mt >= S.last - 2 && mt <= t).map(([, n]) => n); S.worst.push([Math.round(g), `${S.ctx()}${inside.length ? ` · ${[...new Set(inside)].join(', ')}` : ''}`]); S.worst.sort((a, b) => b[0] - a[0]); if (S.worst.length > 14) S.worst.length = 14; } } }
    S.last = document.hidden ? 0 : t; S.raf = requestAnimationFrame(loop);
  };
  S.raf = requestAnimationFrame(loop);
}
export function pmStop() {
  S.on = false; cancelAnimationFrame(S.raf);
  const g = [...S.gaps].sort((a, b) => a - b), q = (x) => (g.length ? Math.round(g[Math.min(g.length - 1, Math.floor(x * g.length))]) : 0);
  const secs = Math.round((Date.now() - S.at) / 1000), n = g.length;
  const lines = [
    `${secs} s · ${n} frames (${n && secs ? Math.round(n / secs) : 0} fps)`,
    `frame p50 ${q(0.5)} ms · p95 ${q(0.95)} · p99 ${q(0.99)} · worst ${Math.round(g[n - 1] ?? 0)}`,
    `over 33 ms: ${g.filter((x) => x > 33).length} · over 50 ms: ${g.filter((x) => x > 50).length}`,
    '', 'Slowest frames (what was on screen):', ...S.worst.map(([ms, c]) => `  ${ms} ms · ${c}`),
    '', 'Timed steps (count · average · worst · over 16 ms):',
    ...[...S.named].sort((a, b) => b[1].max - a[1].max).map(([k, v]) => `  ${k}: ${v.n} · ${(v.t / v.n).toFixed(1)} · ${v.max.toFixed(1)} · ${v.over16}`),
  ];
  const text = lines.join('\n');
  try { localStorage.setItem('perfMeter', text); } catch {}
  return text;
}
export const pmLast = () => { try { return localStorage.getItem('perfMeter') ?? ''; } catch { return ''; } };
