// TikTok clips made from the real app (2026-11-14, Sevaan: "it has to all be stuff you can generate yourself").
// Same method as scripts/store/preview.mjs: the app recorded in Chromium (DevTools screencast) as takes, trimmed and
// joined in ffmpeg, a caption track drawn by the browser frame by frame, the app's own sounds where they played, and
// "Permafrost" (Scott Buckley, CC BY 4.0: credit it in the post) under it. Every video also comes out without music,
// for a TikTok sound laid over it in the app.
// 1080 × 1920 (9:16). Captions sit in the top third, clear of TikTok's description (bottom) and buttons (right).
// Usage: node scripts/social/tiktok.mjs [light|pack|toronto|all] [--catalog=<fresher catalog.json>]
// Output: store/social/tiktok/<name>.mp4, <name>-nomusic.mp4, <name>.txt (caption + hashtags)
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DEVICES, setup, hideNoise, jumpToHero, storeExtras, storeStorage, captureNight, packExtras, stopFollow } from '../store/common.mjs';

const args = process.argv.slice(2), which = args.find((a) => !a.startsWith('--')) ?? 'all';
const catalog = args.find((a) => a.startsWith('--catalog='))?.slice(10) ?? null;
const W = 1080, H = 1920, FPS = 30;
const OUT = join(ROOT, 'store/social/tiktok'); mkdirSync(OUT, { recursive: true });
DEVICES.tiktok = { ...DEVICES.phone, viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, safeTop: 14, safeBottom: 10 };
const vw = 432, vh = 768;
const KEEP = new Set(['collect', 'flip', 'shiny', 'r_common', 'r_uncommon', 'r_rare', 'r_epic', 'r_legend', 'arrive', 'lock', 'swipe', 'welcome', 'rattle', 'step']);
const TORONTO = { latitude: 43.6532, longitude: -79.3832, tz: 'America/Toronto' };

/* One recording session: the app at a time and place, with helpers for takes. */
async function session({ when, place, extra = [], storage = {}, heroIss = true }) {
  const b = await chromium.launch(), tmp = join(ROOT, 'scripts/.cache/tiktok-' + Math.random().toString(36).slice(2, 7)); mkdirSync(tmp, { recursive: true });
  const night = new Date(when), { p, ctx, errs } = await setup(b, 'tiktok', { when, heroIss, clear: true, extra: [...storeExtras(night), ...extra], storage: { ...storeStorage(night), ...storage }, place: place ?? undefined, catalog });
  await hideNoise(p);
  await p.addStyleTag({ content: `
    body.rec #sky-header, body.rec #nav, body.rec .sc-switch, body.rec #skybar, body.rec #tab-fade, body.rec #radar, body.rec #radar-up, body.rec #radar-new, body.rec #nextpass, body.rec #event-banner, body.rec #sky-plus-line, body.rec #until-dark { visibility: hidden !important; opacity: 0 !important; }
    body.rec #reveal #rv-top, body.rec #reveal #rv-rank, body.rec #reveal #reveal-view, body.rec #rv-news { visibility: hidden !important; }
    body.rec #reveal #rv-holder, body.rec #reveal #rv-glow { scale: .76; translate: 0 7%; } /* the card a little smaller and lower: the captions get the top third */` });
  await p.evaluate(() => document.body.classList.add('rec'));
  const w = (ms) => p.waitForTimeout(ms), now = () => Date.now() / 1000;
  await p.evaluate(() => { const st = window.__store.state; st.drag.on = true; st.pinnedId = null; window.__pan = 0; window.__aim = null;
    const step = () => { const s = window.__store.state, e = window.__ease ?? 0.06; let az = null, el = null;
      if (window.__aim != null) { const it = s.items.find((x) => x.obj.id === window.__aim); if (it) { az = it.look.az; el = it.look.el; } }
      if (az != null) { const da = ((az - s.drag.az + 540) % 360) - 180; s.drag.az = (s.drag.az + da * e + 360) % 360; s.drag.el += (Math.max(el, 12) - s.drag.el) * e; }
      else s.drag.az = (s.drag.az + window.__pan + 360) % 360;
      requestAnimationFrame(step); };
    st.drag.el = 38; requestAnimationFrame(step); });
  const cdp = await ctx.newCDPSession(p); let frames = null, nf = 0;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => { if (frames) { const f = join(tmp, `f${String(nf++).padStart(5, '0')}.jpg`); writeFileSync(f, Buffer.from(data, 'base64')); frames.push({ f, t: metadata.timestamp }); } await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
  const sfx = []; await p.exposeFunction('__sfxReal', (n, delay = 0) => { sfx.push([n, now() + delay]); });
  const take = async (fn) => { frames = []; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 }); const marks = {}; const t0 = now();
    await fn((k) => { marks[k] = now(); }); await cdp.send('Page.stopScreencast'); await w(150); const tk = { frames, marks, t0 }; frames = null; return tk; };
  const flipNow = async () => { for (let i = 0; i < 16; i++) { if (await p.evaluate(() => document.getElementById('rv-back')?.style.visibility === 'hidden')) return; await p.locator('#rv-holder').click({ timeout: 600 }).catch(() => {}); await w(200); } };
  const tilt = async (ms) => { const r = await p.locator('#rv-holder').boundingBox().catch(() => null); if (!r) return w(ms); const pts = [[0.5, 0.45], [0.25, 0.3], [0.75, 0.35], [0.7, 0.7], [0.3, 0.62], [0.5, 0.45]]; const step = ms / pts.length;
    for (const [x, y] of pts) { await p.mouse.move(r.x + r.width * x, r.y + r.height * y, { steps: 6 }); await w(Math.max(0, step - 90)); } };
  const cardShot = async (path) => {
    await p.mouse.move(2, 2); await w(900);
    await p.evaluate(() => { const st = document.createElement('style'); st.id = 'shoot'; st.textContent = '#reveal { background: transparent !important; } #reveal > :not(#rv-holder), #reveal .starfield, #rv-glow { visibility: hidden !important; } html, body { background: transparent !important; } #sky, #hud { visibility: hidden !important; }'; document.head.append(st); });
    await w(150);
    const r = await p.evaluate(() => { const c = document.querySelector('#reveal-card .card') ?? document.getElementById('reveal-card'), b = c.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
    const m = 8; await p.screenshot({ path, omitBackground: true, clip: { x: Math.max(0, r.x - m), y: Math.max(0, r.y - m), width: r.width + 2 * m, height: r.height + 2 * m } }).catch(() => {});
    await p.evaluate(() => document.getElementById('shoot')?.remove());
  };
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__store.state.tonight)); i++) await w(1000);
  return { b, p, ctx, errs, tmp, w, now, take, flipNow, tilt, cardShot, sfx, at: (t) => p.clock.setSystemTime(new Date(t)) };
}

/* Cut, caption, end card and sound: clips = [{ take, from, dur }], joined with short dissolves. */
async function render(name, s, clips, caps, end, caption) {
  const { tmp } = s, TR = 0.3;
  const files = clips.map(({ take, from, dur }, k) => {
    const fr = take.frames; let first = fr.findIndex((x, i) => (fr[i + 1]?.t ?? Infinity) > from); if (first < 0) first = fr.length - 1;
    const use = fr.slice(first);
    const lines = use.map((x, i) => { const s0 = Math.max(x.t, from), s1 = use[i + 1] ? use[i + 1].t : from + dur + 1; return `file '${x.f}'\nduration ${Math.max(0.001, s1 - s0).toFixed(4)}`; }).join('\n') + `\nfile '${use.at(-1).f}'\n`;
    writeFileSync(join(tmp, `c${k}.txt`), lines); const out = join(tmp, `c${k}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(tmp, `c${k}.txt`), '-vf', `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p,tpad=stop_mode=clone:stop_duration=3`, '-t', dur.toFixed(3), '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', out]);
    return out;
  });
  const starts = []; let acc = 0; clips.forEach((c, k) => { starts.push(k ? acc - TR : 0); acc = (k ? acc - TR : 0) + c.dur; });
  const END = acc + end.dur, ENDAT = acc - 0.15;
  const vjoin = join(tmp, 'joined.mp4');
  { const inputs = files.flatMap((c) => ['-i', c]); let fc = '', prev = '[0:v]';
    for (let k = 1; k < files.length; k++) { const lab = `[v${k}]`; fc += `${prev}[${k}:v]xfade=transition=fade:duration=${TR}:offset=${starts[k].toFixed(3)}${lab};`; prev = lab; }
    fc += `${prev}tpad=stop_mode=clone:stop_duration=${end.dur + 1}[vj]`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc, '-map', '[vj]', '-t', END.toFixed(3), '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', vjoin]); }
  /* caption track + end card */
  const capDir = join(tmp, 'caps'); mkdirSync(capDir, { recursive: true });
  const cb = await chromium.launch(), cp = await cb.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: W / vw });
  const card = end.card ? 'data:image/png;base64,' + readFileSync(end.card).toString('base64') : '';
  await cp.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: 'SC Display'; src: url('data:font/ttf;base64,${readFileSync(join(ROOT, 'fonts/RussoOne-Regular.ttf')).toString('base64')}'); }
    @font-face { font-family: 'SC Label'; src: url('data:font/ttf;base64,${readFileSync(join(ROOT, 'fonts/BarlowCondensed-Medium.ttf')).toString('base64')}'); font-weight: 500; }
    html, body { margin: 0; background: transparent; width: ${vw}px; height: ${vh}px; overflow: hidden; }
    #band { position: absolute; left: 0; right: 0; top: 9%; height: 21%; background: linear-gradient(transparent, rgba(4,7,13,.5) 25%, rgba(4,7,13,.5) 75%, transparent); opacity: 0; }
    #cap { position: absolute; left: 7%; right: 13%; top: 11%; height: 17%; display: grid; place-items: center; text-align: center; text-wrap: balance; color: #fff2b3;
      font: 400 ${Math.round(vw * 0.08)}px/1.08 'SC Display', Impact, sans-serif; text-shadow: 0 0 ${Math.round(vw * 0.045)}px rgba(250,129,39,.5), 0 3px 0 #000, 0 0 ${Math.round(vw * 0.06)}px rgba(0,0,0,.95), 0 0 4px #000; opacity: 0; }
    #cap b { color: #fa8127; font-weight: 400; }
    #end { position: absolute; inset: 0; opacity: 0; }
    #end .shade { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 40%, rgba(4,7,13,.86), rgba(4,7,13,.97) 70%); }
    #end img { position: absolute; left: 50%; top: 13%; width: ${Math.round(vw * 0.5)}px; margin-left: ${-Math.round(vw * 0.25)}px; filter: drop-shadow(0 12px 24px rgba(0,0,0,.75)); transform: rotate(-4deg); }
    #end .t { position: absolute; left: 0; right: 0; top: ${card ? 60 : 38}%; text-align: center; white-space: nowrap; font: 400 ${Math.round(vw * 0.1)}px/1 'SC Display', Impact, sans-serif; color: #fff2b3; text-shadow: 0 0 22px rgba(250,129,39,.5), 0 3px 0 #000; }
    #end .s { position: absolute; left: 0; right: 0; top: ${card ? 67.5 : 45.5}%; text-align: center; font: 500 ${Math.round(vw * 0.05)}px/1.35 'SC Label', sans-serif; letter-spacing: .2em; text-transform: uppercase; color: #fff2b3; }
    #end .s b { display: block; color: #fa8127; font-weight: 500; }
  </style></head><body><div id="band"></div><div id="cap"></div><div id="end"><div class="shade"></div>${card ? `<img src="${card}">` : ''}<div class="t">SPACE COLLECTOR</div><div class="s">${end.line}</div></div></body></html>`);
  await cp.evaluate(async () => { await document.fonts.load('40px "SC Display"'); await document.fonts.load('500 20px "SC Label"'); await document.fonts.ready; });
  const N = Math.round(END * FPS), ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  for (let i = 0; i < N; i++) {
    const t = i / FPS, c = caps.find(([a, z]) => t >= a && t < z), st = { capOp: 0, scale: 1, blur: 0, html: '', endOp: 0 };
    if (c && t < ENDAT) { const [a, z, text] = c, k = (t - a) / 0.42, out = Math.min(1, Math.max(0, (z - t) / 0.3));
      st.html = '<span>' + text.replace(/\*(.+?)\*/g, '<b>$1</b>') + '</span>'; st.capOp = Math.min(1, k * 3) * out; st.scale = 1 + 0.5 * (1 - ease(k)); st.blur = 4 * (1 - ease(k)); }
    if (t >= ENDAT) st.endOp = Math.min(1, (t - ENDAT) / 0.4);
    await cp.evaluate((st) => { const cap = document.getElementById('cap'); if (cap.dataset.h !== st.html) { cap.innerHTML = st.html; cap.dataset.h = st.html; }
      cap.style.opacity = st.capOp; cap.style.transform = `scale(${st.scale})`; cap.style.filter = st.blur > 0.05 ? `blur(${st.blur}px)` : 'none'; document.getElementById('band').style.opacity = st.capOp;
      document.getElementById('end').style.opacity = st.endOp; }, st);
    await cp.screenshot({ path: join(capDir, `${String(i).padStart(4, '0')}.png`), omitBackground: true });
  }
  await cb.close();
  /* sound: the app's own sounds where they played; one mix with music, one without */
  const mapT = (t) => { for (let k = clips.length - 1; k >= 0; k--) { const x = t - clips[k].from; if (x >= 0 && x <= clips[k].dur) return starts[k] + x; } return null; };
  const last = {}, events = s.sfx.map(([n, t]) => [n, mapT(t)]).filter(([n, t]) => t != null && t > 0 && t < END - 0.3 && KEEP.has(n)).sort((a, b) => a[1] - b[1])
    .filter(([n, t]) => { if (t - (last[n] ?? -9) < 0.35) return false; last[n] = t; return true; });
  events.push(['shiny', ENDAT + 0.3]);
  const NORM = (() => { try { return JSON.parse(readFileSync(join(ROOT, 'js/sfx.js'), 'utf8').match(/const NORM = (\{[^}]*\})/)[1]); } catch { return {}; } })();
  for (const music of [true, false]) {
    const ain = music ? ['-ss', '109.6', '-i', join(ROOT, 'assets/audio/permafrost.m4a')] : ['-f', 'lavfi', '-t', END.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo'];
    events.forEach(([n]) => ain.push('-i', join(ROOT, 'assets/audio/sfx', n + '.mp3')));
    let af = music ? `[2:a]atrim=0:${END},asetpts=N/SR/TB,volume=0.38,afade=t=in:st=0:d=0.2,afade=t=out:st=${(END - 1.2).toFixed(2)}:d=1.2[mus];` : '[2:a]anull[mus];'; const lab = ['[mus]'];
    events.forEach(([n, t], i) => { const ms = Math.round(t * 1000), g = Math.min(1.4, 0.6 * (NORM[n] ?? 1)); af += `[${i + 3}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${g.toFixed(3)},adelay=${ms}|${ms}[e${i}];`; lab.push(`[e${i}]`); });
    af += `${lab.join('')}amix=inputs=${lab.length}:normalize=0:duration=first,alimiter=limit=0.9,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', vjoin, '-framerate', String(FPS), '-i', join(capDir, '%04d.png'), ...ain, '-filter_complex', `[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v];${af}`,
      '-map', '[v]', '-map', '[aout]', '-t', END.toFixed(3), '-c:v', 'libx264', '-profile:v', 'high', '-crf', '18', '-preset', 'slow', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', join(OUT, `${name}${music ? '' : '-nomusic'}.mp4`)]);
  }
  writeFileSync(join(OUT, `${name}.txt`), caption);
  console.log(name, '→', join(OUT, `${name}.mp4`), `${END.toFixed(1)} s`, 'sounds', events.map(([n, t]) => `${n}@${t.toFixed(1)}`).join(' '), s.errs.length ? s.errs : '');
}

const CREDIT = 'Music: "Permafrost" by Scott Buckley, CC BY 4.0 (only if you keep the music version)';

/* 1 · What's that light? A light moving across the sky; the circle slides onto it; it's the Space Station. */
async function light() {
  const s = await session({ when: '2026-10-17T19:30:00-04:00' }), { p, w, take, flipNow, tilt } = s;
  await jumpToHero(p);
  await p.evaluate(() => { const st = window.__store.state, it = st.items.find((x) => x.obj.type === 'station' && x.look?.visible && !st.sightings.some((y) => String(y.objectId) === String(x.obj.id)));
    if (it) { st.drag.az = (it.look.az + 7) % 360; st.drag.el = it.look.el + 3; window.__issId = it.obj.id; } }); /* start close to it: it's the moving light you notice */
  /* an empty circle to start with: try a few spots near it until nothing (no Starlink, no star) is in the circle */
  for (const [da, de] of [[7, 3], [9, -3], [-7, 3], [-9, -3], [12, 0], [-12, 0], [6, 6], [-6, 6]]) {
    await p.evaluate(([da, de]) => { const st = window.__store.state, it = st.items.find((x) => x.obj.id === window.__issId); if (it) { st.drag.az = (it.look.az + da + 360) % 360; st.drag.el = it.look.el + de; } }, [da, de]);
    await w(700); if (await p.evaluate(() => window.__store.state.targetId == null && document.getElementById('discover').hidden)) break; }
  await w(800);
  const t1 = await take(async (mark) => { mark('in'); await w(2600);
    mark('slide'); await p.evaluate(() => { window.__ease = 0.05; window.__aim = window.__issId; });
    for (let i = 0; i < 90 && !(await p.evaluate(() => window.__store.state.targetId === window.__issId && !!document.querySelector('#d-cta:not([hidden])'))); i++) await w(60);
    mark('locked'); await w(2200); mark('collect'); await p.click('#d-cta', { timeout: 3000 }).catch((e) => console.log('light: no Collect', e.message.slice(0, 60)));
    await w(450); await flipNow(); mark('face'); await w(300); await tilt(4200); await w(300); });
  const card = join(s.tmp, 'card.png'); await s.cardShot(card); await stopFollow(p); await s.b.close();
  const m = t1.marks, from = m.in, dur = (m.face + 4.4) - from, rel = (k) => m[k] - from;
  await render('whats-that-light', s, [{ take: t1, from, dur }],
    [[0.2, rel('slide') + 0.3, 'That’s not a *plane*.'], [rel('locked') - 0.1, rel('collect') + 0.4, 'That’s the *Space Station*'], [rel('face') + 0.4, dur - 0.2, 'People have lived on it since *2000*']],
    { dur: 2.4, card, line: 'Free on iPhone<b>Collect the night sky</b>' },
    `That light moving across the sky isn't a plane. It's the Space Station, and you can catch it as a card.\n\nSpace Collector is free on iPhone (link in bio).\n\n#space #iss #spacestation #stargazing #nightsky #satellite #astronomy #iphone #indiegame #appstore\n\n${CREDIT}\n`);
}

/* 2 · The morning pack: everything caught last night, sealed; torn open, the cards turned one by one, the summary. */
async function pack() {
  const morn = new Date('2026-10-18T08:30:00-04:00');
  const s = await session({ when: morn.toISOString(), extra: packExtras(morn) }), { p, w, take } = s;
  for (let i = 0; i < 20 && !(await p.locator('.ticket', { hasText: /in a pack/i }).count()); i++) await w(1000);
  const opened = await p.evaluate(() => { const t = [...document.querySelectorAll('.ticket')].find((x) => /in a pack/i.test(x.textContent)); t?.click(); return !!t; }); /* the toasts are hidden for the recording, so tap it from inside the page */
  if (!opened) console.log('pack: no ticket');
  await p.addStyleTag({ content: '#gift .gp-hint, #gift .gp-x, #gift .gp-head, #gift .gp-tags, #gift .gp-count2 { opacity: 0 !important; } #gift .gp-cue { display: none !important; } #gift .gp-pk, #gift .gp-deck, #gift .gp-haul { scale: .8; translate: 0 8%; } /* smaller and lower: captions on top, TikTok\'s text at the bottom */' }); await w(2600);
  const topCard = () => p.evaluate(() => { const g = document.getElementById('gift'); if (!g || g.querySelector('.gp-haul')) return null; const d = [...g.querySelectorAll('.gp-dc')].at(-1); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, face: d.classList.contains('face') }; });
  const t1 = await take(async (mark) => { mark('in'); await w(1600);
    mark('open'); await p.evaluate(() => document.querySelector('#gift [data-a="open"]')?.click()); await w(3000);
    for (let i = 0; i < 6; i++) { const c = await topCard(); if (!c) break; await p.touchscreen.tap(c.x, c.y); await w(c.face ? 650 : 1300); if (i === 0) mark('first'); } /* three cards, then straight to the summary */
    await p.evaluate(() => { const b = [...document.querySelectorAll('#gift button, #gift [role=button], #gift a')].find((x) => /skip/i.test(x.textContent)); b?.click(); });
    for (let i = 0; i < 20 && !(await p.evaluate(() => !!document.querySelector('#gift .gp-haul'))); i++) await w(150);
    mark('haul'); await w(2800); });
  await s.b.close();
  const m = t1.marks, from = m.in, dur = (m.haul + 3.0) - from, rel = (k) => m[k] - from;
  await render('morning-pack', s, [{ take: t1, from, dur }],
    [[0.2, rel('open') + 0.6, 'Everything I caught *last night*'], [rel('open') + 0.7, rel('first') + 0.2, '…sealed in a *pack*'], [rel('haul') + 0.2, dur - 0.2, 'One night. *Real satellites.*']],
    { dur: 2.2, line: 'Wake up to a pack<b>Free on iPhone</b>' },
    `Opening the pack of everything I caught in the sky last night. Every card is a real satellite or planet that went over my house.\n\nSpace Collector is free on iPhone (link in bio).\n\n#packopening #space #satellite #stargazing #nightsky #tradingcards #cardopening #indiegame #iphone\n\n${CREDIT}\n`);
}

/* 3 · The Space Station over Toronto: a real pass, from today's orbits (pass --catalog=<today's catalog.json>). */
async function toronto() {
  const PASS = Date.parse('2026-11-16T17:59:30-05:00'); /* Mon 16 Nov, 5:58–6:03 PM, up to 47°, mag −3.4 (CelesTrak elements of 14 Nov) */
  const s = await session({ when: new Date(PASS - 40e3).toISOString(), place: TORONTO }), { p, w, take, flipNow, tilt } = s;
  await w(2500);
  const iss = await p.evaluate(() => { const st = window.__store.state, it = st.items.find((x) => x.obj.type === 'station' && String(x.obj.id) === '25544'); return it ? { id: it.obj.id, az: it.look.az, el: it.look.el, vis: it.look.visible } : null; });
  console.log('toronto: ISS', JSON.stringify(iss));
  if (!iss?.vis) { for (let i = 0; i < 12; i++) { await p.clock.fastForward(5000); await w(300); const v = await p.evaluate(() => window.__store.state.items.find((x) => String(x.obj.id) === '25544')?.look?.visible); if (v) break; } }
  await p.evaluate(() => { window.__issId = 25544; });
  /* an empty circle to start with (a star had it: 'Muning · Collect' under 'Toronto: Monday 5:58 PM') */
  for (const [da, de] of [[14, 4], [18, 8], [-14, 4], [10, 10], [22, 3], [-18, 8], [8, 14], [-10, 12]]) {
    await p.evaluate(([da, de]) => { const st = window.__store.state, it = st.items.find((x) => String(x.obj.id) === '25544'); if (it) { st.drag.az = (it.look.az + da + 360) % 360; st.drag.el = it.look.el + de; } }, [da, de]);
    await w(700); if (await p.evaluate(() => window.__store.state.targetId == null && document.getElementById('discover').hidden)) break; }
  await w(600);
  const t1 = await take(async (mark) => { mark('in'); await w(2800);
    mark('slide'); await p.evaluate(() => { window.__ease = 0.05; window.__aim = window.__issId; });
    for (let i = 0; i < 90 && !(await p.evaluate(() => window.__store.state.targetId === window.__issId && !!document.querySelector('#d-cta:not([hidden])'))); i++) await w(60);
    mark('locked'); await w(2400); mark('collect'); await p.click('#d-cta', { timeout: 3000 }).catch((e) => console.log('toronto: no Collect', e.message.slice(0, 60)));
    await w(450); await flipNow(); mark('face'); await w(300); await tilt(3400); await w(300); });
  const card = join(s.tmp, 'card.png'); await s.cardShot(card); await stopFollow(p); await s.b.close();
  const m = t1.marks, from = m.in, dur = (m.face + 3.6) - from, rel = (k) => m[k] - from;
  await render('toronto-iss-mon-nov16', s, [{ take: t1, from, dur }],
    [[0.2, rel('slide') + 0.5, 'Toronto: *Monday 5:58 PM*'], [rel('slide') + 0.6, rel('collect') + 0.3, 'Look *west*. It’s the *Space Station*'], [rel('face') + 0.3, dur - 0.2, 'Brighter than any *star*']],
    { dur: 2.6, card, line: 'Mon Nov 16 · 5:58 PM<b>Look west · Free on iPhone</b>' },
    `Toronto: the Space Station flies over Monday (Nov 16) at 5:58 PM. Look west, it climbs high and crosses to the northeast in about 5 minutes, brighter than any star.\n\nCatch it as a card with Space Collector, free on iPhone (link in bio).\n\n#toronto #iss #spacestation #nightsky #stargazing #space #satellite #ontario\n\n${CREDIT}\n`);
}

const JOBS = { light, pack, toronto };
for (const k of which === 'all' ? Object.keys(JOBS) : [which]) await JOBS[k]();
