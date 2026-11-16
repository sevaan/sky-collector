// Send cards, the sending side (2026-11-07, design/send-cards.html; rules in js/gift.js). A full-screen page in the
// Collection: pick cards (By card) or nights (By night), and the phone's own share sheet sends a link (no names: you
// know who sent it; 2026-11-07, Sevaan).
// Sharing only copies: the cards stay on this phone too (2026-11-07, Sevaan: "we don't need Move as a concept... I don't
// see anyone getting rid of cards they've collected"). Built by cards-page.js, which hands in what it knows (ctx).
import { plural, ownSightings } from './gift.js?v=0.1.1609';
import { nightKey } from './observation.js?v=0.1.1609';
import { TIER_INFO } from './rarity.js?v=0.1.1609';
import { packLinkFor, shareLink } from './pack-share.js?v=0.1.1609';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const day = (t) => new Date(t).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
// The evening a night belongs to (a 1 AM catch is the evening before).
const eveningOf = (s) => new Date(s.time - (new Date(s.time).getHours() < 12 ? 86400e3 : 0));

let ctx = null, view = null, sel = null;
const $ = (id) => document.getElementById(id);

export function initSend(c) { ctx = c; view = $('send-view'); if (!view) return; try { new Image().src = 'assets/art/pack-cheatline.webp'; } catch {} /* the pack's gold artwork is ready before the pack shows */ view.addEventListener('cancel', (e) => { e.preventDefault(); closeSend(); }); view.addEventListener('click', onClick); view.addEventListener('input', onInput); }

// ---------- data ----------
const real = () => ctx.sightings().filter((s) => !s.sim);
function nights() {
  const m = new Map();
  for (const s of ownSightings(ctx.sightings())) { /* your own nights only: cards you were sent carry the sender's dates (the deep review, 2026-11-12) */ const k = nightKey(s.time, s.lon ?? 0); const n = m.get(k) ?? m.set(k, { k, list: [], eve: eveningOf(s) }).get(k); n.list.push(s); if (s.time < n.list[0].time) n.eve = eveningOf(s); }
  return [...m.values()].sort((a, b) => b.k - a.k);
}
function owned() {
  const by = new Map();
  for (const s of real()) (by.get(s.cardKey) ?? by.set(s.cardKey, []).get(s.cardKey)).push(s);
  return [...by.entries()].map(([key, list]) => ({ key, card: ctx.cardOf(key), list, last: Math.max(...list.map((s) => s.time)) })).filter((x) => x.card).sort((a, b) => b.last - a.last);
}
function picked() {
  if (sel.only) return real().filter((s) => sel.only.includes(s.cardKey));
  if (sel.tab === 'card') return real().filter((s) => sel.cards.has(s.cardKey));
  return real().filter((s) => sel.nights.has(nightKey(s.time, s.lon ?? 0)));
}

// ---------- open / close ----------
// opts.only: send these card keys straight away (from a card).
export function openSend(opts = {}) {
  if (!view || !ctx) return;
  sel = { tab: 'card', cards: new Set(), nights: new Set(), gapNo: '', only: opts.only ?? null };
  clearTimeout(closeT); /* reopened within the 300 ms close: the old timer must not close the new page (review 2026-11-07) */
  if (!view.open) view.showModal();
  view.classList.remove('leaving');
  /* the page opens now and fills on the next frame (2026-11-11 jank audit: building every tile first held the slide-up for
     ~220 ms at phone speed) */
  const fill = () => { if (!view.open) return; if (sel.only) openSheet(); else renderPick(); view.scrollTop = 0; };
  if (sel.only) fill(); else requestAnimationFrame(() => setTimeout(fill, 0));
}
export function closeSend() {
  if (!view?.open || view.classList.contains('leaving')) return;
  ctx.header?.(false);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { view.close(); ctx.onClose?.(); return; }
  view.classList.add('leaving');
  closeT = setTimeout(() => { view.classList.remove('leaving'); view.close(); ctx.onClose?.(); }, 300);
}
let closeT = 0;
export const sendOpen = () => !!view?.open;
// Android Back: the sheet first, then the page.
export function sendBack() { if (!view?.open) return false; if (view.dataset.step === 'sheet' && !sel.only) { renderPick(); return true; } closeSend(); return true; }

// ---------- step 1: pick ----------
/* In the app the page sits under the shared header (title + its ✕), like Observer stats; standalone it draws its own. */
function head(eyebrow, title, { back = false } = {}) {
  ctx.header?.(true, String(title).toUpperCase(), String(eyebrow).toUpperCase());
  return `${back ? '<button class="sv-backlink" type="button" data-act="back">‹ Change what to share</button>' : ''}<div class="sv-head">${back ? '<button class="sv-back" type="button" data-act="back" aria-label="Back">‹</button>' : ''}<div class="sv-t"><span class="ui-eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div><button class="close x-close" type="button" data-act="close" aria-label="Close">✕</button></div>`;
}
function renderPick() {
  view.dataset.step = 'pick'; sendRun++; sending = false;
  const tabs = `<div class="sv-tabs" role="tablist"><button type="button" role="tab" data-tab="card" aria-selected="${sel.tab === 'card'}">By card</button><button type="button" role="tab" data-tab="night" aria-selected="${sel.tab === 'night'}">By night</button></div>`;
  view.innerHTML = `<div class="sv-page">${head('Pick what to share', 'Send cards')}${tabs}<div id="sv-body"></div></div><div class="sv-bar" id="sv-bar"></div>`;
  renderBody(); renderBar();
}
function renderBody() {
  const body = $('sv-body'); if (!body) return;
  if (sel.tab === 'card') {
    const list = owned(), all = list.length && list.every((x) => sel.cards.has(x.key));
    body.innerHTML = `<div class="sv-selrow"><span>${list.length ? `${sel.cards.size.toLocaleString('en-US')} of ${plural(list.length, 'card')}` : 'No cards yet'}</span>${list.length ? `<button type="button" class="sv-sa" data-act="all-cards">${all ? 'Select none' : 'Select all'}</button>` : ''}</div>
      <div class="sv-grid">${list.map((x) => tileHtml(x)).join('')}</div>`;
    /* the real mini cards, as in the Collection (2026-11-07, Sevaan: "Should be the mini cards") */
    const grid = body.querySelector('.sv-grid'), byKey = new Map(list.map((x) => [x.key, x])), tiles = [...grid.querySelectorAll('.sv-tile')];
    /* the first screens are built now, the rest as they scroll near (2026-11-07 playtest: 1,000 cards took seconds to open) */
    const fill = (t) => { if (t._filled) return; t._filled = true; const x = byKey.get(t.dataset.card); try { t.querySelector('.sv-art').replaceChildren(ctx.mini(x.card, x.list)); } catch {} };
    tileIO?.disconnect(); tileIO = null;
    /* the first screenful now; the rest a few a frame (2026-11-11 jank audit: 30 mini cards at once held the page ~230 ms at phone speed) */
    const q = [], pump = () => { const t0 = performance.now(); while (q.length && performance.now() - t0 < 6) fill(q.shift()); if (q.length) requestAnimationFrame(pump); };
    const want = (t) => { if (!t._filled && !t._queued) { t._queued = true; q.push(t); if (q.length === 1) requestAnimationFrame(pump); } };
    tiles.slice(0, 9).forEach(fill); tiles.slice(9, 30).forEach(want);
    if (tiles.length > 30) { if ('IntersectionObserver' in window) { tileIO = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { want(e.target); tileIO.unobserve(e.target); } }, { rootMargin: '900px 0px' }); tiles.slice(30).forEach((t) => tileIO.observe(t)); } else tiles.slice(30).forEach(want); }
    fitMini(grid);
  } else {
    const ns = nights(), all = ns.length && ns.every((n) => sel.nights.has(n.k));
    let html = `<div class="sv-selrow"><span>Tick the nights to send</span>${ns.length ? `<button type="button" class="sv-sa" data-act="all-nights">${all ? 'Select none' : 'Select all'}</button>` : ''}</div><div class="sv-nights">`;
    let month = '';
    const gap = gapNights(ns);
    for (const n of ns) {
      const m = n.eve.toLocaleDateString([], { month: 'long', year: 'numeric' });
      if (m !== month) { month = m; const inM = ns.filter((x) => x.eve.toLocaleDateString([], { month: 'long', year: 'numeric' }) === m), allM = inM.every((x) => sel.nights.has(x.k));
        html += `<div class="sv-mon"><span>${esc(m)}</span><button type="button" class="sv-sa" data-act="month" data-month="${esc(m)}">${allM ? 'None of' : 'All of'} ${esc(m.split(' ')[0])}</button></div>`; }
      const cards = new Set(n.list.map((s) => s.cardKey)), arts = [...cards].map((k) => ctx.art(ctx.cardOf(k))).filter(Boolean).slice(0, 3);
      if (gap.first === n.k) html += gapChip(gap);
      html += `<button type="button" class="sv-night${sel.nights.has(n.k) ? ' on' : ''}" data-night="${n.k}" aria-pressed="${sel.nights.has(n.k)}"><span class="sv-box" aria-hidden="true"></span><span class="sv-d">${esc(day(n.eve))}<small>${plural(cards.size, 'card')} · ${plural(n.list.length, 'sighting')}</small></span><span class="sv-mini" aria-hidden="true">${arts.map((a) => `<i style="background-image:url('${esc(a)}')"></i>`).join('')}</span></button>`;
    }
    body.innerHTML = `${html}</div>`;
  }
}
let tileIO = null;
function fitMini(grid) { const w = grid?.querySelector('.sv-tile')?.clientWidth; if (w) grid.style.setProperty('--mini-s', (w / 280).toFixed(4)); }
addEventListener('resize', () => fitMini(document.querySelector('#send-view .sv-grid')));
function tileHtml(x) {
  const on = sel.cards.has(x.key), art = ctx.art(x.card), t = TIER_INFO[x.card.tier] ?? TIER_INFO.common;
  return `<button type="button" class="sv-tile${on ? ' on' : ''}" data-card="${esc(x.key)}" aria-pressed="${on}" aria-label="${esc(ctx.title(x.card))}" style="--c:${t.color}"><span class="sv-art"${art ? ` style="background-image:url('${esc(art)}')"` : ''}></span><span class="sv-tick" aria-hidden="true"></span></button>`;
}
// Ticked nights with unticked ones between them: offer those, once (not a range rule; send-cards design round 3).
function gapNights(ns) {
  const on = ns.filter((n) => sel.nights.has(n.k)); if (on.length < 2) return {};
  const lo = Math.min(...on.map((n) => n.k)), hi = Math.max(...on.map((n) => n.k));
  const between = ns.filter((n) => n.k > lo && n.k < hi && !sel.nights.has(n.k));
  const sig = between.map((n) => n.k).join(',');
  if (!between.length || sel.gapNo === sig) return {};
  return { first: Math.max(...between.map((n) => n.k)), list: between, sig };
}
function gapChip(g) {
  const words = g.list.length === 1 ? `${day(g.list[0].eve)} too?` : `The ${g.list.length} nights between too?`;
  return `<div class="sv-gap"><span>${esc(words)}<small>${g.list.length === 1 ? 'It sits' : 'They sit'} between the nights you ticked</small></span><button type="button" data-act="gap-no">No</button><button type="button" class="o" data-act="gap-add" data-k="${g.list.map((n) => n.k).join(',')}">Add ${g.list.length === 1 ? 'it' : 'them'}</button></div>`;
}
function renderBar() {
  const bar = $('sv-bar'); if (!bar) return;
  const p = picked(), cards = new Set(p.map((s) => s.cardKey)).size;
  const sub = sel.tab === 'card' ? '' /* no second line (2026-11-12, Sevaan didn't like 'every sighting of each') */ : (() => { const ns = [...sel.nights].sort((a, b) => a - b); if (!ns.length) return 'pick a night'; const n = nights().filter((x) => sel.nights.has(x.k)).sort((a, b) => a.k - b.k); return n.length === 1 ? day(n[0].eve) : `${day(n[0].eve)} to ${day(n.at(-1).eve)} · ${plural(n.length, 'night')}`; })();
  bar.innerHTML = `<span class="sv-n">${p.length ? `${plural(cards, 'card')} · ${plural(p.length, 'sighting')}` : 'Nothing picked yet'}${sub ? `<small>${esc(sub)}</small>` : ''}</span><button type="button" class="sv-btn o" data-act="next"${p.length ? '' : ' disabled'}>Next</button>`;
}

// ---------- step 2: the pack you're sending (design/send-sheet/c-game-moment.html, Sevaan's pick 2026-11-07) ----------
// The gold pack the other phone will receive, the best cards sticking out of it as real mini cards,. Share seals the pack (a short moment), then the phone's share sheet opens.
const TIER_N = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
function openSheet() { renderSheet(); }
function pickedCards() {
  const by = new Map(); for (const s of picked()) (by.get(s.cardKey) ?? by.set(s.cardKey, []).get(s.cardKey)).push(s);
  return [...by.entries()].map(([key, list]) => ({ key, list, card: ctx.cardOf(key) })).filter((x) => x.card)
    .sort((a, b) => (TIER_N[b.card.tier] ?? 0) - (TIER_N[a.card.tier] ?? 0) || b.list.length - a.list.length);
}
function renderSheet() {
  view.dataset.step = 'sheet';
  const p = picked(), cs = pickedCards(), n = cs.length;
  const dates = (() => { const t = p.map((s) => s.time).sort((a, b) => a - b); if (!t.length) return ''; const d0 = day(eveningOf({ time: t[0] })), d1 = day(eveningOf({ time: t.at(-1) })); return d0 === d1 ? d0 : `${d0} to ${d1}`; })();
  const single = n === 1 ? ctx.title(cs[0].card) : null, peeks = cs.slice(0, 3), thumbs = cs.slice(0, 6), more = n - thumbs.length;
  view.innerHTML = `<div class="sv-page sv-pack-page">${head(single ?? plural(n, 'card'), single ? 'Share a card' : 'Share cards', { back: !sel.only })}
    <div class="sv-stage"><div class="sv-glow"></div><div class="sv-stage-in">
      ${peeks.map((x, i) => `<div class="sv-peek p${peeks.length === 1 ? 3 : i + 1}" data-i="${i}" style="--c:${(TIER_INFO[x.card.tier] ?? TIER_INFO.common).color}"></div>`).join('')}
      <div class="sv-pk"><div class="sv-bag"><div class="sv-pk-base"></div><div class="sv-pk-art"></div><div class="sv-pk-lines"></div><div class="sv-pk-pillow"></div><div class="sv-pk-pinch"></div><div class="sv-pk-crimp t"></div><div class="sv-pk-crimp b"></div><div class="sv-pk-seam"></div><div class="sv-pk-sheen"></div><div class="sv-pk-edges"></div>
        <div class="sv-pk-count"><b>${n}</b>${n === 1 ? 'card' : 'cards'}</div></div>
        <div class="sv-stamp">Sealed</div></div></div></div>
    <div class="sv-manifest"><div class="hd"><span>In the pack</span><span>${esc(dates)}</span></div>
      <div class="row"><span class="sv-thumbs">${thumbs.map((x, i) => `<i data-t="${i}"></i>`).join('')}${more > 0 ? `<i class="more">+${more}</i>` : ''}</span>
        <span class="lbl">${esc(plural(n, 'card'))}<small>${esc(plural(p.length, 'sighting'))}, ${p.length === 1 ? 'with the night it was seen' : 'each with the night it was seen'}</small></span></div></div>
    <p class="sv-plain">They get a copy to keep. Yours stay right here.</p>
    <button type="button" class="sv-btn o w" data-act="send">Share ${esc(single ? single : plural(n, 'card'))}</button></div>`;
  // the real mini cards: big ones sticking out of the pack, small ones in the manifest
  view.querySelectorAll('.sv-peek').forEach((el) => { const x = peeks[Number(el.dataset.i)]; try { el.appendChild(ctx.mini(x.card, x.list)); } catch {} });
  view.querySelectorAll('.sv-thumbs i[data-t]').forEach((el) => { const x = thumbs[Number(el.dataset.t)]; try { el.appendChild(ctx.mini(x.card, x.list)); } catch {} });
  fitStage();
}
// On a tall phone the pack grows into the spare room (up to 1.4×) instead of leaving a gap above the button.
function fitStage() {
  requestAnimationFrame(() => { const st = view.querySelector('.sv-stage'), from = view.querySelector('.sv-manifest'), plain = view.querySelector('.sv-pack-page .sv-plain'); if (!st || !from || !plain) return;
    st.style.removeProperty('--k'); const gap = plain.getBoundingClientRect().top - from.getBoundingClientRect().bottom - 24;
    const k = Math.max(1, Math.min(1.4, 1 + gap / 290)); st.style.setProperty('--k', k.toFixed(3)); });
}
addEventListener('resize', () => { if (view?.dataset.step === 'sheet') fitStage(); });
// The pack seals: the cards slide in, the top crimps with a flash and a Sealed stamp (about 0.9 s; instant with reduced motion).
function seal() {
  return new Promise((res) => {
    const st = view.querySelector('.sv-stage'); if (!st || matchMedia('(prefers-reduced-motion: reduce)').matches) { res(); return; }
    st.classList.add('sealing'); ctx.feel('medium');
    setTimeout(() => ctx.feel('heavy'), 520);
    setTimeout(res, 950);
  });
}

// ---------- sending ----------
let sending = false, sendRun = 0;
async function send() {
  if (sending) return; sending = true;
  /* leaving the pack page (back link, ✕) drops this share: the link used to arrive later and open the share sheet over
     another page, and Share stayed dead until then (the deep review, 2026-11-12) */
  const run = ++sendRun, stale = () => run !== sendRun || !view.open || view.dataset.step !== 'sheet';
  const btn = view.querySelector('[data-act="send"]'), was = btn?.textContent; if (btn) { btn.disabled = true; btn.textContent = 'Making the link…'; }
  try {
    const p = picked(), cards = new Set(p.map((s) => s.cardKey)).size;
    const link = await packLinkFor(p); /* js/pack-share.js, shared with Share my night */
    if (stale()) return;
    if (btn) btn.textContent = was;
    if (!link) { ctx.ticket({ kind: 'error', eyebrow: 'NO CONNECTION', line: 'Couldn’t make the link', sub: 'Check you’re online and try again.' }); return; }
    const title = `${plural(cards, 'card')} · Sky Collector`;
    await seal();
    if (stale()) return;
    const r = await shareLink(link, title);
    if (!r.ok) { view.querySelector('.sv-stage')?.classList.remove('sealing'); if (!r.cancelled) ctx.ticket({ kind: 'error', line: 'Couldn’t share the link', sub: 'Try again.', ms: 2600 }); return; }
    closeSend(); ctx.feel('success');
    ctx.ticket({ kind: 'info', icon: 'cards', line: r.copied ? 'Link copied' : 'Shared', sub: r.copied ? 'Paste it into a message to send the cards.' : `Your cards stay on this ${ctx.PH} too.`, ms: 3200 });
    ctx.note?.('copy', cards);
  } catch (e) {
    console.warn('send failed', e);
    if (!stale()) ctx.ticket({ kind: 'error', eyebrow: 'COULDN’T SHARE', line: 'Something went wrong making the link', sub: 'Try again.' });
  } finally { if (run === sendRun) sending = false; if (btn?.isConnected) { btn.disabled = false; if (was) btn.textContent = was; } }
}

// ---------- events ----------
function onInput() {}
function onClick(e) {
  const t = e.target.closest('button'); if (!t || !view.contains(t)) return;
  const act = t.dataset.act;
  if (t.dataset.tab) { sel.tab = t.dataset.tab; ctx.feel('select'); renderPick(); return; }
  if (t.dataset.card) { const k = t.dataset.card; sel.cards.has(k) ? sel.cards.delete(k) : sel.cards.add(k); t.classList.toggle('on', sel.cards.has(k)); t.setAttribute('aria-pressed', String(sel.cards.has(k))); ctx.feel('select'); const sr = view.querySelector('.sv-selrow'); if (sr) { const n = owned().length; sr.firstElementChild.textContent = `${sel.cards.size.toLocaleString('en-US')} of ${plural(n, 'card')}`; sr.querySelector('.sv-sa').textContent = sel.cards.size === n ? 'Select none' : 'Select all'; } renderBar(); return; }
  if (t.dataset.night) { const k = Number(t.dataset.night); sel.nights.has(k) ? sel.nights.delete(k) : sel.nights.add(k); ctx.feel('select'); keepScroll(renderBody); renderBar(); return; }
  switch (act) {
    case 'close': closeSend(); break;
    case 'back': renderPick(); break;
    case 'all-cards': { const list = owned(); if (list.every((x) => sel.cards.has(x.key))) sel.cards.clear(); else list.forEach((x) => sel.cards.add(x.key)); ctx.feel('select'); keepScroll(renderBody); renderBar(); break; }
    case 'all-nights': { const ns = nights(); if (ns.every((n) => sel.nights.has(n.k))) sel.nights.clear(); else ns.forEach((n) => sel.nights.add(n.k)); ctx.feel('select'); keepScroll(renderBody); renderBar(); break; }
    case 'month': { const ns = nights().filter((n) => n.eve.toLocaleDateString([], { month: 'long', year: 'numeric' }) === t.dataset.month); const all = ns.every((n) => sel.nights.has(n.k)); ns.forEach((n) => (all ? sel.nights.delete(n.k) : sel.nights.add(n.k))); ctx.feel('select'); keepScroll(renderBody); renderBar(); break; }
    case 'gap-add': t.dataset.k.split(',').forEach((k) => sel.nights.add(Number(k))); keepScroll(renderBody); renderBar(); break;
    case 'gap-no': sel.gapNo = gapNights(nights()).sig ?? ''; keepScroll(renderBody); break;
    case 'next': if (picked().length) { openSheet(); view.scrollTop = 0; } break;
    case 'send': send(); break;
  }
}
function keepScroll(fn) { const y = view.scrollTop; fn(); view.scrollTop = y; }
