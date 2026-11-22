// Show me (and a Today row's card) for a plane the app can't place this second (Sky Tester 2026-11-20, Sevaan: "there was
// a notification saying there was a rare Airbus in the air. But as soon as I tapped [...] show me, it said the plane had
// gone out of range"). Coming back to the app (from a notification, or to a rare-visitor ticket left on screen) the planes
// are the ones from before you left, too old to place, so every plane looked gone until the feed answered. Now: wait for
// a fresh answer first ('find'), and only then say it's gone, honestly and with what's up instead. Pure, no DOM.
import { isUp } from './sky-up.js?v=0.1.1881';

// a: the plane's place now ({ plane, az, el, rangeKm } from PlaneTracker.positions) or null; wait: Show me's wait for a
// plane still coming over ({ az, el, at }) or null; obs: the observer (null before the place is known); lastOk: the last
// good feed answer (ms, 0 = never); since: an answer older than this doesn't count (the app came back from the background
// then), 0 for any; maxAgeMs: older than this the feed's planes aren't placed at all (js/plane-feed.js maxAgeS); final:
// already waited for an answer. Returns 'show' (it's up: steer to it), 'wait' (coming over: wait where it will appear),
// 'find' (no fresh word yet: wait for the feed, then decide), 'nofeed' (waited, still no word) or 'gone'.
export const FIND_MS = 15e3;
export function showMeVerdict({ a = null, wait = null, obs = null, lastOk = 0, since = 0, now = Date.now(), maxAgeMs = 60e3, final = false } = {}) {
  if (obs && isUp(a)) return 'show';
  if (wait && Number.isFinite(wait.at) && now < wait.at + 120e3) return 'wait';
  const fresh = !!obs && lastOk > 0 && now - lastOk <= maxAgeMs && lastOk >= since;
  if (!fresh) return final ? 'nofeed' : 'find';
  return 'gone';
}

// The words when it really is gone. name: the plane's name ('An Airbus A380', 'Air Canada 856'), or null; last: its place
// now if the feed still has it (low in the sky), else null; upNow: how many planes are up now.
export function goneWords({ name = null, last = null, upNow = 0 } = {}) {
  const it = name || 'That plane';
  const why = last && last.el > 0 ? `${it} is down near the horizon now, too low to see over trees and roofs.`
    : `${it} has left your sky: planes turn, climb and land, so it flew on another way.`;
  const now = upNow > 0 ? ` ${upNow === 1 ? 'One other plane is' : `${upNow} other planes are`} up right now.` : ' Nothing else is up this minute: Today shows the next ones coming.';
  return why + now;
}
export const NOFEED_WORDS = 'Can’t reach the plane feed right now, so we can’t find it. Check your connection and try again.';
