// Today's note bubbles in Sky (2026-11-20, option C, design/bubbles/): every text colour on its bubble reads at 4.5:1 or
// better, day (css/sky-theme.css) and night (css/sky-night.css), and the tail takes the bubble's fill and hairline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const day = readFileSync(new URL('../css/sky-theme.css', import.meta.url), 'utf8');
const night = readFileSync(new URL('../css/sky-night.css', import.meta.url), 'utf8');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const prop = (css, sel, name) => { const m = css.match(new RegExp(`(?:^|\\n)${esc(sel)} \\{([^}]*)\\}`)); assert.ok(m, `rule ${sel}`); const v = m[1].match(new RegExp(`(?:^|[;\\s])${name}:\\s*(#[0-9a-f]{6})`, 'i')); assert.ok(v, `${sel} ${name}`); return v[1].toLowerCase(); };
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const [when, css, pre] of [['day', day, 'body.sky-only'], ['night', night, 'html.sky-night body.sky-only']]) {
  test(`Sky's note bubbles by ${when}: text on its bubble at 4.5:1 or better`, () => {
    const bubble = prop(css, `${pre} .n2-b`, 'background'), big = prop(css, `${pre} .n2-b.big`, 'background');
    const ink = prop(css, `${pre} .n2-b`, 'color'), bigInk = prop(css, `${pre} .n2-b.big`, 'color'), link = prop(css, `${pre} .n2-b em`, 'color'), dim = prop(css, `${pre} .n2-b.dim`, 'color');
    for (const [what, fg, bg] of [['body', ink, bubble], ['welcome', bigInk, big], ['link', link, bubble], ['dim line', dim, bubble]]) {
      const r = ratio(fg, bg); assert.ok(r >= 4.5, `${when} ${what} ${fg} on ${bg}: ${r.toFixed(2)}`);
    }
    if (when === 'night') assert.ok(ratio(link, bubble) >= 5, 'the night link is lifted past 5:1');
  });
  test(`Sky's note attachment card by ${when}: its text at 4.5:1 or better`, () => {
    const bg = prop(css, `${pre} .n2-att`, 'background');
    for (const [what, fg] of [['name', prop(css, `${pre} .n2-att`, 'color')], ['line', prop(css, `${pre} .n2-att .tx small`, 'color')], ['time', prop(css, `${pre} .n2-att .tm`, 'color')], ['XP', prop(css, `${pre} .n2-att .tm small`, 'color')]]) {
      const r = ratio(fg, bg); assert.ok(r >= 4.5, `${when} card ${what} ${fg} on ${bg}: ${r.toFixed(2)}`);
    }
  });
  test(`Sky's note tail by ${when}: the bubble's fill and hairline`, () => {
    assert.equal(prop(css, `${pre} .n2-stack > .n2-b:last-child::before`, 'background'), prop(css, `${pre} .n2-b`, 'background'));
    assert.match(css, new RegExp(`${esc(pre)} \\.n2-b \\{[^}]*inset 0 0 0 1px ${prop(css, `${pre} .n2-stack > .n2-b:last-child::after`, 'background')}`));
  });
}
