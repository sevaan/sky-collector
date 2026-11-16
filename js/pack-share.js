// Sharing cards as a pack link (2026-11-11): Send cards and "Share my night" both make the link here and hand it to the
// phone's share sheet. The pack waits on our server (functions/index.js /api/pack, 90 days) and the link carries only its
// id; offline, a small pack still fits in the link itself.
import { packGift, giftCode, giftLink, packLink } from './gift.js?v=0.1.1586';
import { plugin } from './native.js?v=0.1.1586';
import { SERVER } from './server.js?v=0.1.1586';
import { backupBid } from './cloud-backup.js?v=0.1.1586';

// The link for these sightings, or null with no connection and too many cards to fit in the link.
export async function packLinkFor(sightings, { kind = '' } = {}) {
  const code = await giftCode(packGift(sightings, { bid: backupBid(), kind }));
  try { const r = await fetch(`${SERVER}/pack`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: code, signal: AbortSignal.timeout(10000) }); if (r.ok) { const { id } = await r.json(); if (/^[A-Za-z0-9]{7}$/.test(id)) return packLink(id); } } catch {}
  return code.length <= 6000 ? giftLink(code) : null;
}
const viaName = (a = '') => (/CopyToPasteboard/i.test(a) ? 'copied' : '');
// The share sheet with the link alone (with text too, iOS Copy put only the text on the clipboard: iPhone 14 simulator
// 2026-11-07). Resolves { ok, copied, cancelled }.
export async function shareLink(link, title) {
  const share = plugin('Share');
  if (share) {
    try { const r = await share.share({ title, url: link, dialogTitle: title }); const via = viaName(r?.activityType); return { ok: true, via, copied: via === 'copied' }; }
    catch (e) { return { ok: false, cancelled: /cancel/i.test(e?.message ?? '') }; }
  }
  if (navigator.share) {
    try { await navigator.share({ title, url: link }); return { ok: true, via: '' }; }
    catch (e) { return { ok: false, cancelled: e?.name === 'AbortError' }; }
  }
  try { await navigator.clipboard.writeText(link); return { ok: true, via: 'copied', copied: true }; } catch { return { ok: false }; }
}
