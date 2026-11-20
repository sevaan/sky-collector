// One-off (2026-11-20, Space Collector's script, 5f591d4b, pointed at Sky's own project): give every usage row already
// stored in sky_events an expiry, so "each note is deleted after one year" is true for notes sent before the server
// started stamping new ones (512d5372). exp = when the server received it (rt), else when it happened (ts), plus 365 days
// (EVENT_DAYS in server/index.js). Rows that already have exp are left alone. Reads every row once.
//   (once: cd server && npm install)
//   node scripts/usage-expiry-backfill.mjs            dry run: counts only
//   node scripts/usage-expiry-backfill.mjs --write    writes exp (needs Sevaan's yes; personal gcloud login)
// Then switch the deletion on (needs Sevaan's yes):
//   gcloud firestore fields ttls update exp --collection-group=sky_events --enable-ttl --project=sky-collector-app
import { Firestore, Timestamp } from '../server/node_modules/@google-cloud/firestore/build/src/index.js';
const WRITE = process.argv.includes('--write'), YEAR = 365 * 86400e3;
const db = new Firestore({ projectId: 'sky-collector-app' });
const snap = await db.collection('sky_events').select('ts', 'rt', 'exp').get();
const when = (d) => Number(d.get('rt') ?? d.get('ts')) || Infinity;
const todo = snap.docs.filter((d) => !d.get('exp'));
const day = (t) => (Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '–');
const oldestAll = Math.min(...snap.docs.map(when)), oldest = Math.min(...todo.map(when));
console.log(`${snap.size} rows (oldest received ${day(oldestAll)}), ${todo.length} without an expiry; the oldest of those would go on ${day(oldest + YEAR)}`);
if (WRITE) {
  for (let i = 0; i < todo.length; i += 400) {
    const b = db.batch();
    for (const d of todo.slice(i, i + 400)) b.update(d.ref, { exp: Timestamp.fromMillis((Number(d.get('rt') ?? d.get('ts')) || Date.now()) + YEAR) });
    await b.commit(); process.stdout.write(`\r${Math.min(i + 400, todo.length)} / ${todo.length}`);
  }
  console.log('\ndone');
}
