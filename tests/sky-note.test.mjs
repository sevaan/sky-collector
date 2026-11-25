// Sky's daily note (js/sky-note.js; content/sky-today-note-copy-2026-11-24.md): the pick, the pool's no-repeat rule, the
// moments, the regulars' lines, the welcome, and the plane privacy rule on every line.
import test from 'node:test';
import assert from 'node:assert/strict';
const { skyNote, POOL, dayKey } = await import('../js/sky-note.js');

const at = (d, h = 9, m = 0) => new Date(2026, 10, d, h, m).getTime();
const text = (pick) => pick.bubbles.map((b) => (Array.isArray(b) ? b[0] : b)).join(' ');
const plain = (s) => s.replace(/<[^>]+>/g, '');
/* a full sky: every pool kind true (before noon: no records, yesterday instead) */
const full = (now, over = {}) => ({
  now, dayN: 9, minuteNow: new Date(now).getHours() * 60, cardCount: 40, daysPlayed: 8, logDays: 9,
  hero: { hex: 'abc', typeName: 'Airbus A320', fact: 'The **A320** was the first airliner with digital fly-by-wire.' },
  going: { cities: 5, countries: 3, farthest: 'Istanbul' }, pace: { days: 6, perHour: 11.4, busiest: '6 PM' },
  tally: { high: { ft: 41000, typeName: 'Boeing 787-9', city: 'Tokyo' }, far: { km: 8170, city: 'Istanbul', typeName: 'Boeing 777' } },
  yesterday: { planes: 212, far: { city: 'Zürich' } }, setNear: { name: 'The A320 Family', left: 1, level: 'silver' },
  theme: { name: 'Passport Week', text: 'Catch flights to three countries.', have: 1 }, mission: 'Catch two planes you’ve caught before.', missionsLeft: 2,
  ...over,
});

test('a 14-day run never opens with the same line two days running, and the pick is kept through the day', () => {
  let mem = {}, prev = null;
  for (let d = 1; d <= 14; d++) {
    for (const h of [8, 13, 19]) { /* three opens a day, morning, after noon, evening */
      const out = skyNote(full(at(d, h)), mem); mem = out.mem;
      if (h === 8) { const first = plain(text(out.pick)).split('. ')[0]; assert.notEqual(first, prev, `day ${d} opened like day ${d - 1}: ${first}`); prev = first;
        assert.equal(out.pick.kind, 'pool'); }
      else assert.equal(out.pick.sub, mem.hist[dayKey(at(d))].pool, 'the day keeps its pool kind');
    }
  }
});

test('the pool never repeats yesterday\'s kind unless it is the only one true; mission is the last resort', () => {
  let mem = {}; const only = (now) => ({ now, dayN: 9, minuteNow: 540, mission: 'Catch an Airbus.' });
  for (const d of [1, 2, 3]) { const o = skyNote(only(at(d)), mem); mem = o.mem; assert.equal(o.pick.sub, 'mission'); }
  const o = skyNote(full(at(4)), mem); assert.notEqual(o.pick.sub, 'mission');
  assert.deepEqual(POOL.at(-1), 'mission');
});

test('a regular, a moment and rare take over a kept pool pick; a kept regular gives way only to rare', () => {
  let { mem } = skyNote(full(at(5, 8)), {}); assert.equal(mem.pick.kind, 'pool');
  const reg = { callsign: 'ACA856', airline: 'Air Canada', number: '856', city: 'Ottawa', minute: 1245, clock: '8:45 PM', days: 4, of: 7, next: at(5, 10), cardKey: null, ownedDays: 0, caughtToday: false, seenToday: null };
  mem.regsKnown = ['ACA856'];
  let o = skyNote(full(at(5, 9), { regulars: [reg] }), mem); assert.equal(o.pick.kind, 'regular'); assert.match(plain(text(o.pick)), /Your regular, Air Canada 856 to Ottawa, usually comes over about 8:45 PM/);
  o = skyNote(full(at(5, 9, 5), { regulars: [reg], level: { kind: 'level', key: 'P:A320', bubbles: ['x'] } }), o.mem); assert.equal(o.pick.kind, 'regular', 'level does not take a kept regular');
  o = skyNote(full(at(5, 9, 10), { regulars: [reg], rare: { kind: 'rare', key: 'r1', bubbles: ['Something rare is up'] } }), o.mem); assert.equal(o.pick.kind, 'rare');
});

test('regular lines: new, due (owned or not), over today with both times, never due once caught today, not yesterday\'s again', () => {
  const r = (o) => ({ callsign: 'ACA856', airline: 'Air Canada', number: '856', city: 'Ottawa', minute: 600, clock: '10:00 AM', days: 3, of: 7, next: at(6, 10), ownedDays: 0, caughtToday: false, seenToday: null, ...o });
  let o = skyNote(full(at(6, 9), { regulars: [] }), {}); /* first run: today's regulars are known */
  o = skyNote(full(at(6, 9, 1), { regulars: [r()] }), o.mem);
  assert.match(plain(text(o.pick)), /^You have a regular\. Air Canada 856 to Ottawa has come over about 10:00 AM on three days this week\.$/);
  o = skyNote(full(at(7, 9), { regulars: [r({ next: at(7, 10), ownedDays: 4 })] }), o.mem);
  assert.match(plain(text(o.pick)), /Air Canada 856 to Ottawa is due about 10:00 AM\. You’ve caught it on 4 days\./);
  o = skyNote(full(at(8, 9), { regulars: [r({ next: at(8, 10), caughtToday: true })] }), o.mem); assert.notEqual(o.pick.kind, 'regular');
  o = skyNote(full(at(9, 11), { minuteNow: 660, regulars: [r({ next: at(10, 10), seenToday: 598, seenClock: '9:58 AM' })] }), o.mem);
  assert.equal(plain(text(o.pick)), 'Air Canada 856 came over at 9:58 AM today. It’s usually about 10:00 AM.');
  assert.doesNotMatch(plain(text(o.pick)), /early|late/);
  const two = [r({ callsign: 'ACA856', next: at(10, 10) }), r({ callsign: 'WJA12', airline: 'WestJet', number: '12', next: at(10, 11) })];
  let m = skyNote(full(at(10, 9), { regulars: two }), { ...o.mem, regsKnown: ['ACA856', 'WJA12'] }); assert.match(plain(text(m.pick)), /Air Canada 856/);
  m = skyNote(full(at(11, 9), { regulars: two.map((x) => ({ ...x, next: x.next + 86400e3 })) }), m.mem); assert.match(plain(text(m.pick)), /WestJet 12/, 'not yesterday\'s regular when another is due');
});

test('each moment\'s trigger, at most one a day and none two days running', () => {
  const base = (d, over) => full(at(d, 9), over);
  let o = skyNote(base(20, { firstCatch: { at: new Date(2025, 10, 20, 18).getTime(), cardName: 'To Ottawa', modelKey: 'F:ACA:CYYZ-CYOW' } }), {});
  assert.equal(o.pick.sub, 'anniversary'); assert.match(plain(text(o.pick)), /^A year ago today you caught your first card: To Ottawa\. You have 40 now\.$/);
  o = skyNote(base(21, { roundDays: [{ key: 'F:ACA:CYYZ-CYOW', days: 25, flight: { airline: 'Air Canada', number: '856' } }] }), o.mem);
  assert.notEqual(o.pick.kind, 'moment', 'none two days running');
  o = skyNote(base(22, { roundDays: [{ key: 'F:ACA:CYYZ-CYOW', days: 25, flight: { airline: 'Air Canada', number: '856' } }] }), o.mem);
  assert.equal(plain(text(o.pick)), 'That’s 25 days you’ve caught Air Canada 856.');
  o = skyNote(base(24, { firstsYesterday: [{ key: 'P:B748', typeName: 'Boeing 747-8' }] }), o.mem); assert.equal(plain(text(o.pick)), 'Yesterday you caught your first Boeing 747-8.');
  o = skyNote(base(26, { firstsYesterday: [{ key: 'P:B748', typeName: 'Boeing 747-8' }] }), o.mem); assert.notEqual(o.pick.kind, 'moment', 'once per card');
  o = skyNote(base(28, { stranger: { hex: 'h1', typeName: 'Airbus A380' } }), o.mem); assert.equal(plain(text(o.pick)), 'An Airbus A380 is over you. Your sky hasn’t had one all week.'); assert.equal(o.pick.show, 'h1');
  o = skyNote(base(30, { stranger: { hex: 'h1', typeName: 'Airbus A380' }, logDays: 4 }), o.mem); assert.notEqual(o.pick.sub, 'stranger', 'needs 5 days of log');
  o = skyNote(full(at(2, 15) + 30 * 86400e3, { bestFar: { km: 7000 } }), o.mem); assert.equal(o.pick.sub, 'record');
  assert.match(plain(text(o.pick)), /^The farthest traveller your sky has shown you: a Boeing 777 to Istanbul, 8,170 km\.$/);
  const again = skyNote(full(at(2, 18) + 30 * 86400e3, { bestFar: { km: 7000 } }), o.mem); assert.equal(again.pick.sub, 'record', 'kept for the day');
});

test('caught: a new card with its next fact, a card number, a flight again, a type again; missions left', () => {
  const now = at(12, 15), c = (o) => full(now, { caught: { at: now - 3600e3, ...o } });
  assert.equal(plain(text(skyNote(c({ newCard: true, typeName: 'Airbus A220-300', fact: 'Its **windows** are big.' }), {}).pick)), 'An Airbus A220-300. Its windows are big. 2 missions left today.');
  assert.equal(plain(text(skyNote(c({ newCard: true, cardName: 'To Halifax', cardCount: 41 }), {}).pick)), 'Got it. To Halifax is card 41. 2 missions left today.');
  assert.match(plain(text(skyNote(c({ flight: { airline: 'Air Canada', number: '856' }, flightDays: 3 }), {}).pick)), /^Air Canada 856 again\. That’s 3 days\./);
  assert.match(plain(text(skyNote(full(now, { missionsLeft: 0, caught: { at: now - 60e3, typeName: 'Boeing 737-8', typeCount: 4 } }), {}).pick)), /^Another Boeing 737-8\. That’s 4 different ones\. All three of today’s missions are done\.$/);
  assert.notEqual(skyNote(full(now, { caught: { at: now - 5 * 3600e3, newCard: true, cardName: 'x', cardCount: 2 } }), {}).pick.kind, 'caught', 'four hours only');
});

test('welcome back on day 2 and day 3 only, once each', () => {
  let o = skyNote(full(at(2, 9), { dayN: 2 }), {}); assert.equal(o.welcome, 'Welcome back. Day 2!');
  o = skyNote(full(at(2, 18), { dayN: 2 }), o.mem); assert.equal(o.welcome, '', 'not on a later open that day');
  o = skyNote(full(at(3, 9), { dayN: 3 }), o.mem); assert.equal(o.welcome, 'Welcome back. Day 3!');
  o = skyNote(full(at(4, 9), { dayN: 4 }), o.mem); assert.equal(o.welcome, '');
  o = skyNote(full(at(5, 9), { dayN: 2 }), o.mem); assert.equal(o.welcome, '', 'never the same number twice');
});

test('privacy: no pool line or moment carries a callsign, a registration or a private aircraft\'s place', () => {
  /* the record holder is an anonymous aircraft: its kind, no city */
  const anon = { now: at(15, 14), dayN: 9, minuteNow: 840, tally: { high: { ft: 45000, typeName: 'Gulfstream G650', city: '' }, far: null } };
  const o = skyNote(anon, { recordTurn: 'far' }); assert.equal(plain(text(o.pick)), 'The highest plane over you today was at 45,000 ft: a Gulfstream G650.');
  /* every pool kind, every moment: nothing that looks like a callsign (AAA123) or a registration (C-GJZK, N123AB) */
  const ctx = full(at(16, 14), { firstCatch: { at: at(16, 9) - 365 * 86400e3, cardName: 'Boeing 737-8' }, stranger: { hex: 'h', typeName: 'Embraer E195-E2' } });
  for (const k of POOL) { const mem = { hist: { [dayKey(at(15))]: {} } }; const lines = []; let m = mem;
    for (let d = 0; d < POOL.length; d++) { const r = skyNote({ ...ctx, now: at(16 + d, 14) }, m); m = r.mem; lines.push(plain(text(r.pick))); }
    for (const l of lines) { assert.doesNotMatch(l, /\b[A-Z]{3}\d{1,4}[A-Z]?\b/, l); assert.doesNotMatch(l, /\b[A-Z]-[A-Z]{4}\b|\bN\d{1,5}[A-Z]{0,2}\b/, l); } }
});
