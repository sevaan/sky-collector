// Player progress from the sighting log: XP and observer rank, tonight’s three missions, a weekly streak and
// achievements. Everything is derived from the saved sightings (nothing extra is stored), so it can’t drift.
// info(cardKey) -> { tier, type, owner, launch, natural, con } | null. No DOM.
import { isProp } from './sky-props.js?v=0.1.1818';
import { SKY_PATCHES_MORE, freshSky2, noteSky2 } from './sky-patches.js?v=0.1.1818';
import { nightKey, useCalendarDays } from './observation.js?v=0.1.1818';
import { fleetThresholds } from './card-model.js?v=0.1.1818';
import { distRound as distText } from './units.js?v=0.1.1818';
import { firstFlew, isNewType, isOldType, engines, makerOf, isBoeing, isAirbus, continentOfAirport } from './sky-kinds.js?v=0.1.1818';
import { planeSet } from './sky-sets.js?v=0.1.1818';
import { privateCatch, MIL_TYPES } from './plane-privacy.js?v=0.1.1818';
import { localDay, THRESHOLDS } from './sky-stamps.js?v=0.1.1818';

// A longer climb (2026-10-12, playtest room: three ranks on night 1, Mission Control in about two weeks), with two
// prestige ranks past Mission Control. Nobody drops a rank they had on the old curve (rankFloor below).
export const RANKS = [
  [0, 'Stargazer'], [500, 'Spotter'], [1500, 'Tracker'], [4000, 'Navigator'], [10000, 'Flight Controller'], [25000, 'Mission Control'], /* stretched 2026-10-28 (Sevaan): the first rank-up on night 2, not night 1 */
  [50000, 'Deep Space'], [90000, 'Voyager'],
];
const LEGACY_RANKS = [[0, 'Stargazer'], [200, 'Spotter'], [600, 'Tracker'], [1500, 'Navigator'], [4000, 'Flight Controller'], [10000, 'Mission Control']];
// The rank a player already held on the old curve, worked out once and kept (localStorage rankFloor2).
function rankFloor(xp) {
  return 0; /* retired before launch (2026-10-28, Sevaan: Navigator after 10 cards): nobody outside testing played on the old curve */
  try { const v = localStorage.getItem('rankFloor2'); if (v != null) return Number(v) || 0; } catch { return 0; }
  let li = 0; for (let k = 0; k < LEGACY_RANKS.length; k++) if (xp >= LEGACY_RANKS[k][0]) li = k;
  try { localStorage.setItem('rankFloor2', String(li)); } catch {}
  return li;
}
// Flatter since 2026-10-10 (playtest: 10 → 150 was 15×, so rank mostly counted old rocket stages and Mission Control
// arrived in ~4 months). Players who were already further along keep their rank through a one-time carry (xpCarry).
const TIER_XP = { common: 10, uncommon: 15, rare: 25, epic: 40, legendary: 60 };
const LEGACY_TIER_XP = { common: 10, uncommon: 20, rare: 40, epic: 80, legendary: 150 };
const REPEAT_XP = 5, SHINY_XP = 100, MISSION_XP = 50, CON_XP = 200;
// Themed weeks (2026-10-25, Sevaan; design/come-back.html 03): a small goal from Monday to Sunday, the same for everyone
// (a rotation by week; main.js may swap in the next theme when this sky can't deliver it, kept in localStorage
// weekThemes). +150 XP each week it's done, and the theme's week badge (a patch in the Weeks group) the first time.
export const WEEK_XP = 150;
const COUNTRY = { CIS: 'Soviet Union / Russia', US: 'USA', PRC: 'China', FR: 'Europe', ESA: 'Europe', IND: 'India', JPN: 'Japan', SEAL: 'Sea Launch', SKOR: 'South Korea', IRAN: 'Iran', UK: 'UK', AUS: 'Australia', NKOR: 'North Korea' };
export const countryOf = (owner) => COUNTRY[owner] ?? owner ?? 'Unknown';
const yearOf = (i) => Number(String(i?.launch ?? '').slice(0, 4)) || null;
export const WEEK_THEMES = [
  { id: 'stages', name: 'Rocket stage week', short: 'Stage Week', text: 'Catch three rocket stages from different countries.', icon: 'R/B', need: 3,
    have: (w) => new Set(w.filter((s) => s.info?.type === 'rocket-body').map((s) => countryOf(s.info.owner))).size },
  { id: 'old', name: 'Old-timers week', short: 'Old-Timer Week', text: 'Catch three things launched before 1970.', icon: '<70', need: 3,
    have: (w) => new Set(w.filter((s) => !s.info?.natural && yearOf(s.info) && yearOf(s.info) < 1970).map((s) => s.cardKey)).size },
  { id: 'stations', name: 'Station week', short: 'Station Week', text: 'Catch both space stations: the ISS and Tiangong.', icon: 'ISS', need: 2,
    have: (w) => ['25544', '48274'].filter((k) => w.some((s) => String(s.cardKey) === k)).length },
  { id: 'fleet', name: 'Fleet week', short: 'Fleet Week', text: 'Stamp three new launches on your fleet cards.', icon: 'FLT', need: 3,
    have: (w) => new Set(w.filter((s) => s.newStampKey).map((s) => s.newStampKey)).size },
  { id: 'planets', name: 'Planet week', short: 'Planet Week', text: 'Catch three different planets.', icon: 'PL', need: 3,
    have: (w) => new Set(w.filter((s) => String(s.cardKey).startsWith('planet:')).map((s) => s.cardKey)).size },
  // Seven more (2026-10-25, Sevaan): twelve in all, so a theme comes back about once a season.
  { id: 'moon', name: 'Moon week', short: 'Moon Week', text: 'Catch the Moon in three different phases.', icon: 'MN', need: 3,
    have: (w) => new Set(w.filter((s) => String(s.stampKey ?? '').startsWith('MOON:')).map((s) => s.stampKey)).size },
  { id: 'stars', name: 'Star week', short: 'Star Week', text: 'Collect ten new constellation stars.', icon: '✦10', need: 10,
    have: (w) => new Set(w.filter((s) => s.info?.con && s.first).map((s) => s.cardKey)).size },
  { id: 'debris', name: 'Debris week', short: 'Debris Week', text: 'Spot three different pieces of space debris.', icon: 'DEB', need: 3,
    have: (w) => new Set(w.filter((s) => s.info?.type === 'debris').map((s) => s.cardKey)).size },
  { id: 'china', name: 'China week', short: 'China Week', text: 'Catch three different Chinese satellites or rocket stages.', icon: 'CN', need: 3,
    have: (w) => new Set(w.filter((s) => s.info?.owner === 'PRC').map((s) => s.cardKey)).size },
  { id: 'deep', name: 'Deep sky week', short: 'Deep Sky Week', text: 'Find two star clusters, nebulae or galaxies.', icon: 'DSO', need: 2,
    have: (w) => new Set(w.filter((s) => s.info?.type === 'deepsky').map((s) => s.cardKey)).size },
  { id: 'shiny', name: 'Shiny week', short: 'Shiny Week', text: 'Catch one shiny: catch the fade, beside the Moon, or straight overhead.', icon: 'SH', need: 1,
    have: (w) => (w.some((s) => s.shiny) ? 1 : 0) },
  { id: 'high', name: 'High flyer week', short: 'High Flyer Week', text: 'Catch five things more than 60° up.', icon: '60°', need: 5,
    have: (w) => w.filter((s) => s.el >= 60).length },
];
// Weeks run on observing nights (noon to noon), so Sunday night after midnight still counts for Sunday's week; the
// theme index is the local calendar week, so it's the same for everyone whatever their time zone (bug hunt 2026-10-25).
export const weekStartOf = (t) => { const d = new Date(SKY ? t : t - 12 * 3600e3); /* Sky's weeks start Monday at midnight (QA 2026-11-19) */ d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const weekIndex = (ws) => { const d = new Date(ws); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5 + 3) / 7); };
export const weekThemeFor = (ws, chosen = null) => (chosen?.[ws] ? sizedWeek(chosen[ws]) : null) ?? (SKY && ws < SKY_V2_WEEKS ? SKY_WEEK_THEMES_V1[weekIndex(ws) % SKY_WEEK_THEMES_V1.length] : WEEK_THEMES[weekIndex(ws) % WEEK_THEMES.length]);
const WEEKS_FROM = new Date(2026, 9, 26).getTime(); // weeks count from when they started (an update gave old weeks' XP at once)
export function readWeekThemes() { try { return JSON.parse(localStorage.getItem('weekThemes')) || {}; } catch { return {}; } }
const real = (sightings) => sightings.filter((s) => !s.sim && s.via !== 'gift').slice().sort((a, b) => a.time - b.time); /* cards you were sent are yours, but only your own sightings count toward XP, rank, missions, streak and patches (2026-11-11) */
// The one-time carry for gifts opened before that rule (2026-11-11): the XP and patches they had given, kept so nobody
// drops a rank. Worked out once by main.js (markOldGifts) and kept in localStorage 'giftCarry' = { xp, patches }.
export function giftCarry() { try { const v = JSON.parse(localStorage.getItem('giftCarry') || 'null'); return { xp: Number(v?.xp) || 0, patches: Array.isArray(v?.patches) ? v.patches : [] }; } catch { return { xp: 0, patches: [] }; } }
const year = (iso) => (iso ? Number(String(iso).slice(0, 4)) : null);
const soviet = (i) => i?.owner === 'CIS';
const american = (i) => i?.owner === 'US';

// ---------- missions ----------
// Each night gets three, picked from this list by the night itself (everyone gets the same three).
export const MISSIONS = [
  { id: 'stage', text: 'Catch a rocket stage', done: (n) => n.some((s) => s.info?.type === 'rocket-body') },
  { id: 'old', text: 'Find something launched before 1980', done: (n) => n.some((s) => !s.info?.natural && year(s.info?.launch) < 1980) },
  { id: 'star', text: 'Collect a constellation star', done: (n) => n.some((s) => s.info?.con) },
  { id: 'recent', text: 'Catch something launched in the last 5 years', done: (n, t) => n.some((s) => !s.info?.natural && year(s.info?.launch) >= new Date(t).getFullYear() - 5) },
  { id: 'soviet', text: 'Spot something Soviet or Russian', done: (n) => n.some((s) => soviet(s.info)) },
  { id: 'epic', text: 'Catch something Epic or Legendary', done: (n) => n.some((s) => s.info?.natural !== 'story' && ['epic', 'legendary'].includes(s.info?.tier)) },
  { id: 'race', text: 'Space Race: a Soviet object and an American one', done: (n) => n.some((s) => soviet(s.info)) && n.some((s) => american(s.info)) },
  { id: 'high', text: 'Catch something more than 60° up', done: (n) => n.some((s) => s.el >= 60) },
  { id: 'planet', text: 'Collect a planet or the Moon', done: (n) => n.some((s) => ['planet', 'moon'].includes(s.info?.type)) },
  { id: 'junk', text: 'Spot a piece of space debris', done: (n) => n.some((s) => s.info?.type === 'debris') },
  // Deeper ones (2026-10-12, playtest room: "collect 3 new" and "log 5" were done almost every night).
  { id: 'again', text: 'See a card you own on a new night', done: (n) => n.some((s) => !s.first) },
  { id: 'conset', text: 'Find 3 stars in one constellation', done: (n) => { const c = {}; for (const s of n) if (s.info?.con && s.first) c[s.info.con] = (c[s.info.con] ?? 0) + 1; return Object.values(c).some((v) => v >= 3); } },
  { id: 'deep', text: 'Find a star cluster or galaxy', done: (n) => n.some((s) => s.info?.type === 'deepsky') },
  { id: 'rarenew', text: 'Collect a new Rare card, or rarer', done: (n) => n.some((s) => s.first && s.info?.natural !== 'story' && ['rare', 'epic', 'legendary'].includes(s.info?.tier)) },
  { id: 'levelup2', text: 'Turn a card silver or gold', done: (n) => n.some((s) => s.lv) },
  // Fifteen more (2026-10-25, Sevaan: so a night's three don't repeat within a week or two). main.js dealMissions only
  // deals the ones tonight's sky can give.
  { id: 'china', text: 'Spot something from China', done: (n) => n.some((s) => s.info?.owner === 'PRC') },
  { id: 'sixties', text: 'Find something launched in the 1960s', done: (n) => n.some((s) => !s.info?.natural && year(s.info?.launch) >= 1960 && year(s.info?.launch) < 1970) },
  { id: 'eighties', text: 'Find something launched in the 1980s', done: (n) => n.some((s) => !s.info?.natural && year(s.info?.launch) >= 1980 && year(s.info?.launch) < 1990) },
  { id: 'fade', text: 'Catch the fade: tap Collect as it goes dark', done: (n) => n.some((s) => s.shiny === 'eclipse') },
  { id: 'peak', text: 'Catch a new card at its highest point', done: (n) => n.some((s) => s.peak) },
  { id: 'moon', text: 'Catch the Moon', done: (n) => n.some((s) => s.cardKey === 'moon') },
  { id: 'low', text: 'Catch something skimming low, under 20° up', done: (n) => n.some((s) => !s.info?.natural && s.el != null && s.el < 20) },
  { id: 'station', text: 'Catch a space station', done: (n) => n.some((s) => ['25544', '48274'].includes(String(s.cardKey))) },
  { id: 'sats3', text: 'Catch three different satellites', done: (n) => new Set(n.filter((s) => s.info && !s.info.natural && s.info.type !== 'rocket-body' && s.info.type !== 'debris').map((s) => s.cardKey)).size >= 3 },
  { id: 'nations3', text: 'Catch things from three different countries', done: (n) => new Set(n.filter((s) => s.info?.owner).map((s) => countryOf(s.info.owner))).size >= 3 },
  { id: 'late', text: 'Catch something after midnight', done: (n) => n.some((s) => new Date(s.time).getHours() < 6) },
  { id: 'debris2', text: 'Spot two different pieces of debris', done: (n) => new Set(n.filter((s) => s.info?.type === 'debris').map((s) => s.cardKey)).size >= 2 },
  { id: 'europe', text: 'Spot something European', done: (n) => n.some((s) => ['FR', 'ESA', 'UK', 'GER', 'IT', 'EUME', 'EUTE', 'SPN', 'NETH', 'SWED', 'NOR', 'DEN', 'BEL', 'POL', 'CZ', 'POR', 'LUXE', 'FIN'].includes(s.info?.owner)) },
  { id: 'asia', text: 'Spot something from Japan or India', done: (n) => n.some((s) => ['JPN', 'IND'].includes(s.info?.owner)) },
  { id: 'planets2', text: 'See two different planets', done: (n) => new Set(n.filter((s) => String(s.cardKey).startsWith('planet:')).map((s) => s.cardKey)).size >= 2 },
];
// Retired from the draw but kept so past nights still score the same.
const RETIRED = [
  { id: 'three', text: 'Collect 3 new cards', done: (n) => n.filter((s) => s.first).length >= 3 },
  { id: 'five', text: 'Log 5 sightings', done: (n) => n.length >= 5 },
];
// Tonight’s sky challenge (playtest 2026-10-09, #22): a fourth, bonus goal for nights when nothing new is overhead.
// All of them can be done with cards you already own. +50 XP; doesn’t count toward the mission patches.
export const CHALLENGES = [
  { id: 'revisit3', text: 'See 3 cards you own again', done: (n) => n.filter((s) => !s.first).length >= 3 },
  { id: 'pair10', text: 'Catch two satellites in 10 minutes', done: (n) => { const t = n.filter((s) => !s.info?.natural).map((s) => s.time); return t.some((x, i) => i && x - t[i - 1] <= 600000); } },
  { id: 'levelup', text: 'Turn a card silver or gold', done: (n) => n.some((s) => s.lv) },
  { id: 'brightstar', text: 'Find a bright named star', done: (n) => n.some((s) => /^star:(?!hip)/.test(s.cardKey)) },
  { id: 'wanderer', text: 'See a planet again', done: (n) => n.some((s) => !s.first && s.info?.type === 'planet') },
];
export function challengeFor(night) { let h = 7; for (const c of String(night)) h = Math.imul(h ^ c.charCodeAt(0), 2246822519) >>> 0; const C = SKY ? (Number(night) >= nightKey(SKY_V2_CH) ? SKY_CHALLENGES : SKY_CHALLENGES_V1) : CHALLENGES; return C[h % C.length]; }
/* Sky's deal keeps its challenge ('ch:id', main.js skyDealMissions); a day without one draws as before */
export function challengeOf(night, deals = null) { const c = SKY ? (deals?.[night] ?? []).find?.((x) => String(x).startsWith('ch:')) : null; return (c && SKY_CHALLENGES.find((x) => x.id === c.slice(3))) || challengeFor(night); }
/* Round 2 of Sky's missions starts here: a first day from 2026-11-20 gets the new day-one set, challenges and the plain draw
   change from 2026-11-21 (so a day already under way keeps what it showed), the 12 week themes from Monday 2026-11-23 */
const SKY_V2_DAY = new Date(2026, 10, 20).getTime(), SKY_V2_CH = new Date(2026, 10, 21).getTime(), SKY_V2_WEEKS = new Date(2026, 10, 23).getTime();

// A player’s first night gets a fixed starter set a beginner can finish (playtest 2026-10-09: the random three were
// debris, pre-1980 and a rocket stage, and the first catch left them 0 / 3).
export const STARTER = [
  { id: 'firstcard', text: 'Collect your first card', done: (n) => n.some((s) => s.first) },
  { id: 'satellite', text: 'Catch a satellite', done: (n) => n.some((s) => s.info && !s.info.natural) },
  MISSIONS.find((m) => m.id === 'planet'),
];
// Sky Collector (Milestone 1.5, 2026-11-15): the same missions, patches, streaks and ranks, with plane missions and the
// patches that make sense for planes. main.js and cards-page.js switch it on (setSkyProgress). Plane sightings carry their
// card as cardSnapshot (js/sky-cards.js), so these read it there.
const snap = (s) => s.cardSnapshot ?? {};
const WIDE = /^(A3[3-9]|A35|A38|B74|B76|B77|B78|IL96|A30)/;
const PROP = { test: isProp }; /* js/sky-props.js: whole type codes (QA 2026-11-19: the old pattern counted Citation jets, the C-17 and the Beechjet) */
const ccOf = (a) => a?.cc || a?.country || ''; /* airports carry cc (js/routes.js); the mission read .country and could never be done (QA 2026-11-19) */
const firstFlight = (s) => s.first && snap(s).sky === 'flight';
// Sized to your sky (docs/DESIGN-LOOP.md §3, approved 2026-11-17): counts follow how busy the place is (js/sky-local.js
// localStats().sky → setSkySize). A quiet sky asks for one airline; a busy one for five.
const SIZES = { new: { airlines: 2, cards: 1 }, quiet: { airlines: 1, cards: 1 }, steady: { airlines: 2, cards: 2 }, busy: { airlines: 4, cards: 3 } }; /* sized for a 15-minute look (QA 2026-11-19, #6): steady is 1 to 5 planes in 15 min, busy 5 or more */
let SIZE = SIZES.steady;
export function setSkySize(sky) { SIZE = SIZES[sky] ?? SIZES.steady; }
const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const airlinesOf = (n) => new Set(n.filter((s) => /^[A-Z]{3}\d/.test(s.callsign ?? '')).map((s) => s.callsign.slice(0, 3))).size;
/* ---- Sky missions, round 2 (2026-11-20, design/missions-draft.md, Sevaan: "Build it with the 7 cuts") ----
   One tap is one catch (Sevaan's decision 1): a catch saves its flight and plane sightings at the same moment
   (js/sky-cards.js catchSightings), so counts go by catches, never by sightings. */
export function catchesOf(n) {
  const out = [];
  for (const s of [...(n ?? [])].sort((a, b) => a.time - b.time)) { const l = out[out.length - 1]; if (l && s.time - l.time < 3000 && String(s.hex ?? '') === String(l.hex ?? '')) l.list.push(s); else out.push({ time: s.time, hex: s.hex, list: [s] }); }
  return out;
}
const nCatches = (n, f) => catchesOf(n).filter((c) => c.list.some(f)).length;
/* Route data: only an airline's flight card has it. Private, business and military catches never do (js/plane-privacy.js),
   and a route mission never reads one, even a card saved before the privacy rules. */
const route = (s) => (snap(s).sky === 'flight' && !privateCatch(s) ? snap(s) : null);
const setOf = (s) => (snap(s).sky === 'plane' && snap(s).setId) || planeSet(s.typeCode ?? '', !!(snap(s).heli || snap(s).glyph === 'heli')).id;
const inTen = (n, k) => { const t = catchesOf(n).map((c) => c.time); for (let i = k - 1; i < t.length; i++) if (t[i] - t[i - k + 1] <= 600000) return true; return false; };
/* climb: the feed's climb rate when it had one (saved on catches from 2026-11-20); below 15,000 ft, so it's leaving or
   coming to an airport, not stepping between cruising heights */
const climbing = (s, dir) => Number.isFinite(s.climb) && s.altFt != null && s.altFt < 15000 && (dir > 0 ? s.climb >= 1000 : s.climb <= -1000);
const isDark = (s) => typeof s.sunEl === 'number' && s.sunEl < -6;
const quarterOf = (az) => Math.floor(((((az + 45) % 360) + 360) % 360) / 90); // 0 north, 1 east, 2 south, 3 west
const isMil = (s) => setOf(s) === 'military' || MIL_TYPES.test(String(s.typeCode ?? '').toUpperCase()); /* by type only, never callsign, unit, base or route */
/* Missions sized to the sky (key 'id:n', kept in the day's deal so its score never changes). Any-catch ones count catches. */
const SIZED = {
  airlines3: (k) => ({ text: k === 1 ? 'Catch an airline flight' : `Catch ${NUM[k]} different airlines`, done: (n) => airlinesOf(n) >= k }),
  newflights2: (k) => ({ text: k === 1 ? 'Collect a new card' : `Get new cards from ${NUM[k]} planes`, done: (n) => nCatches(n, (s) => s.first) >= k }),
  again: (k) => ({ text: k === 1 ? 'Catch a plane you’ve caught before' : `Catch ${NUM[k]} planes you’ve caught before`, done: (n) => nCatches(n, (s) => !s.first) >= k }),
  livery: (k) => ({ text: k === 1 ? 'Catch a plane in new colours' : `Catch ${NUM[k]} planes in new colours`, done: (n) => nCatches(n, (s) => s.newLivery) >= k }),
  families2: (k) => ({ text: `Catch planes from ${NUM[k]} plane families`, done: (n) => new Set(n.filter((s) => snap(s).sky === 'plane').map((s) => snap(s).setId ?? snap(s).set).filter(Boolean)).size >= k }),
  three10: (k) => ({ text: `Catch ${NUM[k]} planes in 10 minutes`, done: (n) => inTen(n, k) }),
};
/* Mission wording (2026-11-18, the age playtest: a 7-year-old couldn't read "Catch one plane below 5,000 ft and one above
   35,000 ft"): short, plain words; the exact numbers live in the rules ("really high" is 35,000 ft and up, "low" under
   5,000 ft, a long flight over 3,000 km). */
export const SKY_MISSIONS = [
  { id: 'wide', text: 'Catch a big wide jet', done: (n) => n.some((s) => WIDE.test(s.typeCode ?? '')) },
  { id: 'heli', text: 'Catch a helicopter', done: (n) => n.some((s) => snap(s).heli || snap(s).glyph === 'heli') },
  { id: 'prop', text: 'Catch a propeller plane', done: (n) => n.some((s) => PROP.test(s.typeCode ?? '')) },
  { id: 'far', get text() { return `Catch a long flight (over ${distText(3000)})`; }, done: (n) => n.some((s) => (route(s)?.km ?? 0) > 3000) },
  { id: 'ocean', get text() { return `Catch a very long flight (over ${distText(5000)})`; }, done: (n) => n.some((s) => (route(s)?.km ?? 0) > 5000) },
  { id: 'short', get text() { return `Catch a short hop (under ${distText(500)})`; }, done: (n) => n.some((s) => route(s)?.km != null && route(s).km < 500) },
  { id: 'abroad', text: 'Catch a flight to another country', done: (n) => n.some((s) => { const c = route(s); return !!c && !!ccOf(c.from) && !!ccOf(c.to) && ccOf(c.from) !== ccOf(c.to); }) },
  { id: 'airlines3', get text() { return SIZE.airlines === 1 ? 'Catch an airline flight' : `Catch ${NUM[SIZE.airlines]} different airlines`; }, done: (n) => airlinesOf(n) >= SIZE.airlines },
  { id: 'high', text: 'Catch a plane flying really high', done: (n) => n.some((s) => (s.altFt ?? 0) >= 35000) },
  { id: 'low', text: 'Catch a plane flying low', done: (n) => n.some((s) => s.altFt != null && s.altFt < 5000) },
  { id: 'bands', text: 'Catch one low plane and one really high one', done: (n) => n.some((s) => s.altFt != null && s.altFt < 5000) && n.some((s) => (s.altFt ?? 0) >= 35000) },
  { id: 'rarenew', text: 'Collect a new Rare card, or rarer', done: (n) => n.some((s) => s.first && ['rare', 'epic', 'legendary'].includes(s.info?.tier ?? snap(s).tier)) },
  { id: 'rarehere', text: 'Catch a plane that’s rare around here', done: (n) => n.some((s) => s.rareHere) },
  { id: 'families2', text: 'Catch planes from two plane families', done: (n) => new Set(n.filter((s) => snap(s).sky === 'plane').map((s) => snap(s).setId ?? snap(s).set).filter(Boolean)).size >= 2 },
  { id: 'newflights2', get text() { return SIZE.cards === 1 ? 'Collect a new card' : `Collect ${NUM[SIZE.cards]} new cards`; }, done: (n) => n.filter((s) => s.first).length >= SIZE.cards },
  { id: 'again', text: 'Catch a plane you’ve caught before', done: (n) => n.some((s) => !s.first) },
  /* Round 2 (2026-11-20, design/missions-draft.md). Words a 7-year-old can read; the exact rules here. */
  { id: 'continent', text: 'Catch a flight to another continent', done: (n) => n.some((s) => { const c = route(s); if (!c) return false; const a = continentOfAirport(c.from), b = continentOfAirport(c.to); return !!a && !!b && a !== b; }) },
  /* nearTo: the flight's airport was within 30 km of where you stood (saved on the catch from 2026-11-20; never your position) */
  { id: 'landing', text: 'Catch a flight landing near you', done: (n) => n.some((s) => !!route(s) && s.nearTo === true) },
  /* the year that exact model first flew, as printed on its card; a type with no year never counts (js/sky-kinds.js) */
  { id: 'oldtype', text: 'Catch a kind of plane that first flew before 1980' /* first flew before 1980 */, done: (n) => n.some((s) => isOldType(s.typeCode)) },
  { id: 'newtype', get text() { return `Catch a kind of plane that first flew in ${new Date().getFullYear() - 10} or later`; } /* the last 10 years, rolling each January */, done: (n, t) => n.some((s) => isNewType(s.typeCode, s.time ?? t)) },
  /* el, climb and upFor are saved on catches from 2026-11-20; a catch without them never counts */
  { id: 'overhead', text: 'Catch a plane right over your head', done: (n) => n.some((s) => Number.isFinite(s.el) && s.el > 70) },
  { id: 'up', text: 'Catch a plane on its way up', done: (n) => n.some((s) => climbing(s, 1)) },
  { id: 'down', text: 'Catch a plane on its way down', done: (n) => n.some((s) => climbing(s, -1)) },
  { id: 'quick', text: 'Catch a plane in its first minute up' /* up: over the trees, 5° (js/sky-up.js) */, done: (n) => n.some((s) => Number.isFinite(s.upFor) && s.upFor <= 90) },
  { id: 'dark', text: 'Catch a plane after dark', done: (n) => n.some(isDark) },
  { id: 'shiny', text: 'Catch a shiny', done: (n) => n.some((s) => s.shiny) },
  { id: 'boeingairbus', text: 'Catch a Boeing and an Airbus', done: (n) => n.some((s) => isBoeing(s.typeCode)) && n.some((s) => isAirbus(s.typeCode)) },
  { id: 'giant', text: 'Catch a Giant, like a 747 or A380', done: (n) => n.some((s) => setOf(s) === 'giants') },
  { id: 'regional', text: 'Catch a regional jet', done: (n) => n.some((s) => setOf(s) === 'regional') },
  { id: 'biz', text: 'Catch a business jet', done: (n) => n.some((s) => setOf(s) === 'bizjets' || s.cls === 'biz') },
  { id: 'military', text: 'Catch a military plane', done: (n) => n.some(isMil) },
  { id: 'cardlevel', text: 'Turn a card silver or gold', done: (n) => n.some((s) => s.lv) },
  { id: 'newairline', text: 'Catch an airline you’ve never caught', done: (n) => n.some((s) => s.newAirline) },
  ...['three10', 'livery'].map((id) => ({ id, ...SIZED[id](id === 'three10' ? 3 : 1) })),
];
const ALWAYS = new Set(['newflights2', 'airlines3', 'again', 'high']);
/* Which Sky missions can be dealt now (main.js skyDealMissions; docs/DESIGN-LOOP.md §3). st: js/sky-local.js localStats().
   A mission is dealt only if a plane that would do it has flown here lately AT THIS TIME OF DAY (playtest 2026-11-20 #11:
   "Catch a helicopter" and low-plane goals dealt at 1 AM with two airliners up): the coming hours on the last 7 days
   (st.flagsSoon) once the app has been open at those hours; before that, a plain hour rule: in the evening and at night
   (6 PM to 6 AM, QA round 3) no helicopters, propellers or low planes unless one was seen at these hours already. Space Collector's rule is the same idea from its
   side: only missions tonight's passes can give (main.js dealMissions). */
export const NIGHT_ONLY_NOT = ['heli', 'prop', 'low', 'bands', 'oldtype']; const NIGHT_FLAG = { heli: 'heli', prop: 'prop', low: 'low', bands: 'low', oldtype: 'oldtype' }; /* oldtype: here mostly light planes from before 1980, a daytime thing too (QA round 4) */
export function skyPossible(st, { owned = false, hour = new Date().getHours(), dark = false, golden = false, nearLevel = false, newAirline = false } = {}) {
  const can = new Set(['newflights2', 'families2']);
  if (owned) can.add('again');
  /* days 2 and 3, before this place has a log (design/missions-draft.md, pacing): only what any sky can give */
  /* two planes in 10 minutes only where planes come that often: 3 an hour or more, from whatever this place has seen so far
     (QA round 3: dealt at 2.5 an hour before the log knew the hours) */
  if (!st || st.sky === 'new') { for (const id of ['airlines3', 'high', 'boeingairbus']) can.add(id); if ((st?.perHour ?? 0) >= 3) can.add('three10'); return can; }
  const known = (st.soonOpen ?? 0) >= 2, f = known ? st.flagsSoon ?? {} : st.flags7 ?? {}, night = hour >= 22 || hour < 6;
  if (f.wide) can.add('wide'); if (f.heli) can.add('heli'); if (f.prop) can.add('prop'); if (f.high) can.add('high'); if (f.low) can.add('low');
  if (f.high && f.low) can.add('bands');
  if (f.airline) { can.add('airlines3'); can.add('livery'); }
  /* where flights go: from the routes seen here once there are any, else any airline flight as before */
  if (f.routed) { for (const [id, k] of [['abroad', 'abroad'], ['continent', 'cont'], ['far', 'far'], ['ocean', 'ocean'], ['short', 'short'], ['landing', 'landing']]) if (f[k]) can.add(id); }
  else if (f.airline) { can.add('short'); can.add('far'); can.add('abroad'); if (f.wide) can.add('ocean'); }
  for (const [id, k] of [['giant', 'giant'], ['regional', 'regional'], ['biz', 'biz'], ['oldtype', 'oldtype'], ['newtype', 'newtype'], ['overhead', 'overhead'], ['up', 'up'], ['down', 'down'], ['quick', 'rise']]) if (f[k]) can.add(id);
  if (f.boeing && f.airbus) can.add('boeingairbus');
  /* military: only where military types have been seen at these hours (Sevaan's decision 6), never from the week's tally */
  if (known && st.flagsSoon?.mil) can.add('military');
  if ((known ? st.soonRate ?? 0 : st.perHour ?? 0) >= 3) can.add('three10');
  if (dark) can.add('dark'); if (golden) can.add('shiny');
  if (nearLevel) can.add('cardlevel'); if (newAirline) can.add('newairline');
  if (st.total >= 200) { can.add('rarehere'); can.add('rarenew'); } else if (f.heli || f.giant) can.add('rarenew'); /* every helicopter is Rare, and so is every Giant */
  /* before the log knows these hours: no helicopters, propellers or low planes in the evening or at night (6 PM to 6 AM;
     QA round 3: a propeller mission dealt at 8 PM on day 2), unless one has already been seen here at these hours */
  /* from 5 PM (QA round 4: 8 of 252 deals at 5 to 6 PM had props, low planes, old types or helicopters these hours hadn't seen) */
  if (!known && (night || hour >= 17)) for (const id of NIGHT_ONLY_NOT) if (!(st.flagsSoon?.[NIGHT_FLAG[id]] > 0)) can.delete(id);
  return can;
}
/* ---- The day's deal (design/missions-draft.md, pacing rules; Sevaan 2026-11-20) ----
   One easy, one medium, one stretch; no single catch finishes two of them; each fits the hour and what flew here in the
   last 7 days (skyPossible); a stretch eases in a quiet sky. */
const TIER = { short: 'easy', landing: 'easy', newtype: 'easy', high: 'easy', low: 'easy', up: 'easy', down: 'easy', dark: 'easy', regional: 'easy', prop: 'easy', newflights2: 'easy', again: 'easy', livery: 'easy', airlines3: 'easy',
  abroad: 'medium', continent: 'medium', far: 'medium', oldtype: 'medium', bands: 'medium', overhead: 'medium', quick: 'medium', boeingairbus: 'medium', families2: 'medium', wide: 'medium', heli: 'medium', biz: 'medium', rarenew: 'medium', newairline: 'medium',
  ocean: 'stretch', shiny: 'stretch', giant: 'stretch', military: 'stretch', cardlevel: 'stretch', rarehere: 'stretch', three10: 'stretch' };
export const SKY_POOL = Object.keys(TIER); // 35 (the draft's 42 less region, countries3, golden, jetprop, sameairline, newalbum, cargo)
/* Partner groups: missions one plane often does together (the draft's, plus military and business jets). Two single-catch
   missions in one group are never dealt on the same day. */
/* QA round 3 (2026-11-20): one catch still did two in about 1 deal in 10 near an airport, mostly a long flight climbing out
   ("over 5,000 km" + "on its way up"): a flight's route and its height or climb go together there (depart), and so do a
   regional or turboprop flight, a new type and where it's going (regional) */
const PARTNERS = { long: 'wide giant high far ocean abroad continent newtype', regional: 'regional prop newtype short abroad low down up landing', depart: 'far ocean abroad continent wide giant up down low landing',
  light: 'prop low oldtype', heli: 'heli low', mil: 'military oldtype low heli', biz: 'biz high low up down' };
const GROUPS_OF = new Map(); for (const [g, ids] of Object.entries(PARTNERS)) for (const id of ids.split(' ')) (GROUPS_OF.get(id) ?? GROUPS_OF.set(id, new Set()).get(id)).add(g);
/* Any catch can do these (a new card, a plane after dark, one overhead…): partners of every single-catch mission */
const ANY = new Set(['newflights2', 'airlines3', 'again', 'livery', 'newairline', 'cardlevel', 'rarenew', 'rarehere', 'dark', 'quick', 'overhead', 'shiny']);
const MULTI = { bands: () => 2, boeingairbus: () => 2, three10: (k) => k, families2: (k) => k, airlines3: (k) => k, newflights2: (k) => k, again: (k) => k, livery: (k) => k };
export const catchesNeeded = (base, k = 1) => MULTI[base]?.(k) ?? 1;
const NEVER = [['up', 'down'], ['far', 'ocean'], ['low', 'bands'], ['high', 'bands'], ['abroad', 'continent']].map((p) => p.join('|'));
const NEVER_CH = { three10: 'pair10', cardlevel: 'levelup', livery: 'livery2', again: 'revisit3', dark: 'dusk' };
// Could one catch finish both? a, b: { base, k }
export function partners(a, b) {
  if (NEVER.includes(`${a.base}|${b.base}`) || NEVER.includes(`${b.base}|${a.base}`)) return true;
  if (catchesNeeded(a.base, a.k) > 1 || catchesNeeded(b.base, b.k) > 1) return false;
  if (ANY.has(a.base) || ANY.has(b.base)) return true;
  const ga = GROUPS_OF.get(a.base), gb = GROUPS_OF.get(b.base);
  return !!ga && !!gb && [...ga].some((g) => gb.has(g));
}
/* The size of a counting mission from how busy these hours have been over the last 7 days (hz: js/sky-local.js soonSky) */
const sizeFor = (base, hz) => ({ airlines3: (SIZES[hz] ?? SIZES.steady).airlines, newflights2: (SIZES[hz] ?? SIZES.steady).cards, again: hz === 'steady' || hz === 'busy' ? 2 : 1, livery: hz === 'steady' || hz === 'busy' ? 2 : 1,
  families2: hz === 'busy' ? 3 : 2, three10: hz === 'busy' ? 5 : hz === 'steady' ? 3 : 2 })[base] ?? 1;
const FLAG = { wide: 'wide', heli: 'heli', prop: 'prop', high: 'high', low: 'low', giant: 'giant', regional: 'regional', biz: 'biz', military: 'mil', up: 'up', down: 'down', overhead: 'overhead', newtype: 'newtype', oldtype: 'oldtype' };
const ROUTE_FLAG = { abroad: 'abroad', continent: 'cont', far: 'far', ocean: 'ocean', short: 'short', landing: 'landing' };
/* How hard it is HERE: once this place has 3 days of log and enough planes at these hours, the share of them that would do
   it (30% or more easy, 5 to 30% medium, under 5% stretch); before that the draft's tier. Any-catch ones stay easy. */
export function shareOf(base, st = null) {
  const f = st?.flagsSoon ?? {};
  if (!((st?.days ?? 0) >= 3 && (st?.soonOpen ?? 0) >= 2 && (st?.soonN ?? 0) >= 10)) return null;
  return FLAG[base] ? (f[FLAG[base]] ?? 0) / st.soonN : ROUTE_FLAG[base] && (f.routed ?? 0) >= 10 ? (f[ROUTE_FLAG[base]] ?? 0) / f.routed : null;
}
/* The same share over the whole last week, for a quiet place whose coming hours haven't seen 10 planes yet (js/sky-local.js
   types7 counts each aircraft once a day, as flags7 does) */
export function weekShare(base, st = null) {
  const f = st?.flags7 ?? {}; let n = 0; for (const v of st?.types7?.values?.() ?? []) n += v;
  if (n < 10) return null;
  return FLAG[base] ? (f[FLAG[base]] ?? 0) / n : ROUTE_FLAG[base] && (f.routed ?? 0) >= 10 ? (f[ROUTE_FLAG[base]] ?? 0) / f.routed : null;
}
export function tierOf(base, st = null) {
  if (MULTI[base] && ANY.has(base)) return 'easy';
  if (base === 'three10') return 'stretch';
  const share = shareOf(base, st);
  if (share != null) return share >= 0.3 ? 'easy' : share >= 0.05 ? 'medium' : 'stretch';
  return TIER[base] ?? 'medium';
}
const seeded = (night) => { let h = 0; for (const c of String(night)) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0; return () => { h = (h + 0x6d2b79f5) >>> 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0); }; };
const shuffle = (l, rnd) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd() % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const baseOf = (key) => String(key).split(':')[0];
/* night: the day's key; possible: skyPossible(); hz: how busy these hours are; recent: the last days' deals, newest first
   ([[key…]]); quietNight: under 2 planes an hour in the coming hours. Returns { ids: [easy, medium, stretch] keys, challenge }. */
export function skyDeal(night, { possible = new Set(), st = null, hz = 'steady', recent = [], quietNight = false, owned = false, nearLevel = false, dark = false } = {}) {
  const rnd = seeded(`deal${night}`), f = st?.flags7 ?? {};
  const opt = (base) => { const k = sizeFor(base, hz); return { base, k, tier: tierOf(base, st), key: SIZED[base] ? `${base}:${k}` : base }; };
  const all = SKY_POOL.filter((id) => possible.has(id)).map(opt);
  let E = shuffle(all.filter((o) => o.tier === 'easy'), rnd); const M = shuffle(all.filter((o) => o.tier === 'medium'), rnd), S = shuffle(all.filter((o) => o.tier === 'stretch'), rnd);
  /* a quiet hour: the easy one is one any catch can do, or a kind that half or more of the planes here are */
  if (quietNight) { const q = E.filter((o) => (['again', 'newflights2', 'airlines3'].includes(o.base) && o.k === 1) || (shareOf(o.base, st) ?? weekShare(o.base, st) ?? 0) >= 0.5); if (q.length) E = q; }
  /* QA round 3 (2026-11-20): a one-catch "any plane" easy one (Collect a new card) is a partner of every one-catch mission, so
     in a quiet sky it never fitted beside them and the deal fell back to the same two-plane pair every day. Its two-catch
     size is still easy and one catch can't finish it with anything else: tried after the rest. */
  E = [...E, ...E.filter((o) => o.k === 1 && ((o.base === 'again' && owned) || (o.base === 'newflights2' && !quietNight))).map((o) => ({ ...o, k: 2, key: `${o.base}:2` }))];
  const last = new Set((recent[0] ?? []).map(baseOf)), sig = (t) => t.map((o) => o.base).sort().join('|'), weeks = recent.slice(0, 7).map((r) => r.map(baseOf).filter((x) => !x.startsWith('ch')).sort().join('|'));
  const fits = (t) => { for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (t[i].base === t[j].base || partners(t[i], t[j])) return false; return true; };
  /* no repeats, eased a step at a time only when nothing else fits (QA round 3: in a small pool the old all-or-nothing rule
     fell straight back to yesterday's three). In order: none of yesterday's and not a set from the last week; one of
     yesterday's (never one three days running), not a set from the last week; none of yesterday's; one, never three days
     running; one; two, never yesterday's very set; anything */
  const last2 = new Set((recent[1] ?? []).map(baseOf)), LEVELS = 7;
  const fresh = (t, lvl) => { const r = t.filter((o) => last.has(o.base)), rep = r.length, wk = weeks.includes(sig(t)), run3 = r.some((o) => last2.has(o.base));
    return [!rep && !wk, rep <= 1 && !run3 && !wk, !rep, rep <= 1 && !run3, rep <= 1, rep <= 2 && sig(t) !== weeks[0], true][lvl]; };
  /* a harder medium may take the stretch slot (a quiet sky's pool is small: draft rule 5), then an easy one the medium slot */
  const hard = (o) => shareOf(o.base, st) ?? 0.5; /* the rarest here first */
  const byHard = (l) => l.filter((o) => !(MULTI[o.base] && ANY.has(o.base))).sort((x, y) => hard(x) - hard(y)); /* any-catch ones stay in the easy slot */
  const phases = [[E, M, S], [E, M, [...S, ...byHard(M)]], [E, [...M, ...byHard(E)], [...S, ...byHard(M)]]];
  let pick = null;
  find: for (let lvl = 0; lvl < LEVELS; lvl++) for (const [E1, M1, S1] of phases) for (const e of E1) for (const m of M1) for (const x of S1) if (fits([e, m, x]) && fresh([e, m, x], lvl)) { pick = [e, m, x]; break find; }
  if (pick) pick = pick.map((o, i) => ({ ...o, tier: ['easy', 'medium', 'stretch'][i] }));
  /* a tier with nothing that fits here: the nearest tier fills in, still never two that one catch could finish */
  if (!pick) { const L = [...S, ...M, ...E]; outer: for (let lvl = 0; lvl < LEVELS; lvl++) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) for (let k = j + 1; k < L.length; k++) if (fits([L[i], L[j], L[k]]) && fresh([L[i], L[j], L[k]], lvl)) { pick = [L[k], L[j], L[i]]; break outer; } }
  if (!pick) return null;
  const blocked = new Set(pick.map((o) => NEVER_CH[o.base]).filter(Boolean));
  /* two planes in 10 minutes only where they come 3 an hour or more (QA round 3: dealt at 2.5 an hour) */
  const rate = st ? ((st.soonOpen ?? 0) >= 2 ? st.soonRate : st.perHour) ?? 0 : 3;
  const chOk = { revisit3: owned, pair10: hz !== 'quiet' && rate >= 3, levelup: nearLevel, moreaircraft: owned, livery2: owned && !!f.airline, sameairline: !!f.airline, compass: true, dusk: owned && dark };
  const chs = SKY_CHALLENGES.filter((c) => chOk[c.id] && !blocked.has(c.id));
  return { ids: pick.map((o) => o.key), challenge: (chs[rnd() % Math.max(1, chs.length)] ?? SKY_CHALLENGES.find((c) => c.id === 'compass')).id, tiers: pick.map((o) => o.tier) };
}
/* Is a card one catch away from silver or gold? (deals 'Turn a card silver or gold' only then) */
export function nearLevelUp(sightings, now = Date.now()) {
  const fd = new Map(), ph = new Map(), lastF = new Map();
  for (const s of real(sightings)) {
    if (/^F:/.test(String(s.cardKey ?? ''))) { (fd.get(s.cardKey) ?? fd.set(s.cardKey, new Set()).get(s.cardKey)).add(localDay(s.time)); lastF.set(s.cardKey, Math.max(lastF.get(s.cardKey) ?? 0, s.time)); }
    if (s.plane?.key) (ph.get(s.plane.key) ?? ph.set(s.plane.key, new Set()).get(s.plane.key)).add(String(s.hex || `anon:${s.time}`).toLowerCase());
  }
  const [, fs, fg] = THRESHOLDS.flight, [, ps, pg] = THRESHOLDS.plane;
  for (const [k, d] of fd) if ((d.size === fs - 1 || d.size === fg - 1) && now - lastF.get(k) < 7 * 864e5 && !d.has(localDay(now))) return true;
  for (const h of ph.values()) if (h.size === ps - 1 || h.size === pg - 1) return true;
  return false;
}
/* Day one: one step per catch, so the first catch shows 1 of 3 (2026-11-20). A quiet sky asks for two catches. */
const STARTER_N = () => (SIZE === SIZES.quiet ? 2 : 3);
export const SKY_STARTER = [
  { id: 'firstcard', text: 'Collect your first card', done: (n) => n.some((s) => s.first) },
  { id: 'types2', text: 'Catch two different kinds of plane', done: (n) => new Set(n.map((s) => s.typeCode).filter(Boolean)).size >= 2 },
  { id: 'catches3', get text() { return STARTER_N() === 2 ? 'Catch two planes' : 'Catch three planes'; }, done: (n) => catchesOf(n).length >= STARTER_N() },
];
/* the first day's set before 2026-11-20, so a first day played then still scores the same */
const SKY_STARTER_V1 = [
  SKY_STARTER[0],
  { id: 'firstflight', text: 'Catch a plane on its way somewhere', done: (n) => n.some(firstFlight) },
  SKY_STARTER[1],
];
const SKY_CHALLENGES_V1 = [
  { id: 'revisit3', text: 'Catch 3 cards you own again', done: (n) => n.filter((s) => !s.first).length >= 3 },
  { id: 'pair10', text: 'Catch two planes in 10 minutes', done: (n) => { const t = n.map((s) => s.time).sort((a, b) => a - b); return t.some((x, i) => i && x - t[i - 1] <= 600000); } },
  { id: 'levelup', text: 'Turn a card silver or gold', done: (n) => n.some((s) => s.lv) },
];
/* The bonus challenge, eight from 2026-11-21 (design/missions-draft.md): each can be done with cards you own. Counted by catches. */
export const SKY_CHALLENGES = [
  { id: 'revisit3', text: 'Catch three planes you’ve caught before', done: (n) => nCatches(n, (s) => !s.first) >= 3 },
  { id: 'pair10', text: 'Catch two planes in 10 minutes', done: (n) => inTen(n, 2) },
  { id: 'levelup', text: 'Turn a card silver or gold', done: (n) => n.some((s) => s.lv) },
  { id: 'moreaircraft', text: 'Catch another plane of a kind you already have', done: (n) => n.some((s) => s.moreAircraft) },
  /* newColours: saved on the catch from 2026-11-20 (js/sky-stamps.js newLivery); before that, the same rule from your history */
  { id: 'livery2', text: 'Catch a kind you own in new colours', done: (n) => n.some((s) => s.newColours ?? s.ownLivery) },
  { id: 'sameairline', text: 'Catch two planes from the same airline', done: (n) => { const by = new Map(); for (const c of catchesOf(n)) { const s = c.list.find((x) => /^[A-Z]{3}\d/.test(x.callsign ?? '')); if (!s) continue; const a = s.callsign.slice(0, 3), h = by.get(a) ?? by.set(a, new Set()).get(a); h.add(String(s.hex ?? c.time)); if (h.size >= 2) return true; } return false; } },
  /* az: saved from 2026-11-20; catches without it don't count */
  { id: 'compass', text: 'Catch planes in two different parts of the sky', done: (n) => new Set(n.filter((s) => Number.isFinite(s.az)).map((s) => quarterOf(s.az))).size >= 2 },
  { id: 'dusk', text: 'Catch a plane you own after dark', done: (n) => n.some((s) => !s.first && isDark(s)) },
];
// The patches that mean the same for planes (cards, rarity, time of day, streaks, missions); the rest are about satellites.
const SKY_PATCHES = new Set(['first', 'ten', 'twentyfive', 'fifty', 'hundred', 'archivist', 'curator', 'catalogue', 'sightings100', 'legend', 'epic', 'spectrum', 'legends5', 'legends25',
  'twilight', 'owl', 'dawn', 'marathon', 'double', 'hattrick', 'months3', 'months12', 'streak4', 'streak12', 'anniversary', 'roadtrip', 'missions10', 'fullhouse', 'missions50',
  'silver', 'gold', 'gold3', 'shiny', 'shiny5', 'oldtimer', 'decades', 'compass']); /* the last eight from 2026-11-20, in Sky's words (SKY_OVER) */
let SKY = false;
const RANK_NAMES = RANKS.map((r) => r[1]), SKY_RANK_NAMES = ['Skywatcher', 'Spotter', 'Type Spotter', 'Plane Expert', 'Sky Scholar', 'Sky Master', 'Sky Legend', 'Hall of Fame']; /* Sevaan's ladder, 2026-11-20 (content/sky-ranks-2026-11-20.md, ladder A): a hobby, not a job; same thresholds. A rank is its index from XP, never stored by name, so a saved player keeps their place */
// Sky Collector's weekly themes (2026-11-17; Space Collector's are rocket stages, the Moon, debris…). Same machinery:
// one a week by the calendar, `have` counts this week's sightings toward `need`.
const SKY_WEEK_THEMES = [
  { id: 'sky-airlines', name: 'Airline week', short: 'Airline Week', text: 'Catch five different airlines.', icon: 'AIR', need: 5, have: (w) => airlinesOf(w) },
  { id: 'sky-heavy', name: 'Heavy week', short: 'Heavy Week', text: 'Catch three different wide-body jets.', icon: 'HVY', need: 3, have: (w) => new Set(w.filter((s) => WIDE.test(s.typeCode ?? '')).map((s) => s.typeCode)).size },
  { id: 'sky-props', name: 'Propeller week', short: 'Propeller Week', text: 'Catch three propeller planes.', icon: 'PRP', need: 3, have: (w) => new Set(w.filter((s) => PROP.test(s.typeCode ?? '')).map((s) => s.hex ?? s.time)).size },
  { id: 'sky-longhaul', name: 'Long-haul week', short: 'Long-Haul Week', get text() { return `Catch three flights going more than ${distText(5000)}.`; }, icon: '5K', need: 3, have: (w) => new Set(w.filter((s) => snap(s).sky === 'flight' && (snap(s).km ?? 0) > 5000).map((s) => s.cardKey)).size },
  { id: 'sky-families', name: 'Family week', short: 'Family Week', text: 'Catch planes from four different families.', icon: 'FAM', need: 4, have: (w) => new Set(w.filter((s) => snap(s).sky === 'plane').map((s) => snap(s).setId ?? snap(s).set).filter(Boolean)).size },
  { id: 'sky-regulars', name: 'Regulars week', short: 'Regulars Week', text: 'Catch five cards you already own again.', icon: 'x5', need: 5, have: (w) => new Set(w.filter((s) => !s.first).map((s) => s.cardKey)).size },
  { id: 'sky-newcards', name: 'New cards week', short: 'New Cards Week', text: 'Collect eight new cards.', icon: '+8', need: 8, have: (w) => w.filter((s) => s.first).length },
  { id: 'sky-hops', name: 'Short hop week', short: 'Short Hop Week', get text() { return `Catch three flights under ${distText(500)}.`; }, icon: 'HOP', need: 3, have: (w) => new Set(w.filter((s) => snap(s).sky === 'flight' && snap(s).km != null && snap(s).km < 500).map((s) => s.cardKey)).size },
  /* four more (2026-11-20, design/missions-draft.md): twelve, so each comes back about once a season */
  { id: 'sky-night', name: 'Night Flight week', short: 'Night Flight Week', text: 'Catch five planes after dark.', icon: 'NGT', need: 5, have: (w) => nCatches(w, isDark) },
  { id: 'sky-passport', name: 'Passport week', short: 'Passport Week', text: 'Catch flights to four different countries.', icon: 'PAS', need: 4, have: (w) => new Set(w.map(route).filter(Boolean).map((c) => ccOf(c.to)).filter(Boolean)).size },
  { id: 'sky-livery', name: 'Livery week', short: 'Livery Week', text: 'Catch five planes in new colours.', icon: 'LIV', need: 5, have: (w) => nCatches(w, (s) => s.newLivery) },
  { id: 'sky-makers', name: 'Makers week', short: 'Makers Week', text: 'Catch planes from four different makers.', icon: 'MKR', need: 4, have: (w) => new Set(w.map((s) => makerOf(s.typeCode)).filter(Boolean)).size },
];
const SKY_WEEK_THEMES_V1 = SKY_WEEK_THEMES.slice(0, 8); /* the rotation before 2026-11-23, so past weeks keep their theme */
/* New cards week sized to the sky (a quiet sky can't find eight new cards in month three): stored as 'sky-newcards:4' */
const sizedWeek = (id) => { const [b, k] = String(id).split(':'), th = WEEK_THEMES.find((x) => x.id === b) ?? SKY_WEEK_THEMES.find((x) => x.id === b); if (!th || !k || b !== 'sky-newcards') return th ?? null; const n = Number(k); return { ...th, need: n, text: `Collect ${NUM[n] ?? n} new cards.` }; };
/* Can this sky give a week theme? f: the last 7 days' flags (js/sky-local.js flags7); ctx: { owned, dark (planes here after
   dark), makers (different makers seen here) }. A theme it can't give is swapped for the next one (main.js skyDealMissions). */
export function skyWeekPossible(id, st, { owned = false, dark = false, makers = 0 } = {}) {
  const f = st?.flags7 ?? {}, b = String(id).split(':')[0];
  if (!st || st.sky === 'new') return true; /* nothing known yet: the rotation's own */
  /* Enough of them, as many and as different as the theme asks (QA round 3, 2026-11-20: Propeller week stayed after one
     propeller plane, Heavy week after two of one wide-body type). flags count each aircraft once a day. */
  const n = (k) => f[k] ?? 0, types = [...(st.types7 ?? st.byType ?? new Map()).keys()];
  const wideTypes = types.filter((t) => WIDE.test(t)).length, families = new Set(types.map((t) => planeSet(t, false).id)).size + (n('heli') && !types.some((t) => planeSet(t, false).id === 'helicopters') ? 1 : 0);
  return ({ 'sky-airlines': st.airlines7 ? st.airlines7 >= 5 : n('airline') >= 5, 'sky-heavy': wideTypes >= 3, 'sky-props': n('prop') >= 3, 'sky-longhaul': f.routed ? n('ocean') >= 3 : n('wide') >= 3 && !!f.airline,
    'sky-families': families >= 4, 'sky-regulars': owned, 'sky-newcards': true, 'sky-hops': f.routed ? n('short') >= 3 : n('low') >= 3 && !!f.airline, 'sky-night': dark,
    'sky-passport': st.countries7 ? st.countries7 >= 4 : f.routed ? n('abroad') >= 3 : !!f.airline, 'sky-livery': n('airline') >= 5, 'sky-makers': makers >= 4 })[b] ?? true;
}
export function chooseSkyWeek(ws, chosen, st, ctx = {}) {
  if (chosen?.[ws] || ws < SKY_V2_WEEKS) return null;
  const L = SKY_WEEK_THEMES, i0 = weekIndex(ws) % L.length;
  for (let k = 0; k < L.length; k++) { const th = L[(i0 + k) % L.length]; if (skyWeekPossible(th.id, st, ctx)) return th.id === 'sky-newcards' ? `sky-newcards:${({ quiet: 4, steady: 6 })[st?.sky] ?? 8}` : th.id; }
  return L[i0].id;
}
const SPACE_WEEK_THEMES = WEEK_THEMES.slice();
const RANK_AT = RANKS.map((r) => r[0]), SKY_RANK_AT = { 1: 480, 2: 2000 }; /* 480 (was 700) with the starter missions worth 20 XP each (2026-11-19, scripts/sim/week.mjs: the first rank-up now lands on day 2 for light, normal and heavy players) */ /* a plane catch makes two cards, so the first two ranks sit further out and the first rank-up still lands on day 2 (docs/DESIGN-LOOP.md §4) */
/* Space words on a shared patch, renamed for planes (playtest 2026-11-18: "First Light" is a telescope's first look) */
const SKY_PATCH_NAMES = { first: 'Wheels Up', streak4: 'Frequent Flyer', sightings100: 'Hundred Catches', double: 'Double Catch' /* Sevaan 2026-11-20: no "sighting" in a name; ids unchanged */ }, SPACE_PATCH_NAMES = {};
export function setSkyProgress(on) { SKY = !!on; useCalendarDays(SKY); for (const x of ACHIEVEMENTS) if (x.id in SKY_PATCH_NAMES) { SPACE_PATCH_NAMES[x.id] ??= x.name; x.name = SKY ? SKY_PATCH_NAMES[x.id] : SPACE_PATCH_NAMES[x.id]; } RANKS.forEach((r, i) => { r[1] = (SKY ? SKY_RANK_NAMES : RANK_NAMES)[i] ?? r[1]; r[0] = SKY ? SKY_RANK_AT[i] ?? RANK_AT[i] : RANK_AT[i]; }); WEEK_THEMES.splice(0, WEEK_THEMES.length, ...(SKY ? SKY_WEEK_THEMES : SPACE_WEEK_THEMES)); }
const SKY_REPEAT_XP = 3, RARE_HERE_XP = 10, SKY_STARTER_XP = 20; /* the first day's three missions: their own badge (Cleared for Takeoff), less XP than a day's missions (QA 2026-11-19: the first session gave 460 XP and 8 patches) */ /* a stamp on a card you own; a plane that is unusual where you stand */
export const isSkyProgress = () => SKY;
const activeMissions = () => (SKY ? SKY_MISSIONS.slice(0, 16) /* the plain draw (a day with no stored deal) keeps the first sixteen, so past days score the same */ : MISSIONS);
export const activeAchievements = () => (SKY ? [...ACHIEVEMENTS.filter((x) => SKY_PATCHES.has(x.id)).map((x) => (SKY_OVER[x.id] ? { ...x, ...SKY_OVER[x.id] } : x)), ...SKY_ACHIEVEMENTS, ...SKY_PATCHES_MORE] : ACHIEVEMENTS);
const MISSION_BY_ID = new Map([...MISSIONS, ...RETIRED, ...STARTER].map((m) => [m.id, m]));
const SKY_BY_ID = new Map([...SKY_STARTER_V1, ...SKY_STARTER, ...SKY_MISSIONS].map((m) => [m.id, m]));
/* a stored id: 'wide', or a sized one 'three10:2' (its id stays 'three10' for the screens) */
function missionById(key) {
  if (!SKY) return MISSION_BY_ID.get(key) ?? null;
  const [base, k] = String(key).split(':');
  if (k != null) return SIZED[base] && Number(k) > 0 ? { id: base, key, ...SIZED[base](Number(k)) } : null;
  return SKY_BY_ID.get(base) ?? null;
}
// Seeded by the night (a day index from nightKey): integer mixing with Math.imul, so the picks spread evenly
// from one night to the next. (The old float LCG overflowed 2^53 and kept dealing the same few missions.)
// possible (optional): a Set of mission ids that can be done tonight from here (main.js asks the tonight worker
// which have a qualifying pass, playtest 2026-10-09); the draw skips the rest while enough remain.
export function missionsFor(night, possible = null) {
  let h = 0; for (const c of String(night)) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0;
  const next = () => { h = (h + 0x6d2b79f5) >>> 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0); };
  const M = activeMissions(), ok = possible ? M.filter((m) => possible.has(m.id)) : [];
  /* Sky: too few possible missions are topped up from ones any sky allows, never from impossible ones (QA 2026-11-19: a new
     place was dealt "rare around here" with no local log) */
  const fill = SKY && possible && ok.length < 3 ? M.filter((m) => ALWAYS.has(m.id) && !ok.includes(m)) : null;
  const pick = [], pool = (ok.length >= 3 ? ok : fill ? [...ok, ...fill] : M).slice();
  while (pick.length < 3) pick.push(pool.splice(next() % pool.length, 1)[0]);
  return pick;
}
// The missions a night actually had: the starter set on a first night, else a stored deal (main.js saves tonight’s
// once, from the sky), else the plain draw. Everywhere that shows or scores missions goes through this.
function missionsOf(night, { first = false, deals = null } = {}) {
  if (first) return SKY ? (Number(night) >= nightKey(SKY_V2_DAY) ? SKY_STARTER : SKY_STARTER_V1) : STARTER;
  const ids = (deals?.[night] ?? []).filter?.((id) => !String(id).startsWith('ch:')) ?? [], ms = ids.map(missionById);
  if (ms.length === 3 && ms.every(Boolean)) return ms;
  return missionsFor(night);
}

// Stored deals (see main.js dealMissions): { [nightKey]: [missionId × 3] }.
export function readDeals() { try { return JSON.parse(localStorage.getItem('missionDeals')) || {}; } catch { return {}; } }

// The one-time carry that keeps an existing player’s rank through the flatter XP (see TIER_XP): the XP needed to
// reach the rank the old numbers gave them. Worked out once, the first time the new numbers run, and kept.
export function xpCarry(sightings, info, opts = {}) {
  return giftCarry().xp; /* the old tier carry was retired before launch with rankFloor (2026-10-28); the gift carry uses its slot (2026-11-11) */
  try { const v = localStorage.getItem('xpCarry2'); if (v != null) return Number(v) || 0; } catch {} // v2: after the difficulty re-tier (2026-10-10)
  let carry = 0;
  if (real(sightings).length) {
    const old = progress(sightings, info, { ...opts, tierXp: LEGACY_TIER_XP }), cur = progress(sightings, info, { ...opts, carry: 0 });
    carry = Math.max(0, old.rank.at - cur.xp);
  }
  try { localStorage.setItem('xpCarry2', String(carry)); } catch {}
  return carry;
}

// ---------- achievements ----------
// Grouped so a collector always has a next one in reach. `icon` is the short text in the badge circle
// (≤ 4 characters). Everything is read off the accumulator `a` built in progress(); nothing is stored.
const T_HAS = (t) => (a) => a.tiers.has(t);
// Sky Collector's own patches (docs/DESIGN-LOOP.md §5, approved 2026-11-17). Text icons until they have art.
const skyK = (a) => a.sky ?? { wide: 0, b747: 0, a380: 0, heli: 0, freightNight: 0, hop: 0, far: 0, airlines: new Set(), propDays: new Map(), flightDays: new Map() };
const maxSize = (m) => { let n = 0; for (const v of m.values()) n = Math.max(n, v.size); return n; };
const SKY_ACHIEVEMENTS = [
  { id: 'sky-starter', name: 'Cleared for Takeoff', text: 'Finish your three first-day missions', icon: '', done: (a) => !!a.starterDone },
  { id: 'sky-heavy', name: 'Heavy Metal', text: 'Catch a twin-aisle jet', icon: '2✈', done: (a) => skyK(a).wide >= 1 },
  { id: 'sky-jumbo', name: 'Jumbo', text: 'Catch a Boeing 747', icon: '747', done: (a) => skyK(a).b747 >= 1 },
  { id: 'sky-superjumbo', name: 'Superjumbo', text: 'Catch an Airbus A380', icon: '380', done: (a) => skyK(a).a380 >= 1 },
  { id: 'sky-rotor', name: 'Rotor Head', text: 'Catch a helicopter', icon: '✢', done: (a) => skyK(a).heli >= 1 },
  { id: 'sky-propday', name: 'Prop Day', text: 'Catch three propeller planes in one day', icon: '✣3', done: (a) => maxSize(skyK(a).propDays) >= 3 },
  { id: 'sky-freightnight', name: 'Freight Night', text: 'Catch a cargo flight after dark', icon: '▣', done: (a) => skyK(a).freightNight >= 1 },
  { id: 'sky-hopper', name: 'Hopper', get text() { return `Catch a flight shorter than ${distText(300)}`; }, icon: '⤻', done: (a) => skyK(a).hop >= 1 },
  { id: 'sky-globetrotter', name: 'Globetrotter', get text() { return `Catch a flight longer than ${distText(10000)}`; }, icon: '10K', done: (a) => skyK(a).far >= 1 },
  { id: 'sky-airlines5', name: 'Five Airlines', text: 'Catch five different airlines', icon: '5', done: (a) => skyK(a).airlines.size >= 5 },
  { id: 'sky-airlines25', name: 'Twenty-five Airlines', text: 'Catch 25 different airlines', icon: '25', done: (a) => skyK(a).airlines.size >= 25 },
  { id: 'sky-regular', name: 'Regular', text: 'Catch the same flight on 15 days: a gold flight card', icon: '15', done: (a) => maxSize(skyK(a).flightDays) >= 15 },
  { id: 'sky-rarehere', name: 'Rare Here', text: 'Catch five planes that are rare where you are', icon: '◆5', done: (a) => (a.rareHere ?? 0) >= 5 },
  { id: 'sky-fullhangar', name: 'Full Hangar', text: 'Bring five albums to silver', icon: '▦5', done: (a) => (a.albumsSilver ?? 0) >= 5 },
  /* 2026-11-20 (design/missions-draft.md "Milestones"): the new ones. Kinds are type codes you've caught; a type with no
     verified year, engine count or maker never counts (js/sky-kinds.js). */
  ...[
    ['sky-shinyall', 'Full Shine', 'Catch all three kinds of shiny: by the Moon, at sunrise or sunset, and in new colours', '✧3', 3, (a) => ['moon', 'golden', 'colours'].filter((x) => K3(a).shinies.has(x)).length],
    ['sky-secrets3', 'Secret Keeper', 'Find 3 secrets', 'S3', 3, (a) => K3(a).secrets ?? 0],
    ['sky-secrets10', 'Hidden Hangar', 'Find 10 secrets', 'S10', 10, (a) => K3(a).secrets ?? 0],
    ['sky-trijet', 'Three Engines', 'Catch a plane with three engines', '3E', 1, (a) => (K3(a).engines?.has(3) ? 1 : 0)],
    ['sky-single', 'One Engine', 'Catch a plane with one engine', '1E', 1, (a) => (K3(a).engines?.has(1) ? 1 : 0)],
    ['sky-engines4', 'Engine Room', 'Catch planes with one, two, three and four engines', '1234', 4, (a) => [1, 2, 3, 4].filter((n) => K3(a).engines?.has(n)).length],
    ['sky-makers5', 'Plane Makers', 'Catch planes from 5 different makers', 'MK5', 5, (a) => K3(a).makers?.size ?? 0],
    ['sky-makers10', 'Factory Tour', 'Catch planes from 10 different makers', 'MK10', 10, (a) => K3(a).makers?.size ?? 0],
    ['sky-bigtwo', 'Big Two', 'Catch five kinds of Boeing and five kinds of Airbus', 'B+A', 10, (a) => Math.min(5, K3(a).boeing ?? 0) + Math.min(5, K3(a).airbus ?? 0)],
    ['sky-newgen', 'New Generation', 'Catch 5 kinds of plane that first flew in the last 10 years', 'NEW', 5, (a) => K3(a).newgen ?? 0],
    ['sky-nightshift', 'Night Shift', 'Catch 25 planes after dark', 'NGT', 25, (a) => K3(a).night],
    ['sky-upaway', 'Up and Away', 'Catch 10 planes on their way up', 'UP', 10, (a) => K3(a).up],
    ['sky-continents3', 'Three Continents', 'Catch flights heading to 3 continents', 'C3', 3, (a) => K3(a).continents.size],
    ['sky-alliances', 'Alliance Hat Trick', 'Catch an airline from each of the three alliances', 'AL3', 3, (a) => (a.sky2 ? ['star', 'oneworld', 'skyteam'].filter((x) => a.sky2.alliances[x].size).length : 0)],
    ['sky-biz5', 'Jet Set', 'Catch 5 kinds of business jet', 'BIZ', 5, (a) => K3(a).biz ?? 0],
    ['sky-albums10', 'Album Starter', 'Have a card in 10 albums', 'AB10', 10, (a) => K3(a).albums.size],
    ['sky-missions100', 'Old Hand', 'Complete 100 missions', 'M100', 100, (a) => a.missionsDone],
    ['sky-weeks4', 'Four Weeks', 'Finish 4 week themes', 'W4', 4, (a) => a.weeksDone ?? 0],
    ['sky-weeks12', 'Every Week', 'Earn all 12 week patches', 'W12', 12, (a) => a.weekThemes?.size ?? 0],
  ].map(([id, name, text, icon, need, have]) => ({ id, name, text, icon, done: (a) => have(a) >= need, prog: (a) => [Math.min(need, have(a)), need] })),
];
const K3 = (a) => a.sky3 ?? { types: new Set(), shinies: new Set(), continents: new Set(), quarters: new Set(), albums: new Set(), night: 0, up: 0 };
/* Space patches that Sky now has too, in Sky's own words and counts (2026-11-20): levels per card, shinies, first-flight
   years, the four quarters of the sky (north, east, south and west) */
const SKY_OVER = {
  silver: { text: 'Turn a card silver: a flight on 5 days, or 10 aircraft of one kind', done: (a) => (a.skySilver ?? 0) >= 1, skyProg: (a) => [Math.min(1, a.skySilver ?? 0), 1] },
  gold: { text: 'Turn a card gold: a flight on 15 days, or 50 aircraft of one kind', done: (a) => (a.skyGold ?? 0) >= 1, skyProg: (a) => [Math.min(1, a.skyGold ?? 0), 1] },
  gold3: { text: 'Three gold cards', done: (a) => (a.skyGold ?? 0) >= 3, skyProg: (a) => [Math.min(3, a.skyGold ?? 0), 3] },
  oldtimer: { text: 'Catch a kind of plane that first flew before 1970', done: (a) => K3(a).oldest != null && K3(a).oldest < 1970, skyProg: null },
  decades: { text: 'Catch kinds of plane that first flew in 6 different decades', done: (a) => (K3(a).decades?.size ?? 0) >= 6, skyProg: (a) => [Math.min(6, K3(a).decades?.size ?? 0), 6] },
  compass: { text: 'Catch planes in all four quarters of the sky: north, east, south and west', done: (a) => K3(a).quarters.size >= 4, skyProg: (a) => [K3(a).quarters.size, 4] },
  sightings100: { text: 'Catch 100 planes', skyProg: (a) => [Math.min(100, a.sightings), 100] },
  marathon: { text: 'Catch 10 planes in one day' },
  /* QA round 3 (2026-11-20): Space's words (log, observe, night) left on Sky's patches */
  owl: { text: 'Catch a plane between 1 and 4 AM' }, twilight: { text: 'Catch a plane between 5 and 9 PM' }, dawn: { text: 'Catch a plane between 4 and 7 AM' }, /* wording pass 2026-11-20 (content/sky-patches-missions-wording-2026-11-20.md 2a) */
  months3: { text: 'Catch a plane in 3 different months' }, months12: { text: 'Catch a plane in 12 different months' }, roadtrip: { get text() { return `Catch planes from two places more than ${distText(100)} apart`; } }, streak4: { text: 'Catch a plane 4 weeks in a row' }, streak12: { text: 'Catch a plane 12 weeks in a row' },
  anniversary: { text: 'Still spotting a year after your first catch' }, fullhouse: { text: 'Complete all three missions in one day' },
};
export const ACHIEVEMENTS = [
  // Collecting
  { id: 'first', name: 'First Light', text: 'Collect your first card', icon: '✦', done: (a) => a.cards >= 1 },
  { id: 'ten', name: 'Logbook', text: 'Collect 10 cards', icon: '10', done: (a) => a.cards >= 10 },
  { id: 'twentyfive', name: 'Field Guide', text: 'Collect 25 cards', icon: '25', done: (a) => a.cards >= 25 },
  { id: 'fifty', name: 'Half Century', text: 'Collect 50 cards', icon: '50', done: (a) => a.cards >= 50 },
  { id: 'hundred', name: 'Centurion', text: 'Collect 100 cards', icon: '100', done: (a) => a.cards >= 100 },
  { id: 'archivist', name: 'Archivist', text: 'Collect 250 cards', icon: '250', done: (a) => a.cards >= 250 },
  { id: 'curator', name: 'Curator', text: 'Collect 500 cards', icon: '500', done: (a) => a.cards >= 500 },
  { id: 'catalogue', name: 'The Catalogue', text: 'Collect 1,000 cards', icon: '1k', done: (a) => a.cards >= 1000 },
  { id: 'sightings100', name: 'Hundred Sightings', text: 'Log 100 sightings', icon: '§', done: (a) => a.sightings >= 100 },
  // Rarity
  { id: 'legend', name: 'Legend', text: 'Collect a Legendary card', icon: '★', done: T_HAS('legendary') },
  { id: 'epic', name: 'Epic', text: 'Collect an Epic card', icon: '✪', done: T_HAS('epic') },
  { id: 'spectrum', name: 'Full Spectrum', text: 'Collect every rarity, Common to Legendary', icon: '5', done: (a) => ['common', 'uncommon', 'rare', 'epic', 'legendary'].every((t) => a.tiers.has(t)) },
  { id: 'legends5', name: 'Hall of Legends', text: 'Collect 5 Legendary cards', icon: '★5', done: (a) => (a.tierCount.legendary ?? 0) >= 5 },
  { id: 'legends25', name: 'Pantheon', text: 'Collect 15 Legendary cards', icon: '★15', done: (a) => (a.tierCount.legendary ?? 0) >= 15 }, // was 25; only 123 Legendaries since the 2026-10-10 re-tier (id kept)
  { id: 'shiny', name: 'Shiny Hunter', text: 'Catch a shiny', icon: '✧', done: (a) => a.shinies >= 1 },
  { id: 'shiny5', name: 'Shiny Collector', text: 'Catch 5 shinies', icon: '✧5', done: (a) => a.shinies >= 5 },
  // What it is
  { id: 'stage', name: 'Stage Hand', text: 'Catch a rocket stage', icon: '▲', done: (a) => (a.typeCount['rocket-body'] ?? 0) >= 1 },
  { id: 'stages25', name: 'Boneyard', text: 'Catch 25 rocket stages', icon: '▲25', done: (a) => (a.typeCount['rocket-body'] ?? 0) >= 25 },
  { id: 'junk', name: 'Junk Collector', text: 'Catch a piece of space debris', icon: '⁂', done: (a) => (a.typeCount.debris ?? 0) >= 1 },
  { id: 'station', name: 'Crewed', text: 'Catch a space station', icon: '⌂', done: (a) => (a.typeCount.station ?? 0) >= 1 },
  { id: 'stations', name: 'Both Stations', text: 'Catch the ISS and Tiangong', icon: '⌂2', done: (a) => (a.typeCount.station ?? 0) >= 2 },
  { id: 'satellites50', name: 'Payload', text: 'Catch 50 satellites', icon: '50', done: (a) => (a.typeCount.satellite ?? 0) >= 50 },
  // Whose it is
  { id: 'nations', name: 'Around the World', text: 'Objects from 8 different countries or agencies', icon: '8', done: (a) => a.owners.size >= 8 },
  { id: 'diplomat', name: 'Diplomat', text: 'Objects from 15 different countries or agencies', icon: '15', done: (a) => a.owners.size >= 15 },
  { id: 'bigthree', name: 'Big Three', text: 'American, Russian and Chinese objects', icon: '3', done: (a) => a.owners.has('US') && a.owners.has('CIS') && a.owners.has('PRC') },
  { id: 'redstar', name: 'Red Star', text: '10 Soviet or Russian objects', icon: '☭', done: (a) => (a.ownerCount.CIS ?? 0) >= 10 },
  { id: 'stripes', name: 'Stars and Stripes', text: '10 American objects', icon: 'US', done: (a) => (a.ownerCount.US ?? 0) >= 10 },
  { id: 'longmarch', name: 'Long March', text: '10 Chinese objects', icon: 'CN', done: (a) => (a.ownerCount.PRC ?? 0) >= 10 },
  { id: 'europe', name: 'Old World', text: 'A European object (ESA, France, Germany, UK or Italy)', icon: 'EU', done: (a) => ['ESA', 'FR', 'GER', 'UK', 'IT'].some((o) => a.owners.has(o)) },
  { id: 'japan', name: 'Rising Sun', text: 'A Japanese object', icon: 'JP', done: (a) => a.owners.has('JPN') },
  { id: 'india', name: 'Mangalyaan', text: 'An Indian object', icon: 'IN', done: (a) => a.owners.has('IND') },
  { id: 'race', name: 'Space Race', text: 'A Soviet object and an American one on the same night', icon: '⚔', done: (a) => a.race },
  // When it flew
  { id: 'oldtimer', name: 'Old Timer', text: 'Catch something launched before 1970', icon: '60s', done: (a) => a.oldest != null && a.oldest < 1970 },
  { id: 'sputnik', name: 'Sputnik Era', text: 'Catch something launched before 1960', icon: '58', done: (a) => a.oldest != null && a.oldest < 1960 },
  { id: 'coldwar', name: 'Cold War', text: '10 objects launched before 1991', icon: '≤90', done: (a) => a.pre1991 >= 10 },
  { id: 'decades', name: 'Time Traveller', text: 'Objects from 6 different decades', icon: '6×10', done: (a) => a.decades.size >= 6 },
  { id: 'headliners', name: 'Top of the Bill', text: 'Catch 10 of tonight’s headliners', icon: 'TOP', done: (a) => (a.headliners ?? 0) >= 10 },
  { id: 'witness', name: 'Witness', text: 'Collect 3 last-chance satellites before they fall', icon: 'LC', done: (a) => (a.witness ?? 0) >= 3 },
  // Reunions (2026-10-17): own a rocket stage and the satellite it carried (card-model.js partners).
  { id: 'reunion', name: 'Reunited', text: 'Collect a rocket stage and the satellite it carried', icon: 'RU', done: (a) => (a.reunions ?? 0) >= 1 },
  { id: 'reunion10', name: 'Family Reunion', text: 'Reunite 10 rocket stages with their satellites', icon: 'RU', done: (a) => (a.reunions ?? 0) >= 10 },
  { id: 'reunion25', name: 'Mission Control Archivist', text: 'Reunite 25 rocket stages with their satellites', icon: 'RU', done: (a) => (a.reunions ?? 0) >= 25 },
  { id: 'brandnew', name: 'Fresh Off the Pad', text: 'Catch something launched within the last 30 days', icon: 'NEW', done: (a) => a.brandNew },
  // Fleets
  { id: 'starlink', name: 'Train Spotter', text: 'Stamp a Starlink launch', icon: 'SL', done: (a) => (a.fleet.STARLINK ?? 0) >= 1 },
  { id: 'starlink10', name: 'Regular Service', text: 'Stamp 10 Starlink launches', icon: 'SL10', done: (a) => (a.fleet.STARLINK ?? 0) >= 10 },
  { id: 'starlink50', name: 'Megaconstellation', text: 'Stamp 50 Starlink launches for a gold fleet card', icon: 'SL50', done: (a) => (a.fleet.STARLINK ?? 0) >= 50 },
  { id: 'fleets', name: 'Fleet Admiral', text: 'Stamp a launch from all four fleets', icon: '⚓', done: (a) => ['STARLINK', 'ONEWEB', 'KUIPER', 'QIANFAN'].every((f) => (a.fleet[f] ?? 0) >= 1) },
  // Sky
  { id: 'moon', name: 'Moonstruck', text: 'Collect the Moon', icon: '☾', done: (a) => a.naturals.has('moon') },
  { id: 'mars', name: 'Red Planet', text: 'Collect Mars', icon: '♂', done: (a) => a.naturals.has('planet:mars') },
  { id: 'saturn', name: 'Ringed', text: 'Collect Saturn', icon: '♄', done: (a) => a.naturals.has('planet:saturn') },
  { id: 'wanderers', name: 'Wanderer', text: 'Collect the Moon and the five bright planets', icon: '6', done: (a) => a.wanderers >= 6 },
  { id: 'stars10', name: 'Astronomer', text: 'Collect 10 constellation stars', icon: '✶10', done: (a) => a.stars >= 10 },
  { id: 'deep3', name: 'Deep Sky', text: 'Collect 3 star clusters, nebulae or galaxies', icon: '◌3', done: (a) => (a.deep ?? 0) >= 3 }, // 2026-10-11
  { id: 'deep10', name: 'Island Universes', text: 'Collect 10 star clusters, nebulae or galaxies', icon: '◌10', done: (a) => (a.deep ?? 0) >= 10 },
  // Star Map ('Complete a constellation') retired 2026-10-10: it always landed with that constellation’s own patch.
  { id: 'cons5', name: 'Cartographer', text: 'Complete 5 constellations', icon: '✶5', done: (a) => a.cons >= 5 },
  { id: 'zodiac', name: 'Zodiac', text: 'Complete all 12 zodiac constellations', icon: 'XII', done: (a) => a.zodiac >= 12 },
  { id: 'cons25', name: 'Atlas', text: 'Complete 18 constellations', icon: '✶18', done: (a) => a.cons >= 18 }, // any 18 of the 88 (2026-10-11); it was all 18 when there were only 18 (playtest 2026-10-09), and 25 before that; id kept so earned dates stay
  { id: 'cons44', name: 'Half the Sky', text: 'Complete 44 constellations, half of all 88', icon: '✶44', done: (a) => a.cons >= 44 }, // 2026-10-11, with all 88 added; a years-long goal
  // Where you looked
  { id: 'zenith', name: 'Straight Up', text: 'Catch something more than 85° up', icon: '90°', done: (a) => a.maxEl >= 85 },
  { id: 'horizon', name: 'Horizon Hunter', text: 'Catch a satellite under 12° up', icon: '12°', done: (a) => a.minSatEl != null && a.minSatEl <= 12 },
  { id: 'compass', name: 'Compass Rose', text: 'Sightings in all four quarters of the sky', icon: 'NESW', done: (a) => a.quadrants.size >= 4 },
  { id: 'faint', name: 'Keen Eye', text: 'Catch something fainter than magnitude 5', icon: 'mag', done: (a) => a.faintest != null && a.faintest >= 5 },
  { id: 'brilliant', name: 'Blinding', text: 'Catch a satellite brighter than magnitude 0', icon: '−0', done: (a) => a.brightestSat != null && a.brightestSat <= 0 },
  { id: 'close', name: 'Close Pass', text: 'Catch something within 450 km', icon: '450', done: (a) => a.closest != null && a.closest <= 450 },
  { id: 'far', name: 'Far Out', text: 'Catch something more than 2,000 km away', icon: '2k', done: (a) => a.farthest != null && a.farthest >= 2000 },
  // When you looked
  { id: 'twilight', name: 'Dusk Patrol', text: 'Log a sighting between 5 and 9 PM', /* was 'Early Bird', earned at 6 pm (playtest 2026-11-10); pairs with Dawn Patrol */ icon: '21', done: (a) => a.hours.some((h) => h >= 17 && h < 21) },
  { id: 'owl', name: 'Night Owl', text: 'Log a sighting between 1 and 4 AM', icon: '☾', done: (a) => a.hours.some((h) => h >= 1 && h < 4) },
  { id: 'dawn', name: 'Dawn Patrol', text: 'Log a sighting between 4 and 7 AM', icon: '☀', done: (a) => a.hours.some((h) => h >= 4 && h < 7) },
  { id: 'marathon', name: 'Marathon', text: 'Log 10 sightings in one night', icon: '10/n', done: (a) => a.maxNight >= 10 },
  { id: 'double', name: 'Double Sighting', text: 'Collect two new cards within a minute', icon: '×2', done: (a) => a.double },
  { id: 'hattrick', name: 'Hat Trick', text: 'Collect three new cards within five minutes', icon: '×3', done: (a) => a.triple },
  { id: 'months3', name: 'Season Ticket', text: 'Sightings in 3 different months', icon: '3m', done: (a) => a.months.size >= 3 },
  { id: 'months12', name: 'Full Year', text: 'Sightings in 12 different months', icon: '12m', done: (a) => a.months.size >= 12 },
  { id: 'streak4', name: 'Regular', text: 'Observe 4 weeks in a row', icon: '4w', done: (a) => a.bestStreak >= 4 },
  { id: 'streak12', name: 'Devoted', text: 'Observe 12 weeks in a row', icon: '12w', done: (a) => a.bestStreak >= 12 },
  { id: 'anniversary', name: 'Anniversary', text: 'Still observing a year after your first sighting', icon: '1y', done: (a) => a.spanDays >= 365 },
  // Coming back
  { id: 'silver', name: 'Regular Visitor', text: 'Turn a card silver: see a satellite or rocket stage on 3 different nights', icon: 'Ag', done: (a) => a.maxNightsOnCard >= 3 },
  { id: 'gold', name: 'Old Friend', text: 'Turn a card gold: see a satellite or rocket stage on 10 different nights', icon: 'Au', done: (a) => a.maxNightsOnCard >= 10 },
  { id: 'gold3', name: 'Inner Circle', text: 'Three gold cards', icon: 'Au3', done: (a) => a.goldCards >= 3 },
  { id: 'roadtrip', name: 'Road Trip', text: 'Sightings from two places more than 100 km apart', icon: '100k', done: (a) => a.spreadKm >= 100 },
  // Missions
  { id: 'choochoo', name: 'Choo Choo', text: 'Catch five Starlink trains', icon: 'TRN', done: (a) => (a.trains ?? 0) >= 5 },
  { id: 'missions10', name: 'On Assignment', text: 'Complete 10 missions', icon: 'M10', done: (a) => a.missionsDone >= 10 },
  { id: 'fullhouse', name: 'Full House', text: 'Complete all three missions in one night', icon: '3/3', done: (a) => a.fullHouse },
  { id: 'missions50', name: 'Veteran', text: 'Complete 50 missions', icon: 'M50', done: (a) => a.missionsDone >= 50 },
];

// How far along a locked patch is, [have, goal], for the ones that count something (playtest 2026-10-09: a locked
// patch shows its progress stitched part-way round the border, and the detail view says "3 of 10").
const PROG = {
  'sky-airlines5': (a) => [skyK(a).airlines.size, 5], 'sky-airlines25': (a) => [skyK(a).airlines.size, 25], 'sky-regular': (a) => [maxSize(skyK(a).flightDays), 15], 'sky-propday': (a) => [maxSize(skyK(a).propDays), 3], 'sky-rarehere': (a) => [a.rareHere ?? 0, 5], 'sky-fullhangar': (a) => [a.albumsSilver ?? 0, 5],
  witness: (a) => [a.witness ?? 0, 3], reunion: (a) => [a.reunions ?? 0, 1], reunion10: (a) => [a.reunions ?? 0, 10], reunion25: (a) => [a.reunions ?? 0, 25], headliners: (a) => [a.headliners ?? 0, 10], first: (a) => [a.cards, 1], ten: (a) => [a.cards, 10], twentyfive: (a) => [a.cards, 25], fifty: (a) => [a.cards, 50], hundred: (a) => [a.cards, 100],
  archivist: (a) => [a.cards, 250], curator: (a) => [a.cards, 500], catalogue: (a) => [a.cards, 1000], sightings100: (a) => [a.sightings, 100],
  spectrum: (a) => [a.tiers.size, 5], legends5: (a) => [a.tierCount.legendary ?? 0, 5], legends25: (a) => [a.tierCount.legendary ?? 0, 15], shiny5: (a) => [a.shinies, 5],
  stages25: (a) => [a.typeCount['rocket-body'] ?? 0, 25], stations: (a) => [a.typeCount.station ?? 0, 2], satellites50: (a) => [a.typeCount.satellite ?? 0, 50],
  nations: (a) => [a.owners.size, 8], diplomat: (a) => [a.owners.size, 15], redstar: (a) => [a.ownerCount.CIS ?? 0, 10], stripes: (a) => [a.ownerCount.US ?? 0, 10],
  longmarch: (a) => [a.ownerCount.PRC ?? 0, 10], coldwar: (a) => [a.pre1991, 10], decades: (a) => [a.decades.size, 6],
  starlink10: (a) => [a.fleet.STARLINK ?? 0, 10], starlink50: (a) => [a.fleet.STARLINK ?? 0, 50], fleets: (a) => [['STARLINK', 'ONEWEB', 'KUIPER', 'QIANFAN'].filter((f) => a.fleet[f]).length, 4],
  wanderers: (a) => [a.wanderers, 6], stars10: (a) => [a.stars, 10], deep3: (a) => [a.deep ?? 0, 3], deep10: (a) => [a.deep ?? 0, 10], cons5: (a) => [a.cons, 5], zodiac: (a) => [a.zodiac, 12], cons25: (a) => [a.cons, 18], cons44: (a) => [a.cons, 44],
  compass: (a) => [a.quadrants.size, 4], marathon: (a) => [a.maxNight, 10], months3: (a) => [a.months.size, 3], months12: (a) => [a.months.size, 12],
  streak4: (a) => [a.bestStreak, 4], streak12: (a) => [a.bestStreak, 12], silver: (a) => [a.maxNightsOnCard, 3], gold: (a) => [a.maxNightsOnCard, 10], gold3: (a) => [a.goldCards, 3],
  choochoo: (a) => [a.trains ?? 0, 5], missions10: (a) => [a.missionsDone, 10], missions50: (a) => [a.missionsDone, 50],
};

// Weeks with at least one sighting -> current and best streak of consecutive weeks. Weeks run in 7-day blocks from
// your first night out, not Monday to Sunday (playtest room 2026-10-11: Sunday then Monday read "2-week streak 🔥" on
// day 2, which felt unearned).
const dayNum = (time) => { const d = new Date(time); d.setHours(12, 0, 0, 0); return Math.round(d.getTime() / 86400e3); };
// Cloudy weeks don’t break a streak (2026-10-17, Sevaan: "just don’t count cloudy days towards streaks"). Explore saves
// each night’s forecast as it learns it (localStorage skyNights: { dayNum: 1 cloudy | 0 clear }, main.js recordSkyNights);
// a week with no sighting and 4 or more cloudy nights is skipped: it neither adds to the streak nor ends it.
function cloudyDays() { try { return JSON.parse(localStorage.getItem('skyNights') || '{}'); } catch { return {}; } }
export function streaks(sightings, now = Date.now(), cloudy = cloudyDays()) {
  // Counted by observing night (noon to noon), so a session that runs past midnight is one night, not two days that
  // can land in two streak weeks (bug hunt 2026-10-20). Cloudy nights are keyed by the evening's day, which matches.
  const night = (t) => dayNum(SKY ? t : t - 12 * 3600e3); /* Sky: calendar days (QA 2026-11-19) */
  const days = real(sightings).map((s) => night(s.time)); if (!days.length) return { current: 0, best: 0, thisWeek: false };
  const first = Math.min(...days), weekIndex = (t) => Math.floor((night(t) - first) / 7), cur = weekIndex(now);
  const seen = new Set(days.map((d) => Math.floor((d - first) / 7)));
  const cloudyWeek = (w) => { let n = 0; for (let d = first + w * 7; d < first + w * 7 + 7; d++) if (cloudy[d] === 1) n++; return n >= 4; };
  let best = 0, run = 0;
  for (let w = 0; w <= cur; w++) {
    if (seen.has(w)) { run++; best = Math.max(best, run); }
    else if (w === cur || cloudyWeek(w)) continue; // this week isn’t over yet; a cloudy week is skipped
    else run = 0;
  }
  return { current: run, best, thisWeek: seen.has(cur) };
}

// constellations: [{ id, stars: [cardKey], zodiac }] for completion counts.
export function progress(sightings, info, { constellations = [], albums = [], now = Date.now(), deals = null, carry = 0, tierXp = TIER_XP, lon = null, weekThemes = null, keep = true } = {}) {
  const list = real(sightings);
  const seenCard = new Set(), seenNight = new Set(), nights = new Map();
  let xp = 0;
  const a = { cards: 0, sightings: list.length, tiers: new Set(), tierCount: {}, typeCount: {}, shinies: 0, hours: [], double: false, triple: false,
    oldest: null, pre1991: 0, decades: new Set(), brandNew: false, race: false, wanderers: 0, naturals: new Set(), stars: 0, cons: 0, zodiac: 0,
    owners: new Set(), ownerCount: {}, fleet: {}, maxEl: -90, minSatEl: null, quadrants: new Set(), faintest: null, brightestSat: null,
    closest: null, farthest: null, maxNight: 0, months: new Set(), spanDays: 0, maxNightsOnCard: 0, goldCards: 0, spreadKm: 0, missionsDone: 0, fullHouse: false };
  // (Legacy XP reads tier0, each object’s tier before the 2026-10-10 difficulty re-tier.)
  const firsts = [], firstFlags = [], nightsOnCard = new Map(), fleetStamps = new Map(), places = [], placeSeen = new Set(), reunionRoles = new Map();
  /* Sky (2026-11-20, design/missions-draft.md): each card's own level (flights silver at 5 days and gold at 15, plane types
     at 10 and 50 aircraft, js/sky-stamps.js), history flags on each sighting (as `first`), and catches counted once */
  const histFlags = [], lvF = new Map(), lvP = new Map(), seenA3 = new Set(), seenLiv = new Set(), seenCc = new Set(), seenSet = new Set(), cardHex = new Map();
  const k3 = a.sky3 = { types: new Set(), night: 0, up: 0, shinies: new Set(), continents: new Set(), quarters: new Set(), albums: new Set() };
  let lastCatch = null, nCatch = 0;
  for (const s of list) {
    const i = info(s.cardKey), night = nightKey(s.time, s.lon ?? 0), first = !seenCard.has(s.cardKey), nk = `${s.cardKey}|${night}`;
    firstFlags.push(first); // in list order, for the weeks loop below (Star week needs it; bug hunt 2026-10-27)
    const newCatch = SKY && (!lastCatch || s.time - lastCatch.time >= 3000 || String(s.hex ?? '') !== String(lastCatch.hex ?? '')); if (newCatch) { lastCatch = s; nCatch++; }
    let hf = null, skyLv = false;
    if (SKY) {
      const c = snap(s), cs = String(s.callsign ?? ''), a3 = /^[A-Z]{3}\d/.test(cs) ? cs.slice(0, 3) : '', tc = String(s.typeCode ?? '').toUpperCase(), ck = String(s.cardKey ?? ''), r = route(s);
      hf = {};
      if (a3 && !seenA3.has(a3)) { seenA3.add(a3); hf.newAirline = true; }
      if (c.sky === 'plane' && tc && a3 && !seenLiv.has(`${tc}|${a3}`)) { seenLiv.add(`${tc}|${a3}`); hf.newLivery = true; if (!first) hf.ownLivery = true; } /* as the Livery patches count it */
      if (r?.to && ccOf(r.to) && !seenCc.has(ccOf(r.to))) { seenCc.add(ccOf(r.to)); hf.newCountry = true; }
      if (first && c.setId && !seenSet.has(c.setId)) { seenSet.add(c.setId); hf.newAlbum = true; }
      const hx = String(s.hex || `anon:${s.time}`).toLowerCase();
      if (/^F:/.test(ck)) { const d = lvF.get(ck) ?? lvF.set(ck, new Set()).get(ck), day = localDay(s.time); if (!d.has(day)) { d.add(day); skyLv = d.size === THRESHOLDS.flight[1] || d.size === THRESHOLDS.flight[2]; } }
      else if (c.sky === 'plane' || /^P:/.test(ck)) { const h = lvP.get(ck) ?? lvP.set(ck, new Set()).get(ck); if (!h.has(hx)) { h.add(hx); skyLv = h.size === THRESHOLDS.plane[1] || h.size === THRESHOLDS.plane[2]; if (!first) hf.moreAircraft = true; } }
      if (tc && !/^UNKNOWN/.test(tc)) k3.types.add(tc);
      if (newCatch) { if (isDark(s)) k3.night++; if (climbing(s, 1)) k3.up++; }
      if (s.shiny) k3.shinies.add(s.shiny);
      if (r) { const ct = continentOfAirport(r.to); if (ct) k3.continents.add(ct); }
      if (Number.isFinite(s.az)) k3.quarters.add(quarterOf(s.az));
      if (first && c.setId) k3.albums.add(c.setId);
    }
    histFlags.push(hf);
    const fam = s.stampKey && !String(s.stampKey).startsWith('MOON:') ? String(s.stampKey).split(':')[0] : null; // a fleet card (Starlink…): levelled by stamps, not nights
    if (first) {
      seenCard.add(s.cardKey); xp += tierXp[(tierXp === LEGACY_TIER_XP && i?.tier0) || i?.tier] ?? 10; a.cards++;
      /* Sky: one catch saves two cards (the flight and the plane) at the same moment, so Double Sighting and Hat Trick count
         catches, not cards (QA 2026-11-19: the first catch earned Double, the second Hat Trick) */
      const sameCatch = SKY && firsts.length && s.time - firsts[firsts.length - 1] < 3000;
      if (!sameCatch) {
        firsts.push(s.time);
        if (s.time - (firsts[firsts.length - 2] ?? -Infinity) <= 60000) a.double = true;
        if (firsts.length >= 3 && s.time - firsts[firsts.length - 3] <= 300000) a.triple = true;
      }
      if (i?.tier && i.natural !== 'story') a.tierCount[i.tier] = (a.tierCount[i.tier] ?? 0) + 1; // story cards have no rarity (they're shown as "Story" everywhere; round-2 playtest 2026-10-30: Ringside earned the Epic patch)
      if (i?.type && !i.natural) a.typeCount[i.type] = (a.typeCount[i.type] ?? 0) + 1;
      if (i?.owner && !i.natural) a.ownerCount[i.owner] = (a.ownerCount[i.owner] ?? 0) + 1;
      if (i?.natural) a.naturals.add(s.cardKey);
      if (i?.con) a.stars++;
      if (i?.natural === 'deepsky') a.deep = (a.deep ?? 0) + 1; // clusters, nebulae, galaxies (2026-10-11)
      if (!i?.natural && i?.launch) {
        const y = year(i.launch);
        if (y) { if (y < 1991) a.pre1991++; a.decades.add(Math.floor(y / 10)); }
        if (s.time - Date.parse(i.launch) <= 30 * 86400e3 && s.time >= Date.parse(i.launch)) a.brandNew = true;
      }
      if (s.headliner) { xp += 25; a.headliners = (a.headliners ?? 0) + 1; } // tonight’s headliner (main.js headliner)
      if (s.train) a.trains = (a.trains ?? 0) + 1; // a fresh Starlink launch caught as a train (main.js trainOf)
      if (s.peak) { xp += 10; a.peaks = (a.peaks ?? 0) + 1; } // caught within 30 s of its highest point (main.js atPeak, 2026-10-25)
      if (s.lastChance) a.witness = (a.witness ?? 0) + 1; // collected while it was falling (js/last-chance.js)
      if (i?.reunion) { const r = reunionRoles.get(i.reunion) ?? reunionRoles.set(i.reunion, new Set()).get(i.reunion); r.add(i.role); }
    }
    else if (!seenNight.has(nk)) xp += SKY ? SKY_REPEAT_XP : REPEAT_XP;
    if (SKY && s.rareHere) { xp += RARE_HERE_XP; a.rareHere = (a.rareHere ?? 0) + 1; }
    if (SKY) { /* what the plane patches count (docs/DESIGN-LOOP.md §5) */
      const k = a.sky ??= { wide: 0, b747: 0, a380: 0, heli: 0, freightNight: 0, hop: 0, far: 0, airlines: new Set(), propDays: new Map(), flightDays: new Map() };
      const c = snap(s), tc = String(s.typeCode ?? ''), d = new Date(s.time), day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, hr = d.getHours();
      if (WIDE.test(tc)) k.wide++; if (/^B74/.test(tc)) k.b747++; if (tc === 'A388') k.a380++; if (c.glyph === 'heli' || c.setId === 'helicopters') k.heli++;
      if (PROP.test(tc)) { const st = k.propDays.get(day) ?? k.propDays.set(day, new Set()).get(day); st.add(s.hex ?? s.time); }
      if (/^[A-Z]{3}\d/.test(s.callsign ?? '')) k.airlines.add(s.callsign.slice(0, 3));
      if (c.sky === 'flight') { if (c.km != null && c.km < 300) k.hop++; if ((c.km ?? 0) >= 10000) k.far++; if (c.setId === 'cargo' && (hr >= 21 || hr < 5)) k.freightNight++;
        const fd = k.flightDays.get(s.cardKey) ?? k.flightDays.set(s.cardKey, new Set()).get(s.cardKey); fd.add(day); }
      noteSky2(a.sky2 ??= freshSky2(), s, c); /* the patches in js/sky-patches.js */
    }
    let lv = false;
    if (!seenNight.has(nk) && !i?.natural && !fam) { const c = (nightsOnCard.get(s.cardKey) ?? 0) + 1; /* no levels for the Moon, planets, stars… (2026-10-21, Sevaan) */ nightsOnCard.set(s.cardKey, c); lv = c === 3 || c === 10; }
    seenNight.add(nk);
    if (s.stampKey) { const f = String(s.stampKey).split(':')[0]; if (!fleetStamps.has(f)) fleetStamps.set(f, new Set()); const set = fleetStamps.get(f); if (!set.has(s.stampKey)) { set.add(s.stampKey); if (fam) { const [, sv, g] = fleetThresholds(fam); lv = set.size === sv || set.size === g; } } } // fleet level-ups as card.js fleetLevel counts them (bug hunt 2026-10-27: nights had been counted here)
    if (SKY) lv = skyLv; /* per card (the fleet and night rules above are Space's) */
    if (s.shiny) { xp += SHINY_XP; a.shinies++; }
    if (i?.tier && i.natural !== 'story') a.tiers.add(i.tier);
    const d = new Date(s.time); a.hours.push(d.getHours()); a.months.add(`${d.getFullYear()}-${d.getMonth()}`);
    if (!i?.natural && i?.launch) { const y = year(i.launch); if (y && (a.oldest == null || y < a.oldest)) a.oldest = y; }
    if (i?.owner && !i.natural) a.owners.add(i.owner);
    if (typeof s.el === 'number') { a.maxEl = Math.max(a.maxEl, s.el); if (!i?.natural && (a.minSatEl == null || s.el < a.minSatEl)) a.minSatEl = s.el; }
    if (typeof s.az === 'number') a.quadrants.add(Math.floor((((s.az % 360) + 360) % 360) / 90));
    if (typeof s.mag === 'number') { if (a.faintest == null || s.mag > a.faintest) a.faintest = s.mag; if (!i?.natural && (a.brightestSat == null || s.mag < a.brightestSat)) a.brightestSat = s.mag; }
    if (typeof s.rangeKm === 'number' && !i?.natural) { if (a.closest == null || s.rangeKm < a.closest) a.closest = s.rangeKm; if (a.farthest == null || s.rangeKm > a.farthest) a.farthest = s.rangeKm; }
    if (typeof s.lat === 'number' && typeof s.lon === 'number') { const pk = `${s.lat.toFixed(1)},${s.lon.toFixed(1)}`; if (!placeSeen.has(pk)) { placeSeen.add(pk); places.push([s.lat, s.lon]); } } // one per ~10 km spot, so the farthest-pair check stays small (QA 2026-10-08)
    if (!nights.has(night)) nights.set(night, []);
    nights.get(night).push({ ...s, info: i, first, lv, ...hf });
  }
  if (SKY) {
    a.sightings = nCatch; /* Hundred Sightings counts catches: one tap is one (Sevaan's decision 1) */
    a.skySilver = [...lvF.values()].filter((d) => d.size >= THRESHOLDS.flight[1]).length + [...lvP.values()].filter((h) => h.size >= THRESHOLDS.plane[1]).length;
    a.skyGold = [...lvF.values()].filter((d) => d.size >= THRESHOLDS.flight[2]).length + [...lvP.values()].filter((h) => h.size >= THRESHOLDS.plane[2]).length;
    const T = [...k3.types], yrs = T.map(firstFlew).filter(Boolean);
    k3.engines = new Set(T.map(engines).filter(Boolean)); k3.makers = new Set(T.map(makerOf).filter(Boolean));
    k3.decades = new Set(yrs.map((y) => Math.floor(y / 10))); k3.oldest = yrs.length ? Math.min(...yrs) : null; k3.newgen = T.filter((t) => isNewType(t, now)).length;
    k3.biz = T.filter((t) => planeSet(t).id === 'bizjets').length; k3.boeing = T.filter(isBoeing).length; k3.airbus = T.filter(isAirbus).length;
    try { k3.secrets = Object.keys(JSON.parse(localStorage.getItem('secrets')) || {}).length; } catch { k3.secrets = 0; }
  }
  for (const n of nights.values()) { if (n.some((s) => soviet(s.info)) && n.some((s) => american(s.info))) a.race = true; a.maxNight = Math.max(a.maxNight, SKY ? catchesOf(n).length : n.length); } /* Sky's Marathon counts catches */
  a.wanderers = ['moon', 'planet:mercury', 'planet:venus', 'planet:mars', 'planet:jupiter', 'planet:saturn'].filter((k) => seenCard.has(k)).length;
  for (const c of constellations) if (c.stars.every((k) => seenCard.has(k))) { if (!c.system) a.cons++; xp += CON_XP; if (c.zodiac) a.zodiac++; }
  for (const [fam, set] of fleetStamps) a.fleet[fam] = set.size;
  for (const n of nightsOnCard.values()) { a.maxNightsOnCard = Math.max(a.maxNightsOnCard, n); if (n >= 10) a.goldCards++; } // gold = 10 nights, as card.js levelFor (2026-10-12)
  for (const [fam, set] of fleetStamps) if (fam !== 'MOON' && set.size >= fleetThresholds(fam)[2]) a.goldCards++; // a fleet card is gold by stamps
  if (list.length) a.spanDays = (list[list.length - 1].time - list[0].time) / 86400e3;
  // Farthest pair of observing places, in km (equirectangular is plenty at this scale).
  for (let x = 0; x < places.length; x++) for (let y = x + 1; y < places.length; y++) {
    const [la1, lo1] = places[x], [la2, lo2] = places[y], dLat = (la2 - la1) * 111.2, dLon = (lo2 - lo1) * 111.2 * Math.cos(((la1 + la2) / 2) * Math.PI / 180);
    a.spreadKm = Math.max(a.spreadKm, Math.hypot(dLat, dLon));
  }
  // Missions: every completed mission on any night counts once for XP; tonight’s three are shown.
  // A player who starts in the morning (noon-to-noon nights put a 10 AM catch on the night that's ending) still gets the
  // starter missions on their first evening (iPhone 14 playtest 2026-10-30: a morning Sun catch used them up, and the
  // first evening got a hard random deal).
  const firstKey = nights.keys().next().value, solarHour = (s) => ((((Number(s.time) + (Number(s.lon) || 0) / 15 * 3600e3) % 86400e3) + 86400e3) % 86400e3) / 3600e3;
  const morningOnly = !SKY /* Sky's days start at midnight: a morning is that day's own */ && firstKey != null && (nights.get(firstKey) ?? []).every((s) => { const h = solarHour(s); return h >= 5 && h < 12; });
  const isMorning = (s) => { const h = solarHour(s); return h >= 5 && h < 12; };
  // ...the first night with a catch after noon, or tonight if there's none yet (round-3 review: not only the very next night).
  const firstEvening = morningOnly ? ([...nights.keys()].find((k) => (nights.get(k) ?? []).some((s) => !isMorning(s))) ?? nightKey(now, lon ?? list[list.length - 1]?.lon ?? 0)) : null;
  // Every night up to and including that first evening counts as a first night, so a second morning-only night keeps the
  // starters it was dealt once noon passes (final review 2026-10-30: XP dropped 170 → 70 at noon).
  const firstNights = new Set(firstKey == null ? [] : morningOnly ? [...[...nights.keys()].filter((k) => k <= firstEvening), firstEvening] : [firstKey]), firstNight = firstKey;
  for (const [night, n] of nights) {
    const done = missionsOf(night, { first: firstNights.has(night), deals }).filter((m) => m.done(n, n[0].time)).length;
    xp += done * (SKY && firstNights.has(night) ? SKY_STARTER_XP : MISSION_XP); a.missionsDone += done; if (done === 3 && !(SKY && firstNights.has(night))) a.fullHouse = true;
    if (SKY && done === 3 && firstNights.has(night)) a.starterDone = true; /* Cleared for Takeoff */ /* Sky: the starter day's three (done in two catches) don't earn Full House (QA 2026-11-19) */
    if (!firstNights.has(night) && challengeOf(night, deals).done(n, n[0].time)) xp += MISSION_XP;
  }
  a.reunions = [...reunionRoles.values()].filter((r) => r.size === 2).length; // launches where you own the stage and its satellite
  // Themed weeks: each week's sightings against that week's theme. Fleet stamps count only the first time you stamp a launch.
  const weeks = new Map(), firstStamp = new Set();
  for (const [k, s] of list.entries()) { const ws = weekStartOf(s.time), e = { ...s, info: info(s.cardKey), first: firstFlags[k], ...histFlags[k] }; if (s.stampKey && !String(s.stampKey).startsWith('MOON:') && !firstStamp.has(s.stampKey)) { firstStamp.add(s.stampKey); e.newStampKey = s.stampKey; } if (!weeks.has(ws)) weeks.set(ws, []); weeks.get(ws).push(e); }
  a.weekThemes = new Set();
  for (const [ws, w] of weeks) { if (ws < WEEKS_FROM) continue; const th = weekThemeFor(ws, weekThemes); if (th.have(w) >= th.need) { xp += WEEK_XP; a.weekThemes.add(th.id); a.weeksDone = (a.weeksDone ?? 0) + 1; } }
  const wsNow = weekStartOf(now), thNow = weekThemeFor(wsNow, weekThemes), wNow = weeks.get(wsNow) ?? [];
  const week = { id: thNow.id, name: thNow.name, text: thNow.text, need: thNow.need, have: Math.min(thNow.need, thNow.have(wNow)), start: wsNow, sightings: wNow };
  const st = streaks(list, now); a.bestStreak = st.best;
  const tonightKey = nightKey(now, lon ?? list[list.length - 1]?.lon ?? 0) /* where you are now, as the deal was made (bug hunt 2026-10-22: travel split them) */, tonight = nights.get(tonightKey) ?? [];
  // Which catch finished each mission (the first point in tonight's order where it's done), for its picture (QA 2026-10-30: every done card showed the latest catch).
  const tonightAsc = [...tonight].sort((x, y) => x.time - y.time), finisher = (m) => { let lo = 1, hi = tonightAsc.length; if (!hi || !m.done(tonightAsc, now)) return null; while (lo < hi) { const mid = (lo + hi) >> 1; if (m.done(tonightAsc.slice(0, mid), now)) hi = mid; else lo = mid + 1; } return tonightAsc[lo - 1]; }; // a binary search: a mission, once done, stays done as catches are added
  const missions = missionsOf(tonightKey, { first: !nights.size || firstNights.has(tonightKey), deals }).map((m) => { const done = m.done(tonight, now), f = done ? finisher(m) : null; return { id: m.id, text: m.id === 'firstcard' && list.some((x) => x.time < (tonightAsc[0]?.time ?? now) && nightKey(x.time, x.lon ?? 0) !== tonightKey) ? 'Collect a new card' : m.text, done, by: f ? { cardKey: f.cardKey, objectId: f.objectId } : null }; });
  xp += carry;
  let ri = 0; for (let k = 0; k < RANKS.length; k++) if (xp >= RANKS[k][0]) ri = k;
  ri = Math.max(ri, rankFloor(xp));
  const rank = { name: RANKS[ri][1], index: ri, at: RANKS[ri][0], next: RANKS[ri + 1]?.[0] ?? null, nextName: RANKS[ri + 1]?.[1] ?? null };
  a.albumsSilver = albums.filter((al) => al.silver && al.keys.filter((k) => seenCard.has(k)).length >= al.silver).length; /* Sky's Full Hangar patch */
  const achievements = activeAchievements().map((x) => ({ id: x.id, name: x.name, text: x.text, icon: x.icon, done: x.done(a), prog: x.skyProg !== undefined ? x.skyProg?.(a) : PROG[x.id]?.(a) ?? x.prog?.(a) }));
  // Every constellation is its own mission patch (2026-10-09, Sevaan: they replace the gold constellation cards),
  // and so is the Solar System. The patch art is the stick figure (js/patches.js).
  if (!SKY) /* Sky Collector has no constellation patches (2026-11-17) */ for (const c of constellations) achievements.push({ id: `con-${c.id}`, con: c.id, name: c.system ? 'Solar System' : c.name, sub: c.system ? 'Home system' : c.nick.replace(/^part of /, ''), icon: '',
    text: c.system ? 'See the Sun, the Moon and all seven planets' : `Collect all ${c.stars.length} stars of ${c.name}`, done: c.stars.every((k) => seenCard.has(k)), prog: [c.stars.filter((k) => seenCard.has(k)).length, c.stars.length] });
  const ch = challengeOf(tonightKey, deals), challenge = list.length && !firstNights.has(tonightKey) ? { id: ch.id, text: ch.text, done: ch.done(tonight, now) } : null; // not on a first night: the starter set is enough
  // A filled album earns its own gold-foil patch (2026-10-10, playtest #17).
  for (const al of albums) { const have = al.keys.filter((k) => seenCard.has(k)).length; achievements.push({ id: `album-${al.id}`, album: al.id, name: al.name, sub: 'Gold album', icon: '', text: `Fill the ${al.name.replace(/^The /, "")} album to gold: ${al.goal.toLocaleString("en-US")} cards`, done: have >= al.goal, prog: [Math.min(have, al.goal), al.goal] }); }
  for (const th of WEEK_THEMES) achievements.push({ id: `week-${th.id}`, week: th.id, name: th.short, sub: 'Week patch', icon: th.icon, text: `${th.text.replace(/\.$/, '')} in one week`, done: a.weekThemes.has(th.id), prog: [a.weekThemes.has(th.id) ? 1 : 0, 1] });
  if (keep) { const kept = new Set(giftCarry().patches); if (kept.size) for (const x of achievements) if (kept.has(x.id)) x.done = true; } /* patches past gifts gave (giftCarry) */
  /* Sky: a patch once earned stays earned when a rule is put right (2026-11-20: Hundred Sightings now counts catches, levels
     are per card): every patch Explore or the wall recorded (localStorage patchDates) */
  if (keep && SKY) { let d = {}; try { d = JSON.parse(localStorage.getItem('patchDates') || '{}') || {}; } catch {} for (const x of achievements) if (d[x.id]) x.done = true; }
  return { xp, rank, missions, challenge, streak: st, achievements, cards: a.cards, week };
}
