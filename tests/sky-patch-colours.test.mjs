// Sky's patch colours (2026-11-20, design/patch-colours option B): on every group's twill, its tier colours and every
// Sky secret's pastel, the navy name lettering and the red group line read at 4.5:1 or better and the icon accent at 3:1;
// the groups' pastels stay apart from each other; the art's colour map leaves no cream ink behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKY_GROUND, SKY_TIER_GROUND, SKY_THREAD, SKY_LABEL, SKY_ACCENT, SKY_ART_MAP, skyArt, pastelOf, contrast } from '../js/sky-patch-colours.js';

const secrets = readFileSync(new URL('../js/sky-secrets.js', import.meta.url), 'utf8');
const SECRET_TWILL = Object.fromEntries([...secrets.match(/const SKY_TWILL = \{([^}]*)\}/)[1].matchAll(/(\w+): '(#[0-9a-f]{6})'/gi)].map((m) => [m[1], m[2]]));
const grounds = { ...SKY_GROUND, ...Object.fromEntries(Object.entries(SKY_TIER_GROUND).map(([k, v]) => [`tier ${k}`, v])), ...Object.fromEntries(Object.entries(SECRET_TWILL).map(([k, v]) => [`secret ${k}`, pastelOf(v)])) };

test('every Sky patch twill: lettering 4.5:1, group line 4.5:1, icon accent 3:1', () => {
  assert.ok(Object.keys(SECRET_TWILL).length >= 10, 'read the Sky secrets\' twill');
  for (const [k, g] of Object.entries(grounds)) {
    assert.ok(contrast(SKY_THREAD, g) >= 4.5, `${k} ${g}: lettering ${contrast(SKY_THREAD, g).toFixed(2)}`);
    assert.ok(contrast(SKY_LABEL, g) >= 4.5, `${k} ${g}: group line ${contrast(SKY_LABEL, g).toFixed(2)}`);
    assert.ok(contrast(SKY_ACCENT, g) >= 3, `${k} ${g}: accent ${contrast(SKY_ACCENT, g).toFixed(2)}`);
  }
});

test("Sky's groups each have their own pastel (CIE Lab distance 10 or more)", () => {
  const lab = (c) => { const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((x) => (x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4));
    const f = (t) => (t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116), X = f((v[0] * .4124 + v[1] * .3576 + v[2] * .1805) / .95047), Y = f(v[0] * .2126 + v[1] * .7152 + v[2] * .0722), Z = f((v[0] * .0193 + v[1] * .1192 + v[2] * .9505) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
  const sky = ['collect', 'fleet', 'week', 'album', 'nation', 'time', 'history', 'rarity', 'sky', 'member', 'secret'];
  for (let i = 0; i < sky.length; i++) for (let j = i + 1; j < sky.length; j++) {
    const [a, b] = [lab(SKY_GROUND[sky[i]]), lab(SKY_GROUND[sky[j]])], d = Math.hypot(...a.map((v, n) => v - b[n]));
    assert.ok(d >= 10, `${sky[i]} and ${sky[j]} too alike (${d.toFixed(0)})`);
  }
});

test('the art map re-points the cream ink and the accent', () => {
  const out = skyArt('<path fill="#fff2b3" stroke="#FFF2B3"/><circle fill="var(--gold)"/><rect fill="#14284a"/>');
  assert.ok(!/fff2b3|var\(--gold\)|14284a/i.test(out), out);
  assert.equal(SKY_ART_MAP['#fff2b3'], SKY_THREAD);
});

test('locked patch captions read 4.5:1 on the day and night pages, and the CSS uses them (QA round 4)', async () => {
  const { SKY_LOCKED_CAPTION, SKY_PAGE } = await import('../js/sky-patch-colours.js');
  for (const k of ['day', 'night']) assert.ok(contrast(SKY_LOCKED_CAPTION[k], SKY_PAGE[k]) >= 4.5, `${k}: ${contrast(SKY_LOCKED_CAPTION[k], SKY_PAGE[k]).toFixed(2)}`);
  const css = readFileSync(new URL('../css/sky-theme.css', import.meta.url), 'utf8');
  assert.ok(css.includes(`html.sky-cards .pw-item.locked span { color:${SKY_LOCKED_CAPTION.day}; }`));
  assert.ok(css.includes(`html.sky-cards.sky-night .pw-item.locked span { color:${SKY_LOCKED_CAPTION.night}; }`));
});
