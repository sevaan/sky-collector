// Quick check of the Sky perf pass (2026-11-16): seed lands, recorded planes fly, Collection shows plane cards.
import { open, URL0 } from './harness.mjs';
const T = await open('webkit', { at: '2026-11-10T19:40:00-05:00' });
const { p, W, hud, seed, errs } = T;
await p.goto(URL0); await W(2500); console.log('seeded', await seed(200));
await p.goto(URL0); await hud(); await W(15000);
console.log(await p.evaluate(() => ({ dots: document.querySelectorAll('#radar .rd-plane, #radar [data-plane], .radar-plane').length, overhead: document.body.innerText.match(/\d+ OVERHEAD/i)?.[0], title: document.title })));
await p.screenshot({ path: 'scripts/perf/out/smoke-explore.png' });
console.log(errs.slice(0, 5)); await T.b.close();
