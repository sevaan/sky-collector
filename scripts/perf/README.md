# Performance checks (2026-11-07)

Playwright scripts that measure how the app feels, run against a local server (`python3 -m http.server 8765`).
Each one seeds N sightings into a fresh browser profile first, so a big collection can be tested.

- `flows.mjs N [webkit|chromium]`: click-to-paint latency of the main flows (radar, Tonight, a pass row, Collection).
- `frames.mjs [reduced]`: per-frame gaps for 30 frames after each tap in WebKit (Safari's engine), the number that matters on an iPhone.
- `bisect.mjs`: removes parts of the Tonight page one at a time and re-measures its slowest frame.
- `sit.mjs N`: a CPU profile of 8 s of idle Explore in Chromium at 4× slowdown (inclusive and self time by function).
- `longtasks.mjs N`: long tasks during launch and after a Collection refresh.
- `viewer-swipe.mjs [webkit|chromium] [cpu] [--budget]`: the card viewer's gestures (swipe to the next card, flick it away) on a plane and a flight card, with real touch in Chromium and a slowed CPU; worst frame, frames over 33 ms and long tasks, measured inside the Collection's frame. `--budget` fails on a 33 ms frame or a long task. Sky: `PERF_SKY=1 PERF_URL=http://localhost:8768/`.

Run with Node 22: `export PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH; node scripts/perf/frames.mjs`.
