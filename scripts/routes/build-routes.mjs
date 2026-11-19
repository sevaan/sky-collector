// Bundles Virtual Radar Server standing data (CC0) for js/routes.js: data/routes/r/<AAA>.json per airline prefix
// ({ "<number part of callsign>": "ICAO-ICAO[-ICAO]" }) and data/routes/airports.json (only airports that routes use,
// keyed by ICAO: [IATA, name, city, country, lat, lon]). Usage: node scripts/routes/build-routes.mjs [dir-of-standing-data-clone]
// With no argument it shallow-clones github.com/vradarserver/standing-data into a temp dir. See docs/DATA-ROUTES.md.
import { readFileSync, writeFileSync, mkdirSync, readdirSync as rds, rmSync, mkdtempSync } from 'node:fs';
const readdirSync = (p) => rds(p, { withFileTypes: true }).filter((e) => e.isDirectory() || /\.csv$/.test(e.name)).map((e) => e.name);
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../js/routes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..'), out = join(root, 'data', 'routes');
let src = process.argv[2];
if (!src) { src = mkdtempSync(join(tmpdir(), 'vrs-')); execFileSync('git', ['clone', '-q', '--depth', '1', 'https://github.com/vradarserver/standing-data.git', src], { stdio: 'inherit' }); }
const table = (p) => { const t = parseCsv(readFileSync(p, 'utf8').replace(/^﻿/, '')), h = t.shift(); return t.map((v) => Object.fromEntries(h.map((k, i) => [k, v[i]]))); };

rmSync(out, { recursive: true, force: true }); mkdirSync(join(out, 'r'), { recursive: true });
const used = new Set(), prefixes = []; let routes = 0;
const rd = join(src, 'routes', 'schema-01');
// An airline's routes are one file (AAA-all.csv) or, for big airlines, numbered parts (RYR-1.csv, RYR-2.csv …: Ryanair,
// easyJet, Air France, Turkish, Wizz and others; QA 2026-11-19 found none of them had routes). Parts are merged per prefix.
for (const d of readdirSync(rd)) {
  const files = new Map();
  for (const f of readdirSync(join(rd, d))) { const m = /^([A-Z0-9]{3})-(all|\d+)\.csv$/.exec(f); if (m) files.set(m[1], [...(files.get(m[1]) ?? []), f]); }
  for (const [pre, list] of files) {
    const o = {};
    for (const f of list.sort()) for (const r of table(join(rd, d, f))) {
      const codes = (r.AirportCodes || '').split('-').filter(Boolean);
      if (codes.length < 2 || !r.Callsign.startsWith(pre)) continue;
      if (!(r.Callsign.slice(3) in o)) routes++;
      o[r.Callsign.slice(3)] = codes.join('-'); codes.forEach((c) => used.add(c));
    }
    if (Object.keys(o).length) { writeFileSync(join(out, 'r', pre + '.json'), JSON.stringify(o)); prefixes.push(pre); }
  }
}
prefixes.sort();
const ap = {}, ad = join(src, 'airports', 'schema-01');
for (const d of readdirSync(ad)) for (const f of readdirSync(join(ad, d))) for (const a of table(join(ad, d, f))) {
  if (!used.has(a.ICAO)) continue;
  ap[a.ICAO] = [a.IATA || '', a.Name || '', a.Location || '', a.CountryISO2 || '', a.Latitude ? +(+a.Latitude).toFixed(4) : null, a.Longitude ? +(+a.Longitude).toFixed(4) : null];
}
writeFileSync(join(out, 'airports.json'), JSON.stringify(ap));
writeFileSync(join(out, 'index.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), routes, airports: Object.keys(ap).length, prefixes }));
console.log(routes + ' routes, ' + prefixes.length + ' airline shards, ' + Object.keys(ap).length + ' airports (' + used.size + ' referenced)');
