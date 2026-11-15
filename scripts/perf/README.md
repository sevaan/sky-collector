# Performance checks (2026-11-07)

Playwright scripts that measure how the app feels, run against a local server (`python3 -m http.server 8765`).
Each one seeds N sightings into a fresh browser profile first, so a big collection can be tested.

- `flows.mjs N [webkit|chromium]`: click-to-paint latency of the main flows (radar, Tonight, a pass row, Collection).
- `frames.mjs [reduced]`: per-frame gaps for 30 frames after each tap in WebKit (Safari's engine), the number that matters on an iPhone.
- `bisect.mjs`: removes parts of the Tonight page one at a time and re-measures its slowest frame.
- `sit.mjs N`: a CPU profile of 8 s of idle Explore in Chromium at 4× slowdown (inclusive and self time by function).
- `longtasks.mjs N`: long tasks during launch and after a Collection refresh.

Run with Node 22: `export PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH; node scripts/perf/frames.mjs`.
