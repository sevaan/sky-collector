// The boarding pass × spec sheet cards (2026-11-19, design/card-spike/combo-pass-spec.html): each catch's class (js/planes.js
// catchClass, worked out in parse), the verified type specs (js/type-specs.js), the catch facts carried on the sighting and
// the faces the cards print.
import test from 'node:test';
import assert from 'node:assert/strict';
const store = { units: 'metric' }; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };

const { parsePlanes, catchClass, CLASS_WORDS } = await import('../js/planes.js');
const { cardsFor } = await import('../js/flights.js');
const { catchSightings, skyStampInfo, skyModel } = await import('../js/sky-cards.js');
const { typeSpecs, makerLine, TYPE_SPECS } = await import('../js/type-specs.js');
const { flightCardHtml, planeCardHtml, miniCardHtml, compass } = await import('../js/flight-card.js');

const T0 = Date.UTC(2026, 10, 19, 20, 18);
const rec = (o) => ({ lat: 45, lon: -75, alt_baro: o.alt ?? 30000, alt_geom: o.alt ?? 30000, gs: o.gs ?? 400, track: o.track ?? 90, category: o.cat ?? '', hex: o.hex ?? 'abc123', flight: o.cs ?? '', r: o.r ?? '', t: o.t ?? '', dbFlags: o.db ?? 0 });
const one = (o) => parsePlanes({ now: T0 / 1000, ac: [rec(o)] })[0];

test('each catch is classed from what the feed says, first match wins', () => {
  assert.equal(one({ cs: 'UPS2311', t: 'B763', cat: 'A5' }).cls, 'cargo');
  assert.equal(one({ cs: 'WJA651', t: 'B38M', cat: 'A3' }).cls, 'airline');
  assert.equal(one({ cs: 'N12345', t: 'C172', cat: 'A1', alt: 2400, gs: 97 }).cls, 'light');
  assert.equal(one({ cs: 'N650GX', t: 'GLF6', cat: 'A2' }).cls, 'biz');
  assert.equal(one({ cs: 'EJA512', t: 'C68A', cat: 'A2' }).cls, 'biz'); /* NetJets: anonymous, a business jet, no operator */
  assert.equal(one({ cs: 'CGABC', t: 'AS50', cat: 'A7', gs: 110 }).cls, 'heli');
  assert.equal(one({ cs: 'N208XX', t: 'C208', cat: 'A1' }).cls, 'light'); /* category A1 says light */
  assert.equal(one({ cs: 'N208XX', t: 'C208', cat: 'A2' }).cls, 'turboprop');
  assert.equal(one({ cs: 'N145XX', t: 'E145', cat: 'A3' }).cls, 'airliner');
  assert.equal(one({ cs: 'N1', t: 'BALL', cat: 'B2', gs: 10 }).cls, 'balloon');
  assert.equal(one({ cs: 'DGLID', t: 'GLID', cat: 'B1', gs: 50, alt: 4000 }).cls, 'glider');
  assert.equal(one({ cs: 'N999', t: '', cat: 'A2' }).cls, 'small');
  /* gov / military: what it is, never whose (Sevaan 2026-11-19) */
  assert.equal(one({ cs: 'RCH123', t: 'C17', cat: 'A5' }).cls, 'mil');
  assert.equal(one({ cs: 'N1', t: 'B738', cat: 'A3', db: 1 }).cls, 'mil');
  assert.equal(one({ cs: 'UKP12', t: 'EC35', cat: 'A7' }).cls, 'gov');
  assert.equal(one({ cs: 'RCH123', t: 'C17', cat: 'A5' }).type, 'C17');
  assert.equal(one({ cs: 'RCH123', t: 'C17', cat: 'A5' }).clsOp, undefined);
  /* the same type caught two ways: the class is the catch's, not the type's */
  assert.notEqual(one({ cs: 'UPS1', t: 'B763' }).cls, one({ cs: 'N767AA', t: 'B763', cat: 'A5' }).cls);
  /* privacy: a plane-only private catch keeps no callsign or registration, only the class word */
  const p = one({ cs: 'N12345', r: 'N12345', t: 'C172', cat: 'A1', gs: 97 });
  assert.equal(p.callsign, ''); assert.equal(p.reg, ''); assert.equal(p.clsOp, undefined);
  assert.equal(one({ cs: 'UPS2311', t: 'B763' }).clsOp, 'UPS');
  for (const k of ['cargo', 'airline', 'biz', 'light', 'turboprop', 'heli', 'glider', 'balloon', 'airliner', 'mil', 'gov']) assert.ok(CLASS_WORDS[k]);
  assert.equal(catchClass({ callsign: 'N1', type: 'PC12', category: 'A2' }), 'turboprop');
});

test('type specs: verified entries only, aliases, nothing for unknown types', () => {
  assert.equal(typeSpecs('e75l').cells[0][1], '2003');
  assert.equal(typeSpecs('E75S'), typeSpecs('E75L'));
  assert.equal(typeSpecs('AT76'), typeSpecs('AT72'));
  assert.equal(typeSpecs('ZZZZ'), null); assert.equal(typeSpecs(''), null);
  assert.equal(makerLine(typeSpecs('E75L')), 'Embraer · Brazil · twin-jet regional airliner');
  assert.equal(makerLine(typeSpecs('A320')), 'Airbus · narrow-body jet airliner'); /* "Multi-national": no country printed */
  for (const [code, s] of Object.entries(TYPE_SPECS)) {
    assert.ok(s.maker && s.desc, code); assert.ok(s.cells.length >= 2 && s.cells.length <= 4, code);
    for (const c of s.cells) assert.ok(c[0] && c[1], `${code} ${c}`);
  }
});

test('a catch carries its class, heading and route flag on the plane sighting, never on the card snapshot', () => {
  const p = one({ cs: 'UPS2311', r: 'N312UP', t: 'B763', cat: 'A5', track: 225 });
  const { flight, plane } = cardsFor(p, null, 'UPS');
  assert.equal(flight, null);
  const ss = catchSightings({ time: T0, hex: p.hex, callsign: p.callsign, reg: p.reg, type: p.type, altFt: 28400, gsKt: 410, rangeKm: 15, flight, plane });
  assert.equal(ss.length, 1); const s = ss[0];
  assert.equal(s.cls, 'cargo'); assert.equal(s.op, 'UPS'); assert.equal(s.track, 225); assert.equal(s.routed, false);
  assert.equal(s.cardSnapshot.caught, undefined); assert.equal(JSON.stringify(s.cardSnapshot).includes('caught'), false);
  assert.equal(skyModel(plane, 'plane').caught, undefined);
  const info = skyStampInfo(s.cardSnapshot, ss);
  assert.equal(info.last.cls, 'cargo'); assert.equal(info.last.track, 225);
  const html = planeCardHtml(s.cardSnapshot, { stampInfo: info, callsign: s.callsign });
  assert.match(html, /Cargo airline <small>· UPS · route not known<\/small>/);
  assert.match(html, /TYPE<\/span><b>B763/); assert.match(html, /HEADING<\/span><b>SW/);
  assert.match(html, /47\.6<small>m/);
  assert.doesNotMatch(html, /N312UP/); /* no route: the band, not the operator line */
});

test('plane-only private catch: NOT AN AIRLINE band, type only', () => {
  const p = one({ cs: 'N12345', r: 'N12345', t: 'C172', cat: 'A1', gs: 97, alt: 2400, track: 270 });
  const { plane } = cardsFor(p, null, '');
  const ss = catchSightings({ time: T0, hex: p.hex, callsign: p.callsign, reg: p.reg, type: p.type, altFt: 2400, gsKt: 97, rangeKm: 3, flight: null, plane });
  const html = planeCardHtml(ss[0].cardSnapshot, { stampInfo: skyStampInfo(ss[0].cardSnapshot, ss) });
  assert.match(html, /Not an airline <small>· Light aircraft<\/small>/);
  assert.doesNotMatch(html, /N12345/); assert.doesNotMatch(html, /rivate/);
  assert.match(html, /Cessna · USA · four-seat light aircraft/);
});

test('airline catch with a route: a boarding pass and an operator line on the plane card', () => {
  const p = one({ cs: 'RPA3402', r: 'N201JQ', t: 'E75L', cat: 'A3', track: 45 });
  const ORD = { icao: 'KORD', iata: 'ORD', city: 'Chicago', cc: 'US', lat: 41.9786, lon: -87.9048 }, YOW = { icao: 'CYOW', iata: 'YOW', city: 'Ottawa', cc: 'CA', lat: 45.3225, lon: -75.6692 };
  const { flight, plane } = cardsFor(p, { from: ORD, to: YOW, callsign: 'RPA3402' }, 'Republic');
  const ss = catchSightings({ time: T0, hex: p.hex, callsign: p.callsign, reg: p.reg, type: p.type, altFt: 32100, gsKt: 446, rangeKm: 9, airline: 'Republic', flight, plane });
  const f = ss.find((x) => x.type === 'flight'), pl = ss.find((x) => x.type === 'plane');
  const fh = flightCardHtml(f.cardSnapshot, { caughtAt: new Date(T0), heightFt: 32100, sightings: 1, stampInfo: skyStampInfo({ ...f.cardSnapshot, sky: 'flight' }, ss) });
  assert.match(fh, /BOARDING PASS<b>RPA3402/); assert.match(fh, /<b>ORD<\/b>/); assert.match(fh, /<b>YOW<\/b>/); assert.match(fh, /E75L/);
  assert.match(fh, /1,051<small>km/);
  const ph = planeCardHtml(pl.cardSnapshot, { stampInfo: skyStampInfo(pl.cardSnapshot, ss) });
  assert.match(ph, /<b>AIRLINE<\/b><span>Republic · N201JQ<\/span>/);
  assert.doesNotMatch(ph, /ss-band/);
  /* minis */
  assert.match(flightCardHtml(f.cardSnapshot, { small: true, caughtAt: new Date(T0) }), /fc--mini/);
  assert.match(miniCardHtml({ kind: 'plane', card: pl.cardSnapshot, last: T0 }), /m-plate/);
});

test('a type with no verified specs shows only what the feed and the catches say', () => {
  const p = one({ cs: 'N145XX', t: 'E145', cat: 'A3' });
  const { plane } = cardsFor(p, null, '');
  const ss = catchSightings({ time: T0, hex: p.hex, callsign: p.callsign, type: p.type, altFt: 23000, gsKt: 380, rangeKm: 20, flight: null, plane });
  const html = planeCardHtml(ss[0].cardSnapshot, { stampInfo: skyStampInfo(ss[0].cardSnapshot, ss) });
  assert.match(html, /Size<\/span><b>Large/); assert.match(html, /Aircraft<\/span><b>1/);
  assert.doesNotMatch(html, /First flew/);
  assert.equal(compass(359), 'N'); assert.equal(compass(225), 'SW'); assert.equal(compass(undefined), '—');
});
