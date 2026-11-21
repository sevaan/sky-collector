// One-off (2026-11-20, Space Collector's script, 5f591d4b / 1c595988, pointed at Sky's own project): give every usage row
// stored in sky_events the expiry new rows get, so "each note is deleted after 90 days" is true for every note.
// exp = when the server received it (rt), else when it happened (ts), plus 90 days (EVENT_DAYS in server/index.js;
// Sevaan, 2026-11-20, first one year, changed the same day). Sky: rows the live server already stamped with the old
// 365-day expiry are rewritten too, so every row matches; rows already right are left alone. Rows already older than
// 90 days are deleted by the TTL within a day or so of switching it on. Reads every row once.
//   (once: cd server && npm install)
//   node scripts/usage-expiry-backfill.mjs            dry run: counts only
//   node scripts/usage-expiry-backfill.mjs --write    writes exp (needs Sevaan's yes; personal gcloud login)
// Then switch the deletion on (needs Sevaan's yes):
//   gcloud firestore fields ttls update exp --collection-group=sky_events --enable-ttl --project=sky-collector-app
import { Firestore, Timestamp } from '../server/node_modules/@google-cloud/firestore/build/src/index.js';
const WRITE = process.argv.includes('--write'), DAY = 86400e3, KEEP = 90 * DAY;
const db = new Firestore({ projectId: 'sky-collector-app' });
const snap = await db.collection('sky_events').select('ts', 'rt', 'exp').get();
const got = (d) => Number(d.get('rt') ?? d.get('ts')) || Date.now();
const want = (d) => got(d) + KEEP, has = (d) => d.get('exp')?.toMillis?.() ?? null;
const todo = snap.docs.filter((d) => has(d) !== want(d));
const none = todo.filter((d) => has(d) == null).length, year = todo.filter((d) => has(d) != null && Math.abs(has(d) - got(d) - 365 * DAY) < DAY).length;
const day = (t) => new Date(t).toLocaleString('en-CA', { timeZone: 'America/Toronto' });
const oldest = Math.min(...snap.docs.map(got));
console.log(`${snap.size} rows (oldest received ${day(oldest)}); ${todo.length} to set: ${none} without an expiry, ${year} with the old 365-day one, ${todo.length - none - year} other`);
console.log(`the oldest would go on ${day(oldest + KEEP)} (Toronto)`);
if (WRITE) {
  for (let i = 0; i < todo.length; i += 400) {
    const b = db.batch();
    for (const d of todo.slice(i, i + 400)) b.update(d.ref, { exp: Timestamp.fromMillis(want(d)) });
    await b.commit(); process.stdout.write(`\r${Math.min(i + 400, todo.length)} / ${todo.length}`);
  }
  console.log('\ndone');
}
