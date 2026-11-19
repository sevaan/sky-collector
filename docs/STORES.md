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

All three: Family Sharing on (Sevaan's yes, 2026-11-19; it can't be turned off), all 175 countries, Apple's calculated prices elsewhere, English (Canada) name and description, status
Prepare for Submission. The descriptions are generic ("Card backs, alerts and more extras for collectors.") because
Sky's Plus perks aren't decided; js/plus.js still lists Space Collector's.

Not done on Apple:
- The App Review screenshot on each product (the Plus sheet), and review notes.
- The first subscription and first in-app purchase must be submitted together with an app version.

Play: the Subscriptions page only offers "Upload a new APK". Products can't be created until a build that includes
Play Billing has been uploaded, so this waits for the Android project.

RevenueCat (2026-11-19): a project of Sky's own, "Sky Collector" (d30f3dad), separate from Space Collector's
(Sevaan's choice).
- App "Sky Collector (App Store)", bundle `app.skycollector`, using the in-app purchase key already on the account
  (3HK2L8K8G8, the same Apple key Space Collector's app uses; credentials show as valid).
- Products `sky_plus_yearly`, `sky_plus_monthly` (subscriptions) and `sky_plus_forever` (non-consumable), all attached
  to the entitlement `sky_collector_plus` ("Sky Collector Plus").
- Offering `default` with `$rc_annual`, `$rc_monthly` and `$rc_lifetime`.
- js/plus.js has the project's public SDK keys (the App Store key and the Test Store key; both are meant to ship in
  the app). No Play app or key yet. The Test Store has no products, so the Testing tools switch shows no plans.

## Still to do
- **Plus from day one** (Sevaan, 2026-11-19, "like Space Collector did"): Apple's products and RevenueCat exist (above); Play's are still to do.
- Listing text, screenshots, category, age and content ratings, privacy answers, pricing and countries.
- Play: the 15% service fee enrolment, the closed test (12 testers for 14 days) before production, an upload key of
  Sky's own, and the Android project under `app.skycollector`.
- Apple: the bundle id's capabilities (iCloud key-value storage is on through Xcode; associated domains for
  skycollector.app links later).
