# Sky Collector: help page (draft)

Written 2026-11-20. **Draft text only, markdown, not for publishing.** Sky Dev or Sky Build puts it on skycollector.app after Boss and Sevaan approve it.

**How this was made.** Same shape as Space Collector's help page (`space-help-page-2026-11-20.md`): plain questions a player asks, most common first, answers of two to four sentences, voice guide rules (Canadian/British spelling, no exclamation marks). Answers that are true for both games are reused; satellite ones are replaced with plane ones. Under each answer, an italic **Checked** line says where I confirmed it (Sky's code, docs or settings text, 2026-11-20); **NOT VERIFIED** marks anything I could not confirm. Nothing here promises a feature that is not in the live store build, or says what the app does while it is closed.

**Not seen on a device.** I read the code; I did not run the app. Alert facts come from Sky Dev's read of the code. The Android half waits on facts (Plus is not sold on Google Play for Sky yet).

---

## Playing

### How do I play?
Point your phone at a plane. When it lines up in the circle, tap **Collect**. Every plane you collect gets a card for its kind of plane, and most airline flights get a second card with the airline and, when we know it, the route.

*Checked: `HT_SLIDES_SKY` (How to play). The "most airline flights" wording follows Sky Dev's finding that an airline callsign with no route data gives only the plane card.*

### The planes on screen don't match what I see. What do I do?
The app works out where each plane is from your location and the way your phone is pointing, so a drifting compass is the usual cause. Go to Settings → **Compass** and tap Line up. It asks you to point the circle at something real and adjusts. By day it uses the Sun: aim the phone at it, never your eyes.

*Checked: Settings row "Compass · Is the sky drifting or off to one side?"; Line up is the same code as Space (Sun by day, Moon, then planets or a bright star: 2026-10-31 v0.1.1489 and 1490).*

### The sky doesn't move when I turn my phone.
Open Settings → **Look around with**. Choose Motion and allow motion if your phone asks. If your phone has no motion sensors, choose Finger and drag the sky instead.

*Checked: Settings row "Look around with · The sky follows your phone".*

### Why can't I see the plane the app shows, or why is a plane I can see missing?
Plane positions come from volunteers with receivers. Coverage is strongest in North America and Europe and thinner elsewhere, and not every aircraft is shown. A plane very low in your sky, under about 5 degrees up, counts as hidden behind the trees and rooftops.

*Checked: privacy page and the store listing (volunteer receivers, coverage); `js/sky-up.js UP_MIN_EL = 5`.*

### Why did a plane only give me a plane card, with no airline or route?
Not every airline flight has a route we know, and some airline flights aren't recognised as flights until you collect them. You still get the card for the kind of plane. Private, business, military, police and government aircraft show only the kind of aircraft, never an airline, route or callsign, on purpose.

*Checked: Sky Dev's finding (2026-11-20: no route data → plane card only; about 40% of callsigns outside 55 hand-listed airlines aren't recognised until collected); privacy page; `js/plane-privacy.js`.*

### Nothing is overhead. What do I do?
Open **Today** and tap **Show me**. It points you to the best plane up now, or to what is due in the next 15 minutes. By day or at night, the app only counts planes more than 5 degrees up as "up".

*Checked: HT slide "Nothing overhead?"; `js/sky-today.js`; `js/sky-up.js`.*

### Can I play on a cloudy day, or from indoors?
Yes, if you can see the plane. Clouds can hide it, so watch for a break in the cloud. A window, the garden or the airport fence all work, and indoors you can drag the sky with a finger.

*Checked: drag mode (Settings → Look around with). "A break in the cloud" follows the Space wording rule (2026-11-05); whether Sky ever stops a catch under cloud is **NOT VERIFIED**. The first sentence of this answer is general, not from the code.*

## Cards

### What do Common, Uncommon, Rare, Epic and Legendary mean?
Rarity is never something you pay for. For a plane card it is how unusual that kind of plane is: a Boeing 737 is common, an Antonov An-124 is not. For a flight card it is how far the flight goes. Each rarity has its own shape: a circle, triangle, diamond, star-burst or star.

*Checked: `docs/DESIGN-LOOP.md` section 1 (plane cards by how much of the world's traffic the type is; flight cards by distance); shapes `js/rarity.js` (shared with Space). The 737 and An-124 examples are from the same section (737 family Common; An-124 hand-listed Legendary).*

### What do Bronze, Silver and Gold mean?
A card levels up when you catch it again on other days. A flight turns silver after 5 days and gold after 15. A kind of plane turns silver after 10 aircraft and gold after 50.

*Checked: `HT_SLIDES_SKY` ("Flights level up at 5 and 15 days. Plane types level up at 10 and 50 aircraft") and `SKY_OVER.silver/gold`.*

### What is a stamp?
Catch the same flight on another day, or another aircraft of the same kind, and its card gets a stamp.

*Checked: `HT_SLIDES_SKY` ("Catch it again for a stamp").*

### What is a shiny card?
A card comes out shiny when you catch it at the right moment: a plane passing right beside the Moon, a plane as the sun goes down or comes up, or a rare kind of plane in an airline's colours you haven't collected before.

*Checked: `js/shiny.js shinyForPlane` (Moon within 1°; Sun between 1° below and 2° above the horizon; new colours on a Rare or better type).*

### What are my regulars?
After a few days, Sky Collector notices airline flights that pass you at about the same time each day, so you know when to look up for them. It works this out on your phone and never sends it anywhere. Only airline flights can be regulars, never a private plane.

*Checked: `js/sky-regulars.js` header (learned on the phone, 14 days kept, at least 3 days, within about 45 minutes, airline callsigns only, "a person's plane can never become a regular").*

### What are sets?
A set is a collection to fill, like The 737 Family, Giants or Short Hops. There are nineteen. Each has bronze, silver and gold goals, so a quiet sky can still earn one.

*Checked: `js/sky-sets.js` (19 sets: 7 flight, 12 plane); `docs/DESIGN-LOOP.md` section 2.*

## Missions, patches and secrets

### What are missions?
Each day has three missions, sized to how busy your sky is. A new themed week starts every Monday. Finish missions to earn XP, and patches for finishing them.

*Checked: `SKY_MISSIONS`, `SKY_WEEK_THEMES` (12 themes), `weekStartOf` (Monday); `docs/DESIGN-LOOP.md` section 3. Mission wording will change after `sky-patches-missions-wording-2026-11-20.md` is placed.*

### What are patches and ranks?
Patches are small awards for milestones, like your first card or a card turning gold. XP from catches and missions raises your rank. Every card, set, patch and mission is free to earn.

*Checked: `js/progress.js`; store text. Rank names are under review (`sky-ranks-2026-11-20.md`): this answer names none.*

### What is the pack I find in the morning?
The morning after you have been out catching, your day waits as a sealed pack. Tear it open and turn over the best cards.

*Checked: `nightPackData` and `packWhen` in `js/main.js` ("Yesterday · your day, in a pack"). **NOT VERIFIED in Sky:** same code as Space; I did not see it play in Sky.*

## Alerts and widgets

### How do plane alerts work?
Plane alerts are free and off until you turn them on. When you leave the app, Sky Collector can set an alert for a rare plane or a new card due over you in the next few minutes, or for a regular flight you haven't caught yet. You get at most three a day, never in your quiet hours. The app can't look for new planes while it is closed, so alerts work best when you have been using it.

*Checked: `js/sky-alerts.js` header and Sky Dev's read of the code (set when you leave the app; rare plane or new card due within about 10 minutes, alert 2 minutes before; a regular flight you don't have yet, 5 minutes before its usual time, up to 20 hours ahead; 3 a day, 30 minutes apart; never in quiet hours). **NOT VERIFIED on a device.** Plane alerts are free: decided by Sevaan 2026-11-20.*

### How do I stop notifications, or set quiet hours?
Turn plane alerts off in Settings → Notifications. Quiet hours are in the same place: alerts stay quiet then, and reminders you set yourself still come. Notifications can also be turned off in your phone's own settings.

*Checked: Settings rows "Quiet hours · Reminders you set still come" and "Notifications are off on this phone".*

### What are widgets?
On iPhone, widgets show your regular flights on the Home Screen and Lock Screen. They are part of Plus. There are no widgets on Android.

*Checked: Plus page text "Medium, large and Lock Screen widgets… iPhone only" (`js/plus.js PLUS_PERKS`). **NOT VERIFIED:** whether the small widget is free (a code comment says so), and what the widgets show (Sky Dev: the widget code still carries Space ideas, so "your regular flights" is unconfirmed; check before publishing).*

## Sky Collector Plus

### What is Plus?
Plus is optional. Every card, set, patch, mission and plane alert is free without it. Plus adds every card back, seven more app icons, Home Screen and Lock Screen widgets on iPhone, and a members-only patch. It is monthly, yearly (the first week is free for new subscribers) or once, for good.

*Checked: `js/plus.js PLUS_PERKS`, `PLUS_PRICES` (7-day trial on the yearly plan). **NOT VERIFIED:** that the free week is on in both stores; Plus is **not sold on Google Play for Sky yet** (Sky Build), so on Android the answer must say "coming to Android" until it is.*

### How do I restore Plus on a new phone, or after reinstalling?
Open the Plus page, scroll to the bottom and tap **Restore purchases**. Sign in to the same Apple Account (or Google account on Android) you used to buy it. If nothing changes, the app says Plus is already on, or that the store didn't answer. Try again in a moment.

*Checked: Settings row "Restore purchases" exists; the answers follow Space's (CLAUDE.md 2026-10-22, 2026-10-23). Android half: do not publish until Plus can be bought on Google Play.*

### How do I cancel?
Cancel in your Apple Account settings, or in Google Play on Android, at least 24 hours before it renews. Removing the app doesn't cancel it. Cards you have earned stay yours, and the member patch stays on your wall.

*Checked: store text; the member patch staying after Plus ends is Space's rule (shared code). "Removing the app doesn't cancel it" is how Apple and Google work, not from our code: NOT VERIFIED.*

## Your cards

### How do I send cards to a friend?
Open a card, tap the share icon, then choose **Send the card**. Pick the cards you want and tap Share. Your friend gets a link, and on their phone the cards open as a pack to tear open. You keep your own cards. The link works for 90 days.

*Checked: shared Send cards code (`js/send-cards.js`); `server/index.js` (packs deleted after 90 days). The path from a card matches Space's. **NOT VERIFIED:** whether Sky has a Settings → Collection → Send cards row too.*

### Do cards I was sent count towards my rank?
They are in your collection, but they don't count towards your XP, rank or patches. Only cards you catch yourself do.

*Checked: this is Space's rule (CLAUDE.md 2026-11-11, "a card is a card"); Sky uses the same `gift.js`. **NOT VERIFIED in Sky** by playing it.*

### How do I tell a friend about the app?
Settings → Help → **Tell a friend** sends them a sample pack of cards that opens in their browser, no app needed.

*Checked: Settings row "Tell a friend · Send a sample pack of cards to open in a browser"; `TELL_URL` = https://skycollector.app/pack.*

### How do I move my cards to a new phone?
On iPhone, your cards back up to your own iCloud by themselves, so sign in to the same iCloud on the new phone. On Android they are saved with your phone's Google backup, about once a day. There are no accounts, so cards don't move between an iPhone and an Android phone on their own.

*Checked: `js/cloud-backup.js` header (iCloud key 'sky-backup'; Android Auto Backup). **NOT VERIFIED:** a real restore on a second phone, and that Auto Backup is on in the Sky Android build.*

## Privacy and your data

### Does the app use my location?
Yes, to place each plane in your sky. On your phone it uses your precise position. Only a position rounded to about 5 km is sent, to get the planes near you. If you'd rather not share, choose a city in Settings, or use the game without your location.

*Checked: `design/privacy-store-checklist.md`; `js/cities.js` (offline city search). Same facts as the privacy page.*

### What does Sky Collector keep about me?
There are no accounts, no ads, no tracking and no selling of data. Your collection stays on your phone and in your own phone backup. The app sends a few anonymous usage notes, with a random ID and no location, to help us fix problems. You can turn them off in Settings → Help → **Share anonymous usage**. The full policy is at skycollector.app/privacy.

*Checked: `js/field-notes.js`; Settings row "Share anonymous usage · Crashes and play counts, never your location". The privacy page itself is a draft (`sky-privacy-page-2026-11-20.md`) and not live: do not publish this answer until the page is.*

### How do I start again?
Settings → **Reset everything** clears your cards from this phone and starts you again as a new player. There is no account to delete.

*Checked: Settings row "Reset everything · Start again as a new player". **NOT VERIFIED:** whether it also clears the iCloud backup (question in the privacy page draft).*

## Contact

### How do I contact you?
Email hello@skycollector.app. Say which phone you have and the version at the bottom of Settings. A short note about what you did and what you expected helps most. You can also tap Settings → Help → **Send feedback**.

*Checked: Settings row "Send feedback · hello@skycollector.app". Who answers, and how fast, is not stated: do not promise a reply time. The mailbox existing is NOT VERIFIED.*

---

## Left out on purpose

- **The Lock Screen countdown** (Settings row exists; Live Activity). I could not confirm it is in the live iPhone build.
- **How to add a widget** and how to change notification settings on iOS or Android: general phone steps, not from our code.
- **Rank names**: under review.
- **Prices**: the store shows the local price.
- **Camera view and other testing tools.**

## Decisions needed

1. **Is Plus sold on Google Play for Sky yet?** (Sky Build: no.) The Android half of the Plus answers waits for it.
2. **Widgets:** what do they show? Fix or remove the answer after Sky Dev checks.
3. **Does a cloudy sky stop any catch in Sky?** The cloudy-day answer assumes not.
4. **Where does it live?** A page on skycollector.app, or inside the app (Help row)? Written to work in both.
5. **Who answers hello@skycollector.app** and what may we say about how fast. I wrote none.
