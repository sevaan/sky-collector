// Screen readers (VoiceOver, TalkBack): when a page, a sheet, the tour or the new-card reveal opens, the reading point
// moves into it and its name is spoken; when it closes, the reading point goes back to where it was. Without this a
// blind player opened Settings and VoiceOver stayed on the sky behind it (accessibility pass 2026-11-09).
// The Collection's own pop-ups are <dialog> elements, which browsers already handle.
const SEL = '[role="dialog"], .set-sheet, #onboard';
const before = new WeakMap();
function dress(el) {
  if (el.id === 'onboard') { el.setAttribute('role', 'region'); if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Setup'); }
  else { if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog'); if (!el.hasAttribute('aria-modal')) el.setAttribute('aria-modal', 'true'); }
  if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) { const h = el.querySelector('h1, h2, h3, .k, .set-sheet-card > b'); const t = h?.textContent.replace(/\s+/g, ' ').trim(); if (t) el.setAttribute('aria-label', t.slice(0, 80)); }
  if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
}
function opened(el) {
  dress(el); before.set(el, document.activeElement);
  // a frame later, so a field the page focuses itself (the city search) keeps the focus
  requestAnimationFrame(() => { if (!el.hidden && !el.contains(document.activeElement)) { try { el.focus({ preventScroll: true }); } catch {} } });
}
function closed(el) {
  const back = before.get(el); before.delete(el);
  const a = document.activeElement;
  if (back && back.isConnected && back !== document.body && (!a || a === document.body || el.contains(a))) { try { back.focus({ preventScroll: true }); } catch {} }
}
new MutationObserver((recs) => {
  for (const r of recs) { const el = r.target; if (!el.matches?.(SEL)) continue; const wasHidden = r.oldValue !== null; if (wasHidden && !el.hidden) opened(el); else if (!wasHidden && el.hidden) closed(el); }
}).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
