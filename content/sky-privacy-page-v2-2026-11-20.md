# Sky Collector privacy page, for the store release (v2)

Written 2026-11-20. **Draft text, not HTML. Nothing published.** It is the blocker for store submission: the page at skycollector.app/privacy still says it covers the test version. This replaces `sky-privacy-page-2026-11-20.md` (the earlier pass, kept for diffing).

**How this file is laid out.** Part 1 is the page, clean, ready to turn into HTML. Part 2 is a table that checks every statement against Sky's code and docs, and marks what I could not verify. Part 3 is the questions for Sky Dev. **Publishes after the logging and weather fixes are live (Sevaan, 2026-11-20).** Updated the same day with Sky Dev's answers (`sky-privacy-answers-2026-11-20.md`). Part 1 is now written to be **true today**. Three sentences still change when a fix is live (②, ⑦, ⑧), and ① loses its dated caveat on 20 December 2026; and Part 1b gives each one both ways so the page can change in step with the deploys.

It follows Space Collector's privacy page for structure and tone, and agrees with the store answers in `sky-store-listing-2026-11-20.md` (section 8) and `design/privacy-store-checklist.md`.

---

## Part 1. The page

# Privacy

*Last updated [date]. This covers the Sky Collector apps for iPhone and Android, and the website skycollector.app.*

**The short version.** Sky Collector uses your location to find the planes over you, and your exact position never leaves your phone. There are no accounts. Your collection stays on your phone and in your own phone backup. There are no ads and no tracking, and nothing is sold. The app sends a few anonymous notes about how it is used, which you can turn off.

## Your location

Sky Collector needs to know where you are to show the planes in your sky. If you allow precise location, your phone uses it to draw each plane exactly where it is. With only an approximate location, a plane 10 km away can be drawn several degrees from where you see it.

**Your exact position stays on your phone.** Anything that leaves your phone is rounded first, and is used for two things only.

**To find the planes near you.** Your phone asks adsb.lol for aircraft around a position rounded to about 5 km. If adsb.lol is busy, or your phone has used its allowance for the day, it asks our own server instead. Our server passes on only the centre of a much larger square, about 100 km across, to a second service, FlyItalyADSB. It holds each answer for under a minute and keeps no record of who asked. (Until 20 December 2026, some older request logs, with an internet address and the rounded position, are still ageing out. No new ones are kept.) ①

**To get the weather.** The forecast comes from Open-Meteo, asked with a position rounded to about 10 km. ②

Like any service on the internet, each of these sees your internet address when your phone asks it.

You don't have to share your location. Choose "Approximate" in your phone's settings and the game still works; planes may be drawn a little off, and Settings says so. Or pick a city in Settings. The city list is inside the app, so the name you type goes nowhere.

## The aircraft you see

Aircraft broadcast their own position, and volunteers around the world pick up those broadcasts and share them. Sky Collector shows what they share. That is why coverage is best in North America and Europe and thinner elsewhere, and why not every aircraft appears.

**Airline flights.** For a scheduled airline flight, Sky Collector shows the airline and the kind of plane, and the route when it is known.

**Everything else is anonymous.** Private and business aircraft, including charter and shared business jets. Military, police, coast guard and other government aircraft. Any aircraft whose owner has asked not to be tracked publicly. For all of these, Sky Collector shows the kind of aircraft and nothing else: never a callsign, a registration, an owner, an operator, a unit or a route.

The code that identifies each of those aircraft is replaced on your phone with a scrambled number. It only lets the game tell one aircraft from another, and it never leaves your phone.

Sky Collector is a collecting game. It can't follow a particular plane or person, and nothing in it rewards trying.

## Your collection

Your cards, patches and progress are stored on your phone. Each catch keeps the time, the aircraft and where you were standing, because that is part of the card.

- **On iPhone,** your collection is backed up to your own iCloud, so it follows you to a new iPhone or iPad. We can't see it.
- **On Android,** it is saved with your phone's own Google backup, if you have that turned on.
- There is no account and nothing to sign in to. Settings → Reset everything deletes your cards, patches, settings and reminders from this phone, and your iCloud backup if you have one, and starts you again as a new player. The random ID on the usage notes stays the same.

The app also keeps a count, on your phone, of the kinds of aircraft that have flown over you in the last 30 days, and the times your regular flights usually pass. That is how it knows what is rare where you are and when to look up. Neither leaves your phone.

## Sending cards to a friend

When you send cards, the app makes a short link. Behind it is a pack: the cards you chose and when you caught them, with the flight number for an airline flight. **A pack never holds where you were, and never holds your name.** Cards for private, military and government aircraft carry only the kind of aircraft, as everywhere else.

The pack is kept on our server under a random code for 90 days, then deleted. Anyone who has the link can open it, so send it only to people you mean to.

"Tell a friend" sends a sample pack instead. It has nothing of yours in it.

## Anonymous usage notes

To learn whether the game works for people (does a first day end with a card? do people come back?), the app sends a few notes about how it is used: when it was opened and for how long; what kind of aircraft a catch was, how rare, and whether it was new to you; which parts of the app you used (the tour, including whether you shared your location, chose a city or skipped that step, but never where you are; reminders; alerts; sending cards; Plus, and which plan if you buy it; the review prompt; the app icon you chose); how the app is doing on your phone (whether motion sensors and notifications work, how you lined up the compass and how far the sky turned, where the sky slider is set, how long it took to start, how the plane feed did); which secrets you've found; how cloudy the forecast was; and any error that stopped something working, with the error's message and the file it came from.

Each note carries a random ID made on your phone, the app's version, and whether the phone is an iPhone or an Android phone. The notes for opening the app and for a day you caught something also say how many days it has been since you installed, and how many cards and days of play you have. **It carries no location, no name and no device identifier, and nothing that identifies an aircraft.** The notes are kept on our server, in Google Cloud, and used only to improve the game. ⑦

To turn them off: Settings → Help → Share anonymous usage.

## Purchases

Sky Collector is free. Sky Collector Plus is optional, and is bought through the App Store. (It is not on sale on Google Play yet.) We never see your payment details. To know whether Plus is on, the iPhone app uses a service called RevenueCat, which receives the store's record of the purchase and an anonymous ID. It never gets your name or email.

## Notifications

Plane alerts and reminders are made on your phone. No server sends them, and the app can't look for planes while it is closed. Alerts are off until you turn them on.

## The website

skycollector.app has no accounts and no advertising or analytics trackers.

The sample pack at skycollector.app/pack never asks for your location. To put a real flight in the pack, it reads your device's time zone, picks that zone's main city, and asks our server for aircraft near the middle of that city. Only the city's position is sent, never yours.

## What Sky Collector doesn't do

- No ads.
- No tracking across apps or websites.
- No selling or sharing of your data.
- No accounts.
- No use of your contacts, photos or microphone. ⑧

## Children

Sky Collector is made for everyone, families included. It has no accounts and collects no personal information from anyone, children included.

## Changes to this page

If this page changes in a way that matters, we'll say so here and update the date at the top.

## Contact

Questions? Email hello@skycollector.app

---

## Part 1b. Sentences that change with a deploy

Part 1 above is the "true today" column. Swap in the right-hand sentence the day its fix is live, not before.

| | True today (in Part 1) | True after the fix | The fix, and who |
|---|---|---|---|
| ① | **LIVE since 2026-11-20** (Sky Dev, with Sevaan's yes). Part 1 now has the after-fix sentence plus a dated caveat. | From 20 December 2026, delete the sentence in brackets, leaving: "It holds each answer for under a minute and keeps no record of who asked." | Done. Only the caveat's removal is pending, by date. |
| ② | **To get the weather.** The forecast comes from Open-Meteo, asked with a position rounded to about 10 km. | **To get the weather.** The forecast comes from MET Norway, through our own server, asked with a position rounded to about 10 km. | The server side (`/wx`) is LIVE; the app switch (v0.1.1817) is committed but not pushed. Until that build is what players have, the app really does ask Open-Meteo, so the left sentence is the true one. (Open-Meteo's free plan doesn't cover an app with a subscription: this fix should not wait long.) Credits change with it. |
| ⑦ | The notes are kept on our server, in Google Cloud, and used only to improve the game. | The notes are kept on our server, in Google Cloud, and used only to improve the game. Each note is deleted after one year. We keep daily totals, such as how many people played, which hold no IDs. | DECIDED (Sevaan, 2026-11-20): one year, both apps; daily totals with no IDs are kept. Not live yet: use the right-hand sentence only once the expiry is deployed AND the older rows have been dealt with (given an expiry or deleted), or "deleted after one year" isn't true of them. |
| ⑧ | No use of your contacts, photos or microphone. | No use of your contacts, photos, camera or microphone. | The camera view is now hidden in store builds (code, not yet committed), but the iPhone app still carries a camera permission line. Add "camera" once that line is gone from the store build. |

**No longer pending:** ⑤ Reset everything keeps the usage ID on purpose, in both apps (Sevaan, 2026-11-20, reversing the earlier answer), so the page's sentence "The random ID on the usage notes stays the same" is final. ③ (the aircraft-removal sentence) is dropped. ④ Android backup is on. ⑥ the 90-day deletion of packs is active.

---

## Part 2. Every statement, checked

Checked on 2026-11-20 against Sky's working tree (it has uncommitted work). "Code" means I read it there. I did not run the app.

| Statement | Verdict | Where |
|---|---|---|
| Exact position stays on the phone; plane requests rounded to about 5 km | Verified | `js/planes.js feedPoint` (0.05° grid), `tests/location-privacy.test.mjs`, `design/privacy-store-checklist.md` |
| The phone asks adsb.lol itself; falls back to our server when busy or out of allowance | Verified | `docs/PRIVACY-AND-DATA.md` item 1, `js/plane-feed.js` |
| Our server passes on only a large square's centre to FlyItalyADSB; holds answers under a minute | Verified in code | `server/planes-relay.js` (1° squares). "About 100 km across" is my plain wording for 1°. |
| Request logs ① | **Verified by Sky Dev (gcloud): logs are kept today**, 30 days, with address and rounded position. Part 1 says so; Part 1b has the sentence for after the fix. | `sky-privacy-answers` ① |
| Weather from Open-Meteo, rounded to about 10 km ② | Verified as built. Open-Meteo's free plan does not cover an app with a subscription (Sky Dev read its terms today); Sky is moving to MET Norway through its own server. | `js/weather.js`; `sky-privacy-answers` ② |
| Approximate location still works; Settings says so | Verified | checklist, "Done in the apps" |
| City search is inside the app | Verified | `js/cities.js` (bundled GeoNames list) |
| Coverage best in North America and Europe | From Boss's brief and `docs/` research; not measured by me | |
| Airline flight: airline, kind of plane, route when known | Verified | Sky Dev's finding today; `js/flights.js` |
| Private, business, military, police, coast guard, government, and do-not-track aircraft: kind only | Verified | `js/planes.js isAnonymous`, `js/plane-privacy.js` (`GOV_OPS`, `BIZ_OPS`, dbFlags 1, 4, 8) |
| Identifying code replaced by a scrambled number that stays on the phone | Verified | `anonId` (salted hash, salt in localStorage, never sent) |
| A way to ask for an aircraft to be left out ③ | **NOT VERIFIED.** `docs/PRIVACY-AND-DATA.md` lists a removal route as still to add. The email address is in the site footer; whether anyone can act on a request is not established. | |
| iPhone: backed up to the player's own iCloud | Verified | `js/cloud-backup.js` (key `sky-backup`) |
| Android: saved with the phone's Google backup, if it is on | Verified by Sky Dev (`allowBackup="true"`, default rules). That the collection is included is inferred; no restore was tested. | `sky-privacy-answers` ④ |
| Reset everything clears the phone and the iCloud backup; the usage ID stays ⑤ | Verified by Sky Dev (`clearBackup()`; `tid` kept on purpose). | `sky-privacy-answers` ⑤ |
| 30-day count of aircraft kinds, and regulars, stay on the phone | Verified | old privacy page; `js/sky-regulars.js` ("never sent anywhere") |
| A pack holds no place and no name | Verified | `js/gift.js asGift` drops lat, lon, az, el, range; `scrubSightings` |
| Packs kept 90 days under a random code; airline cards carry the flight number | Verified: the deletion rule is ACTIVE (Sky Dev, gcloud). The flight number is inferred from `scrubSightings`. | `sky-privacy-answers` ⑥ |
| Usage notes: what they hold and don't | Verified | `js/field-notes.js`; `catch` carries kind, rarity, new or not |
| Notes can be turned off in Settings → Help | Verified | Settings row "Share anonymous usage" |
| Plus through the App Store; RevenueCat gets an anonymous ID only, on iPhone only | Verified by Sky Dev (`Purchases.configure({ apiKey })` and nothing else; Android key empty). | `sky-privacy-answers` |
| Alerts are made on the phone; nothing while closed | Verified | `js/sky-alerts.js`; Sky Dev's read |
| Website: no analytics trackers | No tracker found in `site/public/*.html`. **NOT VERIFIED** beyond those files. | |
| Sample pack uses the time zone's city, never your position | From the current privacy page; not re-read in code today | |
| No camera, photos, contacts or microphone | **NOT VERIFIED.** The app has a "Camera view" in its testing tools. If that can be reached in a store build, "camera" must come out of this list. | Settings list |

**Left out on purpose, and why.** The current page names licences in the body (ODbL, CC0, CC BY-SA). Those belong on a credits page, and adsb.lol's licence asks for attribution, which Settings → Credits should carry. If Sky has no credits screen in the store build, add this line under "The aircraft you see": "Aircraft data: adsb.lol contributors, Open Database License 1.0. Routes: Virtual Radar Server standing data. Photos: Wikimedia Commons, credited on each card."

## Part 3. Questions for Sky Dev (all answered 2026-11-20)

Answers are in `sky-privacy-answers-2026-11-20.md` and are folded into Parts 1, 1b and 2 above. The questions are kept as a record. Credits: Settings → About → Credits and sources carries adsb.lol's attribution, so the fallback line under Part 2 isn't needed; its Weather credit changes with ②.

1. **① Request logs.** Are `/planes` requests excluded from Cloud Logging, as Space did on 2026-10-28? If not, "keeps no list of who asked" must become "Google Cloud keeps ordinary request logs, with the rounded position, for up to 30 days."
2. **② Weather.** Is Open-Meteo's free plan allowed for an app that sells a subscription? Space moved to its own server over that. If Sky moves too, the weather paragraph changes.
3. **③ Removal requests.** Who reads hello@skycollector.app, and can an aircraft actually be left out? If not yet, the sentence should come out rather than promise it.
4. **④ Android backup.** Is Auto Backup on in the Android build?
5. **⑤ Reset everything.** Does it clear the iCloud backup?
6. **⑥ Packs.** Is the 90-day deletion rule enabled in the `sky-collector-app` database? Does a pack contain an airline flight's callsign? (That is fine, but the page should then say "the flight number".)
7. **Credits.** Does Settings have a credits screen with adsb.lol's attribution?
8. **Camera view.** Reachable in a store build?
9. **RevenueCat.** Anonymous ID only?
10. **Usage notes.** How long are they kept? The page gives no period; if there is one, say it.

## Decisions for Boss and Sevaan

1. DECIDED (Sevaan, 2026-11-20): the aircraft-removal sentence is dropped from the page. Marker ③ no longer appears in Part 1; the row in Part 2 and question 3 are kept only as a record.
2. Who publishes, and the date. I published nothing.
