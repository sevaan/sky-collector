// Sky Collector's usage page at /stats (2026-11-19, Sevaan: "Sky Max should set up it's own similar stats site"): Space
// Collector's functions/stats-page.js, ported. Kept close to Space's so fixes port both ways; what differs is marked "Sky:".
// Sky: plane kinds instead of satellites, a Plane feed section (phone vs relay, adsb.lol's daily allowance, 429s), no MINE
// list (the apps mark simulators, emulators and Play's test devices themselves, js/field-notes.js 'virt'), and days run
// midnight to midnight (planes fly by day).
// The usage page at /api/stats (rebuilt 2026-11-06, Sevaan: "Pretend you own spacecollector.app… is it easy to
// understand? is it telling you everything you need to know?"). Pure: event rows in, HTML out, so it can be tried
// locally with made-up rows (node functions/stats-try.mjs). Days and nights are in Toronto time.
//
// Rows: { ts, iid, v, p: ios|android|web, x: 0|1, name, d: JSON text }. Events the app sends: install, open {dsi, n,
// cards, dark, back}, night {n, f, dsi} (first catch of each night), end {c, s, dark} (app hidden), tour {s, loc, where,
// pick}, motion {s}, calib {ref, deg | s}, sky {s, sb}, help {s | pick}, plus {s, plan, why}, remind {s, k | ch}, err {m}.

import { readFileSync } from 'node:fs';

// The game's own faces (Russo One, Barlow Condensed; OFL, licences in functions/fonts), inlined so the page needs no
// other host. If the files are missing the page falls back to system fonts.
const font64 = (f) => { try { return readFileSync(new URL(`./fonts/${f}`, import.meta.url)).toString('base64'); } catch { return ''; } };
const FONTS = [['SC Display', 'RussoOne-Regular.woff2'], ['SC Label', 'BarlowCondensed-Medium.woff2']].map(([n, f]) => { const b = font64(f); return b ? `@font-face{font-family:'${n}';src:url(data:font/woff2;base64,${b}) format('woff2');font-display:swap}` : ''; }).join('');

const TZ = 'America/Toronto';
const DAY = 86400e3;
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayOf = (ts) => ymd.format(new Date(ts));
// An observing night runs noon to noon, like the game's own nights.
const nightOf = (ts) => dayOf(ts); /* Sky: a calendar day (planes fly by day); Space's observing night ran noon to noon */
const dayNum = (s) => Math.floor(Date.parse(`${s}T12:00:00Z`) / DAY); /* floor, not round: noon is exactly .5 and rounded up, so every date label (numOf) read a day late (2026-11-14) */
const numOf = (s) => new Date(s * DAY).toISOString().slice(0, 10);
const when = (ts) => new Date(ts).toLocaleString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const verNum = (v) => Number(String(v ?? '').split('.').pop()) || 0;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const PLAT = { ios: 'iPhone & iPad', android: 'Android', web: 'Website' };

// Test or real? The website and SC Tester count as tests (SC Tester never sends). Before v0.1.1518 the store apps
// marked themselves as tests by mistake (they load from localhost), so their older rows count as real players.
export const isTest = (e) => e.p === 'web' || e.x === 1; /* Sky: no versions before the mark to allow for */

// A fresh start (2026-11-06, Sevaan: "reset the stats… the app is now in the App Store, I want to start fresh"): the page
// counts from midnight Nov 7, 2026 (Toronto). Nothing is deleted; ?before=1 shows the testing weeks before it too.
// Claude's simulator/emulator playtests on store builds (first 8 characters of the install id), 2026-11-08 to 11-13.
const MINE = new Set([]); /* Sky: empty on purpose. Simulators, emulators and Play's test devices mark themselves (js/field-notes.js 'virt'); Sky Tester never sends */
/* 2026-11-19 additions: Claude's simulator playtests of unreleased store builds (iOS v0.1.1688–1709), Sevaan's Galaxy Flip
   (b2eef62c), and Google Play's pre-launch robots that ran each Android upload (Android installs with no tour, no boot, no
   motion and a few minutes long, right after an upload). From the next app build these mark themselves (js/field-notes.js 'virt'). */
export const FRESH = Date.parse('2026-11-19T05:00:00Z'); /* Sky: the first day Sky's apps could send (midnight Nov 19, Toronto) */
/* Who counts and what each install did, shared by the page and the daily totals (server/daily.js, 2026-11-20, Space's
   5f591d4b). from: a day number; rows before it are left to the saved daily totals (past). */
export function prep(rows, { all = false, before = false, now = Date.now(), from = null } = {}) {
  /* Whose numbers count (2026-11-14, Sevaan: "leave out my devices and my Claude tests"). An install that EVER sent a
     row marked as a test (Testing tools unlocked by 7 taps on the version line, an Android emulator, a test build) is a
     test install for all of its rows, before and after: that catches Sevaan's own phone and most of Claude's runs. Tap the
     version line 7 times on any phone to leave it out from then on, history included. MINE lists Claude's simulator
     playtests that never unlocked Testing tools (iOS simulators can't be told apart): bursts of 2–7 installs started in the
     same minute or two, found by hand. A Plus purchase from a build marked as a test is a test purchase, whatever its
     version. "include tests" brings all of them back. */
  const testIid = new Set(rows.filter((e) => e.p !== 'web' && isTest(e)).map((e) => e.iid));
  /* No separate "test purchase" rule (removed 2026-11-17): the Nov 7 Android yearly buy it hid was real (Play order GPA.3314-3804-9893-53697: free trial Nov 7, charged US$16.23 on Nov 14). A purchase from a test install is already left out with that install. */
  const mine = (e) => MINE.has(String(e.iid).slice(0, 8));
  const ev = rows.filter((e) => (before || e.ts >= FRESH) && (from == null || dayNum(dayOf(e.ts)) >= from) && (all || (!isTest(e) && !testIid.has(e.iid) && !mine(e)))).map((e) => { let d = {}; try { d = JSON.parse(e.d || '{}'); } catch {} return { ...e, d }; }).sort((a, b) => a.ts - b.ts);
  const today = dayNum(dayOf(now));

  // One record per install.
  const P = new Map();
  const get = (e) => { let p = P.get(e.iid); if (!p) { p = { iid: e.iid, p: e.p, first: e.ts, install: null, days: new Set(), nights: new Set(), catchDays: new Set(), v: e.v }; P.set(e.iid, p); } return p; };
  for (const e of ev) {
    const p = get(e); p.v = e.v; p.p = e.p; p.days.add(dayNum(dayOf(e.ts)));
    if (e.name === 'install' && p.install == null) p.install = e.ts;
    if (e.name === 'night') { p.nights.add(nightOf(e.ts)); p.catchDays.add(dayNum(dayOf(e.ts))); }
  }
  const players = [...P.values()];
  const installs = players.filter((p) => p.install != null);
  for (const p of installs) { p.iday = dayNum(dayOf(p.install)); p.age = today - p.iday; p.firstNight = p.nights.has(nightOf(p.install)); p.back = (k) => [...p.days].some((d) => d - p.iday >= k); }
  /* Played = more than 5 minutes between its first and last event, or a catch. A reinstall, a reset (before v0.1.1526) or an
     emulator run usually opens the app for a minute and leaves, so this is the honest count (2026-11-06, Sevaan). */
  const span = new Map(); for (const e of ev) { const s2 = span.get(e.iid); if (!s2) span.set(e.iid, [e.ts, e.ts]); else s2[1] = e.ts; }
  for (const p of installs) { const s2 = span.get(p.iid) ?? [0, 0]; p.played = s2[1] - s2[0] > 5 * 60e3 || p.nights.size > 0; }
  for (const e of ev) e.day = dayNum(dayOf(e.ts));
  return { ev, P, players, installs, today };
}
export { dayOf, dayNum, numOf, nightOf };
export function statsHtml(rows, { all = false, before = false, now = Date.now(), keyQs = '', newCards = null, catalogAt = 0, relay = null, past = [], from = null } = {}) {
  const { ev, P, players, installs, today } = prep(rows, { all, before, now, from });
  /* Days before the raw window come from the saved daily totals (sky_daily, 2026-11-20): one doc per Toronto day, no ids. */
  const PD = new Map(from == null ? [] : past.map((d) => [dayNum(d.day), d]).filter(([d]) => d < from));
  const inPast = (d) => PD.size > 0 && d < from, old = (d, k) => PD.get(d)?.[k] ?? 0;
  const S = (f) => { let n = 0; for (const d of PD.values()) n += f(d) || 0; return n; };
  const C = (k, pl) => S((d) => (pl ? d.byPlatform?.[pl]?.[k] : d.cohort?.[k]));
  const playedIn = (from, to) => installs.filter((p) => p.played && p.iday >= from && p.iday <= to).length;

  const activeIn = (from, to) => players.filter((p) => p.played !== false && [...p.days].some((d) => d >= from && d <= to)).length; /* throwaway installs (see played) aren't players */
  const caughtIn = (from, to) => players.filter((p) => [...p.catchDays].some((d) => d >= from && d <= to)).length;
  const installsIn = (from, to) => installs.filter((p) => p.iday >= from && p.iday <= to).length;
  const buysIn = (from, to) => new Set(ev.filter((e) => e.name === 'plus' && e.d.s === 'buy' && dayNum(dayOf(e.ts)) >= from && dayNum(dayOf(e.ts)) <= to).map((e) => e.iid)).size;
  const w0 = today - 6, w1 = today - 13;

  // ---------- Today first (2026-11-09, Sevaan: "Turn the stats into something more useful and fun for me to look at";
  // earlier the same day: "I only care about kpis for today"). Everything longer-term is folded into "The long view". ----------
  const partsF = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const tod = (ts) => { const p = partsF.formatToParts(new Date(ts)); const g = (t) => Number(p.find((x) => x.type === t)?.value) || 0; return ((g('hour') % 24) * 3600 + g('minute') * 60 + g('second')) * 1000; };
  const yd = today - 1, nowTod = tod(now), nowH = Math.floor(nowTod / 3600e3);
  const clock = (ts) => new Date(ts).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
  const hourLab = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
  const dateLab = (d) => (d === today ? 'today' : d === yd ? 'yesterday' : new Date(numOf(d) + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' }));
  const fmt = (n) => Number(n).toLocaleString('en-CA');
  const dur = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? 'under a minute' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };
  const todayEv = ev.filter((e) => e.day === today), ydEv = ev.filter((e) => e.day === yd), ydBy = ydEv.filter((e) => tod(e.ts) <= nowTod);
  const isNew = (e) => e.name === 'catch' && e.d.n === 1, isBuy = (e) => e.name === 'plus' && e.d.s === 'buy';
  const devs = (list, f = () => true) => new Set(list.filter(f).map((e) => e.iid));
  const realDev = (set) => [...set].filter((i) => P.get(i)?.played !== false).length; /* throwaway installs aren't players (see played) */

  // Made-up call signs from each install's random ID: the same install keeps its name, and nothing about the person is in it.
  const ADJ = ['Quiet', 'Bright', 'Swift', 'Lunar', 'Polar', 'Amber', 'Silver', 'Distant', 'Steady', 'Rising', 'Wandering', 'Midnight', 'Northern', 'Hidden', 'Golden', 'Cosmic'];
  const NOUN = ['Falcon', 'Comet', 'Orbit', 'Lantern', 'Heron', 'Nova', 'Pioneer', 'Voyager', 'Owl', 'Kestrel', 'Beacon', 'Meteor', 'Fox', 'Rover', 'Sparrow', 'Pulsar'];
  const callSign = (iid) => { let h = 2166136261; for (const c of String(iid)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h >>>= 0; return `${ADJ[h % 16]} ${NOUN[(h >>> 4) % 16]}`; };
  const PL = { ios: 'iPhone', android: 'Android', web: 'Website' };
  const SECRET = { plus: 'Plus Member', santa: 'Nice List', dizzy: 'Dizzy', overhead: 'Zenith', balloon: 'Up, Up and Away', glider: 'Silent Wings', airship: 'Lighter Than Air', whale: 'The Whale', heavylift: 'Heavy Lifter', firebird: 'Firebird', hurricane: 'Into the Eye', vintage: 'Vintage', jetstream: 'Jet Stream', ceiling: 'Ceiling', formation: 'Formation', sixcont: 'Six Continents' }; /* Sky: js/sky-secrets.js names */

  // The game's own rarity colours and shapes (js/rarity.js): a shape always rides with the colour, so rarity never
  // depends on colour alone (Rare and Epic are close for deuteranopes; dataviz validator 2026-11-09).
  const TIER = { common: ['Common', '●', '#9aa4b1'], uncommon: ['Uncommon', '▲', '#5fd08a'], rare: ['Rare', '◆', '#4aa8ff'], epic: ['Epic', '✦', '#e46ad6'], legendary: ['Legendary', '★', '#ffc545'] };
  const TORDER = Object.keys(TIER), tierN = (t) => TORDER.indexOf(t);
  const gem = (t) => (TIER[t] ? `<span class="gem" style="color:${TIER[t][2]}" aria-hidden="true">${TIER[t][1]}</span>` : '');
  const tierWord = (t) => TIER[t]?.[0] ?? 'Unknown';
  /* Sky: what a catch was (js/main.js planeKind) */
  const KIND1 = { airliner: 'airliner', private: 'private plane', anon: 'private plane', heli: 'helicopter', balloon: 'balloon', airship: 'airship', glider: 'glider', other: 'card' };
  const KINDS = { airliner: 'Airliners', private: 'Private planes', anon: 'Private (unnamed)', heli: 'Helicopters', balloon: 'Balloons', airship: 'Airships', glider: 'Gliders', other: 'Other' };
  const find = (e) => `${gem(e.d.t)} ${esc(tierWord(e.d.t))} ${esc(KIND1[e.d.k] ?? e.d.k ?? 'card')}`;

  // Days since launch (or since the first row when the testing weeks are shown), for sparklines and records.
  const firstDay = Math.min(ev.length ? ev[0].day : today, ...PD.keys()), span0 = Math.max(firstDay, today - 13);
  const dayList = (from) => Array.from({ length: today - from + 1 }, (_, i) => from + i);
  const perDay = (f) => { const m = new Map(); for (const e of ev) if (f(e)) { const s = m.get(e.day) ?? new Set(); s.add(f(e) === true ? `${e.ts}${e.iid}` : e.iid); m.set(e.day, s); } return (d) => m.get(d)?.size ?? 0; };
  const cardsOn = perDay(isNew), catchersOn = perDay((e) => e.name === 'catch' && 'dev'), buysOn = perDay((e) => isBuy(e) && 'dev');
  const K = {
    players: { now: activeIn(today, today), by: realDev(devs(ydBy)), all: activeIn(yd, yd), f: (d) => (inPast(d) ? old(d, 'players') : activeIn(d, d)) },
    installs: { now: installsIn(today, today), by: installs.filter((p) => p.iday === yd && tod(p.install) <= nowTod).length, all: installsIn(yd, yd), f: (d) => (inPast(d) ? old(d, 'installs') : installsIn(d, d)) },
    caught: { now: catchersOn(today), by: devs(ydBy, (e) => e.name === 'catch').size, all: catchersOn(yd), f: (d) => (inPast(d) ? old(d, 'caught') : catchersOn(d)) },
    cards: { now: cardsOn(today), by: ydBy.filter(isNew).length, all: cardsOn(yd), f: (d) => (inPast(d) ? old(d, 'newCards') : cardsOn(d)) },
    plus: { now: buysOn(today), by: devs(ydBy, isBuy).size, all: buysOn(yd), f: (d) => (inPast(d) ? old(d, 'plusBuys') : buysOn(d)) },
  };

  // Hour by hour, today against yesterday (devices with anything at all that hour).
  const hrs = (list) => { const s = Array.from({ length: 24 }, () => new Set()); for (const e of list) s[Math.min(23, Math.floor(tod(e.ts) / 3600e3))].add(e.iid); return s.map((x) => x.size); };
  const hT = hrs(todayEv), hY = hrs(ydEv);
  const busiest = hT.slice(0, nowH + 1).reduce((b, n, h) => (n > hT[b] ? h : b), 0);

  // Each device's day.
  const D = new Map();
  for (const e of todayEv) {
    let r = D.get(e.iid); if (!r) D.set(e.iid, (r = { iid: e.iid, p: e.p, first: e.ts, last: e.ts, newN: 0, n: 0, best: null, shiny: 0 }));
    r.last = e.ts; r.p = e.p; r.v = e.v;
    if (e.name === 'end') r.secs = (r.secs ?? 0) + (Number(e.d.s) || 0);
    if (e.name === 'catch') { r.n++; if (e.d.n) r.newN++; if (e.d.s) r.shiny++; if (!r.best || tierN(e.d.t) >= tierN(r.best.d.t)) r.best = e; }
  }
  const board = [...D.values()].filter((r) => r.n).sort((a, b) => b.newN - a.newN || b.n - a.n).slice(0, 6);
  const todayNew = todayEv.filter(isNew), rarest = todayNew.reduce((b, e) => (!b || tierN(e.d.t) > tierN(b.d.t) || (tierN(e.d.t) === tierN(b.d.t) && e.ts > b.ts) ? e : b), null);

  // ----- hero: one number and the day in a sentence -----
  const story = [];
  if (hT[busiest]) story.push(`Busiest hour so far: <b>${hourLab(busiest)}</b>, ${hT[busiest]} out at once.`);
  if (rarest) story.push(`Rarest find: ${find(rarest)} by <b>${esc(callSign(rarest.iid))}</b> at ${clock(rarest.ts)}.`);
  if (board[0]?.newN) story.push(`Top collector: <b>${esc(callSign(board[0].iid))}</b>, ${fmt(board[0].newN)} new card${board[0].newN === 1 ? '' : 's'}.`);
  const dlt = (a, b) => (a === b ? `<span class="m">same as yesterday by now</span>` : `<span class="${a > b ? 'up' : 'down'}">${a > b ? '▲' : '▼'} ${fmt(Math.abs(a - b))}</span> <span class="m">vs ${fmt(b)} yesterday by now</span>`);
  let html = `<section class="hero"><div class="hn">${fmt(K.players.now)}</div><div class="hl">collector${K.players.now === 1 ? '' : 's'} out today</div><div class="hd">${dlt(K.players.now, K.players.by)}</div>
<p class="story">${story.join(' ') || 'Quiet so far today.'}</p></section>`;

  // ----- the day's numbers -----
  const spark = (f) => { const ds = dayList(span0); if (ds.length < 2) return ''; const vals = ds.map(f), W = 116, H = 30, mx = Math.max(1, ...vals); const pts = vals.map((v, i) => [5 + (i * (W - 10)) / (vals.length - 1), H - 5 - (v / mx) * (H - 10)]); const last = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ds.map((d, i) => `${dateLab(d)} ${vals[i]}`).join(', ')}"><polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4"/></svg>`; };
  const kpi = (label, k, extra = '') => `<div class="kpi"><div class="kl">${label}</div><div class="krow"><div class="kn">${fmt(k.now)}</div>${spark(k.f)}</div><div class="kd">${dlt(k.now, k.by)}</div><div class="kf m">${fmt(k.all)} all day yesterday${extra}</div></div>`;
  html += `<h2>Today’s numbers</h2><section class="kpis">
${kpi('Installs', K.installs, ` · ${playedIn(today, today)} of today’s played`)}
${kpi('Players', K.players)}
${kpi('Caught something', K.caught)}
${kpi('New cards collected', K.cards)}
${ev.some(isBuy) ? kpi('Bought Plus', K.plus) : ''} 
</section><p class="m small">The little line beside each number is every day since launch, today at the dot.</p>`;

  // ----- hour by hour (HTML columns, so the labels stay readable on a phone) -----
  { const top = Math.max(2, ...hT, ...hY), nice = [2, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 400, 500].find((x) => x >= top) ?? Math.ceil(top / 100) * 100;
    const pc = (n) => `${((100 * n) / nice).toFixed(1)}%`;
    const cols = hT.map((v, h) => `<div class="hc-col${h === nowH ? ' now' : ''}${h > nowH ? ' later' : ''}" tabindex="0" data-tip="${hourLab(h)}: ${h > nowH ? 'not yet' : `${v} out`} · yesterday ${hY[h]}">${h <= nowH && v ? `<i class="bar" style="height:${pc(v)}"></i>` : ''}${hY[h] ? `<i class="yest" style="bottom:${pc(hY[h])}"></i>` : ''}</div>`).join('');
    const labs = hT.map((_, h) => `<span>${h === nowH ? '<b>now</b>' : h % 6 === 0 ? hourLab(h) : ''}</span>`).join('');
    html += `<h2>Today, hour by hour</h2><p class="legend"><span class="k k-today"></span>today &nbsp; <span class="k k-yest"></span>yesterday · players out each hour, Toronto time</p>
<div class="hours" role="img" aria-label="Players out each hour today: ${hT.slice(0, nowH + 1).map((n, h) => `${hourLab(h)} ${n}`).join(', ')}"><div class="hgrid"><span style="bottom:100%"><em>${nice}</em></span><span style="bottom:50%"><em>${nice / 2}</em></span></div><div class="hcols">${cols}</div><div class="hlabs">${labs}</div></div>`; }

  // ----- today's haul -----
  if (todayNew.length) {
    const byT = {}; for (const e of todayNew) byT[e.d.t] = (byT[e.d.t] ?? 0) + 1;
    const parts = TORDER.filter((t) => byT[t]), N = todayNew.length;
    const seg = parts.map((t) => { const share = byT[t] / N; return `<div class="seg" style="flex-grow:${byT[t]};background:${TIER[t][2]}" tabindex="0" data-tip="${TIER[t][1]} ${TIER[t][0]}: ${fmt(byT[t])} (${Math.round(share * 100)}%)">${share >= 0.09 ? `<span>${Math.round(share * 100)}%</span>` : ''}</div>`; }).join('');
    const reps = todayEv.filter((e) => e.name === 'catch' && !e.d.n).length, shinies = todayEv.filter((e) => e.name === 'catch' && e.d.s).length;
    const byK = {}; for (const e of todayNew) byK[e.d.k ?? 'other'] = (byK[e.d.k ?? 'other'] ?? 0) + 1;
    const kinds = Object.entries(byK).sort((a, b) => b[1] - a[1]), kTop = kinds.slice(0, 6), kRest = kinds.slice(6).reduce((s, [, n]) => s + n, 0); if (kRest) kTop.push(['other', kRest]);
    const kMax = Math.max(...kTop.map(([, n]) => n));
    html += `<h2>Today’s haul</h2><p class="lead"><b>${fmt(N)}</b> new card${N === 1 ? '' : 's'} collected${reps ? ` · ${fmt(reps)} seen again` : ''}${shinies ? ` · <b class="shiny">${shinies} shiny</b>` : ''}</p>
<div class="segbar" role="img" aria-label="${parts.map((t) => `${TIER[t][0]} ${byT[t]}`).join(', ')}">${seg}</div>
<ul class="seglegend">${parts.map((t) => `<li>${gem(t)} ${TIER[t][0]} <b>${fmt(byT[t])}</b></li>`).join('')}</ul>
<div class="kinds">${kTop.map(([k, n]) => `<div class="kr" tabindex="0" data-tip="${esc(KINDS[k] ?? k)}: ${fmt(n)}"><span class="kk">${esc(KINDS[k] ?? k)}</span><span class="kb"><i style="width:${Math.max(2, (100 * n) / kMax).toFixed(1)}%"></i></span><span class="kv">${fmt(n)}</span></div>`).join('')}</div>`;
  } else html += `<h2>Today’s haul</h2><p class="empty">No cards yet today.</p>`;

  // ----- top collectors and the feed -----
  const inst0 = new Map(installs.map((p) => [p.iid, p.iday]));
  html += `<div class="two"><div><h2>Top collectors today</h2>${board.length ? `<ol class="board">${board.map((r, i) => `<li><span class="rk">${i + 1}</span><span class="who"><b>${esc(callSign(r.iid))}</b><span class="m">${PL[r.p] ?? esc(r.p)} ${r.secs ? ` · ${dur(r.secs * 1000)} in the app` : ''}${inst0.get(r.iid) === today ? ' · <span class="pill">joined today</span>' : ''}</span>${r.best ? `<span class="bf">best: ${find(r.best)}${r.shiny ? ` · <span class="shiny">${r.shiny} shiny</span>` : ''}</span>` : ''}</span><span class="num">${fmt(r.newN)}<small>new</small></span></li>`).join('')}</ol>` : '<p class="empty">Nobody has caught anything yet today.</p>'}</div>`;

  // The feed: a run of catches by one install (gaps under 15 minutes) is one line.
  const feed = [], runs = new Map();
  for (const e of todayEv) {
    const who = `<b>${esc(callSign(e.iid))}</b>`;
    if (e.name === 'install') feed.push({ ts: e.ts, tag: 'join', html: `${who} joined on ${PL[e.p] ?? esc(e.p)}` });
    else if (isBuy(e)) feed.push({ ts: e.ts, tag: 'plus', html: `${who} bought Plus${e.d.plan ? ` (${esc(e.d.plan)})` : ''}` });
    else if (e.name === 'secret') feed.push({ ts: e.ts, tag: 'secret', html: e.d.id === 'plus' ? `${who} became a Plus member` : `${who} found the secret patch <b>${esc(SECRET[e.d.id] ?? e.d.id)}</b>` });
    else if (e.name === 'gift') feed.push({ ts: e.ts, tag: 'pack', html: `${who} opened a pack of ${fmt(e.d.cards ?? e.d.in ?? 0)} cards` });
    else if (e.name === 'share') feed.push({ ts: e.ts, tag: 'share', html: `${who} shared ${e.d.w === 'week' ? 'their week' : 'a card'}` });
    else if (e.name === 'catch') {
      let r = runs.get(e.iid);
      if (!r || e.ts - r.end > 15 * 60e3) { r = { iid: e.iid, start: e.ts, end: e.ts, n: 0, newN: 0, best: e, shiny: 0 }; runs.set(e.iid, r); feed.push({ run: r }); }
      r.end = e.ts; r.n++; if (e.d.n) r.newN++; if (e.d.s) r.shiny++; if (tierN(e.d.t) >= tierN(r.best.d.t)) r.best = e;
    }
  }
  for (const f of feed) if (f.run) { const r = f.run; f.ts = r.end; f.tag = 'catch'; f.t = r.best.d.t;
    f.html = r.n === 1 ? `<b>${esc(callSign(r.iid))}</b> caught ${find(r.best)}${r.newN ? '' : ' again'}` : `<b>${esc(callSign(r.iid))}</b> caught ${fmt(r.newN)} new card${r.newN === 1 ? '' : 's'}${r.n > r.newN ? ` and saw ${fmt(r.n - r.newN)} again` : ''} · best ${find(r.best)}`;
    if (r.shiny) f.html += ` · <span class="shiny">${r.shiny} shiny</span>`;
    if (r.end - r.start > 60e3) { const a = clock(r.start), b = clock(r.end); f.when = a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`; } }
  const TAG = { join: 'New', plus: 'Plus', secret: 'Secret', pack: 'Pack', share: 'Share', catch: 'Catch' };
  const recent = feed.sort((a, b) => b.ts - a.ts).slice(0, 16);
  html += `<div><h2>Live feed</h2>${recent.length ? `<ul class="feed">${recent.map((f) => `<li class="f-${f.tag}"><time>${f.when ?? clock(f.ts)}</time><span class="tag">${TAG[f.tag]}</span><span class="fx">${f.html}</span></li>`).join('')}</ul>${feed.length > recent.length ? `<p class="m small">${feed.length - recent.length} earlier today not shown.</p>` : ''}` : '<p class="empty">Nothing yet today.</p>'}<p class="m small">Names are made up from each install’s random ID.</p></div></div>`;

  // ----- new players today: how far they got -----
  { const nw = installs.filter((p) => p.iday === today), N = nw.length;
    const has = (p, f) => ev.some((e) => e.iid === p.iid && f(e));
    const fc = new Map(); for (const e of ev) if (e.name === 'catch' && !fc.has(e.iid)) fc.set(e.iid, e.ts);
    if (N) {
      const steps = [['Installed', N], ['Finished or skipped the tour', nw.filter((p) => has(p, (e) => e.name === 'tour' && (e.d.s === 'done' || e.d.s === 'skip'))).length], ['Caught a card', nw.filter((p) => has(p, (e) => e.name === 'catch')).length], ['Stayed 5+ minutes', nw.filter((p) => p.played).length]];
      const first = nw.map((p) => (fc.get(p.iid) >= p.install ? fc.get(p.iid) - p.install : null)).filter((x) => x != null).sort((a, b) => a - b);
      const allFirst = [...installs.map((p) => (fc.get(p.iid) >= p.install ? fc.get(p.iid) - p.install : null)).filter((x) => x != null), ...[...PD.values()].flatMap((d) => d.cohort?.firstMs ?? [])].sort((a, b) => a - b);
      const med = (l) => (l.length ? dur(l[Math.floor(l.length / 2)]) : '–');
      html += `<h2>New players today</h2><div class="funnel">${steps.map(([l, n]) => `<div class="fr" tabindex="0" data-tip="${l}: ${n} of ${N}"><span class="fl">${l}</span><span class="fb"><i style="width:${Math.max(2, (100 * n) / N).toFixed(1)}%"></i></span><span class="fv">${n}<small>${pct(n, N)}</small></span></div>`).join('')}</div>
<p class="m">First card, typically: <b class="ink">${med(first)}</b> after install today · <b class="ink">${med(allFirst)}</b> since launch (${allFirst.length} players)</p>`;
    } else html += `<h2>New players today</h2><p class="empty">No installs yet today.</p>`; }

  // ----- records and milestones -----
  { const ds = dayList(firstDay);
    const rec = (label, f, unit) => { const vals = ds.map((d) => [d, f(d)]); const [bd, bv] = vals.reduce((b, x) => (x[1] > b[1] || (x[1] === b[1] && x[0] === today) ? x : b), [today, -1]); const tv = f(today), isRec = tv > 0 && tv >= bv && ds.length > 1;
      return `<div class="rec${isRec ? ' hot' : ''}"><div class="kl">${label}</div><div class="rv">${fmt(bv)}<small>${unit}</small></div><div class="m">${dateLab(bd)}${isRec ? ' · <span class="pill gold">new record today</span>' : ` · today ${fmt(tv)}`}</div></div>`; };
    const STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
    const mile = (label, n) => { const nxt = STEPS.find((s) => s > n) ?? n * 2, prev = [...STEPS].reverse().find((s) => s <= n) ?? 0; const share = (n - prev) / (nxt - prev);
      return `<div class="mile"><div class="kl">${label}</div><div class="rv">${fmt(n)}</div><div class="meter" role="img" aria-label="${fmt(n)} of ${fmt(nxt)}"><i style="width:${(100 * share).toFixed(1)}%"></i></div><div class="m">${fmt(nxt - n)} to ${fmt(nxt)}</div></div>`; };
    html += `<h2>Records and milestones</h2><section class="recs">
${rec('Most installs in a day', K.installs.f, 'installs')}
${rec('Most players in a day', K.players.f, 'players')}
${rec('Most new cards in a day', K.cards.f, 'cards')}
${mile('Collectors so far', installs.length + S((d) => d.installs))}
${mile('Cards collected so far', ev.filter(isNew).length + S((d) => d.newCards))}
</section>`; }

  // ----- health -----
  { const errs = todayEv.filter((e) => e.name === 'err'), errDev = devs(errs).size;
    const em = {}; for (const e of errs) em[e.d.m ?? '?'] = (em[e.d.m ?? '?'] ?? 0) + 1;
    const boots = todayEv.filter((e) => e.name === 'boot' && !e.d.first).map((e) => Number(e.d.ready) / 1000).sort((a, b) => a - b);
    const vers = {}; for (const r of D.values()) if (r.v) vers[r.v] = (vers[r.v] ?? 0) + 1;
    const pOpen = todayEv.filter((e) => e.name === 'plus' && e.d.s === 'open').length, pPress = todayEv.filter((e) => e.name === 'plus' && e.d.s && e.d.s !== 'open').length;
    html += `<h2>Health today</h2><section class="health">
<div class="hc ${errs.length ? 'warn' : 'ok'}"><div class="kl">Errors</div><div class="hv">${errs.length ? `<span class="ic" aria-hidden="true">!</span> ${errs.length} from ${errDev} player${errDev === 1 ? '' : 's'}` : '<span class="ic" aria-hidden="true">✓</span> None'}</div>${errs.length ? `<div class="m">${Object.entries(em).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m, n]) => `<code>${esc(String(m).slice(0, 80))}</code> ×${n}`).join('<br>')}</div>` : ''}</div>
<div class="hc"><div class="kl">Start-up</div><div class="hv">${boots.length ? `${boots[Math.floor(boots.length / 2)].toFixed(1)} s` : '–'}</div><div class="m">${boots.length ? `typical, to a ready sky · ${boots.length} launches` : 'no returning launches yet'}</div></div>
<div class="hc"><div class="kl">Versions in use</div><div class="hv vers">${Object.entries(vers).sort((a, b) => verNum(b[0]) - verNum(a[0])).slice(0, 4).map(([v, n]) => `<span class="pill">v${esc(v)} · ${n}</span>`).join(' ') || '–'}</div></div>
<div class="hc"><div class="kl">Plus page</div><div class="hv">${pOpen} opened</div><div class="m">${pPress} pressed buy · ${K.plus.now} bought</div></div>
</section>`; }

  /* Sky: no 'Cards that need art' section: Sky's cards come from the live plane feed, not a daily catalogue */

  html += `<details class="long"><summary>The long view</summary><p class="m">The last 30 days, who comes back, Plus, reminders, what people open, errors and setup.</p>`;

  // The last 30 days, one bar per day.
  const N = 30, days = Array.from({ length: N }, (_, i) => today - (N - 1) + i);
  const act = days.map((d) => activeIn(d, d)), ins = days.map((d) => installsIn(d, d)), cau = days.map((d) => caughtIn(d, d));
  const top = Math.max(4, ...act), W = 720, H = 170, bw = W / N;
  const y = (n) => H - (n / top) * (H - 14);
  let bars = '';
  days.forEach((d, i) => {
    const x = i * bw, lab = new Date(numOf(d) + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    bars += `<g><title>${lab}: ${act[i]} players, ${ins[i]} new, ${cau[i]} caught something</title><rect x="${x + 2}" y="${y(act[i])}" width="${bw - 4}" height="${H - y(act[i])}" rx="2" class="b-act"/><rect x="${x + 2}" y="${y(ins[i])}" width="${bw - 4}" height="${H - y(ins[i])}" rx="2" class="b-new"/>${cau[i] ? `<circle cx="${x + bw / 2}" cy="${y(cau[i])}" r="3" class="b-cau"/>` : ''}</g>`;
    if (i % 7 === 2 || i === N - 1) bars += `<text x="${x + bw / 2}" y="${H + 14}" text-anchor="middle" class="ax">${i === N - 1 ? 'today' : lab}</text>`;
  });
  html += `<h2>The last 30 days</h2><p class="m"><span class="k k-act"></span>players that day &nbsp; <span class="k k-new"></span>new installs &nbsp; <span class="k k-cau"></span>caught something. Tap or hover a day for its numbers.</p>
<svg viewBox="0 -4 ${W} ${H + 22}" class="chart" role="img" aria-label="Players, new installs and catches per day"><text x="0" y="8" class="ax">${top}</text><line x1="0" x2="${W}" y1="${H}" y2="${H}" class="base"/>${bars}</svg>`;

  // The first night and coming back, counting only installs old enough to have had the chance.
  const firstOk = installs.filter((p) => p.played && p.age >= 1); /* rates count installs that played, not throwaway runs */
  const ret = (k) => { const ok = installs.filter((p) => p.played && p.age >= k + 1); return [ok.filter((p) => p.back(k)).length, ok.length]; };
  const r1 = ret(1), r7 = ret(7), r28 = ret(28);
  const two = installs.filter((p) => p.nights.size >= 1), twoN = two.filter((p) => p.nights.size >= 2).length;
  const fn = firstOk.filter((p) => p.firstNight).length;
  /* plus the saved days (all far older than 29 days, so every gate is passed) */
  const pFn = C('firstDay'), pPl = C('played'), pTwo = C('days1'), pTwoN = C('days2');
  for (const [r, k] of [[r1, 'back1'], [r7, 'back7'], [r28, 'back28']]) { r[0] += C(k); r[1] += pPl; }
  const big = (label, a, b, note) => `<tr><th>${label}</th><td class="big">${pct(a, b)}</td><td class="m">${b ? `${a} of ${b}` : 'not enough installs yet'}${note ? ` · ${note}` : ''}</td></tr>`;
  html += `<h2>Do new players get it?</h2><table>
${big('Caught a card on their first day', fn + pFn, firstOk.length + pPl, 'players at least a day old (installs that played)')}
${big('Came back the next day or later', r1[0], r1[1], 'installs at least 2 days old')}
${big('Came back a week or more later', r7[0], r7[1], 'installs at least 8 days old')}
${big('Came back a month or more later', r28[0], r28[1], 'installs at least 29 days old')}
${big('Caught on a second day', twoN + pTwoN, two.length + pTwo, 'of those who caught anything')}
</table>`;

  // By install week.
  const monday = (d) => { const wd = (new Date(numOf(d) + 'T12:00:00Z').getUTCDay() + 6) % 7; return d - wd; };
  const weeks = new Map(); for (const p of installs) { const w = monday(p.iday); if (!weeks.has(w)) weeks.set(w, []); weeks.get(w).push(p); }
  const cell = (list, f, need, add = [0, 0]) => { const ok = list.filter((p) => p.played && p.age >= need), a = ok.filter(f).length + add[0], b = ok.length + add[1]; return b ? `${pct(a, b)}<span class="m"> ${a}/${b}</span>` : '<span class="m">too soon</span>'; };
  const wk = [...weeks.keys()].sort((a, b) => b - a).slice(0, 8);
  html += `<h2>By the week they installed</h2><p class="m">Is each week's group doing better than the last? Newer weeks fill in as they get older.</p><div class="scroll"><table class="grid"><tr><th>Week of</th><th>Installs</th><th>Played</th><th>First-day catch</th><th>Back next day+</th><th>Back a week+ later</th><th>Caught on 2+ days</th></tr>
${wk.map((w) => { const l = weeks.get(w); return `<tr><th>${new Date(numOf(w) + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</th><td>${l.length}</td><td>${l.filter((p) => p.played).length}</td><td>${cell(l, (p) => p.firstNight, 1)}</td><td>${cell(l, (p) => p.back(1), 2)}</td><td>${cell(l, (p) => p.back(7), 8)}</td><td>${cell(l, (p) => p.nights.size >= 2, 2)}</td></tr>`; }).join('') || '<tr><td colspan="7" class="m">No installs yet</td></tr>'}</table></div>`;

  // By platform.
  const plats = ['ios', 'android', 'web'].filter((k) => players.some((p) => p.p === k));
  html += `<h2>By platform</h2><div class="scroll"><table class="grid"><tr><th></th><th>Installs</th><th>Players this week</th><th>First-day catch</th><th>Back next day+</th></tr>
${plats.map((k) => { const l = installs.filter((p) => p.p === k), pp = C('played', k); return `<tr><th>${PLAT[k]}</th><td>${l.length + C('installs', k)}</td><td>${players.filter((p) => p.p === k && [...p.days].some((d) => d >= w0)).length}</td><td>${cell(l, (p) => p.firstNight, 1, [C('firstDay', k), pp])}</td><td>${cell(l, (p) => p.back(1), 2, [C('back1', k), pp])}</td></tr>`; }).join('') || '<tr><td colspan="5" class="m">No players yet</td></tr>'}</table></div>`;

  // Reminders.
  const by = (name, f) => new Set(ev.filter((e) => e.name === name && f(e)).map((e) => e.iid)).size;
  const cnt = (name, f) => ev.filter((e) => e.name === name && f(e)).length;
  const setters = by('remind', (e) => e.d.s === 'set');
  const taps = cnt('remind', (e) => e.d.s === 'tap'), tappers = by('remind', (e) => e.d.s === 'tap'), nots = cnt('remind', (e) => e.d.s === 'nottonight'), widg = cnt('remind', (e) => e.d.s === 'widget');
  const chans = {}; for (const e of ev) if (e.name === 'remind' && e.d.s === 'tap') chans[e.d.ch || 'other'] = (chans[e.d.ch || 'other'] ?? 0) + 1;
  const CH = { asked: 'ones they set', tonight: 'tonight / clear-sky', other: 'other' };
  const row = (k, v, sub = '') => `<tr><th>${k}</th><td>${v}</td><td class="m">${sub}</td></tr>`;
  const seenRem = ev.some((e) => e.name === 'remind');
  html += `<h2>Do reminders bring people back?</h2>${seenRem ? '' : '<p class="m">Counted from v0.1.1519 on, so this fills in once the next builds are out.</p>'}<table>
${row('Set a reminder themselves', String(setters))}
${row('Tapped a reminder to open the app', String(taps), `${tappers} players · ${Object.entries(chans).map(([k, n]) => `${CH[k] ?? esc(k)}: ${n}`).join(' · ') || 'none yet'}`)}
${row('Tapped “Not tonight”', String(nots))}
${row('Opened from a home-screen widget', String(widg))}
</table>`;

  // Plus.
  const opened = by('plus', (e) => e.d.s === 'open'), tried = by('plus', (e) => e.d.s && e.d.s !== 'open'), bought = by('plus', (e) => e.d.s === 'buy');
  const plans = {}; for (const e of ev) if (e.name === 'plus' && e.d.s === 'buy') plans[e.d.plan || '?'] = (plans[e.d.plan || '?'] ?? 0) + 1;
  const fails = {}; for (const e of ev) if (e.name === 'plus' && e.d.s && !['open', 'buy'].includes(e.d.s)) fails[e.d.s] = (fails[e.d.s] ?? 0) + 1;
  const whys = {}; for (const e of ev) if (e.name === 'plus' && e.d.s === 'open') whys[e.d.why || 'other'] = (whys[e.d.why || 'other'] ?? 0) + 1;
  const list = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(k)}: ${n}`).join(' · ') || '–';
  html += `<h2>Plus</h2><table>
${big('Looked at Plus', opened, players.length, 'of all players')}
${big('Pressed buy', tried, opened, 'of those who looked')}
${big('Bought', bought, opened, `of those who looked · plans: ${list(plans)}`)}
${row('Didn’t go through', list(fails), 'cancelled = they backed out; error = the store said no')}
${row('What opened the Plus page', list(whys))}
</table><p class="m">Money, renewals and refunds are in <a href="https://app.revenuecat.com/projects/d30f3dad/overview">RevenueCat</a>.</p>`;

  // What people catch, sharing, pages, notifications, clouds, start-up time and secrets (all counted from v0.1.1527 on).
  const since = (n) => ev.filter((e) => e.name === n && e.ts > now - 30 * DAY);
  const tally = (list, f) => { const o = {}; for (const e of list) { const k = f(e); if (k != null && k !== '') o[k] = (o[k] ?? 0) + 1; } return o; };
  const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const catches = since('catch'), fresh = catches.filter((e) => e.d.n === 1), byTier = tally(fresh, (e) => e.d.t), byKind = tally(fresh, (e) => e.d.k);
  const KIND = { airliner: 'airliners', private: 'private planes', anon: 'private (unnamed)', heli: 'helicopters', balloon: 'balloons', airship: 'airships', glider: 'gliders', other: 'other' }; /* Sky */
  const newSince = !ev.some((e) => ['catch', 'share', 'boot', 'perm', 'secret'].includes(e.name));
  html += `<h2>What people catch (last 30 days)</h2>${newSince ? '<p class="m">This section and the ones below fill in as the apps send.</p>' : ''}<table>
${row('New cards caught', String(fresh.length), `${catches.length - fresh.length} repeat sightings · ${catches.filter((e) => e.d.s === 1).length} shiny`)}
${row('By rarity', TIERS.map((t) => `${t[0].toUpperCase() + t.slice(1)} ${byTier[t] ?? 0}`).join(' · '), fresh.length ? `${pct((byTier.rare ?? 0) + (byTier.epic ?? 0) + (byTier.legendary ?? 0), fresh.length)} Rare or rarer` : '')}
${row('By kind', Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(KIND[k] ?? k)} ${n}`).join(' · ') || '–')}
</table>`;
  const shares = since('share'), sharers = new Set(shares.map((e) => e.iid)).size, SW = { reveal: 'from the new-card reveal', viewer: 'from the Collection', week: 'their week' };
  html += `<h2>Sharing (last 30 days)</h2><table>
${row('Shares', String(shares.length), `${sharers} players · ${Object.entries(tally(shares, (e) => e.d.w)).map(([k, n]) => `${SW[k] ?? esc(k)}: ${n}`).join(' · ') || 'none yet'}`)}
</table>`;
  // Review asks (from v0.1.1570): n >= 1 is Apple's own sheet being requested (Apple may still not show it); n = 0 is a tap on a rating link.
  { const rv = since('review'), asked = rv.filter((e) => Number(e.d.n) >= 1), links = rv.filter((e) => !Number(e.d.n));
    const WHY = { return: 'came back another day', milestone: 'a card, patch or rank put away', share: 'shared a card', recap: 'closed the weekly recap', night5: '5th night', night10: '10th night', 'link-set': 'Settings', 'link-note': 'the note from Sevaan', 'link-recap': 'the weekly recap' };
    const say = (l) => Object.entries(tally(l, (e) => e.d.why)).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${WHY[k] ?? esc(k)}: ${n}`).join(' · ') || 'none yet';
    html += `<h2>Asking for reviews (last 30 days)</h2>${rv.length ? '' : '<p class="m">Counted from v0.1.1570 on, so this fills in once the next build is out.</p>'}<table>
${row('Apple’s rating sheet requested', String(asked.length), `${new Set(asked.map((e) => e.iid)).size} players · ${say(asked)}`)}
${row('Tapped a “Rate” link', String(links.length), say(links))}
</table><p class="m">Apple decides whether its sheet actually appears (at most three times a year per person), and ratings themselves are in App Store Connect.</p>`; }
  const ends = since('end').filter((e) => e.d.pg != null), seen = (k) => ends.filter((e) => String(e.d.pg).split(',').includes(k)).length;
  html += `<h2>What people open (share of sessions, last 30 days)</h2><table>
${row('Today page', pct(seen('tonight'), ends.length), `${seen('tonight')} of ${ends.length} sessions`)}
${row('Collection', pct(seen('collection'), ends.length), String(seen('collection')))}
${row('Plus page', pct(seen('plus'), ends.length), String(seen('plus')))}
</table>`;
  const lastPerm = new Map(); for (const e of ev) if (e.name === 'perm') lastPerm.set(e.iid, e.d.n); const perms = tally([...lastPerm.values()].map((n) => ({ n })), (e) => e.n);
  const darkEnds = ends.filter((e) => e.d.dark === 1 && Number(e.d.s) >= 60 && Number(e.d.cl) >= 0), clear = darkEnds.filter((e) => e.d.cl < 50), cloudy = darkEnds.filter((e) => e.d.cl >= 50);
  const none = (l) => l.filter((e) => !Number(e.d.c)).length;
  html += `<h2>Notifications and clouds</h2><table>
${row('Notifications allowed', pct(perms.granted ?? 0, lastPerm.size), `${perms.granted ?? 0} of ${lastPerm.size} players · ${perms.denied ?? 0} said no · ${(perms.prompt ?? 0) + (perms['prompt-with-rationale'] ?? 0) + (perms.default ?? 0)} not asked yet`)}
${row('Dark visits with no catch, clear sky', pct(none(clear), clear.length), `${none(clear)} of ${clear.length} (forecast under 50% cloud)`)}
${row('… cloudy sky', pct(none(cloudy), cloudy.length), `${none(cloudy)} of ${cloudy.length} (50% cloud or more)`)}
</table>`;
  const boots = since('boot').filter((e) => !e.d.first).map((e) => Number(e.d.ready) / 1000).sort((a, b) => a - b), q = (f) => (boots.length ? `${boots[Math.min(boots.length - 1, Math.floor(f * boots.length))].toFixed(1)} s` : '–');
  const secrets = tally(since('secret'), (e) => e.d.id);
  html += `<h2>Start-up and secrets</h2><table>
${row('Time to a ready sky', q(0.5), boots.length ? `typical (middle) · slowest 1 in 10: ${q(0.9)} · ${boots.length} launches, returning players` : 'no launches yet')}
${row('Secrets found', String(Object.values(secrets).reduce((a, b) => a + b, 0)), Object.entries(secrets).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(SECRET[k] ?? k)} ${n}`).join(' · ') || 'none yet')}
</table>`;


  // ----- Sky: the plane feed (2026-11-19, Boss/Sevaan: the feed-cost question). Each app session sends one 'feed' row when
  // it goes to the background: asks to adsb.lol from the phone (ph, phOk), to our relay (rl, rlOk), 429s from adsb.lol (q),
  // the lowest allowance adsb.lol reported (low, of ~500 a day per internet address) and why it handed over to the relay (sw). -----
  { const fd = since('feed'), sum = (f) => fd.reduce((a, e) => a + (Number(f(e)) || 0), 0);
    const ph = sum((e) => e.d.ph), phOk = sum((e) => e.d.phOk), rl = sum((e) => e.d.rl), rlOk = sum((e) => e.d.rlOk);
    const devDay = (f) => { const m = new Map(); for (const e of fd) if (f(e)) { const k = e.day; (m.get(k) ?? m.set(k, new Set()).get(k)).add(e.iid); } return m; };
    const usedDay = devDay((e) => (Number(e.d.ph) || 0) + (Number(e.d.rl) || 0) > 0), limDay = devDay((e) => Number(e.d.q) > 0 || e.d.sw === 'low' || e.d.sw === '429');
    const relayDay = devDay((e) => Number(e.d.rl) > 0), ds = [...usedDay.keys()];
    const pd = (m) => ds.reduce((a, d) => a + (m.get(d)?.size ?? 0), 0);
    const worst = ds.reduce((b, d) => Math.max(b, m0(limDay, d)), 0); function m0(m, d) { return m.get(d)?.size ?? 0; }
    const why = tally(fd.filter((e) => e.d.sw), (e) => e.d.sw), WHY = { low: 'allowance nearly used up', 429: 'adsb.lol said 429', fails: 'adsb.lol failing' };
    const lows = fd.map((e) => Number(e.d.low)).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
    html += `<h2>Plane feed (last 30 days)</h2>${fd.length ? '' : '<p class="m">Fills in from the first app build that sends it.</p>'}<table>
${row('Asks from phones to adsb.lol', fmt(ph), ph ? `${pct(phOk, ph)} answered` : '')}
${row('Asks to our relay (FlyItalyADSB)', fmt(rl), rl ? `${pct(rlOk, rl)} answered${relay?.budget?.quota ? ` · this month on this server: ${fmt(relay.budget.used)} of ${fmt(relay.budget.quota)}` : ''}` : '')}
${row('Phones that hit adsb.lol’s daily limit', `${fmt(pd(limDay))} phone-day${pd(limDay) === 1 ? '' : 's'}`, ds.length ? `of ${fmt(pd(usedDay))} phone-days with planes · worst day ${worst} · “429 too many” answers: ${fmt(sum((e) => e.d.q))}` : '')}
${row('Phone-days that needed the relay', fmt(pd(relayDay)), Object.entries(why).map(([k, n]) => `${WHY[k] ?? esc(k)}: ${n}`).join(' · ') || 'no hand-overs')}
${row('Lowest allowance left', lows.length ? `${lows[Math.floor(lows.length / 2)]} typical` : '–', lows.length ? `lowest ${lows[0]} · adsb.lol allows about 500 a day per internet address, reset at 00:00 UTC` : '')}
</table>`; }

  // Errors in the last 14 days.
  const errs = new Map();
  for (const e of ev) if (e.name === 'err' && e.ts > now - 14 * DAY) { const k = String(e.d.m ?? ''); const r = errs.get(k) ?? { n: 0, who: new Set(), plat: new Set(), v: e.v, last: 0, src: e.d.s }; r.n++; r.who.add(e.iid); r.plat.add(PLAT[e.p] ?? e.p); if (verNum(e.v) > verNum(r.v)) r.v = e.v; r.last = Math.max(r.last, e.ts); errs.set(k, r); }
  const er = [...errs.entries()].sort((a, b) => b[1].who.size - a[1].who.size || b[1].last - a[1].last).slice(0, 12);
  html += `<h2>Errors (last 14 days)</h2><table>${er.map(([m, r]) => `<tr><th><code>${esc(m)}</code>${r.src ? `<div class="m">${esc(r.src)}</div>` : ''}</th><td>${r.who.size}<span class="m"> ${r.who.size === 1 ? 'player' : 'players'}</span></td><td class="m">${[...r.plat].join(', ')} · newest v${esc(r.v)} · last ${when(r.last)}</td></tr>`).join('') || '<tr><td class="m">None reported</td></tr>'}</table>`;

  // Versions in use.
  const vers = {}; for (const p of players) if ([...p.days].some((d) => d >= w0)) vers[p.v] = (vers[p.v] ?? 0) + 1;
  html += `<h2>Versions in use this week</h2><p>${Object.entries(vers).sort((a, b) => verNum(b[0]) - verNum(a[0])).slice(0, 8).map(([v, n]) => `v${esc(v)}: <b>${n}</b>`).join(' &nbsp;·&nbsp; ') || '–'}</p>`;

  // Setup details, folded away.
  const tour = (s) => by('tour', (e) => e.d.s === s);
  const loc = {}; for (const e of ev) if (e.name === 'tour' && e.d.s === 'loc') loc[e.d.loc] = (loc[e.d.loc] ?? 0) + 1;
  const mot = {}; const lastMot = new Map(); for (const e of ev) if (e.name === 'motion') lastMot.set(e.iid, e.d.s); for (const s of lastMot.values()) mot[s] = (mot[s] ?? 0) + 1;
  const cal = ev.filter((e) => e.name === 'calib' && e.d.s == null && e.d.deg != null), calBig = cal.filter((e) => Math.abs(e.d.deg) >= 20).length;
  const helpShown = by('help', (e) => e.d.s === 'shown'), picks = {}; for (const e of ev) if (e.name === 'help' && e.d.pick) picks[e.d.pick] = (picks[e.d.pick] ?? 0) + 1;
  const PICK = { show: 'show me something', line: 'line up the sky', more: 'see more stars', close: 'closed it' };
  const dark = ev.filter((e) => e.name === 'end' && e.d.dark === 1 && Number(e.d.s) >= 60), darkNo = dark.filter((e) => !Number(e.d.c)).length;
  const mShown = by('sky', (e) => e.d.s === 'match-shown'), mDone = by('sky', (e) => e.d.s === 'match');
  html += `<details><summary>Setup and sky details</summary><table>
${row('Setup tour', `${tour('done')} finished · ${tour('skip')} skipped`)}
${row('Location in the tour', `${loc.own ?? 0} shared it · ${loc.tz ?? 0} used their time zone's city · ${loc.skip ?? 0} skipped`)}
${row('How they look around', `${mot.live ?? 0} move the phone · ${mot.drag ?? 0} drag with a finger · ${mot.none ?? 0} no motion sensor`, 'each player’s latest')}
${row('Matched the sky brightness', `${mDone} of ${mShown} shown the card`)}
${row('Lined up the compass', `${cal.length} times`, cal.length ? `${pct(calBig, cal.length)} needed a turn of 20° or more (a poor compass)` : '')}
${row('“Nothing caught yet?” card', `shown to ${helpShown}`, Object.entries(picks).map(([k, n]) => `${PICK[k] ?? esc(k)}: ${n}`).join(' · ') || 'no picks yet')}
</table></details>`;
  html += '</details>';

  const dayTitle = new Date(now).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
  const head = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#080f1b"><link rel="icon" type="image/png" href="/icon.png"><link rel="apple-touch-icon" href="/icon.png"><title>Mission Control</title>
<style>${FONTS}:root{color-scheme:light;--bg:#eef5fb;--ink:#0d2238;--dim:#4a6178;--line:#d6e0ea;--grid:#e3ebf2;--gold:#0d2238;--or:#d7362b;--tile:#fffdf6;--tile2:#f7f2e6;--up:#1f7a45;--down:#b42a20;--disp:'SC Display',system-ui,sans-serif;--label:'SC Label','Arial Narrow',system-ui,sans-serif}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;padding:28px 16px 64px;background:linear-gradient(180deg,#8cc2ec 0,#cfe5f6 260px,var(--bg) 620px) no-repeat,var(--bg);color:var(--ink);font:15px/1.45 -apple-system,system-ui,sans-serif}main{max-width:860px;margin:0 auto}
.eyebrow{font:500 13px var(--label);letter-spacing:.24em;text-transform:uppercase;color:var(--dim)}
h1{font:400 30px/1.1 var(--disp);letter-spacing:.02em;color:var(--gold);margin:2px 0 6px;text-transform:uppercase}
h2{font:500 15px var(--label);letter-spacing:.2em;text-transform:uppercase;color:var(--or);margin:36px 0 12px}
.top{color:var(--dim);font-size:13px;margin:0 0 6px}.top b{color:var(--ink);font-weight:500}a{color:var(--or)}
.up{color:var(--up)}.down{color:var(--down)}.m{color:var(--dim);font-size:13px}.small{font-size:12px}.ink{color:var(--ink);font-weight:600}
.hero{margin:22px 0 4px;padding:22px 20px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(160deg,#fffdf6,#f6efdd);box-shadow:0 10px 30px rgba(13,34,56,.12)}
.hn{font:600 64px/1 -apple-system,system-ui,sans-serif;color:var(--gold);letter-spacing:-.02em}.hl{font:500 18px var(--label);letter-spacing:.14em;text-transform:uppercase;margin-top:4px}.hd{margin-top:6px;font-size:14px}
.story{margin:14px 0 0;font-size:15px;color:#2c4560;max-width:62ch}.story b{color:var(--ink);font-weight:600}
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.kpi,.rec,.mile,.hc{background:var(--tile);border:1px solid var(--line);border-radius:12px;padding:12px 12px 10px}
.kl{font:500 13px var(--label);letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.kn{font:600 34px/1.1 -apple-system,system-ui,sans-serif;color:var(--gold);margin-top:4px}.kd{font-size:12.5px;margin-top:2px;min-height:18px}
.krow{display:flex;align-items:flex-end;justify-content:space-between;gap:8px}.kf{margin-top:6px;font-size:12px;line-height:1.35}
.spark{width:64px;height:24px;flex:none;overflow:visible;margin-bottom:6px}.spark polyline{fill:none;stroke:#8aa0b8;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}.spark circle{fill:var(--or);stroke:var(--tile);stroke-width:2;vector-effect:non-scaling-stroke}
.chart{width:100%;height:auto;display:block;overflow:visible}.grid{stroke:var(--grid);stroke-width:1}.base{stroke:var(--line)}.ax{fill:var(--dim);font:500 12px var(--label);letter-spacing:.06em}.ax.now{fill:var(--or)}
.b-today{fill:var(--or)}.b-yest{stroke:#8aa0b8;stroke-width:2;stroke-linecap:round}.hit{fill:transparent;cursor:default;outline:none}.hit:hover,.hit:focus{fill:#0d22380a}
.legend{margin:-4px 0 8px;color:var(--dim);font-size:13px}.k{display:inline-block;width:12px;height:10px;border-radius:2px;margin-right:6px;vertical-align:0}.k-today{background:var(--or)}.k-yest{height:2px;background:#8aa0b8;vertical-align:3px}
.lead{margin:0 0 10px;font-size:16px}.lead b{color:var(--gold)}.shiny{background:linear-gradient(90deg,#c99520,#e8493c,#24508c);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:700}
.segbar{display:flex;gap:2px;height:28px;border-radius:4px;overflow:hidden}.seg{min-width:3px;border-radius:4px;display:flex;align-items:center;padding-left:8px;outline:none}.seg span{font:600 13px -apple-system,system-ui,sans-serif;color:#0b1220}.seg:hover,.seg:focus{filter:brightness(1.12)}
.seglegend{list-style:none;display:flex;flex-wrap:wrap;gap:6px 16px;margin:10px 0 0;padding:0;font-size:14px}.seglegend b{color:var(--gold);font-weight:600;margin-left:2px}
.gem{display:inline-block;width:1.1em;text-align:center}
.kinds{margin-top:16px;display:grid;gap:7px}.kr{display:grid;grid-template-columns:118px 1fr 52px;align-items:center;gap:10px;font-size:14px;outline:none}.kk{color:#2c4560;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kb,.fb{height:10px;background:var(--tile2);border-radius:4px}.kb i,.fb i{display:block;height:100%;background:var(--or);border-radius:0 4px 4px 0}.kv{text-align:right;font-variant-numeric:tabular-nums;color:var(--gold)}
.two{display:grid;grid-template-columns:1fr;gap:0 24px}@media(min-width:760px){.two{grid-template-columns:1fr 1fr}}
.board{list-style:none;margin:0;padding:0}.board li{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
.rk{font:400 18px var(--disp);color:var(--dim);text-align:center}.board li:first-child .rk{color:var(--gold)}.who{display:flex;flex-direction:column;min-width:0}.who b{font-weight:600}.who .m{font-size:12.5px}.bf{font-size:13px;color:#2c4560;margin-top:2px}
.num{font:600 22px/1 -apple-system,system-ui,sans-serif;color:var(--gold);text-align:right}.num small{display:block;font:500 11px var(--label);letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-top:3px}
.pill{display:inline-block;padding:1px 7px;border:1px solid var(--line);border-radius:999px;font:500 12px var(--label);letter-spacing:.06em;color:#2c4560;white-space:nowrap}.pill.gold{border-color:#d9b65a;color:var(--gold)}
.feed{list-style:none;margin:0;padding:0}.feed li{display:grid;grid-template-columns:auto auto 1fr;gap:8px 10px;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px}
.feed time{font:500 13px var(--label);letter-spacing:.04em;color:var(--dim);white-space:nowrap;font-variant-numeric:tabular-nums}.feed .fx{min-width:0}.feed b{font-weight:600}
.tag{font:500 11px var(--label);letter-spacing:.12em;text-transform:uppercase;padding:1px 6px;border-radius:4px;border:1px solid var(--line);color:var(--dim)}.f-join .tag{color:var(--or);border-color:#f0b9a0}.f-plus .tag{color:var(--gold);border-color:#d9b65a}.f-secret .tag{color:#e46ad6;border-color:#e2b5dc}
.funnel{display:grid;gap:9px}.fr{display:grid;grid-template-columns:190px 1fr 64px;gap:10px;align-items:center;font-size:14px;outline:none}.fl{color:#2c4560}.fv{text-align:right;color:var(--gold);font-variant-numeric:tabular-nums}.fv small{color:var(--dim);margin-left:5px;font-size:12px}
@media(max-width:520px){.fr{grid-template-columns:1fr 64px}.fr .fb{grid-column:1/-1;grid-row:2}.kr{grid-template-columns:100px 1fr 44px}}
.recs,.health{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}.rv{font:600 28px/1.1 -apple-system,system-ui,sans-serif;color:var(--gold);margin:4px 0 2px}.rv small{font:500 12px var(--label);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-left:6px}
.rec.hot{border-color:#d9b65a;background:linear-gradient(160deg,#fbf1d6,var(--tile))}
.meter{height:8px;background:var(--tile2);border-radius:4px;margin:6px 0 6px;overflow:hidden}.meter i{display:block;height:100%;background:var(--or);border-radius:4px}
.hv{font:600 18px/1.3 -apple-system,system-ui,sans-serif;margin:4px 0 2px}.hv.vers{display:flex;flex-wrap:wrap;gap:4px;font-size:14px}.hc.ok .ic{color:var(--up)}.hc.warn{border-color:#f0b9a0}.hc.warn .ic{color:var(--down)}.ic{font-weight:700}
.empty{color:var(--dim);font-size:14px;padding:14px 16px;border:1px dashed var(--line);border-radius:12px;margin:0}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{font-weight:500;color:#2c4560}td{color:var(--gold);font-variant-numeric:tabular-nums}
td.big{font-size:20px;font-weight:600;white-space:nowrap}.grid th,.grid td{white-space:nowrap}.grid tr:first-child th{color:var(--dim);font-size:12px;font-weight:500}.scroll{overflow-x:auto}
code{font:12px ui-monospace,monospace;color:#a8361c;word-break:break-word}
.b-act{fill:#9cc3e6}.b-new{fill:var(--or)}.b-cau{fill:var(--gold)}.k-act{background:#9cc3e6}.k-new{background:var(--or)}.k-cau{background:var(--gold);border-radius:50%}
details{margin-top:30px}summary{cursor:pointer;color:var(--or);font:500 15px var(--label);letter-spacing:.2em;text-transform:uppercase}
details.long{margin-top:44px;padding-top:18px;border-top:1px solid var(--line)}details.long>summary{font-size:16px}
#tip{position:fixed;z-index:9;pointer-events:none;background:#16243b;border:1px solid #2c4060;color:var(--ink);font-size:13px;padding:6px 9px;border-radius:8px;box-shadow:0 6px 18px #0008;opacity:0;transition:opacity .12s;max-width:240px}#tip.on{opacity:1}
.hours{position:relative}.hgrid{position:absolute;left:0;right:0;top:0;height:150px;pointer-events:none}.hgrid span{position:absolute;left:0;right:0;height:0;border-top:1px solid var(--grid)}.hgrid em{position:absolute;right:0;bottom:3px;font:500 12px var(--label);font-style:normal;color:var(--dim)}
.hcols{position:relative;display:grid;grid-template-columns:repeat(24,1fr);height:150px;border-bottom:1px solid var(--line)}.hc-col{position:relative;outline:none}.hc-col:hover,.hc-col:focus{background:#0d22380a}
.hc-col .bar{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:min(70%,18px);background:var(--or);border-radius:4px 4px 0 0}.hc-col .yest{position:absolute;left:50%;transform:translate(-50%,1px);width:min(86%,22px);height:2px;background:#8aa0b8;border-radius:2px}
.hlabs{display:grid;grid-template-columns:repeat(24,1fr);margin-top:6px;font:500 12px var(--label);letter-spacing:.04em;color:var(--dim);white-space:nowrap}.hlabs span{overflow:visible;width:0}.hlabs b{color:var(--or);font-weight:500}
[data-tip]{cursor:default}.gem{text-shadow:0 0 1px rgba(13,34,56,.6)} /* Sky: the game's tier colours, edged so the light ones read on cream */</style><main>
<div class="eyebrow">Sky Collector</div><h1>Mission Control</h1>
<p class="top"><b>${dayTitle}</b> · Toronto time · updated ${clock(now)} · <a href="">refresh</a> (new numbers every 10 minutes)</p>
<p class="top">${all ? `<b>Everyone, including tests</b> (the website and builds in testing mode) · <a href="?${keyQs}">real players only</a>` : `<b>Real players</b> (the website and tests left out) · <a href="?all=1&amp;${keyQs}">include tests</a>`} · ${before ? `<b>including the testing weeks</b> · <a href="?${all ? 'all=1&amp;' : ''}${keyQs}">from launch only</a>` : `counting from Nov 19, 2026 (Sky's first app builds) · <a href="?before=1&amp;${all ? 'all=1&amp;' : ''}${keyQs}">include the testing weeks</a>`} · anonymous: a random ID per install, no places or names</p>`;
  const tipJs = `<div id="tip" role="tooltip"></div><script>(()=>{const t=document.getElementById('tip');let cur=null;const show=(el,x,y)=>{cur=el;t.textContent=el.getAttribute('data-tip');t.classList.add('on');const r=t.getBoundingClientRect();t.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x-r.width/2))+'px';t.style.top=Math.max(8,y-r.height-12)+'px';};const hide=()=>{cur=null;t.classList.remove('on');};
addEventListener('pointerover',e=>{const el=e.target.closest('[data-tip]');if(el&&e.pointerType==='mouse')show(el,e.clientX,e.clientY);else if(!el&&e.pointerType==='mouse')hide();});
addEventListener('pointermove',e=>{if(cur&&e.pointerType==='mouse')show(cur,e.clientX,e.clientY);});
addEventListener('click',e=>{const el=e.target.closest('[data-tip]');if(el&&el!==cur){const r=el.getBoundingClientRect();show(el,r.left+r.width/2,r.top);}else hide();});
addEventListener('focusin',e=>{const el=e.target.closest('[data-tip]');if(el){const r=el.getBoundingClientRect();show(el,r.left+r.width/2,r.top);}});addEventListener('focusout',hide);addEventListener('scroll',hide,{passive:true});})();</script>`;
  return head + html + '</main>' + tipJs;
}
