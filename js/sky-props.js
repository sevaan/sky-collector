// Propeller planes by ICAO type code (QA 2026-11-19: the old prefix pattern counted Citation jets (C25A/C25B), the C-17
// and the Beechjet (BE40) as propeller planes). Whole codes and tight families only: turboprop airliners and utility
// planes, piston singles and twins, warbirds. Used by the propeller mission, Prop Day, Propeller week (js/progress.js)
// and Today (js/sky-today.js). No DOM here.
const PROP_RE = new RegExp('^(' + [
  'DH8[A-D]', 'AT4[3-6]', 'AT7[2-6]', 'DHC[2-7]', 'SF34', 'SB20', 'B190', 'BE99', 'B350', 'BE9[LT]', 'BE(?!40)[1-9][0-9]',
  'E110', 'E120', 'JS3[12]', 'JS41', 'D228', 'D328', 'SW[34]', 'C208', 'C212', 'CN35', 'C295', 'C130', 'C30J', 'A400',
  'AN(2|12|24|26|28|30|32)', 'L410', 'PC(6T|12)', 'TBM[7-9]', 'P46T', 'PAY[1-4]', 'KODI', 'Y12', 'MA60', 'P180',
  'C1[5-9][0-9]', 'C2[01][0-9]', 'C3[14][0-9]', 'C4[0-2][0-9]', 'P28[A-U]', 'P32[RT]', 'PA[1-4][0-9]', 'SR2[02]', 'S22T',
  'DA[2-6][0-9]', 'M20[A-Z]', 'DC3', 'DC6', 'B17', 'B25', 'P51', 'SPIT', 'T6', 'AA5', 'GA8', 'BN2P', 'TRIS', 'CVLT', 'F27', 'F50',
].join('|') + ')$');
export const isProp = (type) => PROP_RE.test(String(type ?? '').toUpperCase());
