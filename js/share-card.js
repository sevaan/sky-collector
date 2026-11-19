import { isNative, shareFile } from './native.js?v=0.1.1734';
// Share a card as an image (1080 × 1350, Instagram portrait): the card on screen, drawn as it looks (js/dom-snap.js, so
// the image always matches the card's design; 2026-10-31, Sevaan), on a starry background with the game's web address under
// it (was the observer rank; 2026-11-02, Sevaan), then handed to the share sheet (navigator.share with a file) or downloaded.
import { snapElement } from './dom-snap.js?v=0.1.1734';
const W = 1080, H = 1350, INK = '#fff2b3', MUTED = '#bdbea9';
// Left out of the picture: the tilt glare and foil (they depend on how the phone was held), twinkles, the back face, the
// fact's Source link and the "Tap for its orbit" hint.
const SKIP = '.card__glare, .card__foil, .card__shine, .art-stars, .card__back, .back-holo, .back-glare, .card__fact .src';

export async function drawShareCard(el, { rootExtra = '', extra = null } = {}) {
  const doc = el.ownerDocument, html = doc.documentElement, body = doc.body;
  // A shared card is never red: red night mode is lifted while the card is copied (the copy is made before snapElement's first await).
  const theme = html.dataset.theme, night = body.classList.contains('night');
  if (theme === 'night') delete html.dataset.theme; body.classList.remove('night');
  const pad = 24, fitW = 900, fitH = 1180;
  const s = Math.min((fitW + pad * 2) / (el.offsetWidth + pad * 2), (fitH + pad * 2) / (el.offsetHeight + pad * 2));
  const snap = snapElement(el, { scale: s, pad,
    skip: (n) => n.matches(SKIP),
    skipPseudo: (n, p) => p === '::after' && n.classList.contains('card__art'),
    extra: (n) => (n === el && rootExtra ? rootExtra : '') + (n.classList.contains('card__rotator') ? 'transform:none;' : '') + (extra?.(n) ?? '') });
  if (theme === 'night') html.dataset.theme = theme; if (night) body.classList.add('night');
  const card = await snap;
  await Promise.all(['500 30px "SC Label"'].map((f) => document.fonts?.load(f).catch(() => {})));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  // Background and a scatter of stars.
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0e1830'); bg.addColorStop(1, '#05080f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 160; i++) { ctx.globalAlpha = 0.2 + rnd() * 0.6; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * 1.6 + 0.3, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  // The card, centred above the address.
  ctx.drawImage(card, (W - card.width) / 2, (H - 60 - card.height) / 2);
  // Under the card: where to get the game.
  ctx.letterSpacing = '4px'; ctx.font = '500 26px "SC Label", sans-serif'; ctx.fillStyle = MUTED; ctx.textAlign = 'center';
  ctx.fillText('www.skycollector.app', W / 2, H - 34);
  return c;
}

// The system share sheet with the image (native apps and phones), else a download (QA 2026-10-11).
export async function shareCard(canvas, filename, title) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (await shareFile(blob, filename, { title })) return 'shared';
  if (isNative()) return 'failed';
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}

// Share the card element on screen (collection viewer, capture reveal) as it looks. c: catalogue card (unused, kept for callers).
// Returns 'shared' | 'cancelled' | 'downloaded'.
export async function shareCardEl(el, c, { title }) {
  const canvas = await drawShareCard(el);
  // Readable file names with the game’s name (2026-10-12, Sevaan): "Space Collector - Arcturus.png".
  return shareCard(canvas, `Sky Collector - ${title.replace(/[\\/:*?"<>|]+/g, '').trim()}.png`, `${title} · Sky Collector`);
}

// Share any card-shaped element on screen as the same kind of picture (2026-11-11: the morning pack's summary card).
// rootExtra: styles for the copied element itself (e.g. lifting it out of its on-screen centring).
export async function shareElementPicture(el, title, { rootExtra = '', extra = null } = {}) {
  const canvas = await drawShareCard(el, { rootExtra, extra });
  return shareCard(canvas, `Sky Collector - ${title.replace(/[\\/:*?"<>|]+/g, '').trim()}.png`, `${title} · Sky Collector`);
}
