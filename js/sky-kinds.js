// What a plane IS, for Sky's missions, milestones and week themes (2026-11-20, design/missions-draft.md, Sevaan: "Build
// it with the 7 cuts"): the year its model first flew, how many engines it has, who made it, and which continent a flight
// is heading to. Every answer is either known for sure or null: a type with no answer never counts (no guessing). No DOM.
import { typeSpecs } from './type-specs.js?v=0.1.1922';
import { continentOf } from './sky-secrets.js?v=0.1.1922';
import { QUAD } from './sky-patches.js?v=0.1.1922';

const up = (t) => String(t ?? '').trim().toUpperCase();
const cell = (s, label) => s?.cells?.find((c) => c[0] === label) ?? null;

// The year this exact model first flew, as printed on its card (js/type-specs.js, each read on Wikipedia), or null.
export function firstFlew(type) {
  const c = cell(typeSpecs(type), 'First flew'); const y = c ? Number(c[1]) : NaN;
  return Number.isFinite(y) && y > 1900 ? y : null;
}
// "First flew in the last 10 years" rolls each January: from (this year - 10).
export const isNewType = (type, now = Date.now()) => { const y = firstFlew(type); return y != null && y >= new Date(now).getFullYear() - 10; };
export const isOldType = (type, before = 1980) => { const y = firstFlew(type); return y != null && y < before; };

// Engines: the card's own count when it has one, else whole-type lists that are certain (three-engined jets; four-engined
// from Sky's Four Engines patch; single-engine light planes and turboprops). Anything else: null (not counted).
const TRI = /^(MD11|DC10|B72[12]|R72[12]|L101|FA50|F900|FA7X|FA8X|YK40|YK42|T154)$/;
const SINGLE = /^(C15[02]|C17[0-7]|C172|C177|C182|C206|C207|C210|C208|P28[A-U]|PA18|PA22|PA24|PA28|PA32|P32R|PA46|P46T|SR20|SR22|S22T|DA40|DV20|M20[A-Z]|BE33|BE35|BE36|PC6T|PC12|TBM7|TBM8|TBM9|KODI|SF50|R22|R44|R66|AS50|B06|B407|EC20|EC30|H125|H130|A119|J3|AA5)$/;
const TWIN = /^(A318|A319|A320|A321|A19N|A20N|A21N|A30[06B]|A310|A33[0-9]|A35[9K]|BCS[13]|B73[0-9]|B3[789X]M|B37M|B75[23]|B76[234]|B77[23LW]|B778|B779|B78[89X]|E170|E75[LS]|E190|E195|E29[05]|E135|E145|CRJ[1279X]|AT4[3-6]|AT7[2-6]|DH8[A-D]|DHC6|SF34|SB20|B190|BE20|B350|C25[A-CM]|C510|C525|C550|C560|C56X|C680|C68A|C700|C750|CL30|CL35|CL60|GL5T|GL7T|GLEX|GLF[4-6]|G280|E50P|E55P|LJ[3-7][0-9]|H25B|PC24|HDJT|EC35|EC45|EC55|A109|A139|A169|S76|B412|B429)$/;
export function engines(type) {
  const t = up(type); if (!t) return null;
  const c = cell(typeSpecs(t), 'Engines') ?? cell(typeSpecs(t), 'Engine'); if (c) return Number(c[1]) || null;
  return QUAD.test(t) ? 4 : TRI.test(t) ? 3 : SINGLE.test(t) ? 1 : TWIN.test(t) ? 2 : null;
}

// Who made it: the card's maker when it has one, else ICAO type-code families that only one maker builds. Ambiguous
// families (the Dash 8 and TBM changed hands) are left out, so they never count toward a maker.
const MAKERS = [
  ['Boeing', /^(B7[0-9]{2}|B7[0-9][A-Z]|B3[789X]M|B37M|BLCF)$/], ['Airbus', /^(A3[0-9]{2}|A3[0-9]N|A[12][0-9]N|BCS[13])$/],
  ['Embraer', /^(E1[0-9]{2}|E2[0-9]{2}|E[0-9]{2}[LSP]|E135|E145|E35L|E545|E550)$/], ['Bombardier', /^(CRJ[1279X]|CL30|CL35|CL60|GL5T|GL7T|GLEX)$/],
  ['ATR', /^AT[47][0-9]$/], ['Cessna', /^(C15[02]|C162|C17[0257]|C18[0258]|C195|C20[5-8]|C210|C25[A-CM]|C5[0-9]{2}|C56X|C68A|C700|C750)$/], ['Piper', /^(P28[A-U]|PA[1-4][0-9]|P32R|P46T)$/],
  ['Beechcraft', /^(BE(?!40)[0-9]{2}|BE9[LT]|B350|B190)$/], ['Gulfstream', /^(GLF[2-6]|G280|GA[5-8]C)$/], ['Dassault', /^(FA[0-9][0-9X]|F2TH|F900)$/],
  ['Pilatus', /^(PC6T|PC12|PC24)$/], ['Cirrus', /^(SR2[02]|S22T|SF50)$/], ['Diamond', /^(DA[2-6][0-9]|DV20)$/], ['Robinson', /^(R22|R44|R66)$/],
  ['Bell', /^(B06|B407|B412|B429|B505)$/], ['Airbus Helicopters', /^(EC[0-9]{2}|AS[0-9]{2}|H1[2-6][05])$/], ['Learjet', /^LJ[2-7][0-9]$/],
  ['Mooney', /^M20[A-Z]$/], ['McDonnell Douglas', /^(MD11|DC10|MD8[0-9]|MD90)$/], ['Honda', /^HDJT$/],
];
export function makerOf(type) {
  const t = up(type); if (!t) return null;
  const s = typeSpecs(t); if (s?.maker) return s.maker;
  for (const [m, re] of MAKERS) if (re.test(t)) return m;
  return null;
}
// Boeing and Airbus airliners only (no military types), for "a Boeing and an Airbus" and Big Two.
export const isBoeing = (type) => /^(B7[0-9]{2}|B7[0-9][A-Z]|B3[789X]M|B37M)$/.test(up(type)) && !/^(B52|B1|B2)$/.test(up(type));
export const isAirbus = (type) => /^(A3[0-9]{2}|A3[0-9]N|A[12][0-9]N|BCS[13])$/.test(up(type)) && up(type) !== 'A400';

// Continents by country code, with one exception (Sevaan 2026-11-20): Hawaii's airports count as Oceania.
const HAWAII = new Set(['HNL', 'OGG', 'KOA', 'LIH', 'ITO', 'PHNL', 'PHOG', 'PHKO', 'PHLI', 'PHTO']);
export function continentOfAirport(a) {
  if (!a) return null;
  if (HAWAII.has(up(a.iata)) || HAWAII.has(up(a.icao))) return 'OC';
  return continentOf(a.cc || a.country || '');
}
