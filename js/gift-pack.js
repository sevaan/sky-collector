// The gift pack (2026-11-07, design/booster-pack.html, gold on navy): received cards arrive sealed. Tear the top to open
// it; the cards rise out, the good ones face down and glowing, dealt from the least to the best; then all of them in a
// grid. Styles in css/gift.css (#gift). playPack resolves 'collection' | 'done' | 'later' (closed before opening).
// opts: { from, count, newCount, highlights: [{ card, sightings, tags }], tiles: [{ card, isNew }], summary (async: the XP line), onOpen,
//         renderCard, attachTilt, artImage, applyBack, sfx, feel, tierColor }
const wait = (ms, reduced) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 120) : ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
// The same turn as the capture reveal (js/reveal.js FX; 2026-11-07, Sevaan: "doesn't feel the same"): slower the rarer,
// a lift at edge-on, Epic spins a full extra turn, Rare and up hold their breath first.
const FLIP = { common: { ms: 520, spin: 0, hold: 0 }, uncommon: { ms: 560, spin: 0, hold: 0 }, rare: { ms: 650, spin: 0, hold: 300 }, epic: { ms: 800, spin: 360, hold: 600 }, legendary: { ms: 1100, spin: 0, hold: 1100 } };
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
    const sfx = (n, v) => { try { o.sfx?.(n, { gain: v }); } catch {} }, feel = (k) => { try { o.feel?.(k); } catch {} };
    const best = o.highlights.at(-1)?.card;
    const root = document.createElement('div'); root.id = 'gift'; root.className = 'in'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', `Cards from ${o.from || 'a friend'}`);
    root.style.setProperty('--fx', o.tierColor(best?.tier) ?? '#ffc93d');
    const from = o.from ? `From ${o.from}` : 'Cards for you';
    const skin = () => `<div class="gp-base"></div><div class="gp-art"></div><div class="gp-lines"></div><div class="gp-glow"></div>
      <div class="gp-count"><b>${o.count}</b><span>card${o.count === 1 ? '' : 's'}</span></div>
      ${o.from ? `<div class="gp-ribbon"><small>From</small>${esc(o.from)}</div>` : ''}${o.newCount ? `<div class="gp-newb">${o.newCount} new</div>` : ''}
      <div class="gp-crimp"></div><div class="gp-crimp b"></div><div class="gp-seam"></div><div class="gp-shade"></div><div class="gp-sheen"></div>`;
    root.innerHTML = `<div class="gp-stars"></div>
      <div class="gp-head"><div class="k">Cards for you</div><h1>${esc(o.from ? `From ${o.from}` : 'A pack of cards')}</h1><p>${esc(o.dates ?? '')}</p></div>
      <button class="gp-x" type="button" aria-label="Close">✕</button>
      <div class="gp-flash"></div><div class="gp-burst"><div class="gp-rays"></div></div><div class="gp-deck"></div>
      <div class="gp-pk idle"><div class="gp-leak"></div><div class="gp-tilt"><div class="gp-shadow"></div>
        <div class="gp-piece gp-main"><div class="gp-skin">${skin()}</div></div>
        <div class="gp-piece gp-cap"><div class="gp-skin">${skin()}</div></div>
        <svg class="gp-tear" viewBox="0 0 100 12" preserveAspectRatio="none"><path d=""/></svg><div class="gp-cue"></div></div></div>
      <div class="gp-tags"></div>
      <div class="gp-hint"><b>Swipe across the top</b> to open<span class="sub">${o.count} card${o.count === 1 ? '' : 's'}${o.newCount ? ` · ${o.newCount} new to you` : ''}</span><button type="button" data-a="open">Tap to open</button></div>
      <div class="gp-count2 gone"></div>`;
    document.body.appendChild(root);
    const q = (s) => root.querySelector(s), pk = q('.gp-pk'), cap = q('.gp-cap'), main = q('.gp-main'), tearPath = q('.gp-tear path');
    { const s = q('.gp-stars'); for (let i = 0; i < 80; i++) { const e = document.createElement('i'); e.style.left = `${Math.random() * 100}%`; e.style.top = `${Math.random() * 100}%`; e.style.animationDelay = `${-Math.random() * 3}s`; s.appendChild(e); } }
    let phase = 'sealed', tearing = false, prog = 0, lastMove = 0, closed = false;
    const finish = (how) => { if (closed) return; closed = true; root.classList.remove('in'); root.classList.add('out'); setTimeout(() => root.remove(), 300); removeEventListener('deviceorientation', orient); clearInterval(rattleT); resolve(how); };
    // ---- tilt: finger, phone, or a slow idle sway ----
    /* Every frame moves only transforms and opacity (2026-11-07 jank pass: changing CSS variables on the pack repainted
       the masked gold foil, its shadow and blend layers each frame: ~100 ms frames in WebKit). */
    const tiltEl = q('.gp-tilt'), sheens = [...root.querySelectorAll('.gp-sheen')], glows = [...root.querySelectorAll('.gp-glow')], leak = q('.gp-leak');
    const setTilt = (x, y) => { tiltEl.style.transform = `rotateX(${(-(y - 50) / 50 * 9).toFixed(2)}deg) rotateY(${((x - 50) / 50 * 12).toFixed(2)}deg)`;
      const sx = `translate3d(${((50 - x) * 0.9).toFixed(1)}%, 0, 0)`, gx = `translate3d(${((x - 50) * 0.6).toFixed(1)}%, ${((y - 40) * 0.5).toFixed(1)}%, 0)`;
      for (const e of sheens) e.style.transform = sx; for (const e of glows) e.style.transform = gx; };
    setTilt(50, 40);
    root.addEventListener('pointermove', (e) => { lastMove = performance.now(); if (phase === 'sealed' && !tearing) setTilt(e.clientX / innerWidth * 100, e.clientY / innerHeight * 100); });
    const orient = (e) => { if (phase !== 'sealed' || tearing || e.gamma == null) return; lastMove = performance.now(); setTilt(50 + Math.max(-1, Math.min(1, e.gamma / 30)) * 50, 50 + Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * 50); };
    addEventListener('deviceorientation', orient);
    (function idle(t) { if (closed) return; if (phase === 'sealed' && !tearing && performance.now() - lastMove > 1500 && !reduced) setTilt(50 + Math.sin(t / 1400) * 22, 42 + Math.cos(t / 1900) * 12); requestAnimationFrame(idle); })(0);
    const rattle = () => { pk.classList.remove('rattle'); void pk.offsetWidth; pk.classList.add('rattle'); sfx('rattle', 0.7); };
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
    let tick = 0;
    pk.addEventListener('pointerdown', (e) => {
      if (phase !== 'sealed') return;
      const r = pk.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
      if (y > 0.34) { rattle(); feel('select'); return; }
      tearing = true; pk.classList.remove('idle'); pk.setPointerCapture?.(e.pointerId); sfx('step', 0.6);
      const move = (ev) => { const p = Math.max(prog, Math.min(1, (ev.clientX - r.left) / r.width)); if (p - tick > 0.08) { tick = p; sfx('page', 0.4); feel('select'); } showProg(p); };
      const up = () => { pk.removeEventListener('pointermove', move); pk.removeEventListener('pointerup', up); pk.removeEventListener('pointercancel', up); tearing = false; tick = 0;
        if (prog > 0.55) open(); else animateProg(prog, 0, 220).then(() => { if (phase === 'sealed') pk.classList.add('idle'); }); };
      pk.addEventListener('pointermove', move); pk.addEventListener('pointerup', up); pk.addEventListener('pointercancel', up);
    });
    tap(q('[data-a="open"]'), () => { if (phase === 'sealed') { pk.classList.remove('idle'); animateProg(0, 1, 520).then(open); } });
    tap(q('.gp-x'), () => { if (phase === 'sealed') finish('later'); else if (phase !== 'opening') showHaul(); });
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') q('.gp-x').click(); });
    // ---- open: the cards rise out of the mouth, the pack falls away ----
    const flash = () => { const f = q('.gp-flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); };
    /* The cards are built and their pictures decoded while the sealed pack is on screen, not when it tears (2026-11-07,
       Sevaan: "seeing the card face image change because the new one loaded"; building 7 full cards at the tear also
       cost frames). open() waits for them, at most a moment. */
    const dcs = o.highlights.map(makeDc);
    /* in the page from the start, invisible behind the sealed pack: laying out 7 full cards at the tear cost a ~200 ms frame */
    { const deck = q('.gp-deck'); deck.style.opacity = '0'; deck.style.transform = 'translateY(12%) scale(.94)'; dcs.slice().reverse().forEach((d) => deck.appendChild(d)); }
    const pics = [...new Set([...dcs.flatMap((d) => [...d.querySelectorAll('img')].map((im) => im.src)), ...dcs.map((d) => (/url\(['"]?([^'")]+)/.exec(d.querySelector('.gp-bk')?.style.backgroundImage ?? '') || [])[1]), ...o.tiles.slice(0, 60).map((x) => o.artImage(x.card))].filter(Boolean))];
    const ready = Promise.all(pics.map((src) => { const im = new Image(); im.decoding = 'async'; im.src = src; return im.decode().catch(() => {}); }));
    async function open() {
      if (phase !== 'sealed') return; phase = 'opening';
      let ok = true; try { ok = (await o.onOpen?.()) !== false; } catch { ok = false; }
      if (!ok) { phase = 'sealed'; showProg(0); pk.classList.add('idle'); return; } // saving failed: the caller said why; the link still works
      await animateProg(prog, 1, 160);
      sfx('swipe', 1.1); feel('heavy');
      cap.classList.add('fly'); q('.gp-tear').style.opacity = '0';
      main.style.setProperty('--tear', jag.map(([x, y]) => `${x}% ${((y - 6) * 0.9).toFixed(2)}px`).join(', ')); main.classList.add('torn');
      q('.gp-hint').classList.add('gone'); q('.gp-head').classList.add('gone'); flash();
      const b = q('.gp-burst'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); sparks();
      await Promise.race([ready, W(900)]); /* the pictures are ready (usually long since) */
      const deck = q('.gp-deck'); deck.style.transition = 'none'; deck.style.opacity = '1';
      await W(220); sfx('arrive', 0.9);
      if (reduced) { pk.classList.add('drop'); deck.style.zIndex = '7'; await W(200); } /* reduced motion: no deck slide (review 2026-11-07) */
      else { deck.style.transition = 'transform .9s cubic-bezier(.2,.9,.25,1.02)'; deck.style.transform = 'translateY(-58%) scale(.96)';
        await W(760); pk.classList.add('drop'); deck.style.zIndex = '7'; deck.style.transform = 'translateY(0) scale(1)';
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
      count2.innerHTML = `<b>${i + 1}</b> of ${dcs.length} highlights${o.count > dcs.length ? ` · ${o.count} in all` : ''}<button type="button" data-skip>Skip ›</button>`;
      tap(count2.querySelector('[data-skip]'), () => showHaul());
      tags.innerHTML = '';
      if (d._rare) {
        d.classList.add('aura', 'shake'); sfx('lock', 0.7); feel('medium');
        const t = d._h.card.tier; tags.style.setProperty('--t', o.tierColor(t));
        tags.innerHTML = `<span class="tease">${t === 'legendary' ? 'Something legendary' : t === 'epic' ? 'Something epic' : 'Something rare'} · tap to turn</span>`;
        d._tap = () => flip(d, i);
        /* Epic and Legendary: two slow double heartbeats while it waits, like the reveal */
        if (!reduced && ['epic', 'legendary'].includes(t)) for (const [ms, strong] of [[220, false], [430, true], [1080, false], [1290, true]]) setTimeout(() => { if (d.classList.contains('face') || d._busy || closed) return; try { o.heartbeat?.(strong); } catch {} dispatchEvent(new CustomEvent('sc:heartbeat', { detail: { strong } }));
          d._fl.animate([{ transform: 'scale(1)', filter: 'none' }, { transform: `scale(${strong ? 1.05 : 1.03})`, filter: strong ? 'brightness(1.25)' : 'brightness(1.12)', offset: .2 }, { transform: 'scale(1)', filter: 'none' }], { duration: 360, easing: 'ease-out' }); }, ms);
      } else setTimeout(() => flip(d, i), reduced ? 0 : 160);
    }
    async function flip(d, i) {
      if (d._busy || d.classList.contains('face') || phase !== 'dealing' || closed) return; d._busy = true; d._tap = null;
      d.classList.remove('shake'); /* the glow stays through the held breath, like the reveal */
      const fx = FLIP[d._h.card.tier] ?? FLIP.common, fl = d._fl;
      if (fx.hold && !reduced) await fl.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-1.5deg)' }, { transform: 'rotate(1.5deg)' }, { transform: 'rotate(0)' }], { duration: fx.hold, easing: 'ease-in-out' }).finished.catch(() => {});
      d.classList.remove('aura'); sfx('flip', 0.8);
      const ms = reduced ? 1 : fx.ms, end = 180 + fx.spin;
      const a = fl.animate([
        { transform: 'perspective(1600px) rotateY(0) scale(1)', easing: 'cubic-bezier(.5,0,1,1)' },
        { transform: `perspective(1600px) rotateY(${90 + fx.spin / 2}deg) scale(1.12)`, offset: .5, easing: 'cubic-bezier(0,0,.4,1)' },
        { transform: `perspective(1600px) rotateY(${end}deg) scale(1)` }], { duration: ms, easing: 'linear', fill: 'forwards' });
      /* each frame shows whichever face is toward you, read from the actual angle (the front sits turned 180° inside) */
      let turning = true; const tick = () => { if (!turning || a.playState !== 'running') return; const m = new DOMMatrix(getComputedStyle(fl).transform); d.classList.toggle('face', m.m11 < 0); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      await a.finished.catch(() => {}); turning = false;
      d.classList.add('face', 'settled'); a.cancel(); /* settled: the front's 180° and the flipper's 180° become none, no visible change */
      const tier = d._h.card.tier;
      sfx(`r_${TIERS.includes(tier) ? tier === 'legendary' ? 'legend' : tier : 'common'}`, tier === 'legendary' || tier === 'epic' ? 1.3 : 1);
      feel(tier === 'legendary' || tier === 'epic' ? 'success' : 'medium');
      if (d._h.tags.some(([k]) => k === 'shiny')) setTimeout(() => sfx('shiny', 1), 380);
      if (d._h.tags.some(([, t]) => /^Now /.test(t))) setTimeout(() => sfx('levelup', 0.9), 380);
      if (tier === 'legendary' || tier === 'epic') flash();
      fl.animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
      tags.innerHTML = d._h.tags.map(([k, t]) => `<span class="${k}">${esc(t)}</span>`).join('');
      try { o.attachTilt?.(d._card); } catch {}
      await W(200); d._busy = false;
      /* a tap is the browser's own click (iOS doesn't always send pointer events for a quick tap: iPhone 14 simulator
         2026-11-07); a flick is pointer movement */
      let sx = 0, sy = 0;
      d._tap = () => away(d, i);
      d.onpointerdown = (e) => { sx = e.clientX; sy = e.clientY; };
      d.onpointerup = (e) => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) > 40) away(d, i, dx, dy); };
    }
    async function away(d, i, dx = -1, dy = 0) {
      if (d._gone) return; d._gone = true; d.onpointerdown = d.onpointerup = null; d._tap = null; sfx('swipe', 0.6);
      const dir = Math.abs(dx) > 20 ? Math.sign(dx) : -1;
      d.style.transition = reduced ? 'opacity .15s' : 'transform .5s cubic-bezier(.4,0,.6,1), opacity .5s'; if (!reduced) d.style.transform = `translate(${dir * 130}vw, ${dy < -40 ? -40 : -8}vh) rotate(${dir * 24}deg)`; d.style.opacity = '0';
      tags.innerHTML = ''; setTimeout(() => d.remove(), 520);
      if (i + 1 < dcs.length) { await W(140); deal(i + 1); } else { await W(260); showHaul(); }
    }
    // ---- all of them ----
    function showHaul() {
      if (phase === 'haul') return; phase = 'haul';
      q('.gp-deck').innerHTML = ''; tags.innerHTML = ''; count2.classList.add('gone'); q('.gp-pk').classList.add('drop');
      const el = document.createElement('div'); el.className = 'gp-haul';
      const upd = o.count - o.newCount;
      el.innerHTML = `<div class="k">${esc(from)}</div><h2>${o.count} card${o.count === 1 ? '' : 's'}</h2><p>${o.newCount ? `<b>${o.newCount} new</b> to you` : 'None new to you'}${upd ? ` · <b>${upd}</b> you have, with more` : ''}</p><div class="gp-grid"></div><div class="xp" hidden></div><button class="go" type="button">See them in your collection</button><button class="later" type="button">Done</button>`;
      root.appendChild(el); sfx('complete', 0.9);
      const g = el.querySelector('.gp-grid');
      const MAXT = o.tiles.length > 60 ? 59 : 60, extra = o.tiles.length - MAXT; /* a big pack shows its best 59 + the "+N" tile, ten full rows of six (2026-11-07: an every-card pack drew 4,843 pictures) */
      o.tiles.slice(0, MAXT).forEach((x, i) => { const t = document.createElement('div'); t.className = `t${x.isNew ? ' n' : ''}`; t.style.setProperty('--c', o.tierColor(x.card.tier) ?? '#556'); const a = o.artImage(x.card); if (a) t.style.backgroundImage = `url('${a}')`; else if (o.mini) { try { t.appendChild(o.mini(x.card)); } catch {} } /* no picture file (stars, constellation charts): the drawn mini card instead of a blank tile (2026-11-08, Sevaan) */ t.style.animationDelay = `${reduced ? 0 : Math.min(i, 60) * 28}ms`; g.appendChild(t); });
      { const w = g.firstElementChild?.offsetWidth; if (w) g.style.setProperty('--mini-s', (w / 280).toFixed(4)); } /* mini cards scale to the tile */
      if (extra > 0) { const t = document.createElement('div'); t.className = 't more'; t.textContent = `+${extra.toLocaleString('en-US')}`; t.style.setProperty('--c', '#2a3d55'); t.style.animationDelay = `${reduced ? 0 : MAXT * 28}ms`; g.appendChild(t); }
      /* only whole rows that fit this screen (the tiles are still invisible, so trimming now shows nothing): the last slot says how many more */
      { const first = g.firstElementChild; if (first && g.children.length > 12) { const th = first.offsetHeight + 6, rows = Math.max(2, Math.floor((g.clientHeight + 2) / th)), cap = rows * 6;
        if (g.children.length > cap) { const more = o.tiles.length - (cap - 1); while (g.children.length > cap - 1) g.lastElementChild.remove(); const t = document.createElement('div'); t.className = 't more'; t.textContent = `+${more.toLocaleString('en-US')}`; t.style.setProperty('--c', '#2a3d55'); t.style.animationDelay = `${reduced ? 0 : (cap - 1) * 28}ms`; g.appendChild(t); } } }
      Promise.resolve(o.summary?.()).then((line) => { const x = el.querySelector('.xp'); if (line && x) { x.textContent = line; x.hidden = false; x.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' }); } }).catch(() => {});
      tap(el.querySelector('.go'), () => finish('collection'));
      tap(el.querySelector('.later'), () => finish('done'));
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
