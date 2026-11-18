// Side-by-side sheet: node qa-sheet.mjs <out.png> <size> <suffix> [suffix...]  (no labels; space left, sky right; one pair per suffix, pairs laid out left to right)
// reads out/qa/space-<size>-<suffix>.png and sky-<size>-<suffix>.png, writes out/qa/sheets/<out>. (ImageMagick montage has no font here, so convert +append.)
import { execFileSync } from 'node:child_process'; import { mkdirSync, existsSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
const D = fileURLToPath(new URL('./out/qa/', import.meta.url)); mkdirSync(D + 'sheets/', { recursive: true });
const [out, size, ...sfx] = process.argv.slice(2), scale = process.env.SCALE || '60%', rows = [];
for (const s of sfx) { const a = []; for (const l of ['space', 'sky']) { const f = `${D}${l}-${size}-${s}.png`; a.push(existsSync(f) ? f : 'xc:gray'); } const o = `${D}sheets/_row${rows.length}.png`; execFileSync('convert', [...a, '-background', '#777', '-gravity', 'north', '+append', '-bordercolor', '#f0f', '-border', '4x0', o]); rows.push(o); }
execFileSync('convert', [...rows, '-background', '#777', '+append', '-resize', scale, `${D}sheets/${out}`]); console.log('wrote', out);
