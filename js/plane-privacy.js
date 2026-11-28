// Who is never named (2026-11-19, split out of js/planes.js so js/pack-flight.js, which can't load the whole tracker,
// uses the same rule): government and military aircraft, by the feed's military flag, by operator, or by a military
// type whatever callsign it flies under (QA 2026-11-19). js/planes.js isAnonymous builds on this.
export const GOV_OPS = new Set('AAC ACW AFP AIO AME ASF ASY AYB BAF BFW BRS CEF CFC CGX CIE CNV CTG CTM CWP DAF DAR DCN DEF DNY DOD EEF EGY EVY EXB FAC FAF FAG FNF FNY FPR GAF GAM GDB GKA GNY GRY GRZ HAF HKG HNA HRZ HUF HVK IAF IAM ICG IFC INP JMM KIW KRC LAF LEG LMG LSV LYF MBR MED MJN MNV NAF NDF NGR NOW NRN NVY NYB PAT PLC PLF PNY POA POF POL PON PRD QUE RCH RFF RFR RGP RIF RJZ RMF ROF ROP RRF RRR RSF SAF SAM SGF SGS SHF SIV SLG SQF SSG SUI SVF TRI TRP UAF UFA UKP WDG'.split(' '));
export const MIL_TYPES = /^(C17|C130|C30J|C5M|A400|K35[ER]|KC10|KC46|E3[TC]F|E6|B52|B1|B2|P8|C2|C295|V22|U2|F16|F18|F18H|F18S|F15|F22|F35|EUFI|A10|H47|H53|H53S|H60|AN12|IL76|T38|T6|TEX2|HAWK|TOR|RFAL|GRIF|SB39|MRF1|C160|CN35|E2|R135|C40|C32|C37[AB]|VC25|Q9|Q4|C5|SR71)$/; /* Q9 Q4 C5 SR71: 2026-11-27, named now */
export const opOf = (a) => String(a?.flight ?? a?.callsign ?? '').trim().toUpperCase().slice(0, 3);
export const isGovOrMil = (a) => (Number(a?.dbFlags) & 1) !== 0 || GOV_OPS.has(opOf(a)) || MIL_TYPES.test(String(a?.t ?? a?.type ?? '').toUpperCase());

/* Callsigns that look like an airline's (three letters and a number) */
export const AIRLINE_CS = /^[A-Z]{3}\d/;
/* fractional / charter business-jet operators: anonymous like any private plane (js/planes.js) */
export const BIZ_OPS = new Set(['EJA', 'NJE', 'EJM', 'LXJ', 'XOJ', 'JRE', 'ASP', 'VJT', 'WUP', 'JTL', 'TWY', 'DCM', 'FFL']);
/* business-jet types are anonymous whatever callsign they file under (bug pass 2026-11-25: Wheels Up and owners' own
   three-letter callsigns kept their callsign, registration and route); the same codes as js/sky-sets.js Business Jets */
export const BIZ_TYPES = /^(C25[0-9ABCM]|C5[0-9]{2}|C56X|C68[0A]|C700|C750|CL3[05]|CL60|GL[567E][TX]|GLF[2-6]|GA[5-8]C|G[12]50|G280|E5[05]P|E545|E550|F2TH|F900|FA[5-8]X|FA[0-9]{2}|LJ[2-7][0-9]|H25[A-C]|HDJT|PC24|PRM1|BE40|ASTR|GALX|HA4T|E35L|SF50|EA50)/;
/* A hidden aircraft's id: a salted hash of its hex, kept on this phone, so the same aircraft still counts once */
let anonSalt = null;
export function anonId(hex) {
  if (anonSalt == null) { try { anonSalt = localStorage.getItem('anonSalt'); if (!anonSalt) { anonSalt = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('anonSalt', anonSalt); } } catch { anonSalt = 'x'; } }
  let h1 = 0x811c9dc5, h2 = 0x01000193; const s = anonSalt + '|' + String(hex ?? '').toLowerCase();
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
  return `~${h1.toString(36)}${h2.toString(36)}`; /* "~" marks it: never a real ICAO hex */
}

// ---- Saved and sent catches (2026-11-19, QA: catches saved before the privacy rules, and packs from older apps, could
// still carry a private, business, military or government aircraft's callsign, registration, real hex or operator) ----
const flightOp = (key) => (/^F:([A-Z0-9]{2,4}):/.exec(String(key ?? '')) || [])[1] || '';
/* Was this saved catch one that must not be named? From what it kept: the callsign, the type, a flight card's operator. */
export function privateCatch(s) {
  if (!s) return false;
  const cs = String(s.callsign ?? s.cardSnapshot?.callsign ?? '').trim().toUpperCase(), type = String(s.typeCode ?? s.cardSnapshot?.type ?? '').toUpperCase();
  const op = flightOp(s.cardKey) || cs.slice(0, 3);
  if (isGovOrMil({ flight: cs, t: type }) || GOV_OPS.has(op) || BIZ_OPS.has(op) || BIZ_TYPES.test(type)) return true;
  if (/^F:/.test(String(s.cardKey ?? ''))) return !!cs && !AIRLINE_CS.test(cs); /* a flight card is an airline's by nature; one kept with another callsign isn't */
  return !!cs && !AIRLINE_CS.test(cs); /* a plane catch with a non-airline callsign (a registration, N123AB) */
}
const hidHex = (h) => (!h || String(h).startsWith('~') ? h : anonId(h));
/* A private catch made safe: its flight card goes (the card itself names the operator), a plane catch keeps only the
   type: no callsign, registration or operator, and the aircraft's id hashed. Returns null to drop, else the sighting
   (a new object when anything changed). */
export function scrubSighting(s) {
  if (!privateCatch(s)) return s;
  if (/^F:/.test(String(s.cardKey ?? '')) || s.type === 'flight') return null;
  const hid = (h) => !h || String(h).startsWith('~'), snap = s.cardSnapshot;
  if (!s.callsign && !s.reg && !('op' in s) && s.cls !== 'airline' && s.cls !== 'cargo' && hid(s.hex) && (!/^HEX:/.test(String(s.stampKey ?? '')) || hid(s.stampKey.slice(4))) && !s.flight && (!snap || typeof snap !== 'object' || (!snap.reg && !snap.callsign && !snap.stamp))) return s; /* already safe: a business-jet type stays private after its scrub, so a second pass must change nothing */
  const t = { ...s, callsign: '', reg: '' }; delete t.op; if (t.cls === 'airline' || t.cls === 'cargo') delete t.cls;
  if (t.hex) t.hex = hidHex(t.hex);
  if (/^HEX:/.test(String(t.stampKey ?? ''))) t.stampKey = `HEX:${hidHex(t.stampKey.slice(4))}`;
  if (t.cardSnapshot && typeof t.cardSnapshot === 'object') { const c = { ...t.cardSnapshot }; delete c.reg; delete c.callsign; if (c.stamp) c.stamp = ''; t.cardSnapshot = c; }
  if (t.flight) t.flight = null;
  return t;
}
/* A whole list: [kept, changed (count), dropped (keys)] */
export function scrubSightings(list) {
  const out = [], dropped = []; let changed = 0;
  for (const s of list ?? []) { const t = scrubSighting(s); if (t === null) { dropped.push(s.key); continue; } if (t !== s) changed++; out.push(t); }
  return { list: out, changed, dropped };
}
