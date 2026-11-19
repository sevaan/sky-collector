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

## Still to do
- **Plus from day one** (Sevaan, 2026-11-19, "like Space Collector did"): a subscription group with Plus Monthly and
  Plus Yearly and a one-time Plus Forever in each store, and a RevenueCat project of Sky's own (never Space
  Collector's) with its keys in js/plus.js.
- Listing text, screenshots, category, age and content ratings, privacy answers, pricing and countries.
- Play: the 15% service fee enrolment, the closed test (12 testers for 14 days) before production, an upload key of
  Sky's own, and the Android project under `app.skycollector`.
- Apple: the bundle id's capabilities (iCloud key-value storage is on through Xcode; associated domains for
  skycollector.app links later).
