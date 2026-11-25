// Sky Collector's daily note on Today, its words and its pick (2026-11-24, content/sky-today-note-copy-2026-11-24.md,
// Sevaan: "Do it all and all ten"). Pure: js/main.js gathers what is true now (ctx) and keeps the memory (mem, in
// localStorage 'skyNote'); this decides which note shows and what it says. No DOM, so tests/sky-note.test.mjs can run days.
//
// Order: caught (4 h after a catch today) › rare › a moment › regular › level › the pool.
// Rule 1: the pick is kept for the day; a kept pool or level pick gives way to rare, a moment or a regular that turns up,
//         a kept regular to rare. Rule 2: the pool never opens with yesterday's pool kind (unless it's the only one true).
// Rule 3: "Welcome back. Day N!" on day 2 and day 3 only, once each. Moments: at most one a day, none two days running.
// Privacy: every name here comes from ctx, which only carries airline flights on Sky's own list by airline and number
// (js/sky-regulars.js regularAllowed); anything else is its kind ("a Gulfstream G650"), never a callsign or a place.

export const POOL = ['upnow', 'going', 'pace', 'records', 'yesterday', 'set', 'theme', 'mission'];
const RANK = { caught: 0, rare: 1, moment: 2, regular: 3, level: 4, pool: 5 };
const KEPT_YIELDS = { pool: ['rare', 'moment', 'regular'], level: ['rare', 'moment', 'regular'], regular: ['rare'] };
const DAY = 86400e3;

export const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const prevDay = (t) => dayKey(new Date(new Date(t).setHours(12, 0, 0, 0)).getTime() - DAY);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* names keep a model designation on one line, as card titles do (js/flight-card.js escName; QA round 4: never "747-" / "8") */
export const escName = (s) => esc(s).replace(/\S+-\S+/g, (w) => `<span style="white-space:nowrap">${w}</span>`);
const em = (s) => `<em>${escName(s)}</em>`;
export const aAn = (w) => (/^[AEIOU]/i.test(String(w ?? '').trim()) && !/^(U[a-z]|Eu|One)/.test(String(w ?? '').trim()) ? 'an' : 'a');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const numWord = (n) => (n === 0 ? 'None' : n === 1 ? 'One' : String(n));
/* a card fact without its bold markers (the note has its own emphasis) */
export const plainFact = (f) => String(f ?? '').replace(/\*\*/g, '').trim();
/* "Air Canada 856 to Ottawa" from a flight ctx entry { airline, number, city } */
/* a card named inside a sentence (Content, 2026-11-24: "To Halifax" doesn't read as a name): a flight card is "Air Canada 856
   to Halifax", or "the flight to Halifax" without an airline on Sky's list; a plane card is its name. cap: it starts a sentence */
const cardPhrase = (name, fc, cap = false) => (fc?.city ? (fc.airline && fc.number ? em(`${fc.airline} ${fc.number} to ${fc.city}`) : `${cap ? 'The' : 'the'} flight ${em(`to ${fc.city}`)}`) : em(name));
const flightName = (f, city = true) => `${f.airline} ${f.number}${city && f.city ? ` to ${f.city}` : ''}`;

// ---------- the candidates ----------
function caughtCand(c, ctx) {
  if (!c || ctx.now - c.at > 4 * 3600e3) return null;
  const left = ctx.missionsLeft, dim = left == null ? null : [left > 0 ? `${plural(left, 'mission')} left today.` : 'All three of today’s missions are done.', 'dim'];
  let first = null;
  if (c.newCard && c.fact) first = `${aAn(c.typeName).replace(/^a/, 'A')} ${em(c.typeName)}. ${esc(plainFact(c.fact))}`;
  else if (c.newCard) first = `Got it. ${cardPhrase(c.cardName, c.cardFlight, true)} is card ${c.cardCount}.`;
  else if (c.flightDays >= 2 && c.flight) first = `${em(flightName(c.flight, false))} again. That’s ${c.flightDays} days.`;
  else if (c.typeCount >= 2) first = `Another ${em(c.typeName)}. That’s ${c.typeCount} different ones.`;
  if (!first) return null;
  return { kind: 'caught', key: String(c.at), bubbles: dim ? [first, dim] : [first], modelKey: c.modelKey };
}

function momentCand(ctx, mem) {
  const today = dayKey(ctx.now), y = mem.hist?.[prevDay(ctx.now)];
  if (mem.hist?.[today]?.moment) return mem.hist[today].moment; /* today's, kept */
  if (y?.moment) return null; /* none two days running */
  /* 1 · your anniversary: a year or a month since the first card */
  const f = ctx.firstCatch;
  if (f) { const d0 = new Date(f.at), d1 = new Date(ctx.now), year = d1.getFullYear() - d0.getFullYear() >= 1 && d0.getMonth() === d1.getMonth() && d0.getDate() === d1.getDate();
    const month = !year && d0.getDate() === d1.getDate() && (d1.getFullYear() * 12 + d1.getMonth()) - (d0.getFullYear() * 12 + d0.getMonth()) === 1;
    if (year || month) return { kind: 'moment', sub: 'anniversary', key: `ann-${today}`, bubbles: [`${year ? 'A year' : 'A month'} ago today you caught your first card: ${cardPhrase(f.cardName, f.cardFlight)}.`, [`You have ${ctx.cardCount} now.`, 'dim']], modelKey: f.modelKey }; }
  /* 2 · a regular's round number */
  const rr = (ctx.roundDays ?? []).find((r) => !(mem.rounds ?? []).includes(`${r.key}@${r.days}`));
  if (rr) return { kind: 'moment', sub: 'round', key: `${rr.key}@${rr.days}`, bubbles: [`That’s ${rr.days} days you’ve caught ${em(flightName(rr.flight, false))}.`], modelKey: rr.key, mark: { rounds: `${rr.key}@${rr.days}` } };
  /* 3 · a first, yesterday (Rare or better), once per card */
  const fy = (ctx.firstsYesterday ?? []).find((x) => !(mem.firsts ?? []).includes(x.key));
  if (fy) return { kind: 'moment', sub: 'first', key: fy.key, bubbles: [`Yesterday you caught your first ${em(fy.typeName)}.`], modelKey: fy.key, mark: { firsts: fy.key } };
  /* 4 · a stranger to your sky: a type up now the last 7 days haven't seen, airline flights only, with 5 days of log */
  const st = ctx.stranger;
  if (st && (ctx.logDays ?? 0) >= 5) return { kind: 'moment', sub: 'stranger', key: st.hex, show: st.hex, bubbles: [`${aAn(st.typeName).replace(/^a/, 'A')} ${em(st.typeName)} is over you.`, ['Your sky hasn’t had one all week.', 'dim']] };
  /* 5 · a record: today's farthest beats the best kept, after a week of play */
  const far = ctx.tally?.far, best = ctx.bestFar;
  if (far && far.city && (ctx.daysPlayed ?? 0) >= 7 && best && far.km > best.km) return { kind: 'moment', sub: 'record', key: `rec-${today}`, bubbles: [`The farthest traveller your sky has shown you: ${aAn(far.typeName)} ${em(far.typeName)} to ${em(far.city)}, ${far.km.toLocaleString('en-US')} km.`] };
  return null;
}

function regularCand(ctx, mem) {
  const today = dayKey(ctx.now), regs = ctx.regulars ?? [], yName = mem.regNamed?.[prevDay(ctx.now)];
  /* it becomes a regular: once per flight (the ones already regular when this shipped were never news) */
  const keptNew = mem.pick?.day === today && mem.pick.kind === 'regular' && mem.pick.sub === 'new' ? regs.find((r) => r.callsign === mem.pick.key) : null; /* the news stays up for the day */
  const fresh = keptNew ?? regs.find((r) => mem.regsKnown && !mem.regsKnown.includes(r.callsign));
  if (fresh) return { kind: 'regular', sub: 'new', key: fresh.callsign, bubbles: ['You have a regular.', `${em(flightName(fresh))} has come over about ${esc(fresh.clock)} on ${fresh.days === 3 ? 'three' : fresh.days} days this week.`], modelKey: fresh.cardKey, mark: { regsKnown: fresh.callsign } };
  /* already over today: the two times and nothing else (never early or late: the usual time is an average, not a schedule) */
  const over = regs.find((r) => r.seenToday != null && ctx.minuteNow > r.minute && !(mem.over ?? {})[`${r.callsign}@${today}`]);
  const overKept = regs.find((r) => { const at = (mem.over ?? {})[`${r.callsign}@${today}`]; return at && ctx.now - at < 30 * 60e3; }); /* "show once": this view, not every redraw */
  const o = overKept ?? over;
  if (o) return { kind: 'regular', sub: 'over', key: o.callsign, bubbles: [`${em(flightName(o, false))} came over at ${esc(o.seenClock)} today.`, [`It’s usually about ${esc(o.clock)}.`, 'dim']], modelKey: o.cardKey, mark: { over: `${o.callsign}@${today}` } };
  /* due in the next 3 hours, not caught today; not yesterday's if another is due */
  const due = regs.filter((r) => r.next > ctx.now && r.next - ctx.now < 3 * 3600e3 && !r.caughtToday && r.seenToday == null);
  const d = due.find((r) => r.callsign !== yName) ?? due[0];
  if (!d) return null;
  const bubbles = d.ownedDays > 0 ? [`${em(flightName(d))} is due about ${esc(d.clock)}.`, [`You’ve caught it on ${plural(d.ownedDays, 'day')}.`, 'dim']] : [`Your regular, ${em(flightName(d))}, usually comes over about ${esc(d.clock)}.`, [`Seen ${d.days} of the last ${d.of} days.`, 'dim']];
  return { kind: 'regular', sub: 'due', key: d.callsign, bubbles, modelKey: d.cardKey, mark: { regNamed: d.callsign } };
}

/* the pool: each kind's bubbles, or null when it isn't true now */
function poolLine(kind, ctx, mem) {
  const h = new Date(ctx.now).getHours();
  switch (kind) {
    case 'upnow': { const u = ctx.hero; if (!u?.fact) return null; return { show: u.hex, bubbles: [`Up now: ${aAn(u.typeName)} ${em(u.typeName)}.`, esc(plainFact(u.fact))] }; }
    case 'going': { const g = ctx.going; if (!g || g.cities < 3) return null; return { bubbles: [`Right now the planes over you are heading to ${g.cities} cities in ${plural(g.countries, 'country').replace('countrys', 'countries')}.`, `The farthest is going to ${em(g.farthest)}.`] }; }
    case 'pace': { const p = ctx.pace; if (!p || (p.days ?? 0) < 3 || !(p.perHour > 0)) return null; return { bubbles: [`About ${Math.max(1, Math.round(p.perHour))} plane${Math.round(p.perHour) === 1 ? '' : 's'} an hour come over you at this time of day.`, `Your busiest hour is around ${esc(p.busiest)}.`] }; }
    case 'records': { if (h < 12) return null; const hi = ctx.tally?.high, far = ctx.tally?.far, turn = mem.recordTurn === 'high' ? 'far' : 'high';
      const lineHi = hi ? `The highest plane over you today was at ${hi.ft.toLocaleString('en-US')} ft: ${aAn(hi.typeName)} ${em(hi.typeName)}${hi.city ? ` to ${esc(hi.city)}` : ''}.` : null;
      const lineFar = far?.city ? `The farthest traveller over you today is going to ${em(far.city)}, ${far.km.toLocaleString('en-US')} km away.` : null;
      const pick = turn === 'high' ? lineHi ?? lineFar : lineFar ?? lineHi; if (!pick) return null;
      return { bubbles: [pick], mark: { recordTurn: pick === lineHi ? 'high' : 'far' } }; }
    case 'yesterday': { const y = ctx.yesterday; if (h >= 12 || !y || !(y.planes > 0)) return null; return { bubbles: [`Yesterday ${y.planes} plane${y.planes === 1 ? '' : 's'} crossed your sky.`].concat(y.far?.city ? [`The farthest was going to ${em(y.far.city)}.`] : []) }; }
    case 'set': { const s = ctx.setNear; if (!s || !(s.left >= 1 && s.left <= 2)) return null; return { bubbles: [`${s.left === 1 ? 'One more card' : 'Two more cards'} and ${em(s.name)} turns ${esc(s.level)}.`] }; }
    case 'theme': { const t = ctx.theme; if (!t?.name || !t.text) return null; return { bubbles: [`It’s ${em(t.name)}: ${esc(t.text.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase()))}.`, `${numWord(t.have ?? 0)} so far.`] }; }
    case 'mission': { if (!ctx.mission) return null; return { bubbles: [`Here’s one to try: ${em(ctx.mission.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase()))}.`] }; }
  }
  return null;
}
function poolCand(ctx, mem) {
  const today = dayKey(ctx.now), keptKind = mem.hist?.[today]?.pool, yKind = mem.hist?.[prevDay(ctx.now)]?.pool;
  if (keptKind) { const l = poolLine(keptKind, ctx, { ...mem, recordTurn: mem.hist[today].recordTurnBefore ?? mem.recordTurn }); if (l) return { kind: 'pool', sub: keptKind, key: keptKind, ...l }; }
  const lines = POOL.map((k) => [k, poolLine(k, ctx, mem)]).filter(([, l]) => l);
  if (!lines.length) return null;
  const [k, l] = lines.find(([k]) => k !== yKind) ?? lines[0];
  return { kind: 'pool', sub: k, key: k, ...l };
}

// ---------- the pick ----------
// ctx: what's true now (see js/main.js skyNoteCtx). mem: the note's memory. -> { pick, welcome, mem } (mem updated; save it).
export function skyNote(ctx, mem0 = {}) {
  const mem = structuredClone(mem0 ?? {}), today = dayKey(ctx.now);
  mem.hist ??= {};
  if (!mem.regsKnown) mem.regsKnown = (ctx.regulars ?? []).map((r) => r.callsign); /* first run: today's regulars aren't news */
  const cands = [caughtCand(ctx.caught, ctx), ctx.rare ?? null, momentCand(ctx, mem), regularCand(ctx, mem), ctx.level ?? null, poolCand(ctx, mem)].filter(Boolean);
  if (!cands.length) return { pick: null, welcome: '', mem };
  const best = cands.sort((a, b) => RANK[a.kind] - RANK[b.kind])[0];
  let pick = best;
  const kept = mem.pick?.day === today ? cands.find((c) => c.kind === mem.pick.kind && c.key === mem.pick.key) : null;
  if (best.kind !== 'caught' && kept && kept !== best && !(KEPT_YIELDS[kept.kind] ?? []).includes(best.kind)) pick = kept;
  /* remember */
  const h = (mem.hist[today] ??= {});
  if (pick.kind !== 'caught') mem.pick = { day: today, kind: pick.kind, key: pick.key, sub: pick.sub ?? '' };
  if (pick.kind === 'pool' && !h.pool) { h.pool = pick.sub; h.recordTurnBefore = mem.recordTurn; }
  if (pick.kind === 'moment' && !h.moment) h.moment = pick;
  for (const [k, v] of Object.entries(pick.mark ?? {})) {
    if (k === 'recordTurn') { if (!h.recordDone) { mem.recordTurn = v; h.recordDone = true; } }
    else if (k === 'regNamed') (mem.regNamed ??= {})[today] = v;
    else if (k === 'over') (mem.over ??= {})[v] ??= ctx.now;
    else { const l = (mem[k] ??= []); if (!l.includes(v)) l.push(v); }
  }
  /* tidy: 14 days of history, the last 200 of each list */
  const keep = new Set(Array.from({ length: 14 }, (_, i) => dayKey(ctx.now - i * DAY)));
  for (const k of Object.keys(mem.hist)) if (!keep.has(k)) delete mem.hist[k];
  for (const k of Object.keys(mem.regNamed ?? {})) if (!keep.has(k)) delete mem.regNamed[k];
  for (const k of Object.keys(mem.over ?? {})) if (!k.endsWith(`@${today}`)) delete mem.over[k];
  for (const k of ['regsKnown', 'rounds', 'firsts']) if (mem[k]?.length > 200) mem[k] = mem[k].slice(-200);
  /* Rule 3: day 2 and day 3 only, once each, kept for half an hour of that day so a redraw doesn't drop it */
  let welcome = '';
  const n = ctx.dayN, w = (mem.welcomed ??= {});
  if ((n === 2 || n === 3) && pick.kind !== 'caught') { if (w[n] == null) w[n] = ctx.now; if (ctx.now - w[n] < 30 * 60e3 && dayKey(w[n]) === today) welcome = `Welcome back. Day ${n}!`; }
  return { pick, welcome, mem };
}
