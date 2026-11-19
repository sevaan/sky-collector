// The gift pack (2026-11-07, design/booster-pack.html, gold on navy): received cards arrive sealed. Tear the top to open
// it; the cards rise out, the good ones face down and glowing, dealt from the least to the best; then all of them in a
// grid. Styles in css/gift.css (#gift). playPack resolves 'collection' | 'done' | 'later' (closed before opening).
// opts: { from, count, newCount, highlights: [{ card, sightings, tags }], tiles: [{ card, isNew }], summary (async: the XP line), onOpen,
//         kicker, title, label, dateLabel, footLeft, stats: [[value, label]], subHtml, goLabel, laterLabel, share: { label, fn } (an icon at the top of the summary), rowHtml (resolves 'row'), tail: { card, tags, label, button: { label, fn } },
//         renderCard, attachTilt, artImage, applyBack, sfx, feel, tierColor }
const wait = (ms, reduced) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 120) : ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
import { TIERS, flipCard, heartbeats, payoffSound } from './card-moment.js?v=0.1.1757';
import { attachGyro } from './card.js?v=0.1.1757';
import { cloudsHtml } from './weather-art.js?v=0.1.1757';
// Cards turn with the catch reveal's own flip and rarity table (js/card-moment.js, 2026-11-11): one turn for a catch, a
// gift and the morning pack.
// A tap that answers on the finger lifting, like main.js tapOn: the pack animates every frame, and WebKit drops a click
// while the page is changing (iPhone 14 simulator 2026-11-07: Tap to open and the dealt cards didn't answer).
function tap(el, fn) {
  let down = null, fired = 0;
  el.addEventListener('pointerdown', (e) => { if (e.button > 0) return; down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  el.addEventListener('pointerup', (e) => { const d = down; down = null; if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 600) return; fired = performance.now(); fn(e);
    const ux = e.clientX, uy = e.clientY, eat = (c) => { if (Math.hypot(c.clientX - ux, c.clientY - uy) > 12) return; document.removeEventListener('click', eat, { capture: true }); c.preventDefault(); c.stopPropagation(); };
    document.addEventListener('click', eat, { capture: true }); setTimeout(() => document.removeEventListener('click', eat, { capture: true }), 400); });
  el.addEventListener('pointercancel', () => { down = null; });
  el.addEventListener('click', (e) => { if (performance.now() - fired < 800) return; fn(e); });
}

export function playPack(o) {
  return new Promise((resolve) => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, W = (ms) => wait(ms, reduced);
    const sfx = (n, v) => { try { o.sfx?.(n, typeof v === 'object' && v ? v : { gain: v ?? 1 }); } catch {} } /* a number is the gain; an object is passed through (2026-11-18: the tear's { gap, wait } arrived as the gain, so it was NaN and the tear never played, Sevaan: "didn't hear the pack opening sound"; Space Collector 925f6a71) */, feel = (k) => { try { o.feel?.(k); } catch {} };
    const best = o.highlights.at(-1)?.card;
    const bare = !!o.bare; /* the first-run opener (2026-11-12, Sevaan): just the pack and the swipe cue, no words; o.emerge(packRect, dropPack) brings the welcome card out of it */
    const root = document.createElement('div'); root.id = 'gift'; root.className = bare ? 'in bare' : 'in'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', bare ? 'A sealed pack. Swipe across the top to open it.' : `Cards from ${o.from || 'a friend'}`); if (bare) root.tabIndex = 0;
    root.style.setProperty('--fx', o.tierColor(best?.tier) ?? '#ffc93d');
    const from = o.label ?? (o.from ? `From ${o.from}` : 'Cards for you');
    const skin = () => `<div class="gp-base"></div><div class="gp-art"></div><div class="gp-lines"></div><div class="gp-glow"></div>
      ${bare ? '' : `<div class="gp-count"><b>${o.count}</b><span>card${o.count === 1 ? '' : 's'}</span></div>`}
      ${o.from ? `<div class="gp-ribbon"><small>From</small>${esc(o.from)}</div>` : ''}
      <div class="gp-pillow"></div><div class="gp-cards"></div><div class="gp-pinch"></div><div class="gp-band"></div>
      <div class="gp-seal"></div><div class="gp-seal b"></div><div class="gp-seam"></div><div class="gp-shade"></div><div class="gp-sheen"></div><div class="gp-edges"></div>`;
    /* (2026-11-12, Sevaan picked A of design/pack-real.html) the pack reads as a sealed bag: pillow shading, pinch folds and
       ridged seals, a highlight sliding down the bulge with the tilt, lit side edges and a contact shadow (.gp-contact) */
    root.innerHTML = `<div class="gp-stars"></div>
      ${bare ? '' : `<div class="gp-head"><div class="k">${esc(o.kicker ?? 'Cards for you')}</div><h1>${esc(o.title ?? (o.from ? `From ${o.from}` : 'A pack of cards'))}</h1><p>${esc(o.dates ?? '')}</p></div>
      <button class="gp-x" type="button" aria-label="Close">✕</button>`}
      ${o.share ? `<button class="gp-share" type="button" aria-label="${esc(o.share.label)}" hidden><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18 10h-2"/></svg></button>` : ''}
      <div class="gp-flash"></div><div class="gp-burst"><div class="gp-rays"></div></div><div class="gp-deck"></div>
      <div class="gp-pk idle"><div class="gp-leak"></div><div class="gp-contact"></div><div class="gp-tilt"><div class="gp-shadow"></div><div class="gp-back"></div><div class="gp-wall l"></div><div class="gp-wall r"></div>
        <div class="gp-piece gp-main"><div class="gp-skin">${skin()}</div></div>
        <div class="gp-piece gp-cap"><div class="gp-skin">${skin()}</div></div>
        <svg class="gp-tear" viewBox="0 0 100 12" preserveAspectRatio="none"><path d=""/></svg><div class="gp-cue"></div></div></div>
      <div class="gp-tags"></div>
      ${bare ? '' : `<div class="gp-hint"><b>Swipe across the top</b> to open<span class="sub">${o.count} card${o.count === 1 ? '' : 's'}${o.newCount ? ` · ${o.newCount} new to you` : ''}</span><button type="button" data-a="open">Tap to open</button></div>`}
      <div class="gp-count2 gone"></div>`;
    document.body.appendChild(root);
    const q = (s) => root.querySelector(s), pk = q('.gp-pk'), cap = q('.gp-cap'), main = q('.gp-main'), tearPath = q('.gp-tear path');
    /* Sky Collector (2026-11-16, Sevaan: "realistic moving clouds … use the weather effects from Space Collector"): the
       pack opens over a daylight sky (css/sky-theme.css) with Tonight's drifting noise clouds in white, three decks,
       where Space Collector twinkles stars. */
    if (document.body.classList.contains('sky-only')) q('.gp-stars').innerHTML = `<div class="gp-cl hi">${cloudsHtml(0.75, { tint: [255, 255, 255] })}</div><div class="gp-cl mid">${cloudsHtml(0.5, { tint: [250, 252, 255] })}</div><div class="gp-cl lo">${cloudsHtml(0.8, { tint: [255, 255, 255] })}</div>`;
    else { const s = q('.gp-stars'); for (let i = 0; i < 80; i++) { const e = document.createElement('i'); e.style.left = `${Math.random() * 100}%`; e.style.top = `${Math.random() * 100}%`; e.style.animationDelay = `${-Math.random() * 3}s`; s.appendChild(e); } }
    let phase = 'sealed', tearing = false, prog = 0, lastMove = 0, closed = false, auto = false;
    const finish = (how) => { if (closed) return; closed = true; root.classList.remove('in'); root.classList.add('out'); setTimeout(() => root.remove(), 300); stopGyro(); clearInterval(rattleT); resolve(how); };
    root._dismiss = () => finish('later'); /* for whoever put the pack up (the opener, when the sky starts without it) */
    // ---- tilt: finger, phone, or a slow idle sway ----
    /* Every frame moves only transforms and opacity (2026-11-07 jank pass: changing CSS variables on the pack repainted
       the masked gold foil, its shadow and blend layers each frame: ~100 ms frames in WebKit). */
    const tiltEl = q('.gp-tilt'), sheens = [...root.querySelectorAll('.gp-sheen')], glows = [...root.querySelectorAll('.gp-glow')], bands = [...root.querySelectorAll('.gp-band')], leak = q('.gp-leak');
    const setTilt = (x, y) => { tiltEl.style.transform = `rotateX(${(-(y - 50) / 50 * 11).toFixed(2)}deg) rotateY(${((x - 50) / 50 * 20).toFixed(2)}deg)`; /* 20° side to side so the pack's sides show (2026-11-12) */
      const sx = `translate3d(${((50 - x) * 0.9).toFixed(1)}%, 0, 0)`, gx = `translate3d(${((x - 50) * 0.6).toFixed(1)}%, ${((y - 40) * 0.5).toFixed(1)}%, 0)`;
      for (const e of sheens) e.style.transform = sx; for (const e of glows) e.style.transform = gx;
      /* Pillow (A, 2026-11-12): the highlight down the bulge slides slowly with the tilt */
      const bx = `translate3d(${((x - 50) * 0.35).toFixed(1)}%, 0, 0)`; for (const e of bands) e.style.transform = bx; };
    setTilt(50, 40);
    root.addEventListener('pointermove', (e) => { lastMove = performance.now(); if (phase === 'sealed' && !tearing) setTilt(e.clientX / innerWidth * 100, e.clientY / innerHeight * 100); });
    /* The phone's tilt, read the way cards read it (attachGyro: relative to how you hold it, gimbal-free). Raw beta/gamma
       flip when the phone is held upright (gamma jumps by 180° near beta 90°), so the highlight leapt from one edge to
       the other and the whole pack snapped to a new angle (2026-11-12, Sevaan). */
    const gyro = { touching: false, set(px, py) { if (phase !== 'sealed' || tearing) return; lastMove = performance.now(); setTilt(px * 100, py * 100); }, reset() {} };
    const stopGyro = reduced ? () => {} : attachGyro(root, gyro);
    (function idle(t) { if (closed) return; if (phase === 'sealed' && !tearing && performance.now() - lastMove > 1500 && !reduced) setTilt(50 + Math.sin(t / 1400) * 22, 42 + Math.cos(t / 1900) * 12); requestAnimationFrame(idle); })(0);
    const rattle = () => { if (reduced) return; pk.classList.remove('rattle'); void pk.offsetWidth; pk.classList.add('rattle'); sfx('rattle', 0.7); };
    pk.addEventListener('animationend', (e) => { if (e.animationName === 'gp-rattle') pk.classList.remove('rattle'); }); /* or the idle bob never came back after the first rattle */
    const rattleT = setInterval(() => { if (phase === 'sealed' && !tearing && !reduced) rattle(); }, 5200);
    // ---- the tear ----
    const jag = []; for (let i = 0; i <= 40; i++) jag.push([i * 2.5, 6 + (i % 2 ? -1 : 1) * (2 + Math.random() * 2.2)]);
    const path = (p) => { const n = Math.max(1, Math.round(p * 40)); return `M${jag.slice(0, n + 1).map(([x, y]) => `${x} ${y.toFixed(2)}`).join(' L')}`; };
    const showProg = (p) => { prog = p; leak.style.opacity = (0.15 + p * 0.85).toFixed(3); tearPath.setAttribute('d', p > 0 ? path(p) : ''); cap.style.transform = `rotate(${(-p * 7).toFixed(2)}deg) translateY(${(-p * 5).toFixed(1)}px)`; };
    /* on frames, with a timer behind it: a WebView that stops sending animation frames (Android emulator 2026-11-07) must
       not leave the pack half torn and every tap ignored */
    const animateProg = (a, b, ms) => new Promise((res) => { const t0 = performance.now(); let done = false;
      const end = () => { if (done) return; done = true; showProg(b); res(); };
      const f = () => { if (done) return; const k = Math.min(1, (performance.now() - t0) / (reduced ? 1 : ms)); showProg(a + (b - a) * (1 - (1 - k) ** 2)); if (k < 1) requestAnimationFrame(f); else end(); };
      requestAnimationFrame(f); setTimeout(end, (reduced ? 1 : ms) + 150); });
    /* the pack tears itself (Tap to open, a tap on the opener, Enter): once, however many times it's asked */
    const autoTear = () => { if (phase !== 'sealed' || auto || closed) return; auto = true; sfx('tear', { gap: 700, wait: 1500 }); pk.classList.remove('idle'); animateProg(prog, 1, 520).then(() => { auto = false; open(); }); };
    let tick = 0;
    pk.addEventListener('pointerdown', (e) => {
      if (phase !== 'sealed' || auto) return;
      const r = pk.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
      if (y > 0.34 && !bare) { rattle(); feel('select'); return; }
      if (y > 0.34) { /* the opener has no Tap to open button: a tap on the pack tears it for you (a swipe still works from the top) */
        const x0 = e.clientX, y0 = e.clientY; const up = (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 14) autoTear(); };
        pk.addEventListener('pointerup', up, { once: true }); return; }
      tearing = true; pk.classList.remove('idle'); pk.setPointerCapture?.(e.pointerId); sfx('step', 0.6);
      const dx0 = e.clientX, dy0 = e.clientY, start0 = Math.max(0, Math.min(.3, (e.clientX - r.left) / r.width)); let moved = 0, torn0 = false;
      /* the tear follows the finger from where it pressed, either way across (Fable pack hunt 2026-11-13: a right-to-left swipe jumped straight to 93%) */
      /* A tear can never be left stuck (2026-11-18, Sevaan swiped a cold pack on his iPhone and it froze): if the browser
         takes the pointer away (lostpointercapture) or no pointer event comes for 1.5 s, the tear ends as a release would:
         open past the threshold, otherwise back to the sealed pack, ready for the next touch. A main thread that was
         blocked (a long tick) doesn't count as the finger going quiet: its queued moves are still on the way. */
      let lastEv = performance.now(), lastTick = lastEv, ended = false;
      const dog = setInterval(() => { const now = performance.now(); if (now - lastTick > 600) lastEv = now; lastTick = now; if (now - lastEv > 1500) up(); }, 250);
      const move = (ev) => { lastEv = performance.now(); moved = Math.max(moved, Math.hypot(ev.clientX - dx0, ev.clientY - dy0)); const p = Math.max(prog, Math.min(1, start0 + Math.abs(ev.clientX - dx0) / r.width)); if (!torn0 && moved > 10) { torn0 = true; sfx('tear', { gap: 700, wait: 1500 }); } /* the tearing sound once the finger really tears (2026-11-14, Sevaan) */ if (p - tick > 0.08) { tick = p; feel('select'); } showProg(p); };
      const up = () => { if (ended) return; ended = true; clearInterval(dog); pk.removeEventListener('pointermove', move); pk.removeEventListener('pointerup', up); pk.removeEventListener('pointercancel', up); pk.removeEventListener('lostpointercapture', up); tearing = false; tick = 0;
        if (bare && moved < 14 && prog < 0.55) { autoTear(); return; } /* the opener: a plain tap on the top strip tears it too */
        if (prog > 0.55) open(); else animateProg(prog, 0, 220).then(() => { if (phase === 'sealed' && !tearing && !auto) pk.classList.add('idle'); }); };
      pk.addEventListener('pointermove', move); pk.addEventListener('pointerup', up); pk.addEventListener('pointercancel', up); pk.addEventListener('lostpointercapture', up);
    });
    if (!bare) tap(q('[data-a="open"]'), autoTear);
    if (!bare) tap(q('.gp-x'), () => { if (phase === 'sealed') finish('later'); else if (phase === 'haul') finish('done'); else if (phase !== 'opening') showHaul(); });
    root._back = () => { const sh = q('.gp-sheet .gp-cancel'); if (sh) sh.click(); else q('.gp-x')?.click(); return !bare; }; /* Escape and Android Back: the share chooser first, then the pack; false = nothing to close here (the opener) */
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') root._back(); if (bare && (e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); autoTear(); } });
    // ---- open: the cards rise out of the mouth, the pack falls away ----
    const flash = () => { const f = q('.gp-flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); };
    /* The cards are built and their pictures decoded while the sealed pack is on screen, not when it tears (2026-11-07,
       Sevaan: "seeing the card face image change because the new one loaded"; building 7 full cards at the tear also
       cost frames). open() waits for them, at most a moment. */
    /* the cards are the reveal's size, a little wider than the pack: they rise out of its mouth at the pack's width, then grow as they land */
    const riseK = () => { const pw = pk.getBoundingClientRect().width, dw = q('.gp-deck').getBoundingClientRect().width / (parseFloat(q('.gp-deck').style.transform.match(/scale\(([\d.]+)/)?.[1]) || 1); return Math.min(.96, pw && dw ? (pw * .9) / dw : .96); };
    const dcs = o.highlights.map((h, i) => { try { return makeDc(h, i); } catch { return null; } }).filter(Boolean); /* a card that can't be drawn is left out, never a pack that can't open */
    if (o.tail?.card) { const t = makeDc({ card: o.tail.card, sightings: [], tags: o.tail.tags ?? [] }, dcs.length); t._tail = o.tail; t._rare = false; dcs.push(t); } /* the morning pack's last card: tonight's (2026-11-11) */
    /* in the page from the start, invisible behind the sealed pack: laying out 7 full cards at the tear cost a ~200 ms frame */
    { const deck = q('.gp-deck'); deck.style.opacity = '0.01'; /* not 0: barely there behind the sealed pack, so the phone draws its layer now, not in the first frame of the fly-out (2026-11-10, Sevaan: janky) */ deck.style.transform = `translateY(12%) scale(${riseK() * .98})`; dcs.slice().reverse().forEach((d) => deck.appendChild(d));
      /* the cards' real height in card ems, so css/gift.css centres and sizes them like the catch reveal (2026-11-13) */
      const em = dcs[0] && deck.offsetWidth ? dcs[0].offsetHeight / (deck.offsetWidth / 28) : 0; if (em > 30 && em < 60) root.style.setProperty('--dch', Math.max(39.2, em).toFixed(2)); }
    const pics = [...new Set([...dcs.flatMap((d) => [...d.querySelectorAll('img')].map((im) => im.src)), ...dcs.map((d) => (/url\(['"]?([^'")]+)/.exec(d.querySelector('.gp-bk')?.style.backgroundImage ?? '') || [])[1]), ...o.tiles.slice(0, 60).map((x) => o.artImage(x.card))].filter(Boolean))];
    const ready = Promise.all(pics.map((src) => { const im = new Image(); im.decoding = 'async'; im.src = src; return im.decode().catch(() => {}); }));
    async function open() {
      if (phase !== 'sealed' || closed) return; phase = 'opening'; /* closed: ✕ during the automatic tear must not save the cards */
      let ok = true, why = ''; try { const r = await Promise.race([Promise.resolve(o.onOpen?.()), W(12000).then(() => 'That took too long. Try again.')]); if (typeof r === 'string') { ok = false; why = r; } else ok = r !== false; } catch { ok = false; }
      if (!ok) { phase = 'sealed'; showProg(0); pk.classList.add('idle'); /* saving failed: say why here (a notice would be hidden under the pack); the link still works */
        if (why) { let m = q('.gp-sharemsg'); if (!m) { m = document.createElement('div'); m.className = 'gp-sharemsg'; m.setAttribute('role', 'status'); root.appendChild(m); } m.textContent = why; m.classList.add('in', 'bad'); setTimeout(() => m.classList.remove('in'), 5000); }
        return; }
      await animateProg(prog, 1, 160);
      sfx('swipe', 1.1); feel('heavy');
      cap.classList.add('fly'); pk.classList.add('opened'); /* the back and sides go with the top: a card rising out of the mouth showed the dark back face as a black box (2026-11-12, Sevaan) */ q('.gp-tear').style.opacity = '0';
      main.style.setProperty('--tear', jag.map(([x, y]) => `${x}% ${((y - 6) * 0.9).toFixed(2)}px`).join(', ')); main.classList.add('torn');
      q('.gp-hint')?.classList.add('gone'); q('.gp-head')?.classList.add('gone'); flash();
      const b = q('.gp-burst'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); sparks();
      if (bare) { /* the welcome card rises out of the mouth from behind the pack (it lives in the page under this layer, whose backdrop fades now), then the pack falls away */
        root.classList.add('clear');
        try { await o.emerge?.(pk.getBoundingClientRect(), () => pk.classList.add('drop')); } catch {}
        pk.classList.add('drop'); await W(300); finish('done'); return; }
      await Promise.race([ready, W(900)]); /* the pictures are ready (usually long since) */
      const deck = q('.gp-deck'); deck.style.transition = 'none';
      /* The cards wait behind the pack, their bottom only a few px above its crimped bottom edge: shown at full strength
         here, the bottom of the first card peeked out under the pack for a moment, through the crimp and below the pack
         as it leant under the finger (2026-11-18, Sevaan on his iPhone: "I can see the bottom of the card at the bottom of
         the pack for a split second"). Hide anything lower than the pack's printed area until the pack falls away. */
      { const pr = (q('.gp-tilt') ?? pk).getBoundingClientRect(), dr = deck.getBoundingClientRect(), k = deck.offsetHeight ? dr.height / deck.offsetHeight : 1;
        const cut = Math.max(0, dr.bottom - (pr.bottom - pr.height * 0.14)) / (k || 1);
        if (cut > 0) deck.style.clipPath = `inset(-60% -60% ${cut.toFixed(1)}px -60%)`; }
      deck.style.opacity = '1';
      await W(220); sfx('arrive', 0.9);
      if (reduced) { pk.classList.add('drop'); deck.style.clipPath = ''; deck.style.zIndex = '7'; deck.style.transition = 'none'; deck.style.transform = 'none'; /* full size, in place (it started small and low for the slide) */ await W(200); } /* reduced motion: no deck slide (review 2026-11-07) */
      else { deck.style.transition = 'transform .9s cubic-bezier(.2,.9,.25,1.02)'; deck.style.transform = `translateY(-58%) scale(${riseK()})`;
        await W(760); pk.classList.add('drop'); deck.style.clipPath = ''; deck.style.zIndex = '7'; deck.style.transform = 'translateY(0) scale(1)';
        await W(650); }
      phase = 'dealing'; deck.classList.add('live');
      if (dcs.length) deal(0); else showHaul();
    }
    function sparks() {
      const b = q('.gp-burst'), r = pk.getBoundingClientRect(), y0 = r.top + r.height * 0.14 - innerHeight / 2;
      for (let i = 0; i < 26 && !reduced; i++) { const s = document.createElement('i'); b.appendChild(s); const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, d = 120 + Math.random() * 220;
        s.animate([{ transform: `translate(${(Math.random() - 0.5) * r.width * 0.7}px, ${y0}px) scale(1)`, opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${y0 + Math.sin(a) * d}px) scale(.2)`, opacity: 0 }], { duration: 900 + Math.random() * 700, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }); }
    }
    function makeDc(h, i) {
      const d = document.createElement('div'); d.className = 'gp-dc';
      d.style.setProperty('--t', o.tierColor(h.card.tier) ?? '#fff');
      const bk = document.createElement('div'); bk.className = 'gp-bk'; try { o.applyBack?.(bk, h.card); } catch {}
      const fr = document.createElement('div'); fr.className = 'gp-fr';
      const card = o.renderCard(h.card, { sightings: h.sightings }); fr.appendChild(card);
      const fl = document.createElement('div'); fl.className = 'gp-flip'; fl.append(bk, fr); d.append(fl); d._fl = fl; d._card = card; d._h = h; d._rare = TIERS.indexOf(h.card.tier) >= 2;
      tap(d, () => d._tap?.());
      d.style.transform = `translateY(${i * -1.5}px) rotate(${((i * 37) % 5 - 2) * 0.5}deg)`; d.style.zIndex = String(100 - i);
      return d;
    }
    const tags = q('.gp-tags'), count2 = q('.gp-count2');
    function deal(i) {
      if (phase !== 'dealing' || closed) return; /* Skip or ✕ during a fly-away: the haul is up, don't bring the strip back (review 2026-11-07) */
      const d = dcs[i]; if (!d) { showHaul(); return; }
      count2.classList.remove('gone');
      count2.innerHTML = d._tail ? `<b>${esc(d._tail.label ?? 'Tonight')}</b><button type="button" data-skip>Skip ›</button>` : `<b>${i + 1}</b> of ${dcs.length - (o.tail?.card ? 1 : 0)} highlights${o.count > dcs.length - (o.tail?.card ? 1 : 0) ? ` · ${o.count} in all` : ''}<button type="button" data-skip>Skip ›</button>`;
      tap(count2.querySelector('[data-skip]'), () => showHaul());
      tags.innerHTML = '';
      if (d._rare) {
        d.classList.add('aura', 'shake'); sfx('lock', 0.7);
        const t = d._h.card.tier; tags.style.setProperty('--t', o.tierColor(t));
        tags.innerHTML = `<span class="tease">${t === 'legendary' ? 'Something legendary' : t === 'epic' ? 'Something epic' : 'Something rare'} · tap to turn</span>`;
        d._tap = () => flip(d, i);
        /* Epic and Legendary: two slow double heartbeats while it waits, like the reveal */
        d._beats = heartbeats(t, (strong) => d._fl.animate([{ transform: 'scale(1)' }, { transform: `scale(${strong ? 1.06 : 1.035})`, offset: .2 }, { transform: 'scale(1)' }], { duration: 360, easing: 'ease-out', composite: 'add' }), () => !d.classList.contains('face') && !d._busy && !closed && phase === 'dealing', { haptic: false }); /* scale only: a brightness filter repainted the whole card every frame */
      } else setTimeout(() => flip(d, i), reduced ? 0 : 160);
    }
    async function flip(d, i) {
      if (d._busy || d.classList.contains('face') || phase !== 'dealing' || closed) return; d._busy = true; d._tap = null;
      d.classList.remove('shake'); /* the glow stays through the held breath, like the reveal */
      const fl = d._fl; d._beats?.();
      await flipCard(fl, { tier: d._h.card.tier, faces: [fl.firstElementChild, fl.lastElementChild], perspective: '1600px', settle: true, alive: () => !closed && phase === 'dealing', onTurn: () => d.classList.remove('aura'), showFace: (f) => d.classList.toggle('face', f) });
      if (phase !== 'dealing' || closed) return; /* Skip or ✕ mid-turn: no sounds, tags or buttons over the summary (the deep review, 2026-11-12) */
      d.classList.add('face', 'settled'); /* settled: the front's 180° and the flipper's 180° become none, no visible change */
      const tier = d._h.card.tier;
      if (d._tail) payoffSound(tier, { fresh: false }); else payoffSound(TIERS.includes(tier) ? tier : 'common', { gain: tier === 'legendary' || tier === 'epic' ? 1.3 : 1 });
      if (d._h.tags.some(([k]) => k === 'shiny')) setTimeout(() => sfx('shiny', 1), 380);
      if (d._h.tags.some(([, t]) => /^Now /.test(t))) setTimeout(() => sfx('levelup', 0.9), 380);
      if (!d._tail && (tier === 'legendary' || tier === 'epic')) flash();
      /* no buzz and no pulse after a flip (2026-11-11, Sevaan): the card just lands */
      tags.innerHTML = d._h.tags.map(([k, t]) => `<span class="${k}">${esc(t)}</span>`).join('');
      if (d._tail?.button) { /* under the card: tonight's one action (a reminder) */
        const b = document.createElement('button'); b.type = 'button'; b.className = 'gp-tailbtn'; b.textContent = d._tail.button.label; root.appendChild(b); d._btn = b;
        tap(b, async () => { if (b.disabled) return; b.disabled = true; let r = null; try { r = await d._tail.button.fn(); } catch {} if (r) { b.textContent = r; b.classList.add('done'); } else b.disabled = false; }); }
      try { o.attachTilt?.(d._card); } catch {}
      if (d._tail?.stays) { d._busy = false; try { d._tail.onLand?.(d); } catch {} return; } /* a last card that stays (the sample pack page, 2026-11-18; Space Collector 5585f2e5): never armed to be put away; the page takes it as it lands (a tap 200-380 ms after it settled could throw it away before the page claimed it) */
      await W(200); d._busy = false;
      /* a tap is the browser's own click (iOS doesn't always send pointer events for a quick tap: iPhone 14 simulator
         2026-11-07); a flick is pointer movement */
      let sx = 0, sy = 0, down = false; /* down: a press from before the card landed doesn't count as a flick */
      d._tap = () => away(d, i);
      d.onpointerdown = (e) => { sx = e.clientX; sy = e.clientY; down = true; };
      d.onpointerup = (e) => { if (!down) return; down = false; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) > 40) away(d, i, dx, dy); };
    }
    async function away(d, i, dx = -1, dy = 0) {
      if (d._gone) return; d._gone = true; d._btn?.remove(); d.onpointerdown = d.onpointerup = null; d._tap = null; sfx('swipe', 0.6);
      const dir = Math.abs(dx) > 20 ? Math.sign(dx) : -1;
      d.style.transition = reduced ? 'opacity .15s' : 'transform .5s cubic-bezier(.4,0,.6,1), opacity .5s'; if (!reduced) d.style.transform = `translate(${dir * 130}vw, ${dy < -40 ? -40 : -8}vh) rotate(${dir * 24}deg)`; d.style.opacity = '0';
      tags.innerHTML = ''; setTimeout(() => d.remove(), 520);
      if (i + 1 < dcs.length) { await W(140); deal(i + 1); } else { await W(260); showHaul(); }
    }
    // ---- all of them ----
    function chooser(done) {
      if (q('.gp-sheet')) return;
      const sum = q('.gp-sum'), sheet = document.createElement('div'); sheet.className = 'gp-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', o.share.label);
      sheet.innerHTML = `<div class="gp-sheet-card"><div class="k">${esc(o.share.label)}</div><div class="gp-opts">
        <button type="button" class="gp-opt" data-o="pic"><span class="gp-opt-vis gp-opt-pic"></span><b>A picture</b><small>To post or text</small></button>
        <button type="button" class="gp-opt" data-o="pack"><span class="gp-opt-vis v-opt-pack"><span class="sv-pk" aria-hidden="true"><span class="sv-bag"><span class="sv-pk-base"></span><span class="sv-pk-art"></span><span class="sv-pk-lines"></span><span class="sv-pk-pillow"></span><span class="sv-pk-pinch"></span><span class="sv-pk-crimp t"></span><span class="sv-pk-crimp b"></span><span class="sv-pk-seam"></span><span class="sv-pk-sheen"></span><span class="sv-pk-edges"></span></span></span></span><b>Send the cards</b><small>They get a copy too</small></button></div>
        <button type="button" class="gp-cancel">Cancel</button></div>`;
      if (sum) { const vis = sheet.querySelector('.gp-opt-pic'), c = sum.cloneNode(true); c.removeAttribute('style'); c.classList.add('gp-sum-mini'); c.style.setProperty('--k', String(Math.min(1, 92 / (sum.offsetHeight || 460)))); c.style.width = `${sum.offsetWidth}px`; c.style.height = `${sum.offsetHeight}px`; const wrap = document.createElement('div'); wrap.className = 'gp-haul gp-haul-mini'; wrap.appendChild(c); vis.appendChild(wrap); } /* inside a .gp-haul so the card keeps its styles */
      root.appendChild(sheet); requestAnimationFrame(() => sheet.classList.add('in'));
      const close = () => { sheet.classList.remove('in'); setTimeout(() => sheet.remove(), 220); };
      tap(sheet.querySelector('.gp-cancel'), close);
      sheet.addEventListener('pointerdown', (e) => { if (e.target === sheet) close(); });
      for (const b of sheet.querySelectorAll('.gp-opt')) tap(b, () => { close(); done(b.dataset.o); });
    }
    const statsHtml = (list) => (list ?? []).map(([v, l]) => `<div><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('');
    /* flick the summary card up or down to put the pack away (2026-11-11, Sevaan: "swipe the screen away like other screens");
       on the scrolling grid only once it can't scroll that way */
    function swipeAway(card, grid) {
      let y0 = 0, x0 = 0, t0 = 0, dy = 0, on = false, id = null;
      card.addEventListener('pointerdown', (e) => { if (e.button > 0 || e.target.closest('button')) return; y0 = e.clientY; x0 = e.clientX; t0 = performance.now(); dy = 0; on = false; id = e.pointerId; });
      card.addEventListener('pointermove', (e) => { if (id !== e.pointerId) return; const d = e.clientY - y0;
        if (!on) { if (Math.abs(d) < 8 || Math.abs(e.clientX - x0) > Math.abs(d)) return; const inGrid = grid.contains(e.target) && /auto|scroll/.test(getComputedStyle(grid).overflowY) /* the fan of cards isn't a scroller: its tilted cards overflow by a few px, which cancelled every upward swipe that began on it (playtest 2026-11-12) */, canUp = grid.scrollTop + grid.clientHeight < grid.scrollHeight - 2, canDown = grid.scrollTop > 2; if (inGrid && ((d < 0 && canUp) || (d > 0 && canDown))) { id = null; return; } on = true; card.setPointerCapture?.(e.pointerId); card.style.transition = 'none'; }
        dy = d; card.style.transform = `translateY(${dy}px) rotate(${dy / 60}deg)`; card.style.opacity = String(Math.max(.4, 1 - Math.abs(dy) / 600)); });
      const end = (e) => { if (id !== e.pointerId) return; id = null; if (!on) return; on = false; const v = dy / Math.max(1, performance.now() - t0);
        if (Math.abs(dy) > 120 || Math.abs(v) > .6) { sfx('swipe', 0.6); card.style.transition = 'transform .32s cubic-bezier(.4,0,.6,1), opacity .32s'; card.style.transform = `translateY(${Math.sign(dy) * innerHeight}px) rotate(${Math.sign(dy) * 8}deg)`; card.style.opacity = '0'; setTimeout(() => finish('done'), 220); }
        else { card.style.transition = 'transform .35s cubic-bezier(.2,.9,.3,1.2), opacity .2s'; card.style.transform = ''; card.style.opacity = ''; } };
      card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
    }
    function showHaul() {
      if (phase === 'haul' || closed) return; phase = 'haul'; dcs.forEach((d) => { try { d._beats?.(); } catch {} });
      q('.gp-deck').innerHTML = ''; tags.innerHTML = ''; root.querySelectorAll('.gp-tailbtn').forEach((b) => b.remove()); count2.classList.add('gone'); q('.gp-pk').classList.add('drop');
      const el = document.createElement('div'); el.className = 'gp-haul';
      const upd = o.count - o.newCount;
      /* Design A (2026-11-11, design/pack-summary.html): the summary is the night's own card, in the card's double frame, with
         the buttons at the bottom in thumb reach; flick it up or down to put it away, like the card viewer. */
      el.innerHTML = `<div class="gp-sum" role="group" aria-label="${esc(from)}"><div class="gp-sbar"><span>${esc(from)}</span><span>${esc(o.dateLabel ?? '')}</span></div>
        <h2>${o.count} card${o.count === 1 ? '' : 's'}</h2><p>${o.subHtml ?? `${o.newCount ? `<b>${o.newCount} new</b> to you` : 'None new to you'}${upd ? ` · <b>${upd}</b> you have, with more` : ''}`}</p>
        <div class="gp-fan"></div><div class="gp-stats"${o.stats?.length ? '' : ' hidden'}>${statsHtml(o.stats)}</div><div class="gp-patches" hidden></div>
        <div class="gp-sfoot"><span>${esc(o.footLeft ?? '')}</span><span>Sky Collector</span></div></div>
        <div class="gp-btns">${o.rowHtml ? `<button class="gp-row" type="button">${o.rowHtml}</button>` : ''}<button class="go" type="button">${esc(o.goLabel ?? 'See them in your collection')}</button><button class="later" type="button">${esc(o.laterLabel ?? 'Done')}</button></div>`;
      root.appendChild(el); sfx('complete', 0.9);
      /* The night's best five as a fan in the middle (2026-11-11, Sevaan), best in front and centre, "+N more" under it when
         there were more; 1 to 5 cards all fan evenly. o.tiles comes rarest first. */
      const g = el.querySelector('.gp-fan'), best = o.tiles.slice(0, 5), extra = o.tiles.length - best.length;
      const slots = best.map((x, k) => ({ x, k })), order = []; /* best in the middle, the rest out to either side */
      for (const sl of slots) { if (sl.k === 0) order.push(sl); else if (sl.k % 2) order.unshift(sl); else order.push(sl); }
      const n = order.length, mid = (n - 1) / 2;
      /* mini cards, like the Collection (2026-11-11, Sevaan); the footer says New card */
      const make = (x) => { const t = document.createElement('div'); t.className = 't mini'; t.style.setProperty('--c', o.tierColor(x.card.tier) ?? '#556'); try { t.appendChild(o.mini(x.card, x.isNew ? 'New card' : '', x.sightings)); } catch { const a = o.artImage(x.card); if (a) t.style.backgroundImage = `url('${a}')`; } return t; };
      const cards = order.map(({ x, k }, i) => { const t = make(x), off = i - mid; t.dataset.off = String(off); t.style.zIndex = String(10 - k); g.appendChild(t); return t; });
      if (extra > 0) { const m = document.createElement('div'); m.className = 'gp-more'; m.textContent = `+${extra.toLocaleString('en-US')} more`; g.appendChild(m); }
      const layoutFan = (animate) => { const W = g.clientWidth, H = g.clientHeight - (extra > 0 ? 34 : 0); if (!W || !H) return;
        const step = n > 1 ? Math.min(.42, 1.5 / (n - 1)) : 0, tilt = n > 1 ? .32 : 0, w = Math.min((W - 8) / (1 + tilt + step * (n - 1)), (H * .86) / 1.5, 210); /* mini cards are 2:3 */ /* as big as the space allows, the outer cards' tilt included */
        g.style.setProperty('--fw', `${w.toFixed(1)}px`);
        cards.forEach((t, i) => { const off = Number(t.dataset.off), x = off * step * w, y = Math.abs(off) * w * .06, r = off * (n > 3 ? 8 : 9);
          const to = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r}deg)`;
          t.style.transform = to;
          if (animate && !reduced) t.animate([{ transform: 'translate(-50%, -50%) translateY(18px) rotate(0deg) scale(.92)', opacity: 0 }, { transform: to, opacity: 1 }], { duration: 460, delay: 60 + i * 50, easing: 'cubic-bezier(.2,.9,.3,1.15)', fill: 'backwards' }); });
        { const w0 = cards[0]?.offsetWidth; if (w0) g.style.setProperty('--mini-s', (w0 / 280).toFixed(4)); } };
      layoutFan(true); new ResizeObserver(() => layoutFan(false)).observe(g);
      swipeAway(el.querySelector('.gp-sum'), g);
      Promise.resolve(o.summary?.()).then((res) => { if (!res || typeof res === 'string') return;
        const st = el.querySelector('.gp-stats'); if (res.stats?.length) { st.innerHTML = statsHtml(res.stats); st.hidden = false; st.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }); }
        const pr = el.querySelector('.gp-patches'); if (res.patches?.length) { pr.innerHTML = res.patches.map((pt) => `<span class="gp-patch" title="${esc(pt.name)}">${pt.html}<small>${esc(pt.name)}</small></span>`).join('') + (res.more ? `<span class="gp-patch more">+${res.more}</span>` : ''); pr.hidden = false; pr.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'ease-out' }); }
      }).catch(() => {});
      tap(el.querySelector('.go'), () => finish('collection'));
      tap(el.querySelector('.later'), () => finish('done'));
      const say = (text, bad) => { if (!text) return; let m = q('.gp-sharemsg'); if (!m) { m = document.createElement('div'); m.className = 'gp-sharemsg'; root.appendChild(m); } m.textContent = text; m.classList.toggle('bad', !!bad); m.classList.remove('in'); void m.offsetWidth; m.classList.add('in'); clearTimeout(m._t); m._t = setTimeout(() => m.classList.remove('in'), 2200); };
      { const sh = q('.gp-share'); if (sh) { sh.hidden = false; if (!sh._wired) { sh._wired = true; const run = async (fn) => { if (sh.disabled) return; sh.disabled = true; sh.classList.add('busy'); let r = null; try { r = await fn(); } catch { r = { ok: false, text: 'Couldn’t share. Try again.' }; } sh.disabled = false; sh.classList.remove('busy'); if (r) { sh.classList.toggle('done', !!r.ok); say(r.text, !r.ok); setTimeout(() => sh.classList.remove('done'), 1800); } };
          /* a picture of this card or the cards themselves, the card viewer's chooser (2026-11-11, Sevaan) */
          tap(sh, () => { if (sh.disabled) return; if (o.share.picture) chooser((pick) => run(pick === 'pic' ? () => o.share.picture(el.querySelector('.gp-sum')) : o.share.fn)); else run(o.share.fn); });  /* r: { ok, text } (null: cancelled) */ } } } /* share what's in the pack, from the top like the card viewer (2026-11-11, Sevaan) */
      { const rw = el.querySelector('.gp-row'); if (rw) tap(rw, () => finish('row')); }
    }
    // a link that only adds sightings to cards already here, or one opened after reduced motion: still the pack
    root.tabIndex = -1; root.focus({ preventScroll: true });
  });
}

// A short message in the pack's place (a link cut short, a newer version, two phones on one iCloud).
export function packMessage({ title, text, button = 'OK' }) {
  return new Promise((resolve) => {
    const root = document.createElement('div'); root.id = 'gift'; root.className = 'in';
    root.innerHTML = `<div class="gp-msg"><h2>${esc(title)}</h2><p>${esc(text)}</p><button type="button">${esc(button)}</button></div>`;
    document.body.appendChild(root);
    tap(root.querySelector('button'), () => { root.classList.add('out'); setTimeout(() => root.remove(), 300); resolve(); });
  });
}
