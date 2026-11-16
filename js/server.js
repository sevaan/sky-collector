// Our own server (functions/index.js, a Cloud Run function behind Firebase Hosting, 2026-10-26): weather from MET Norway, live planes from
// adsb.lol, fresh satellite data for the phone apps, and the anonymous usage reports. Free for commercial use, which
// Open-Meteo's free plan and the adsb.fi / adsbdb feeds weren't. Empty until it's deployed: the app then keeps its old
// sources. localStorage 'skyServer' overrides it (testing, e.g. http://localhost:8787 with `wrangler dev`).
const DEPLOYED = ''; // Sky Collector has no server yet; the app uses its direct sources (planes: relay/planes.ts)
export const SERVER = (() => { try { return localStorage.getItem('skyServer') /* Sky's own key (2026-11-16, Sevaan: decoupled from Space Collector; was 'scServer') */ || DEPLOYED; } catch { return DEPLOYED; } })().replace(/\/$/, '');
