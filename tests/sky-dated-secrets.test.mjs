// QA 2026-11-19: the UFO, Santa and the aviation anniversaries could never be caught in Sky. Their name and tap button live
// in the circle's ticket (#tk), which css/sky-cards.css hid outright, and the anniversaries (SKY_DATED) had no drawing in
// the sky, so nothing crossed. Both are checked here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKY_DATED, SKY_SECRET_PATCHES } from '../js/sky-secrets.js';

test("Sky's CSS shows the circle's ticket for a secret or the UFO (it holds their tap button)", () => {
  const css = readFileSync(new URL('../css/sky-cards.css', import.meta.url), 'utf8');
  assert.match(css, /#tk:is\(\[data-ink="secret"\], \[data-ink="ufo"\]\):not\(\[hidden\]\) \{ display: flex !important; \}/);
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /for \(const id of \['ufo-cta', 'secret-cta'\]\) \$\('tk-act'\)\.append/); // the buttons are inside #tk
});

test('every aviation anniversary draws something in the sky and has a patch', async () => {
  globalThis.window ??= globalThis; globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const { SkyView } = await import('../js/sky.js');
  for (const [id] of SKY_DATED) {
    assert.ok(SKY_SECRET_PATCHES[id], `${id} patch`);
    let marks = 0; const ctx = new Proxy({}, { get: (_, k) => (['fill', 'stroke', 'fillRect', 'strokeRect'].includes(k) ? () => { marks++; } : typeof k === 'string' && /^[a-z]/.test(k) && !['shadowColor', 'shadowBlur', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'globalAlpha'].includes(k) ? () => ({ addColorStop() {} }) : undefined), set: () => true });
    const view = Object.assign(Object.create(SkyView.prototype), { ctx, ring: { x: 100, y: 100, r: 50 }, project: () => ({ x: 100, y: 100 }), onScreen: () => true });
    view.drawSecrets([{ kind: id, enu: [0, 1, 0], inCircle: false, done: false, title: id, color: '#ffc93d' }]);
    assert.ok(marks > 0, `${id} is drawn`);
  }
});
