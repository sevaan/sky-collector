// Who is never named (2026-11-19, split out of js/planes.js so js/pack-flight.js, which can't load the whole tracker,
// uses the same rule): government and military aircraft, by the feed's military flag, by operator, or by a military
// type whatever callsign it flies under (QA 2026-11-19). js/planes.js isAnonymous builds on this.
export const GOV_OPS = new Set('AAC ACW AFP AIO AME ASF ASY AYB BAF BFW BRS CEF CFC CGX CIE CNV CTG CTM CWP DAF DAR DCN DEF DNY DOD EEF EGY EVY EXB FAC FAF FAG FNF FNY FPR GAF GAM GDB GKA GNY GRY GRZ HAF HKG HNA HRZ HUF HVK IAF IAM ICG IFC INP JMM KIW KRC LAF LEG LMG LSV LYF MBR MED MJN MNV NAF NDF NGR NOW NRN NVY NYB PAT PLC PLF PNY POA POF POL PON PRD QUE RCH RFF RFR RGP RIF RJZ RMF ROF ROP RRF RRR RSF SAF SAM SGF SGS SHF SIV SLG SQF SSG SUI SVF TRI TRP UAF UFA UKP WDG'.split(' '));
export const MIL_TYPES = /^(C17|C130|C30J|C5M|A400|K35[ER]|KC10|KC46|E3[TC]F|E6|B52|B1|B2|P8|C2|C295|V22|U2|F16|F18|F15|F22|F35|EUFI|A10|H47|H53|H60|AN12|IL76|T38|T6|TEX2|HAWK|TOR|RFAL|GRIF|MRF1|C160|CN35|E2|R135|C40|C32|C37[AB]|VC25)$/;
export const opOf = (a) => String(a?.flight ?? a?.callsign ?? '').trim().toUpperCase().slice(0, 3);
export const isGovOrMil = (a) => (Number(a?.dbFlags) & 1) !== 0 || GOV_OPS.has(opOf(a)) || MIL_TYPES.test(String(a?.t ?? a?.type ?? '').toUpperCase());
