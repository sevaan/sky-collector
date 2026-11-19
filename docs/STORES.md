# Store setup (started 2026-11-19)

Sky Collector's own records in both stores, separate from Space Collector's. No builds uploaded yet.

| | App Store Connect | Google Play Console |
|---|---|---|
| Name | Sky Collector | Sky Collector |
| App id | bundle id `app.skycollector` | package `app.skycollector` |
| Record | Apple ID 6836886739, SKU `sky-collector-ios` | app 4975560585196276255 |
| Language | English (Canada) | English (United Kingdom), the form's default; can be changed |
| Type and price | iOS; price not set yet | Game, Free |
| State | 1.0, Prepare for Submission | Draft; dashboard tasks not started |

The tester app on Sevaan's iPhone is `app.skycollector.tester` ("Sky Tester", native/build-tester.sh). The phone-app
shell (`native/`) is not in this repo yet; it has no Android project.

## Plus (started 2026-11-19)

Same plans and prices as Space Collector. Apple product ids must be unique across the whole developer account, and
Space Collector already has `plus_yearly`, `plus_monthly` and `plus_forever`, so Sky's carry a `sky_` prefix. Use the
same ids on Play.

| | Product id | Apple ID | Price (US) | Notes |
|---|---|---|---|---|
| Group "Sky Collector Plus" | | 22596814 | | display name set, English (Canada) |
| Plus Yearly | `sky_plus_yearly` | 6836891966 | $14.99 (CA $19.99) | level 1; free first week for new subscribers, no end date |
| Plus Monthly | `sky_plus_monthly` | 6836892618 | $1.99 | level 2 |
| Plus Forever | `sky_plus_forever` | 6836893373 | $29.99 | non-consumable |

All three: all 175 countries, Apple's calculated prices elsewhere, English (Canada) name and description, status
Prepare for Submission. The descriptions are generic ("Card backs, alerts and more extras for collectors.") because
Sky's Plus perks aren't decided; js/plus.js still lists Space Collector's.

Not done on Apple:
- **Family Sharing** is off on all three. Space Collector has it on; it can never be turned off again, so it waits for
  Sevaan's yes.
- The App Review screenshot on each product (the Plus sheet), and review notes.
- The first subscription and first in-app purchase must be submitted together with an app version.

Play: the Subscriptions page only offers "Upload a new APK". Products can't be created until a build that includes
Play Billing has been uploaded, so this waits for the Android project.

RevenueCat: nothing set up. Sevaan is weighing a link between the two apps' Plus (free or half-price in the other
app), which decides whether Sky gets a project of its own or joins Space Collector's. js/plus.js RC_KEYS stay empty
and its entitlement name is still `space_collector_plus`.

## Still to do
- **Plus from day one** (Sevaan, 2026-11-19, "like Space Collector did"): Apple's products exist (above); Play's and
  RevenueCat are still to do.
- Listing text, screenshots, category, age and content ratings, privacy answers, pricing and countries.
- Play: the 15% service fee enrolment, the closed test (12 testers for 14 days) before production, an upload key of
  Sky's own, and the Android project under `app.skycollector`.
- Apple: the bundle id's capabilities (iCloud key-value storage is on through Xcode; associated domains for
  skycollector.app links later).
