// The app icons a player can choose (2026-11-19, Plus): Space Collector's js/app-icons.js (32524915) with Sky's own
// list (design/icons-sky/IconsSky.dc.html, Sevaan's OK on the sheet 2026-11-19). `native` is the name iOS
// (CFBundleAlternateIcons) and Android (activity-alias) use; null = the app's main icon. Art: design/icons-sky/out
// (scratchpad render-icons.mjs), into the apps with scripts/app-icons-native.py.
export const ICONS = [
  { id: 'original', name: 'Original', plus: false, native: null },
  { id: 'flightplan', name: 'Flight Plan', plus: true, native: 'IconFlightPlan' },
  { id: 'nightflight', name: 'Night Flight', plus: true, native: 'IconNightFlight' },
  { id: 'cheatline', name: 'Cheatline', plus: true, native: 'IconCheatline' },
  { id: 'blueprint', name: 'Blueprint', plus: true, native: 'IconBlueprint' },
  { id: 'goldenage', name: 'Golden Age', plus: true, native: 'IconGoldenAge' },
  { id: 'airmail', name: 'Airmail', plus: true, native: 'IconAirmail' },
  { id: 'cockpit', name: 'Cockpit', plus: true, native: 'IconCockpit' },
];
export const iconById = (id) => ICONS.find((i) => i.id === id) ?? ICONS[0];
/* What a player may use: Original always, the rest with Plus (a lapsed Plus goes back to Original). */
export const iconAllowed = (id, plus) => !iconById(id).plus || !!plus;
export const iconToUse = (id, plus) => (iconAllowed(id, plus) ? iconById(id).id : 'original');
