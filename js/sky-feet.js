// The compass at your feet, for planes (2026-11-20, Sevaan: "The radar when I look down at the ground in sky collector
// should also indicate what's up in the air around me like space collector does"). Space Collector's own map
// (js/sky.js drawFeet, fed by main.js feetItems) fed with the planes up now instead of the Moon, planets and stars.
// Pure, so the choice is tested (tests/sky-feet.test.mjs).
//
// list: state.planeItems ([{ plane, az, el, rangeKm }]); fresh(plane): catching it gives a new card or stamp;
// highlight(plane): Settings → Circle highlights would let the circle lock on; nameOf(plane): its name on the map.
// Every plane up (js/sky-up.js isUp, the same rule as the radar's count and Today) is drawn (at most `max`); only `labels` of them get a spoke and a name, as Space keeps to the
// Moon, planets and 4 new satellites: highlighted ones first, new ones first among those, then the highest.
import { isUp } from './sky-up.js?v=0.1.1907';
export const FEET_MAX = 40, FEET_LABELS = 4;
export function feetPlanes(list, { fresh = () => false, highlight = () => true, nameOf = () => 'Plane', max = FEET_MAX, labels = FEET_LABELS } = {}) {
  const up = (list ?? []).filter(isUp).map((a) => {
    const isNew = !!fresh(a.plane), hl = !!highlight(a.plane);
    return { a, isNew, hl };
  });
  up.sort((x, y) => Number(y.hl) - Number(x.hl) || Number(y.isNew) - Number(x.isNew) || y.a.el - x.a.el || (x.a.rangeKm ?? 0) - (y.a.rangeKm ?? 0));
  return up.slice(0, max).map(({ a, isNew, hl }, i) => ({
    kind: 'plane', icon: a.plane.heli ? 'heli' : 'plane', id: a.plane.hex, plane: a.plane,
    name: nameOf(a.plane), az: a.az, el: a.el, track: a.plane.track,
    isNew: isNew && hl, quiet: !hl, label: hl && i < labels,
  }));
}
// What a plane is called on the map. Anonymous aircraft (js/planes.js isAnonymous): the type only, nothing else.
export function feetName(p, route, typeName) {
  const type = typeName || (p.heli ? 'Helicopter' : 'Aircraft');
  if (p.anon) return type;
  const number = route?.flight?.replace(/^([A-Z]{3}|[A-Z0-9]{2})(?=\d)/, '');
  const airline = route?.airline?.replace(/\s*\(.*?\)\s*/g, ' ').trim(); /* 'Jazz (Air Canada Express)' ran off the screen */
  return airline && number ? `${airline} ${number}` : p.callsign || type;
}
/* Where a picture (an airline's tail fin or a plane's photo, w x h, centred on x) goes on All around you's strip, W wide
   (QA 2026-11-20: at 360-430 px a plane near the right edge drew as a clipped photo with half a blue tail fin beside it).
   Pictures never hang off either edge; one that would cover another picture (taken: [[x, y, w, h], ...], left/top
   corners) steps aside to whichever side has room, nearest first, else stays where it is. Returns the new centre x. */
export function stripSpot(x, y, w, h, W, taken = []) {
  const lo = w / 2 + 2, hi = W - w / 2 - 2, fit = (v) => (hi < lo ? W / 2 : Math.max(lo, Math.min(hi, v)));
  const hits = (cx) => taken.some(([ix, iy, iw, ih]) => Math.abs(ix + iw / 2 - cx) < (w + iw) / 2 + 2 && Math.abs(iy + ih / 2 - y) < (h + ih) / 2);
  const x0 = fit(x); if (!hits(x0)) return x0;
  const step = w * 0.65;
  for (let k = 1; k <= 4; k++) for (const s of [1, -1]) { const cx = x0 + s * k * step; if (cx < lo || cx > hi) continue; if (!hits(cx)) return cx; }
  return x0;
}
