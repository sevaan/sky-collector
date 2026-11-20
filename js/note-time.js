/* The daily note's card time (2026-11-20 QA): the time a pick shows on its attached card, or null when it has none.
   Sky's 'level' pick (a card one aircraft from Silver) has no time and no pass; fmtTime(undefined) printed "Invalid
   Date" in red. A pick with no time shows no time: never fake one. */
export function noteTime(att, pass) {
  const t = att?.time ?? pass?.start;
  return Number.isFinite(t) ? t : null;
}
