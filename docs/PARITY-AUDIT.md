# Sky Collector vs Space Collector: behaviour parity audit

Read-only audit, 2026-11-15. Every item is read from the code, not guessed. "SC" = Space Collector's code in this repo
(`js/card.js`, `js/cards-page.js`, `js/reveal.js`, `js/main.js`); "Sky" = the new modules (`js/flight-card.js`,
`js/sky-collection.js`, `js/sky-catch.js`, `js/sky-today.js`, `js/sky-progress.js`) and the SKY_ONLY branches in `main.js`.
Items marked (verify) are inferred from code paths and should be checked on a phone. Ranked by how often a player hits it.

Root cause behind most of the card gaps: Sky's cards are `.fc` articles (`flight-card.js` `shell()`), not SC's `.card`
(`card.js` `renderCard`, which carries `.card__back`, `.card__rotator` and so on). Every SC helper that looks for
`.card__back` (`attachFlip`, `turnCard`, `spin`, `applyBack`) silently does nothing on a Sky card. And the Sky Collection
viewer (`#sky-viewer`) is a separate tiny dialog, so none of `#viewer`'s code (swipe, share, flick, keys, spin, position,
modal message, Android Back) applies to it.

---

## A. Hit on almost every session

### 1. Owned plane in the circle says "Stamped today" with a dead button, not "View card"
- SC: `main.js:1342` (`setTxt($('d-cta'), 'View card')`), tap -> `main.js:1466` `viewOwned()` -> `showViewCard()` (`main.js:1654`) -> `playView()` (`reveal.js:272`): the card spins out of the button, eyebrow "IN YOUR COLLECTION", Share and "View in collection" work, flick up to close.
- Sky: `sky-catch.js` `discoverPanel()` writes "Stamped today" and sets `cta.disabled = stamped`; the Sky branch of the tap handler (`main.js:1460`) returns without doing anything when disabled. Nothing opens.
- Fix: in `discoverPanel`, when `out.kind === 'none'` show "View card", leave it enabled and mark `el.dataset.view = '1'`. In the `main.js:1460` branch call a new `skyViewCard(hit)` that builds the same `flightCardHtml`/`planeCardHtml` as `skyReveal` (using `flightStampInfo`/`planeStampInfo` for that card and the stored catch for height/speed) and calls `playView({ card, o: {tier, name}, from: $('d-cta').getBoundingClientRect() })`; set `reveal-view` href to `cards.html#<card.key>`. No catch is saved (equivalent of SC's already-counted pass).

### 2. Double-tap does not flip a card anywhere (reveal, Collection viewer, owned view)
- SC: `card.js:556` `attachFlip` -> `turnCard` (`card.js:518`) flips the card to a back (`applyBack`, the chosen `CARD_BACKS` poster) with `sfx('flip')` + `feel('select')`; used in `cards-page.js:871`, `reveal.js` `finish()` (also `playView`). Single tap = orbit globe (satellite only). Back markup: `card.js:246` `<div class="card__back"><div class="back-holo"></div><div class="back-glare"></div></div>`.
- Sky: `flight-card.js` `shell()` has no `.card__back`. `attachFlip(card, {onBack: applyBack})` runs in the reveal (via `reveal.js` finish) but `flip()` returns at `if (!back) return` (`card.js:571`). `sky-collection.js` `openCard` never calls `attachFlip` at all.
- Fix: add `<div class="card__back" aria-hidden="true"><div class="back-holo"></div><div class="back-glare"></div></div>` to `shell()` inside `.fc` (CSS for `.card__back` is `cards.css:162`, needs `border-radius` matching `.fc` and `inset:0`; check `.fc-rot` does not clip it). Then in `sky-collection.js` `openCard` add `attachFlip(card, { onBack: (b) => applyBack(b, e.card), onTap: null })` (import from `card.js` and `card-backs.js`; `onTap: null` avoids `orbitTap` which would try `el._card`). Sky already ships its own 20 backs in `card-backs.js`.

### 3. Flick/slide/close gestures on the Collection viewer
- SC: close by flicking the card up (`cards-page.js:1025` `flickClose`, wired at the `$('slot')` pointerup just below it) with `throwOff` + sound; ✕ with a spin back into the tile (`closeViewer`, `spin`); Escape (native dialog); Android Back (message `back`, `cards-page.js` listener, closes `#viewer`).
- Sky: `sky-collection.js` `init()`: ✕ button and a click on `dlg` itself (dead: the dialog is `inset:0` full-screen, so `ev.target === dlg` is almost never true). No flick, no pull-down (`pull-close.js` is used only for main.js panels and stats-view), no spin.
- Android Back from the Collection tab closes the whole Collection instead of the card: `cards-page.js` `message` handler (`sc === 'back'`) only checks `sendOpen`, `#stats-view`, `#patch-view`, `#viewer`. (verify)
- Fix: after `openCard`, call `pullToClose(dlg, () => dlg.close(), dlg.querySelector('.scv-scroll'))` (wrap `.scv-body` in a scroller), and add the `$('slot')`-style flick handler on `.scv-card`, calling `throwOff(card, dx, dy, dt)` from `card.js:499`. Add a `message` listener in `sky-collection.js` for `sc === 'back'` that closes `#sky-viewer` and `stopImmediatePropagation()`s if open (or add `#sky-viewer` to the `back` chain in `cards-page.js`).

### 4. Reveal after a catch has no Share
- SC: `main.js:1636/1647/1659/1677` set `$('rv-share').hidden = false; revealShare = { card, o }`; handler `main.js:1684` -> `share-card.js` `shareCardEl` (1080x1350 image with the web address, native share sheet or download, toast "Saved the card image.").
- Sky: `skyReveal` (`main.js:943`) never touches `#rv-share` (hidden by default in `index.html:304`, and any stale `revealShare` is a leftover). So no share button in the reveal for planes.
- Fix: at the end of the `skyReveal` card build set `$('rv-share').hidden = false; revealShare = { card, o: { name: <title>, ... } }` and make the click handler tolerate a Sky model: replace `titleFor(r.o)` with `r.title ?? titleFor(r.o)` and call `shareElementPicture(card, title, { rootExtra })` (already exported by `share-card.js:61`). Add `.fc-glare, .fc-foil, .fc-coat, .fc-credit` to `SKIP` in `share-card.js:7` (they bake in tilt highlights) and make `extra` zero the transform on `.fc-rot` (SC does it for `.card__rotator`, `share-card.js:21`).

### 5. "View in collection" in the reveal does not open that card
- SC: `reveal-view` href is `cards.html#<cardKey>` (`main.js:1579, 1647, 1659, 1677`); the click interceptor (`main.js:7517-7526`) calls `openCollection(key)` which posts `{sc:'show', key}` and `cards-page.js:1265` `openKey()` opens that exact card in the viewer.
- Sky: `skyReveal` sets `$('reveal-view').href = 'cards.html'` (`main.js:952`): opens the Collection top, no card. `sky-collection.js` has no `message` handler for `show`/`open` + `key` at all (only `refresh`), and `cards-page.js:openKey` ignores Sky keys (`F:...`, `P:...`, not in `state.byKey`).
- Fix: set the href to `cards.html#${encodeURIComponent(card.key)}` and in `sky-collection.js` add: `window.addEventListener('message', ev => { if (ev.data?.sc==='show' || ev.data?.sc==='open') { const k = ev.data.key; ... switch to the right tab, clear the filter, openCard(entry) } })`, plus the same for `location.hash` at load (SC does it in `cards-page.js:boot`, ~line 140). For a flight reveal the key is the flight key; also let the plane strip/chip open the plane card.

### 6. Owned plane shows "NOT YET COLLECTED" on its ticket mini card
- SC: the owned ticket shows the real mini card of what you have (`setDiscMini(o)`, `main.js:1339`), with its level frame and footer.
- Sky: `sky-catch.js` `discoverPanel`: `miniCardHtml({ kind, card, type })` never passes `last`, `n`, `stamps` or `stampInfo`, so `flight-card.js:miniCardHtml` always prints "NOT YET COLLECTED" and no level medal, even for a card you own or a plane just stamped today.
- Fix: when `list.some(c => c.key === card.key)` pass `last` (newest catch time), `n` (count) and `stampInfo` (`flightStampInfo(list, key)` / `planeStampInfo`) into `miniCardHtml`. Include `out.kind` and the count in the cache key `mk`.

### 7. Tap feedback and speed of the Collect tap
- SC: `main.js:1467` `sfx('collect'); buzz(16);` the instant you tap, then `rushReveal` (`reveal.js:148`, called `main.js:1546`) starts the sweep from the ring before any work; a second tap is ignored (`state.captureBusy`).
- Sky: the Sky branch (`main.js:1460`) calls `collectPlane` which first `await lookupRoute()` (network) and only then `skyReveal` plays `sfx('collect'); buzz(16)` and the rush. On a cold route the tap looks dead for as long as the lookup takes. `d-hit` also lacks the `state.captureBusy` guard (it has its own `busy` flag in `sky-catch.js`, which also stays true until `show()` resolves, i.e. until the reveal is closed, so Collect on another plane is blocked while the reveal is up; fine, but nothing tells you).
- Fix: in the `main.js:1460` branch do `sfx('collect'); buzz(16); openPanel('reveal'); rushReveal({ origin, tier })` before `collectPlane`, pass `{rushed:true}` through (SC's `playReveal` already consumes `rush`), and `cancelRush(); closePanel('reveal')` when `collect()` returns null.

### 8. Level-up and stamp feedback in the reveal use Space's rules
- SC: `main.js:1593-1604` passes `fleet` (`newStamp`, `level`, `before`, custom `line`) and `progress` to `playReveal`; `reveal.js:166` then picks the eyebrow ("NEW LAUNCH STAMP"), glow, level-up burst, stamp toast and sounds (`payoffSound`, `sc:payoff` haptics `main.js:7938`).
- Sky: `skyReveal` calls `playReveal` with only `seen`, `origin`, `xp`, `rank`, `earned`. So `level = levelFor(seen)` uses Space's 3/10-night thresholds (`card.js:43`) on a *count of catches*, while Sky's levels are flights 1/5/15 and planes 1/10/50 (`sky-stamps.js:17`). Result: a gold/silver glow and level-up sound/burst appear at the wrong counts and never at the right ones; a stamp reads "SEEN AGAIN" in the eyebrow and gets the plain-repeat haptic (no `newStamp`).
- Fix: build `fleet = { newStamp: stamp, level, before: levelBefore, line: ... }` and `progress = { level, before, nights: 0 }` from `flightStampInfo/planeStampInfo` (the `levelUp` boolean is already in the `collect()` result) and pass them. `reveal.js:182` hard-codes "NEW LAUNCH STAMP"/"NEW PHASE STAMP": add an optional `eyebrow` param to `playReveal` for "NEW STAMP".

### 9. New card does not fly into the Collection tab; no milestone moments
- SC: `main.js:1637` `revealIntoBinder = ...` then `intoBinder()` (`main.js:5380`) flies a brand-new card into the Collection tab with "+1" when closed or flicked away; `reveal.js` also fires "Your first card" / 10, 25, 50... milestone tickets from `collected` (`finish()`, `PATCHED`/`MILESTONES`).
- Sky: `skyReveal` never sets `revealIntoBinder` (stays false) and passes no `collected`, so no binder flight, no milestone toast, and `onRevealSwipeIntoBinder` never fires.
- Fix: in `skyReveal`: `revealIntoBinder = !stamp && !isOwnedBefore; revealFaced = false;` and pass `collected: new Set(catches.map(c => c.key)).size`. (`binderReady()` and `intoBinder()` work off `#nav-collection`, which Sky keeps.)

---

## B. Collection page (frequent once a player has a few cards)

### 10. Card viewer: no swipe between cards, no "3 / 24", no keyboard
- SC: `cards-page.js:1068` `step()`, swipe handlers `1082-1135`, `v-position` counter (`showCard`, line ~880), ArrowLeft/Right (`$('viewer').addEventListener('keydown')`, after `sharePicture`), `feel('select')` and `sfx('page')`.
- Sky: `openCard` shows one card; to see the next you close and tap another.
- Fix: keep the current `all` array and index in `openCard`; copy the `slot` pointer swipe block (`1082-1135`) onto `.scv-card`, calling `openCard(all[i±1])` and wrap with `slideTo`. Add `#sky-viewer` keydown for arrows and a position label in `.scv-head` (SC `#v-position`).

### 11. Viewer has no Share and no Send (gift)
- SC: share icon in viewer header -> sheet "A picture / Send" (`cards-page.js:1154-1196`, `#v-sheet`), picture via `shareCardEl`, "Send" opens the gift flow with just that card.
- Sky: `#sky-viewer` has only ✕. Settings -> "Send cards" (`set-send-open`) is also dead for Sky: `main.js:6020` checks `state.sightings.some(x => !x.sim)` and toasts "Catch a card first" because plane catches live in `skyCatches`, not `state.sightings`; `send-cards.js` and `gift.js` only understand SC sightings.
- Fix (cheap half): a Share icon in `scv-head` calling `shareElementPicture(cardEl, title)` (`share-card.js:61`; see item 4 for SKIP changes). Gift needs a Sky-aware `gift.js` (catch -> link) or hide `#set-send-open` under `body.sky-only` in `css/sky.css:373` until then. Hide it now so it is not a dead row.

### 12. Rank card is a plain dial: no missions, streak, remind, events, "XP since last time", tap-through
- SC: `cards-page.js:477` `renderLogbook` (rank ladder picture, streak "N-week streak" + "Remind me Sat" button `remindStreak` line 379, missions list "Missions ›" expand, Sky challenge, Events chips, tap opens Observer stats, compact/expanded remembered `lbOpen`), `replaySince()` line 450 animates "+N XP since last time", rank card folds into the deck with the objects globe.
- Sky: `sky-collection.js` `rankCard()` draws rank name, XP, ring and "XP to next". Nothing else. (Missions/streak need a Sky progress model; `sky-progress.js` has only XP/rank.)
- Fix, in order of cheapness: (a) persist `colVisit = {at, xp}` like `saveVisit` and show "+N XP since last time" with the same animation (copy `primeSince`/`replaySince`, `cards-page.js:443-465`); (b) tap the card for a Sky stats sheet (cards, flights, planes, airlines, countries); (c) a weekly streak and 2-3 daily missions ("catch a plane with a callsign", "catch a helicopter") once `sky-progress.js` defines them; (d) `remindStreak` only after (c).

### 13. No tile feedback in the grid: NEW sticker, hold-to-peek, tilt, spin-open
- SC: NEW sticker for cards caught since last visit (`stickerOn`/`peelSticker`, `cards-page.js:437-442`, `freshKeys` in `colFresh`/`colPeeled`); hold a tile 380 ms to peek the full card (`holdToPeek` line 238); finger tilt on tiles (`attachTileTilt($('grid'))`, `starfield.js:20`); a tile spins out into the viewer and back (`spin`, line 975) with `feel('select')` and fade.
- Sky: `.sct` tiles are plain buttons (`sky-collection.js` `tile()`), instant `showModal()`, no haptic or sound.
- Fix: reuse `freshKeys`/`peeled` (same localStorage keys, keyed by Sky key) and add a `<span class="tile-new">NEW</span>` in `tile()`; call `peelSticker` in `openCard`. Add `feel('select')` (from `./haptics`/`native.js` as `cards-page.js` does) and `sfx('page')` on open. Spin-open: copy `spin()` + `fadeViewer()` using the tile rect.

### 14. No search, sort or rarity filter; no result count; tabs not sticky
- SC: search (`#search`, `matches()` line 149, word-start matching), Filters button with Album/Rarity/Sort (Newest, Rarest, A to Z), "N cards" result line + "Clear filters" (`resetFilters`), sticky tabs + tools (`collection.css:749-751`, `tabsPin`), tapping the active tab scrolls to top (`cards-page.js` `tab-patches` handler).
- Sky: only the Flights/Planes tab and a set/group chip row (`render()`), always newest-first; tabs scroll away with the page (`.scc-tabs` not sticky in `sky.css`). Once there are 30+ flights you cannot find one (no airline/city search).
- Fix: add a search box that filters on city, airline, callsign, aircraft name; a `Sort` select (Newest/Rarest/Most seen/A-Z) and a rarity chip row using `TIER_ORDER` (already defined and unused in `sky-collection.js`); `position: sticky; top: var(--col-top)` on `.scc-tabs`; show "N of M" and Clear.

### 15. Viewer content is shallower than SC's
- SC viewer extras: "Up tonight" panel with Remind me and Show me (`renderUpPanel`, `cards-page.js:752`), live "where it is now" line (`whereLine`), sighting rows with direction and elevation ("43° up in the north-east", `showCard`), a fleet dot map of stamps (`dotMap`, `card.js:313`), "Artwork preview" for unowned cards (`v-preview`).
- Sky: "WHEN YOU SAW IT" rows show time, callsign/registration and altitude only; no direction/elevation even though the catch records `az`? (it saves `rangeKm`, `altFt`, `gsKt`; not `az`/`el`: add them in `sky-catch.js` `collect` from `hit`); the stamps appear as the passport row on the card, which is fine and equivalent to SC's dot map. "Show me this plane again" has no equivalent (planes move on, so "Up tonight" is not applicable).
- Fix: store `az`/`el` in the catch entry and append `· 43° up in the north-east` using `dirWord` (already in `sky-today.js`) to each row; keep the rest as intentionally different.

### 16. Gyro tilt and motion permission on cards
- SC: `attachGyro(el, tilt)` (`card.js:464`) after `askMotion()` (`cards-page.js:849`), so the foil follows the phone; used in reveal, viewer, welcome card.
- Sky: viewer uses `attachTilt(card, { scroll: true })` only (`sky-collection.js` `openCard`), so the foil and glare move only under a finger. The reveal does have gyro (generic `reveal.js`).
- Fix: after `attachTilt` add `viewerGyro = attachGyro(card, viewerTilt)` guarded by `!matchMedia('(prefers-reduced-motion: reduce)').matches`, stop it on close; call the same permission ask as `cards-page.js:askMotion` on the first tap.

### 17. Collection layout while Explore's switcher is over it, and leaving the Collection
- SC: `cards-page.js` posts `{sc:'modal', on}` whenever `#viewer`, `#patch-view`, `#stats-view`, `#send-view` is open so Explore hides its switcher (`main.js:7475`, class `col-modal`), and on `away` closes those dialogs (`cards-page.js` `away` handler).
- Sky: `#sky-viewer` is not in either list. So Explore's pill sits over the bottom rows of the "When you saw it" list (the exact issue SC fixed 2026-10-11), and the viewer stays open (hidden) if you leave the Collection with it open. (verify)
- Fix: in `sky-collection.js` post `window.parent.postMessage({sc:'modal', on:true/false}, location.origin)` on open/close of `#sky-viewer`, and close it on `sc === 'away'`.

### 18. Albums, Patches, Find tabs have no Sky equivalent
- SC: Albums (`renderAlbums`, line 342, per-album progress, gold albums wear a special back), Patches (`renderPatches`, 1317, plus patch coin toasts after catches), Find (`renderFind`, 616: search the catalogue for something you do not have yet, with next pass and a bell).
- Sky: flights have a `set` field and `sky-collection.js` shows set chips, but there is no "3 of 12 in Across Canada", no gold set, no patches. The welcome card (`main.js:7598`) and How to play promise "earn patches as you go". Flights are generated from route data, so a finite "to find" list does not exist (Find is not directly portable). 
- Fix: a progress line on each set chip ("Across Canada 4 / 20" from the route table), an "Airlines" or "Airports" group, and a small patch set (first helicopter, first Gold, 10 airlines, a transatlantic flight) using `patches.js`'s wall renderer; until patches ship, change the welcome copy so it does not promise them.

### 19. Empty and loading states
- SC: "Opening the field guide…" loading state, notices on load failure (`notice()`), clear tab empty states with actions.
- Sky: has an empty state with a link. `render()` is synchronous so no loading state needed, but `load()` reads the localStorage mirror only: if a restore-from-backup is in progress the page can show "Your first flight" until the next `visibilitychange`. (verify, low)

---

## C. Explore / catch

### 20. Tapping a plane drawn in the sky does nothing; no "Aim at it" other than Show me
- SC: `main.js:5303` `tapSky` selects any satellite or planet under the finger (30 px) so the steering line leads you to it.
- Sky: `tapSky` only checks `sky.hits` (satellites) and `state.naturals`; plane markers are not in either, so planes can only be pinned via Today -> Show me.
- Fix: in `tapSky` also test `state.planeItems` (project `a.enu` with `sky.project`) and call the same code as `skyShowMe` (`state.planeGuide = {hex, name, lostAt:null}`).

### 21. Lock-on sound/haptic/pulse for planes differs
- SC: `main.js:797` `snapTick()` on lock: `buzz(12)` (de-duplicated), `sfx('lock')`, ring pulse `sky.lockPulseAt`. Setting "Snap onto targets" tunes it.
- Sky: `main.js:741` forces `state.lockedOn = false` when a plane is in the circle, so none of that runs; `renderPlane` does `sfx('plane')` + `buzz(8)` once per plane (`main.js:978`). Different sound/feel, no ring pulse, and Settings -> Snap onto targets does nothing for planes. (verify feel on device)
- Fix: call `snapTick(true)` in `renderPlane` when `planeShown !== hit.plane.hex`, drop the separate `sfx('plane')` or keep it as the second sound.

### 22. Screen reader announcement for the plane in the circle
- SC: `announceTarget(...)` (`main.js:1303`, `6069`) writes "Name, Rare. Double-tap to collect." to `#sr-target`.
- Sky: `renderPlane`/`discoverPanel` never call it; only `aria-label` on `#d-hit`. (verify with VoiceOver)
- Fix: `announceTarget(`${name}, ${tier.label}. ${stamped ? 'In your collection.' : 'Double-tap to collect.'}`)` in `discoverPanel`.

### 23. Toasts and chips after a catch: missions, patches, ticket for rank-up
- SC: `main.js:1620-1635` builds `news` (mission complete, patch, event, rank-up) shown as chips and `announceProgress` tickets; `reveal.js:399-430` `fillRank` animates the XP bar and rank-up wrap.
- Sky: rank bar and rank-up chip work (`skyXp()` passes `rank` and `earned`); no missions/patches/events/peak/shiny chips because those systems do not exist for planes. The chips Sky does show ("+ Planes", stamp) are fine.
- Fix: nothing to port until Sky has missions/patches (see 12 and 18); ensure the `earned` list also includes a "Level up: Silver" chip (`levelUp`) and "Milestone" chips (see 9).

### 24. Switching targets in the circle
- SC: `#t-switch`/`#d-switch` cycles candidates when several things overlap (`main.js:1488`); `switchLabel` currently returns `''`, so SC itself no longer shows it (2026-10-07 decision: a slight tilt moves the pick).
- Sky: `planeHit` picks the nearest plane to the centre (`main.js:812-834`) with a 400 ms hold; same intent. No gap.

### 25. Collect-time haptics for stamped/none
- SC: a tap on an owned object still gives feedback (opens the card).
- Sky: tapping the disabled button does nothing: no haptic, no sound, no toast ("Already stamped today. Come back tomorrow or catch another aircraft."). Fixed by item 1; if you keep a disabled state anywhere, add a toast with `buzz(8)`.

---

## D. Today vs Tonight

### 26. Today rows start "Show me" only; no card preview or owned-card view
- SC: a Tonight row opens the real card, or a preview if you do not own it (`showTonightCard`, `main.js:1664`) with Show me, and the bell sets a reminder (`remindIds`, `notifyAt`, `ud-sheet` "Remind me tonight").
- Sky: `sky-today.js` rows are buttons whose click is `ctx.show(hex)` = `skyShowMe` (closes Today and steers). Rows tagged "IN YOUR COLLECTION" cannot be opened; "Coming over next" rows are not interactive; there are no reminders. Reminders for individual planes are not meaningful (no schedule more than a few minutes ahead), so the nearest equivalent is "Notify me when a helicopter/rare plane is overhead", which needs a background fetch the app does not have: leave out.
- Fix: make a row tap open a bottom sheet with the card preview (`flightCardHtml` for a known route, else `planeCardHtml`, via `showTonightCard` pattern + `playView`), with Show me inside, and View card for owned ones. Keep Show me on the hero.

### 27. Today refresh and re-render
- SC: Tonight re-renders on events, keeps scroll.
- Sky: `renderSkyToday` rebuilds `innerHTML` every 10 s (`main.js:891`); a tap landing during the swap can be lost and a scrolled list may jump (verify). Fix: diff by `data-hex` or skip re-render while a finger is down on `#sky-today`.

---

## E. Settings and header

Rows wired to satellites that do nothing (or lie) for planes:
- **Send cards** (`index.html:357`, `main.js:6020`): always toasts "Catch a card first" (see 11). Hide under `body.sky-only` or build Sky gifting.
- **How to play** (`main.js:5710-5720` `HT_SLIDES`): all seven slides are satellite content ("Come back on other nights... silver on 3 nights", "Starlink stamps", "Look for secrets", "bell under the circle"). Replace with Sky slides (point, line up, Collect, flights vs planes, stamps and levels 1/5/15 and 1/10/50, where it came from).
- **Stars, planets & Moon**, **Milky Way**, **Constellation lines**, **Tree line**, **Sky labels** (`index.html:388-397`): affect the drawn night sky only; verify they still make sense on the daylight sky or hide them under `body.sky-only` like `css/sky.css:373`.
- **Sky events (PLUS)** (`index.html:404`): meteor showers; not shown in `sky.css:373` list (only `chk-meteor` row is hidden by `:has`, but this label's id differs). Verify it is hidden.
- **Feedback** (`index.html:420`): mailto subject is still "Space Collector feedback".
- **Testing tools**: Summon the UFO, Summon Santa, Shooting star, "Jump to next visible pass", "Open last night's pack" are satellite tools; hide them or label them.
- **Card back** works (Sky has its own set). **Airline logos** and **Plane positions** are Sky-specific and fine.
- **Header** (collection): `cards.html:36` has no night toggle behaviour wired for Sky mode and no Observer stats link (hidden by design; SC moved it to Settings). The ☾ button is `hidden`; fine.

---

## Suggested build order

1. Items 1, 2, 4, 5, 6 (small, all in `sky-catch.js`, `flight-card.js`, `skyReveal`, `sky-collection.js`): fixes the reported misses.
2. 7, 8, 9: reveal timing and stamp/level correctness.
3. 3, 10, 17: viewer close, swipe, modal/Back handling.
4. 13, 14, 11 (share half): tile polish, search and sort.
5. 12, 18: rank card depth, sets/patches (needs a Sky progress design).
6. Settings sweep (E) and How to play copy.
