# Sky Collector privacy page: draft for the store release

Written 2026-11-20. **Draft text, not HTML. Nothing published.** It replaces `site/public/privacy.html` (and the in-app copy), which still says it covers the test version and "will be rewritten before the game is in the app stores". It must be live at https://skycollector.app/privacy before either store form can be submitted.

**How to read it.** The text between the two lines of dashes is the page, in plain words (voice guide: short sentences, no hype). After each section, a **Checked** line says where I confirmed it in Sky's code or docs (2026-11-20, working tree with uncommitted changes), and **NOT VERIFIED** marks anything I could not confirm. Square-bracketed notes are for the Dev, not for the page. It matches the store privacy answers in `sky-store-listing-2026-11-20.md` (section 8) and `design/privacy-store-checklist.md`. Questions for Sky Dev are at the end.

Starting structure and tone: Space Collector's privacy page, and Sky's existing page, which already held most of the true facts.

---

# Privacy

*Last updated [date]. This covers the Sky Collector apps for iPhone and Android, the website skycollector.app, and the sample pack at skycollector.app/pack.*

**The short version.** Sky Collector uses your location to find the planes over you. There are no accounts. Your collection stays on your phone and in your own phone backup. There are no ads, no tracking and nothing is sold. The app sends a few anonymous usage notes, and you can turn them off.

## Your location

Sky Collector needs to know where you are to show the planes in your sky. If you allow precise location, your phone uses it to draw each plane where it really is. A plane 10 km away can be drawn several degrees off if the app only has an approximate position.

**Your precise position stays on your phone.** Everything that leaves your phone is rounded first, and it is used for two things only:

- **Planes near you.** The app asks adsb.lol for aircraft around a position rounded to about 5 km. If adsb.lol is busy, or your phone has used its daily allowance, it asks our own server instead, which passes on only the centre of a 1-degree square (about 110 km) to a second flight-data service, FlyItalyADSB. The search circle is a little bigger, so rounding never hides a plane. Our server keeps each answer in memory for under a minute and doesn't keep a record of who asked.
- **The weather.** The forecast for your area comes from Open-Meteo, asked with a position rounded to about 10 km.

The anonymous usage notes below never contain a location.

Like any service on the internet, each of these sees your internet address when your phone asks. Google Cloud, which runs our server, also keeps ordinary request logs for a limited time; [Dev: see question 1].

If you choose "Approximate" location in your phone's settings, the game still works. Planes may be drawn a little off, and Settings says so. You can also choose a city in Settings, or use the game without your location (it shows an example sky).

**Checked:** precise fix on the phone only; planes request rounded to 0.05° (about 5 km), radius 43 NM; relay passes the 1° square centre; weather rounded to 0.1°; usage notes carry no location: `design/privacy-store-checklist.md`, `js/planes.js feedPoint`, `tests/location-privacy.test.mjs`, `js/weather.js`, `server/planes-relay.js`. City search works offline (`js/cities.js`, GeoNames data), so no city name is sent anywhere. Example sky: old privacy page.
**NOT VERIFIED:** (a) the weather source: `js/weather.js` uses Open-Meteo directly because `SERVER` in `js/server.js` is empty; Open-Meteo's free plan is non-commercial, which is why Space moved to its own server (question 2). (b) How long Google Cloud's request log keeps the rounded point and address; the checklist says 30 days by default (question 1). (c) "Doesn't keep a record of who asked": true of the app's own code, not of Cloud Run's log (the same question).

## Where the planes come from

Aircraft broadcast their position publicly, and volunteers with receivers share those broadcasts. Sky Collector shows what they share, which is why coverage is strongest in North America and Europe and thinner elsewhere, and why not every aircraft appears.

- Aircraft data: **adsb.lol contributors, under the Open Database License (ODbL) 1.0** (https://www.adsb.lol).
- Backup feed: FlyItalyADSB, through our server.
- Routes come from Virtual Radar Server's standing data (CC0), bundled with the app.
- Aircraft photos and airline logos come from Wikimedia Commons. Each photo's author and licence are on its card. Airline names and logos belong to their owners and are used only to say which airline a flight is.

**Checked:** `docs/PRIVACY-AND-DATA.md` (ODbL, attribution text for Settings → Credits), `js/routes.js` (bundled `data/routes/`), the old page for photos and logos.
**NOT VERIFIED:** FlyItalyADSB's licence wording (the old page said CC BY-SA 4.0 for the website's source; the apps' backup feed is the same service, but I did not re-read its terms); whether photos and logos are bundled or fetched while you play (if fetched, Wikimedia sees your internet address: question 3); the routes file falls back to downloading from GitHub only if a bundled file can't load (question 3).

## The aircraft you see

For an airline flight, Sky Collector shows the **airline and the type**, and the **route** when it is known. Every other aircraft is anonymous in the game.

- **Private and business planes** (including fractional and charter business jets), helicopters, and any aircraft whose owner has asked not to be tracked publicly (the FAA's LADD and PIA programmes) show **the type only**.
- **Military, police, coast guard and other government aircraft** show **the type only**, such as a C-17 or a B-2, and only when they broadcast their position. Never a callsign, registration, unit or route, and they never get a flight card.
- The app never shows or keeps a registration, callsign or owner for these aircraft. An aircraft's transponder code is replaced on your phone by a scrambled number that only lets the game count different aircraft. It never leaves your phone.

Sky Collector can't follow a particular plane or person, and it doesn't try to. Nothing in the game rewards following one.

Questions, or an aircraft you'd like left out? Write to hello@skycollector.app.

**Checked:** `js/planes.js isAnonymous/anonId`, `js/plane-privacy.js isGovOrMil`, `js/gift.js` (packs scrub the same way), the old privacy page, `docs/PRIVACY-AND-DATA.md` items 4 and 5.
**NOT VERIFIED:** the removal-request route: `docs/PRIVACY-AND-DATA.md` still lists "a removal request route" as to do, and the old page offers one by email (question 4).

## Your collection and backups

Your cards, catches, patches and progress are stored on your phone. Each catch records the time, the aircraft and where you were standing, because that is part of the card.

- **iPhone:** your collection is backed up to **your own iCloud**, so it follows you to a new iPhone or iPad. We can't see it.
- **Android:** it is saved with your phone's own Google backup, about once a day.
- There is no sign-up and no account. Settings → Reset everything starts you again as a new player.

Sky Collector also keeps a tally on your phone of the aircraft types that have flown over you in the last 30 days. It's how the game knows what is rare where you are. It never leaves your phone.

**Checked:** `js/cloud-backup.js` (iCloud key 'sky-backup'; Android Auto Backup), the old page (30-day tally), Settings → Reset everything exists in the app.
**NOT VERIFIED:** that Reset everything also clears the iCloud backup (Space's does; question 5); that the Android Auto Backup is enabled in the Sky build's manifest (the native shell is not in this repo).

## Sending cards to a friend

When you send cards, the app puts the pack in a short link. The pack holds the cards you chose: what each card is (its type, and for an airline flight the airline and the route, when known) and when you saw it. **It holds no places and no names.** Cards for private, business and government aircraft carry the type only.

The pack is stored on our server under a random 7-character code for **90 days**, then deleted automatically. Anyone with the link can open it. If your phone is offline, a small pack travels inside the link itself and nothing is stored.

When you tap "Tell a friend", your friend gets a sample pack that opens in their browser and never touches your collection.

**Checked:** `server/index.js` (Firestore `sky_packs`, random id, 90-day TTL on `exp`; POST limited to app origins), `js/gift.js asGift` (drops lat, lon, azimuth, elevation, range), `scrubSightings`.
**NOT VERIFIED:** whether an airline flight's callsign (for example JST563) is inside a pack (the code scrubs private and government aircraft; airline callsigns are likely kept: question 6); the offline fallback exists in Sky as it does in Space; whether the TTL policy is enabled in Sky's own Firestore project (question 7); what the sample pack stores.

## Anonymous usage and error reports

To learn whether the game works for people (does a first day end with a card? do people come back?), the app sends a few anonymous notes: when it is opened, each day you catch something, how long a session lasted, what kind of aircraft each catch was (an airliner, a helicopter and so on) and its rarity, whether it was new, whether the phone's motion sensors work, whether the tour was finished or skipped, whether a reminder was set, how the plane feed did in that session, and errors that stop something working.

They are tied to a **random ID made on your phone**, plus the app version and whether it is an iPhone or Android. They hold **no location, no name, no device identifier, nothing from your contacts or photos, and nothing that identifies an aircraft** (no callsign, registration or transponder code). They are kept on our server (Google Cloud, in Sky Collector's own project) and used only to improve the game.

You can turn them off at any time: Settings → Help → **Share anonymous usage**.

**Checked:** `js/field-notes.js` and `server/index.js` NAMES (events: install, open, night, end, tour, motion, calib, plus, err, catch, share, boot, perm, secret, gift, feed, remind, rare…); `catch` carries kind, rarity, new; random id `tid`; Settings row exists ("Crashes and play counts, never your location").
**NOT VERIFIED:** how long events are kept (question 8); that the plane-feed note holds only counts (`js/main.js` ~2284); whether the server logs your internet address (question 1).

## Purchases

Sky Collector is free. **Sky Collector Plus** is optional and bought through the App Store or Google Play. We never see your payment details. To know whether Plus is on, the app uses RevenueCat, which receives an anonymous app user ID and the purchase record from the store. Subscriptions are managed in your Apple Account or Google Play settings.

**Checked:** `js/plus.js` (RevenueCat, store products).
**NOT VERIFIED:** exactly what RevenueCat holds for Sky (an anonymous ID only, no email or custom ID: question 9); whether Plus is on sale on Android yet (Sky Build: not yet, so the Android line may need to say "on iPhone for now").

## Notifications

Plane alerts and reminders are set **on your phone**; there is no server that sends them. Alerts are off until you turn them on, and the app can't find new planes while it is closed. The notification permission is the phone's own: you can change it any time in your phone's settings.

**Checked:** `js/sky-alerts.js` (set when you leave the app; 3 a day; quiet hours), `js/native.js` local notifications.

## The website

The sample pack at skycollector.app/pack never asks for your location. To put a real flight in the pack, the page reads your device's **time zone** (for example "America/Toronto"), picks that zone's big city, and asks our plane server for aircraft near the city's centre. Only the city's coordinates are sent, never yours. Our server sees your internet address when it is asked, like any website. If it doesn't answer in time, the pack shows a flight seen over a nearby city earlier. Nothing from the pack is kept.

**Checked:** the old privacy page. **NOT VERIFIED:** that the site has no analytics (I found none in `site/public/*.html`; question 10).

## What Sky Collector doesn't do

- No ads and no advertising trackers.
- No third-party analytics.
- No account and no sign-in.
- It never sells or shares your data.
- It doesn't use your contacts, photos or microphone. [Dev: confirm camera, photos and microphone permissions are absent from the native app: question 11.]

## Children

Sky Collector is made for everyone, including families. There are no accounts, and it collects no personal information from anyone, children included.

## Changes

If we change this page in a way that matters, we will say so here and change the date at the top.

## Contact

hello@skycollector.app

---

## Questions for Sky Dev

1. **Request logs.** Cloud Run logs each request's URL, which carries the rounded 0.05° point, and the caller's address, for 30 days by default (`docs/PRIVACY-AND-DATA.md`). Space excluded its API requests from the `_Default` sink on 2026-10-28. Has Sky done the same? If not, the sentence "Google Cloud also keeps ordinary request logs for a limited time" stays; if it has, I can cut it.
2. **Weather source.** `SERVER` in `js/server.js` is empty, so the phone asks Open-Meteo directly. Is Open-Meteo's free plan acceptable for an app that sells a subscription (Space moved off it for that reason)? If weather moves to Sky's own server, the page should say so.
3. **Fetches while playing.** Are airline photos and logos downloaded at runtime (Wikimedia) or bundled? Does the route file ever download from GitHub in the store build?
4. **Removal requests.** Is there a route for "an aircraft you'd like left out" besides email, and who answers hello@skycollector.app?
5. **Reset everything:** does it clear the iCloud backup?
6. **Packs:** does a pack contain an airline flight's callsign? Is the offline fallback (small packs inside the link) in Sky?
7. **Firestore TTL:** is the 90-day policy on `sky_packs.exp` enabled in the `sky-collector-app` project?
8. **Retention:** how long does Sky keep `sky_events` rows? (Space: indefinitely, 120 days read.)
9. **RevenueCat:** anonymous ID only? Is Sky's app configured with no email or custom user ID?
10. **Website:** any analytics or log service on skycollector.app or /pack besides Firebase Hosting's own?
11. **Permissions:** the native shell isn't in the checkout I read. Confirm the Android manifest and Info.plist: location (precise and approximate), motion, notifications; no camera, photos, microphone, contacts.
12. **adsb.lol terms:** does the ODbL attribution appear in Settings → Credits as well as here?

## Decisions for Boss and Sevaan

1. The aircraft-you-see wording now says "the route when it is known", matching Sky Dev's finding that some airline flights have no route data. Confirm.
2. Is the page for the store apps only, or does the old test-site wording stay in a separate "Website" section (as drafted)?
3. Date and who publishes. I published nothing.
