// Send cards, the sending side (2026-11-07, design/send-cards.html; rules in js/gift.js). A full-screen page in the
// Collection: pick cards (By card) or nights (By night), and the phone's own share sheet sends a link (no names: you
// know who sent it; 2026-11-07, Sevaan).
// Sharing only copies: the cards stay on this phone too (2026-11-07, Sevaan: "we don't need Move as a concept... I don't
// see anyone getting rid of cards they've collected"). Built by cards-page.js, which hands in what it knows (ctx).
import { plural, ownSightings } from './gift.js?v=0.1.1838';
import { nightKey } from './observation.js?v=0.1.1838';
import { TIER_INFO } from './rarity.js?v=0.1.1838';
import { packLinkFor, shareLink } from './pack-share.js?v=0.1.1838';
import { createPicks, toggle, allPicked, countPicked, pickShown, pickedSightings, countLine, filtersOn } from './send-pick.js?v=0.1.1838';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const day = (t) => new Date(t).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
// The evening a night belongs to (a 1 AM catch is the evening before).
const eveningOf = (s) => new Date(s.time - (new Date(s.time).getHours() < 12 ? 86400e3 : 0));

let ctx = null, view = null, sel = null;
const $ = (id) => document.getElementById(id);

/* Sky Collector: days, not nights (2026-11-19). Read when used: this module loads before cards-page.js marks the page sky-cards. */
const sky = () => document.documentElement.classList.contains('sky-cards') || (() => { try { return !!window.parent?.__skyOnly; } catch { return false; } })();
export function initSend(c) { ctx = c; view = $('send-view'); if (!view) return; try { new Image().src = 'assets/art/backs/back-collector-mask.webp'; } catch {} /* the pack's gold artwork is ready before the pack shows */ view.addEventListener('cancel', (e) => { e.preventDefault(); closeSend(); }); view.addEventListener('click', onClick); view.addEventListener('input', onInput); }

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
/* By card and By day add up: picks made in either stay, across tabs, searches and filters (js/send-pick.js, 2026-11-20) */
const dayOf = (s) => nightKey(s.time, s.lon ?? 0);
const picked = () => pickedSightings(real(), sel, dayOf);

// ---------- open / close ----------
// opts.only: send these card keys straight away (from a card).
export function openSend(opts = {}) {
  if (!view || !ctx) return;
  sel = createPicks({ kind: ctx.kinds?.[0]?.id ?? null, only: opts.only ?? null });
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
/* By card has the Collection's own header pieces (2026-11-20, Sevaan: "this list of cards can get really long too. Probably
   needs planes and flights tabs and search stuff under it"): its tab strip (ctx.kinds: Sky's Planes / Flights; Space
   has none), a copy of its search field, Filters button and filter menus, and its count line. Same classes, same look. */
function renderPick() {
  view.dataset.step = 'pick'; sendRun++; sending = false;
  const tabs = `<div class="sv-tabs" role="tablist"><button type="button" role="tab" data-tab="card" aria-selected="${sel.tab === 'card'}">By card</button><button type="button" role="tab" data-tab="night" aria-selected="${sel.tab === 'night'}">${sky() ? 'By day' : 'By night'}</button></div>`;
  const ks = kinds(), strip = ks ? `<div class="collection-tabs sv-kinds" aria-label="Cards to pick from">${ks.map((k) => `<button type="button" data-kind="${esc(k.id)}" aria-pressed="${sel.kind === k.id}">${esc(k.label)} <span class="tab-count" data-n="${esc(k.id)}">0</span></button>`).join('')}</div>` : '';
  view.innerHTML = `<div class="sv-page">${head('Pick what to share', 'Send cards')}${tabs}${strip}<div class="sv-tools-slot"></div><div id="sv-body"></div></div><div class="sv-bar" id="sv-bar"></div>`;
  const slot = view.querySelector('.sv-tools-slot'), tools = toolsCopy(); if (tools) slot.replaceWith(tools); else slot.remove();
  renderBody(); renderBar();
  requestAnimationFrame(pinTools);
}
const kinds = () => (ctx.kinds?.length > 1 ? ctx.kinds : null);
const unitOf = () => kinds()?.find((k) => k.id === sel.kind)?.unit ?? ['card', 'cards'];
// The Collection's search line and filter menus, copied (same markup, so the same styles by day and night); ids become data-f.
const F = { search: 'query', 'set-filter': 'set', 'rarity-filter': 'rarity', 'sort-by': 'sort' };
function toolsCopy() {
  const src = document.querySelector('main .collection-tools'); if (!src) return null;
  const t = src.cloneNode(true); t.classList.add('sv-tools');
  for (const el of t.querySelectorAll('[id]')) { if (F[el.id]) el.dataset.f = F[el.id]; el.removeAttribute('id'); }
  const fb = t.querySelector('.filters-btn'); if (fb) { fb.removeAttribute('aria-controls'); fb.setAttribute('aria-expanded', 'false'); fb.classList.toggle('active', filtersOn(sel)); }
  t.querySelector('.filter-row')?.classList.remove('open');
  for (const el of t.querySelectorAll('[data-f]')) el.value = sel[el.dataset.f];
  return t;
}
// The strip and the search line stay pinned at the top of the page as the cards scroll, as in the Collection; the ink under the tab slides.
function pinTools() { const bar = view.querySelector('.sv-kinds'); if (bar && !bar.hidden) { view.style.setProperty('--sv-tabs-h', `${bar.offsetHeight}px`); ctx.ink?.(bar); } else view.style.setProperty('--sv-tabs-h', '0px'); }
let cur = { shown: [], gen: 0 };
function renderBody() {
  const body = $('sv-body'); if (!body) return;
  const byCard = sel.tab === 'card', strip = view.querySelector('.sv-kinds'), tools = view.querySelector('.sv-tools');
  if (strip) strip.hidden = !byCard;
  tileIO?.disconnect(); keepIO?.disconnect(); tileIO = keepIO = null; cur.gen++;
  if (byCard) {
    const all = owned(), ks = kinds(), byKey = new Map(all.map((x) => [x.key, x]));
    if (tools) tools.hidden = all.length < 5; /* as in the Collection: a handful of cards needs no search (UX 2026-10-28) */
    if (ks) for (const k of ks) { const el = strip?.querySelector(`.tab-count[data-n="${k.id}"]`); if (el) el.textContent = all.filter((x) => ctx.kindOf(x.card) === k.id).length.toLocaleString(); }
    const inKind = ks ? all.filter((x) => ctx.kindOf(x.card) === sel.kind) : all, unit = unitOf();
    const list = ctx.list ? ctx.list(inKind.map((x) => x.card), { ...sel, query: sel.query.trim().toLowerCase() }) : inKind.map((x) => x.card);
    const shown = list.map((c) => c.key).filter((k) => byKey.has(k)); cur.shown = shown;
    if (!all.length) { body.innerHTML = '<div class="result-row"><span class="sv-results">No cards yet</span></div>'; return; }
    if (!inKind.length) { body.innerHTML = `<div class="result-row"><span class="sv-results">No ${esc(unit[1])} yet</span></div>`; return; }
    if (!shown.length) { body.innerHTML = `<div class="result-row"><span class="sv-results">${esc(countLine(0, 0, unit))}</span></div><div class="empty"><span class="empty__orbit empty__search" aria-hidden="true"><svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="21" cy="21" r="12"/><path d="M30 30 L40 40"/></svg></span><h2>No cards found</h2><p>Try a different name, album or rarity.</p><button type="button" data-act="clear">Clear filters</button></div>`; return; }
    body.innerHTML = `<div class="result-row"><span class="sv-results" aria-live="polite"></span><button type="button" class="sv-sa" data-act="all-cards"></button></div><div class="sv-grid">${shown.map((k) => tileHtml(byKey.get(k))).join('')}</div>`;
    countRow();
    /* the real mini cards, as in the Collection (2026-11-07, Sevaan: "Should be the mini cards") */
    const grid = body.querySelector('.sv-grid'), tiles = [...grid.children], gen = cur.gen;
    const fill = (t) => { if (t._filled || gen !== cur.gen) return; t._filled = true; t._queued = false; const x = byKey.get(t.dataset.card);
      try { const face = ctx.mini(x.card, x.list), pic = face.querySelector('.fc-pic, .card__art'), tick = document.createElement('span'); tick.className = 'sv-tick'; tick.setAttribute('aria-hidden', 'true');
        /* the pick marker sits in the picture's lower left corner, over no words (2026-11-20, Sevaan: it covered airport codes and names) */
        if (pic) pic.appendChild(tick); else t.appendChild(tick);
        t.querySelector('.sv-art').replaceChildren(face); } catch {} };
    /* far off screen, a tile goes back to an empty slot of the same size (as the Collection's grid does): 600 full cards
       at once is a lot of page to scroll and keep in memory */
    const empty = (t) => { if (!t._filled) return; t._filled = false; for (const im of t.querySelectorAll('img')) im.removeAttribute('src'); t.querySelector('.sv-art').replaceChildren(); t.querySelector(':scope > .sv-tick')?.remove(); };
    /* the first screenful now; the rest a few a frame as they come near (2026-11-11 jank audit) */
    const q = [], pump = () => { if (gen !== cur.gen) return; const t0 = performance.now(); while (q.length && performance.now() - t0 < 4) fill(q.shift()); /* 4 ms a frame, as the Collection grid */ if (q.length) requestAnimationFrame(pump); };
    const want = (t) => { if (!t._filled && !t._queued) { t._queued = true; q.push(t); if (q.length === 1) requestAnimationFrame(pump); } };
    fitMini(grid);
    const top = view.scrollTop, first = tiles.filter((t) => t.offsetTop + t.offsetHeight > top - 200 && t.offsetTop < top + view.clientHeight + 200);
    (first.length ? first : tiles.slice(0, 9)).slice(0, 15).forEach(fill);
    if ('IntersectionObserver' in window) {
      tileIO = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) want(e.target); }, { root: view, rootMargin: '900px 0px' });
      keepIO = new IntersectionObserver((es) => { for (const e of es) if (!e.isIntersecting) { const i = q.indexOf(e.target); if (i >= 0) q.splice(i, 1); e.target._queued = false; empty(e.target); } }, { root: view, rootMargin: '2400px 0px' });
      for (const t of tiles) { tileIO.observe(t); keepIO.observe(t); }
    } else tiles.forEach(want);
  } else {
    if (tools) tools.hidden = true;
    const ns = nights(), all = ns.length && ns.every((n) => sel.nights.has(n.k));
    let html = `<div class="sv-selrow"><span>Tick the ${sky() ? 'days' : 'nights'} to send</span>${ns.length ? `<button type="button" class="sv-sa" data-act="all-nights">${all ? 'Select none' : 'Select all'}</button>` : ''}</div><div class="sv-nights">`;
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
let tileIO = null, keepIO = null;
function fitMini(grid) { const w = grid?.querySelector('.sv-tile')?.clientWidth; if (w) grid.style.setProperty('--mini-s', (w / 280).toFixed(4)); }
addEventListener('resize', () => { fitMini(document.querySelector('#send-view .sv-grid')); if (view?.dataset.step === 'pick') pinTools(); });
function tileHtml(x) {
  const on = sel.cards.has(x.key);
  return `<button type="button" class="sv-tile${on ? ' on' : ''}" data-card="${esc(x.key)}" aria-pressed="${on}" aria-label="${esc(ctx.title(x.card))}"><span class="sv-art"></span></button>`;
}
// "3 of 10 planes picked" over what's shown, and Select all / Select none for just those cards.
function countRow() {
  const r = view.querySelector('.sv-results'), sa = view.querySelector('.sv-sa[data-act="all-cards"]'); if (!r) return;
  r.textContent = countLine(countPicked(sel.cards, cur.shown), cur.shown.length, unitOf());
  if (sa) sa.textContent = allPicked(sel.cards, cur.shown) ? 'Select none' : 'Select all';
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
  const p = picked(), cards = new Set(p.map((s) => s.cardKey)).size, word = sky() ? 'day' : 'night';
  /* the total across both ways of picking, every tab and search; the second line names the days, if any (2026-11-12,
     Sevaan didn't like 'every sighting of each' under By card) */
  const sub = (() => { if (!sel.nights.size) return sel.tab === 'card' || p.length ? '' : `pick a ${word}`; const n = nights().filter((x) => sel.nights.has(x.k)).sort((a, b) => a.k - b.k); if (!n.length) return ''; return n.length === 1 ? day(n[0].eve) : `${day(n[0].eve)} to ${day(n.at(-1).eve)} · ${plural(n.length, word)}`; })();
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
        <span class="lbl">${esc(plural(n, 'card'))}<small>${esc(plural(p.length, 'sighting'))}, ${p.length === 1 ? `with the ${sky() ? 'day' : 'night'} it was seen` : `each with the ${sky() ? 'day' : 'night'} it was seen`}</small></span></div></div>
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
// The search waits for a pause in typing, as the Collection's does; the menus apply at once.
let searchT = 0;
function onInput(e) {
  const f = e.target.dataset?.f; if (!f || view.dataset.step !== 'pick') return;
  sel[f] = e.target.value;
  if (f === 'query') { clearTimeout(searchT); searchT = setTimeout(() => renderBody(), 120); return; }
  view.querySelector('.sv-tools .filters-btn')?.classList.toggle('active', filtersOn(sel)); renderBody();
}
function onClick(e) {
  const t = e.target.closest('button'); if (!t || !view.contains(t)) return;
  const act = t.dataset.act;
  if (t.dataset.tab) { sel.tab = t.dataset.tab; ctx.feel('select'); renderPick(); return; }
  if (t.dataset.kind) { if (sel.kind === t.dataset.kind) return; sel.kind = t.dataset.kind; ctx.feel('select'); for (const b of view.querySelectorAll('.sv-kinds button')) b.setAttribute('aria-pressed', String(b === t)); ctx.ink?.(t.parentElement);
    const head = view.querySelector('.sv-kinds'); if (head && view.scrollTop > head.offsetTop) view.scrollTop = head.offsetTop; /* the new tab starts at its top, the tools still pinned */ renderBody(); return; }
  if (t.classList.contains('filters-btn')) { const open = t.getAttribute('aria-expanded') !== 'true'; t.setAttribute('aria-expanded', String(open)); t.closest('.collection-tools')?.querySelector('.filter-row')?.classList.toggle('open', open); return; }
  if (t.dataset.card) { const on = toggle(sel.cards, t.dataset.card); t.classList.toggle('on', on); t.setAttribute('aria-pressed', String(on)); ctx.feel('select'); countRow(); renderBar(); return; }
  if (t.dataset.night) { const k = Number(t.dataset.night); sel.nights.has(k) ? sel.nights.delete(k) : sel.nights.add(k); ctx.feel('select'); keepScroll(renderBody); renderBar(); return; }
  switch (act) {
    case 'close': closeSend(); break;
    case 'back': renderPick(); break;
    case 'all-cards': { pickShown(sel.cards, cur.shown); /* what's shown: this tab, this search */ for (const el of view.querySelectorAll('.sv-tile')) { const on = sel.cards.has(el.dataset.card); el.classList.toggle('on', on); el.setAttribute('aria-pressed', String(on)); } ctx.feel('select'); countRow(); renderBar(); break; }
    case 'clear': { sel.query = ''; sel.set = sel.rarity = 'all'; sel.sort = 'auto'; for (const el of view.querySelectorAll('.sv-tools [data-f]')) el.value = sel[el.dataset.f]; view.querySelector('.sv-tools .filters-btn')?.classList.remove('active'); renderBody(); break; }
    case 'all-nights': { const ns = nights(); if (ns.every((n) => sel.nights.has(n.k))) sel.nights.clear(); else ns.forEach((n) => sel.nights.add(n.k)); ctx.feel('select'); keepScroll(renderBody); renderBar(); break; }
    case 'month': { const ns = nights().filter((n) => n.eve.toLocaleDateString([], { month: 'long', year: 'numeric' }) === t.dataset.month); const all = ns.every((n) => sel.nights.has(n.k)); ns.forEach((n) => (all ? sel.nights.delete(n.k) : sel.nights.add(n.k))); ctx.feel('select'); keepScroll(renderBody); renderBar(); break; }
    case 'gap-add': t.dataset.k.split(',').forEach((k) => sel.nights.add(Number(k))); keepScroll(renderBody); renderBar(); break;
    case 'gap-no': sel.gapNo = gapNights(nights()).sig ?? ''; keepScroll(renderBody); break;
    case 'next': if (picked().length) { openSheet(); view.scrollTop = 0; } break;
    case 'send': send(); break;
  }
}
function keepScroll(fn) { const y = view.scrollTop; fn(); view.scrollTop = y; }
