// When the tour runs at launch (2026-11-19, Space Collector's port): never once you've caught something or it's done;
// after a quit mid-tour it resumes once, and a second quit counts as done. tourDone is set when the last card is shown.
export function tourOnLaunch({ started, tourDone, tourResumed, hasCatch }) {
  if (!started || tourDone || hasCatch) return 'none';
  return tourResumed ? 'done' : 'resume';
}
