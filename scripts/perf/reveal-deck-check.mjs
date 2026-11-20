// Reveal deck check (2026-11-20 swipe pass): a flight's two cards on the catch reveal, swiped sideways between, then flicked
// up and away. WebKit, pointer events from the mouse.  node scripts/perf/reveal-deck-check.mjs [url]
import { webkit } from '../../node_modules/playwright/index.mjs';
const URL0 = process.argv[2] || 'http://localhost:8781/';
const b = await webkit.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, serviceWorkers: 'block', geolocation: { latitude: 43.66, longitude: -79.58 }, permissions: ['geolocation'] });
await ctx.addInitScript(() => { for (const k of ['started', 'tourDone', 'fingerChosen', 'radarTip']) if (!localStorage.getItem(k)) localStorage.setItem(k, '1'); localStorage.setItem('recapWeek', '9e15'); });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => { if (!/PointerCapture|InvalidPointerId/.test(e.message)) errs.push(e.message.slice(0, 160)); });
const W = (ms) => p.waitForTimeout(ms);
await p.goto(URL0); await W(6000);
const ver = (await (await fetch(new URL('/version.json', URL0))).json()).version;
await p.evaluate(async (ver) => {
  const { playReveal } = await import(`/js/reveal.js?v=${ver}`); const { renderCard } = await import(`/js/card.js?v=${ver}`); const { cardsFor } = await import(`/js/flights.js?v=${ver}`); const { catchSightings } = await import(`/js/sky-cards.js?v=${ver}`);
  const ap = (icao, city, lat, lon) => ({ icao, iata: icao.slice(1), city, cc: 'CA', lat, lon, name: city });
  const { flight, plane } = cardsFor({ hex: 'c0ffee', callsign: 'ACA101', reg: 'C-FGKP', type: 'B38M', desc: '', category: 'A3' }, { from: ap('CYYZ', 'Toronto', 43.68, -79.63), to: ap('CYVR', 'Vancouver', 49.19, -123.18), callsign: 'ACA101' }, '');
  const ss = catchSightings({ time: Date.now(), hex: 'c0ffee', callsign: 'ACA101', reg: 'C-FGKP', type: 'B38M', altFt: 30000, gsKt: 450, rangeKm: 20, lat: 43.66, lon: -79.58, flight, plane }).map((x, i) => ({ ...x, key: 'k' + i, sim: false }));
  const mk = (x) => ({ card: renderCard(x.cardSnapshot, { sightings: [x], seenMembers: 1, ownedKeys: new Set() }), o: x.cardSnapshot, key: x.cardKey, seen: 1, progress: { level: 'bronze', before: 'none', nights: 1 } });
  const cards = ss.map(mk);
  document.getElementById('reveal').hidden = false; /* main.js shows it before playing */
  playReveal({ ...cards[0], collected: 2, cards, origin: { x: 200, y: 400 } });
}, ver);
await p.waitForFunction(() => document.getElementById('reveal')?.classList.contains('rv-done'), null, { timeout: 20000 }); await W(1500);
const front = () => p.evaluate(() => { const f = document.querySelector('#reveal .dk-front'); return f ? (f.querySelector('.fc')?.className.match(/fc--(flight|plane)/)?.[1] ?? f.className) : null; });
const drag = async (x0, y0, x1, y1, steps = 10) => { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= steps; i++) { await p.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await W(16); } await p.mouse.up(); };
const box = await p.evaluate(() => { const r = document.querySelector('#reveal .dk-front').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
void ('at point:', JSON.stringify(box), await p.evaluate(({ x, y }) => { const e = document.elementFromPoint(x + 60, y); return [e?.tagName, e?.id, String(e?.className), e?.closest('.dk-slot')?.className, [...document.querySelectorAll('#reveal-card > *')].map((c) => c.className + ' ' + JSON.stringify(c.getBoundingClientRect())).join(' | ')]; }, box)); const f0 = await front(); await drag(box.x + 60, box.y, box.x - 160, box.y + 5); await W(1200); const f1 = await front();
await drag(box.x - 60, box.y, box.x + 160, box.y + 5); await W(1200); const f2 = await front();
const sw = await p.evaluate(() => [...document.querySelectorAll('#reveal .card')].map((c) => c.dataset.swiping ?? '-').join(','));
await drag(box.x, box.y + 120, box.x + 4, box.y - 320, 6); await W(2000);
const open = await p.evaluate(() => { const r = document.getElementById('reveal'), c = r.querySelector('.dk-front .card'); return !r.hidden && !!c && c.getBoundingClientRect().bottom > 0 && !r.classList.contains('rv-gone'); }); console.log('after flick:', await p.evaluate(() => { const r = document.getElementById('reveal'), c = r.querySelector('.dk-front .card'); return `hidden=${r.hidden} class=${r.className} card bottom=${Math.round(c?.getBoundingClientRect().bottom)}`; }));
console.log(`deck front: ${f0} -> swipe left -> ${f1} -> swipe right -> ${f2}; data-swiping left on cards: ${sw}; after flick up the reveal is ${open ? 'STILL OPEN' : 'closed'}; errors ${errs.length ? errs.join(' | ') : 'none'}`);
await b.close();
