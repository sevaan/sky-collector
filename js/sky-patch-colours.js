// Sky Collector's patch colours (2026-11-20, Sevaan picked design/patch-colours option B "Uniform twill"): Space
// Collector's patches are dark twill made for a night-sky app; Sky's are pale twill like an airline uniform patch, navy
// thread lettering and a navy merrowed edge, red details. Each group its own pastel, spread round the colour wheel so the
// groups tell apart (coral, apricot, butter, lime, green, aqua, sky blue, lilac, rose, white, silver: 40 degrees of hue apart); rarity
// patches take their tier's colour. js/patches.js patchSvg uses this only in Sky, so Space Collector is unchanged.
// No DOM here (tests/sky-patch-colours.test.mjs checks every ground's contrast).

export const SKY_GROUND = {
  time: '#fac3bd', nation: '#f8c693', album: '#f5d978', sky: '#bbda7f', week: '#a4ddac', fleet: '#96dcd3', collect: '#a6d5f4',
  rarity: '#dcc7f5', history: '#f4c0dc', member: '#f4f7fb', secret: '#d3d9e1',
  rocket: '#fac3bd', planet: '#f8c693', con: '#dcc7f5', /* Space-only groups, in case one ever shows in Sky */
};
// Rarity patches in their tier's colour (Legendary gold, Epic purple, Rare blue)
export const SKY_TIER_GROUND = { legend: '#f5d978', legends5: '#f5d978', legends25: '#f5d978', shiny: '#f5d978', shiny5: '#f5d978', 'sky-shinyall': '#f5d978', epic: '#dcc7f5', spectrum: '#b3cdf6' };
export const SKY_THREAD = '#0d2238'; // name lettering, icon, inner ring
export const SKY_LABEL = '#9a2318'; // the group (or date) along the bottom: a deeper red than the app's #b42a20, so it passes on every pastel
export const SKY_ACCENT = '#c42f22'; // the icons' accent (Space's orange, var(--gold))
// Edges: assets/art/patch/merrow.webp recoloured (navy by day, light sky blue at night on the navy page, gold for gold finish)
// Locked patches' captions on the wall (css/sky-theme.css .pw-item.locked span), on the day page and the night page
export const SKY_LOCKED_CAPTION = { day: '#566c81', night: '#8aa0b4' }, SKY_PAGE = { day: '#eef5fb', night: '#0b1626' };
export const SKY_MERROW = { day: 'merrow-navy.webp', night: 'merrow-sky.webp', gold: 'merrow-gold.webp' };
// The art's own colours, re-pointed for a light ground (cream ink and night-sky fills read on dark twill only)
export const SKY_ART_MAP = {
  '#fff2b3': SKY_THREAD, 'var(--gold)': SKY_ACCENT, '#e8493c': SKY_ACCENT, '#ff6b5e': SKY_ACCENT, '#fa8127': SKY_ACCENT,
  '#14284a': '#ffffff', '#0c1c33': '#e9eef4', '#8fd0ff': '#2b6a99', '#f2b632': '#b5780a', '#c9b98a': '#8f7f50', '#fff6cf': '#ffffff',
};
const ART_RE = new RegExp(Object.keys(SKY_ART_MAP).map((k) => k.replace(/[()]/g, '\\$&')).join('|'), 'gi');
export const skyArt = (svg) => svg.replace(ART_RE, (m) => SKY_ART_MAP[m.toLowerCase()] ?? m);

const hex = (c) => { const s = c.replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)); };
const toHex = (r) => '#' + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
// A secret's own dark twill (js/sky-secrets.js SKY_TWILL), lifted to a pastel of the same hue
export function pastelOf(dark) {
  const [r, g, b] = hex(dark).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const h = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4, s = Math.min(.55, d ? d / (1 - Math.abs(mx + mn - 1)) : 0);
  const l = .83, a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h * 2) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return toHex([f(0), f(8), f(4)].map((x) => x * 255));
}
// The twill colour of a patch: its tier, its secret's own colour, or its group's
export const skyGround = (id, group, secretTwill) => SKY_TIER_GROUND[id] ?? (secretTwill ? pastelOf(secretTwill) : SKY_GROUND[group] ?? SKY_GROUND.collect);

// WCAG contrast, for the tests
export const luminance = (c) => { const v = hex(c).map((x) => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
