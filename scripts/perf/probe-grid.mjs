// What the Collection grid draws per tile, Space vs Sky (2026-11-16 scroll gap). PERF_URL / PERF_SKY.
import { open, URL0 } from './harness.mjs';
const T = await open('webkit', { at: '2026-11-10T19:40:00-05:00', wx: 'clear' });
const { p, W, hud, seed } = T;
await p.goto(URL0); await W(2500); await seed(2000);
await p.goto(URL0); await hud(); await W(4000);
await p.evaluate(() => document.querySelector('#nav-collection').click()); await W(5000);
const f = p.frames().find((x) => /cards\.html/.test(x.url()));
console.log(JSON.stringify(await f.evaluate(() => {
  const tiles = [...document.querySelectorAll('.card-tile')], t = tiles[0];
  const imgs = [...document.querySelectorAll('.card-tile img')];
  const filt = [...document.querySelectorAll('.card-tile *')].filter((e) => { const s = getComputedStyle(e); return s.filter !== 'none' || s.backdropFilter && s.backdropFilter !== 'none'; }).length;
  return { tiles: tiles.length, nodesPerTile: Math.round(document.querySelectorAll('.card-tile *').length / Math.max(1, tiles.length)), imgs: imgs.length, natural: [...new Set(imgs.slice(0, 40).map((i) => `${i.naturalWidth}x${i.naturalHeight}`))].slice(0, 6), filtered: filt, anims: document.getAnimations().length, sample: t?.innerHTML.slice(0, 700) };
}), null, 1));
await T.b.close();
