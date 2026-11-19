// Space Collector Plus (2026-10-11, design/plans.html). One switch, isPlus(), that every paid perk checks. The sky,
// every card, patches and missions are never behind it. In the apps it comes from the store through RevenueCat
// (2026-10-16): the purchase belongs to the player’s Apple ID / Google account, no sign-in of ours. The last answer is
// kept (localStorage 'plusStore') so Plus holds offline. The testing toggle (Settings → Testing tools → "Plus
// (testing)", 'plusTest') still turns it on anywhere; the website never sells Plus.
import { plugin, isNative, onNative } from './native.js?v=0.1.1764';

// RevenueCat public SDK keys (safe in the app). The Test Store key works with no App Store / Play setup; swap in the
// appl_ / goog_ keys from RevenueCat → Project settings → API keys once the store apps are connected.
// RevenueCat public SDK keys (safe to ship). iOS is the real App Store key (2026-10-19); Android the real Play key
// (2026-11-05, app.spacecollector). TEST_KEY is used anywhere when Testing tools → "RevenueCat Test Store" is on.
/* Sky Collector's own RevenueCat project (2026-11-19, separate from Space Collector's): App Store app app.skycollector,
   products sky_plus_monthly / sky_plus_yearly / sky_plus_forever, offering 'default'. No Play app yet (docs/STORES.md). */
const TEST_KEY = 'test_HGiDdKNXGZeDqSATGXsjbRpoHtS';
const RC_KEYS = { ios: 'appl_vgcqsIxuwiDKZCgqvnKKtpcWHvo', android: '' };
const ENTITLEMENT = 'sky_collector_plus'; // RevenueCat → Entitlements (display name Sky Collector Plus)
const listeners = new Set();
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const testing = () => ls.get('plusTest') === '1';
const fromStore = () => ls.get('plusStore') === '1';
export function isPlus() { return testing() || fromStore(); }
const emit = (was, how) => { const on = isPlus(); if (on !== was) for (const f of listeners) try { f(on, how); } catch {} };
export function setPlusForTesting(on) { const was = isPlus(); ls.set('plusTest', on ? '1' : '0'); emit(was, 'testing'); }
export function onPlus(f) { listeners.add(f); return () => listeners.delete(f); }

// ---- the store (native apps only) ----
const rc = () => (isNative() ? plugin('Purchases') : null);
let ready = null;
// Plus = the sky_collector_plus entitlement; any other active one counts too, in case it’s ever renamed.
const active = (info) => { const a = info?.entitlements?.active ?? {}; return !!(a[ENTITLEMENT] ?? Object.values(a).find((e) => e?.isActive)); };
function apply(info, how = 'store') { if (!info) return; const was = isPlus(); ls.set('plusStore', active(info) ? '1' : '0'); emit(was, how); }
export const rcTestStore = (on) => (on === undefined ? ls.get('rcTestStore') === '1' : ls.set('rcTestStore', on ? '1' : '0'));
// Whether this app can sell Plus yet: no while its platform only has the Test Store key (Android until the goog_ key is in).
export function storeOpen() {
  if (!isNative()) return false;
  const ios = /iP(hone|ad|od)|Mac/.test(navigator.userAgent), key = ls.get('rcTestStore') === '1' ? TEST_KEY : ios ? RC_KEYS.ios : RC_KEYS.android;
  return !(key.startsWith('test_') && ls.get('rcTestStore') !== '1');
}
let watching = false;
export function initStore() {
  const p = rc(); if (!p || ready) return ready;
  const ios = /iP(hone|ad|od)|Mac/.test(navigator.userAgent), key = ls.get('rcTestStore') === '1' ? TEST_KEY : ios ? RC_KEYS.ios : RC_KEYS.android;
  // RevenueCat closes a release build (TestFlight, the App Store) that uses a Test Store key (2026-10-18, Sevaan: "the app
  // will close now"). So the Test Store key is only used when Settings → Testing tools → "RevenueCat Test Store" is on
  // (simulator and Xcode debug builds); otherwise there’s no store until the real appl_/goog_ keys are in RC_KEYS.
  if (key.startsWith('test_') && ls.get('rcTestStore') !== '1') return null;
  // A release build closes itself a few seconds after setup with the Test Store key, and did so on every launch after,
  // so the switch could never be turned off again (iPhone playtest 2026-10-26, build 33). A launch that dies within 20 s
  // of using it switches it off for the next one.
  if (key === TEST_KEY && isNative()) {
    if (ls.get('rcTestPending')) { ls.set('rcTestStore', '0'); ls.set('rcTestPending', ''); return null; }
    ls.set('rcTestPending', '1'); setTimeout(() => ls.set('rcTestPending', ''), 20000);
  }
  ready = p.configure({ apiKey: key }).then(() => true).catch((e) => { console.warn('store setup failed', e?.message ?? e); ready = null; return false; });
  ready.then((ok) => ok && refreshPlus());
  if (!watching) { watching = true; onNative('App', 'appStateChange', ({ isActive }) => { if (isActive) refreshPlus(); }); } // bought or cancelled elsewhere; once, though a failed setup retries (bug hunt 2026-10-22)
  return ready;
}
export async function refreshPlus() {
  const p = rc(); if (!p || !(await ready)) return;
  try { const r = await p.getCustomerInfo(); apply(r?.customerInfo ?? r); } catch (e) { console.warn('store check failed', e?.message ?? e); }
}
// The three plans as the store sells them: { month, year, once } → { pkg, price, trial }. Null off the apps or offline.
const TYPES = { month: 'MONTHLY', year: 'ANNUAL', once: 'LIFETIME' };
export async function storePlans() {
  const p = rc(); if (!p || !(await ready)) return null;
  try {
    const o = await p.getOfferings(), pkgs = o?.current?.availablePackages ?? [];
    const out = {};
    for (const [id, type] of Object.entries(TYPES)) {
      const pkg = pkgs.find((x) => x.packageType === type); if (!pkg) continue;
      const intro = pkg.product?.introPrice;
      out[id] = { pkg, price: pkg.product?.priceString ?? '', trial: intro && !intro.price ? (intro.periodUnit === 'WEEK' ? 7 * intro.periodNumberOfUnits : intro.periodUnit === 'DAY' ? intro.periodNumberOfUnits : 0) : 0 };
    }
    return Object.keys(out).length ? out : null;
  } catch (e) { console.warn('store plans failed', e?.message ?? e); return null; }
}
// Buy one: resolves 'ok' | 'cancelled' | 'pending' | 'error' (with the store’s message).
export async function buyPlus(plan) {
  const p = rc(); if (!p) return { result: 'error', message: 'Plus is sold in the App Store and Google Play apps.' };
  if (!plan?.pkg) return { result: 'error', message: 'The store isn\u2019t answering. Try again in a moment.' };
  try { const r = await p.purchasePackage({ aPackage: plan.pkg }); apply(r?.customerInfo, 'bought'); return { result: isPlus() ? 'ok' : 'pending' }; }
  catch (e) {
    const cancelled = e?.data?.userCancelled || e?.userCancelled || String(e?.code) === '1' || /cancel/i.test(e?.message ?? '');
    if (cancelled) return { result: 'cancelled' };
    if (String(e?.code) === '20' || /pending|deferred/i.test(e?.message ?? '')) return { result: 'pending' }; // Ask to Buy
    return { result: 'error', message: e?.message ?? 'The purchase didn\u2019t go through.' };
  }
}
// Restore: resolves true when Plus is on afterwards.
// Redeem a code (2026-11-06, Sevaan: codes for friends, testers and Reddit). iPhone: Apple's own sheet over the app (offer
// codes for the yearly plan or Lifetime); the purchase comes through RevenueCat as usual. Android has no in-app sheet, so the
// Play Store's redeem page opens, and the next time the app comes back the purchases are synced (a code redeemed outside the
// app isn't seen until then). Returns 'sheet', 'store', 'closed' (no store on this build) or 'web'.
let syncOnReturn = false;
export async function redeemCode() {
  const p = rc(); if (!p) return 'web';
  if (!storeOpen()) return 'closed';
  await ready;
  if (/iP(hone|ad|od)|Mac/.test(navigator.userAgent)) {
    try { await p.presentCodeRedemptionSheet(); } catch (e) { console.warn('redeem sheet failed', e?.message ?? e); return 'closed'; }
    setTimeout(refreshPlus, 4000); return 'sheet';
  }
  if (!syncOnReturn) { syncOnReturn = true; onNative('App', 'appStateChange', ({ isActive }) => { if (isActive && syncOnReturn === 'away') { syncOnReturn = true; restorePlus(); } }); }
  setTimeout(() => { syncOnReturn = 'away'; }, 0);
  location.href = 'https://play.google.com/redeem'; // Capacitor hands web links outside the app to Android, which opens the Play Store
  return 'store';
}
export async function restorePlus() {
  const p = rc(); if (!p || !(await ready)) return null;
  try { const r = await p.restorePurchases(); apply(r?.customerInfo ?? r, 'restored'); return isPlus(); } catch (e) { console.warn('restore failed', e?.message ?? e); return null; }
}
// What Plus adds, in the order the Plus card lists them (2026-10-16, design/plus-sheet-card.html). `why` = the openPlus
// reason that leads with it (its label turns orange on the card).
export const PLUS_PERKS = [
  { why: 'reminders', name: 'Pass reminders', text: 'Alerts for any pass you choose.' },
  { why: 'rare', name: 'Rare alerts', text: 'A ping when a new Rare or better card passes.' },
  { why: 'widgets', name: 'Widgets', text: 'Tonight on your home and lock screen.' }, // every widget is Plus (2026-10-22, Sevaan)
  { why: 'shiny', name: 'Shiny forecast', text: 'When and where a shiny can happen.' },
  { why: 'backs', name: 'Card backs', text: '6 designs, or a random one each flip.' },
  { why: 'patch', name: 'Member patch', text: 'Only Plus members wear this one.' },
];
// Prices (2026-10-16, Sevaan). The yearly plan has the 7-day free trial; all three are shared with Family Sharing.
export const PLUS_PRICES = [
  { id: 'month', label: 'Month', price: '$1.99', note: '' },
  { id: 'year', label: 'Year', price: '$14.99', note: 'Save 37%', trial: 7 }, // the % is worked out from the shown prices (main.js shownPrices)
  { id: 'once', label: 'Forever', price: '$29.99', note: 'No subscription' },
];
