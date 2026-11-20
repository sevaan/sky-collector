# Answers to the privacy page's questions (v2, Part 3)

Written 2026-11-20 for `content/sky-privacy-page-v2-2026-11-20.md`. Each answer says **VERIFIED** (and how) or **INFERRED** (and from what). Cloud checks were read-only `gcloud` commands, run as sevaan@gmail.com (the account `scripts/deploy-site.py` uses) on project `sky-collector-app`. Nothing in Firebase, Firestore, Cloud Logging or GCP was created, changed or deleted.

Code changes made in the main repo (not committed, no version bump): listed at the end.

---

## ① Request logs: does Cloud Run keep `/planes` requests? YES. The sentence is false today.

**VERIFIED (gcloud, read-only).**
- `gcloud logging sinks describe _Default`: Sky's `_Default` sink has **no exclusions**. `gcloud logging buckets list`: the `_Default` bucket keeps logs for **30 days**.
- `gcloud logging read 'httpRequest.requestUrl:"/planes"'` returns entries in `run.googleapis.com/requests` for service `api`. Each one has `httpRequest.remoteIp` and the full URL, `/planes?lat=…&lon=…&dist=43` (the 0.05° rounded point). The oldest is from 2026-11-18, so nothing has expired yet. (I printed the entries with the coordinates removed.)
- Sky's own code logs no coordinates. The only `console.*` lines in `server/index.js` and `server/planes-relay.js` are about the budget, upstream errors and the stats snapshot.

**How Space did it. VERIFIED** (Space's `CLAUDE.md` 2026-10-28, and a read-only `gcloud logging sinks describe _Default --project=space-collector-91cc7`): an exclusion named `api-requests` on the `_Default` sink drops every request-log line of its `api` service.

```
resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND log_id("run.googleapis.com/requests")
```

Sky's service has the same labels (`cloud_run_revision`, `api`), so the same filter fits.

**Proposed change. NOT APPLIED; needs Sevaan's yes:**

```
gcloud logging sinks update _Default \
  --add-exclusion=name=api-requests,filter='resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND log_id("run.googleapis.com/requests")' \
  --project=sky-collector-app --account=sevaan@gmail.com
```

- This stops new request lines from being stored. Lines already stored (from 2026-11-18) age out within 30 days. Deleting them sooner would mean deleting the `run.googleapis.com/requests` log (`gcloud logging logs delete run.googleapis.com%2Frequests`), which also needs Sevaan.
- It also drops request lines for `/t`, `/pack` and `/stats` (the caller's address, nothing else). The app's own warnings and errors are kept, since they're in a different log.
- Check it worked: `gcloud logging sinks describe _Default` shows the exclusion, and a new `/planes` request leaves no `run.googleapis.com/requests` line.

**Page:** once the exclusion is on, "keeps no list of who asked" is true. Until then: "Google Cloud keeps ordinary request logs, with your internet address and the rounded position, for up to 30 days."

## ② Weather: is Open-Meteo's free plan allowed? NO. Sky should move to MET Norway through its own server, as Space did.

**VERIFIED (Open-Meteo's terms, fetched 2026-11-20, https://open-meteo.com/en/terms).** The free API is for non-commercial use only. Its examples of commercial use include "Websites or apps that have subscriptions or display advertisements." Sky Collector Plus is a subscription, so the free plan doesn't cover it. The paid plans start at "API Standard" (1M calls a month). The pricing page didn't show a price in the text I could read.

**VERIFIED (Sky's code):** `js/server.js` has `DEPLOYED = ''`, so `SERVER` is empty and `js/weather.js` asks `api.open-meteo.com` directly, with the position rounded to 0.1°. Settings → Credits says "Weather: Open-Meteo · CC BY 4.0".

**What Space did. VERIFIED** (Space's `CLAUDE.md` 2026-10-25 and 2026-10-26, `functions/index.js`): Space added `/wx` to its own server. It asks MET Norway's locationforecast (free for commercial use, CC BY 4.0, an identifying User-Agent required), caches 30 minutes per 0.1° square, and reshapes the answer to `js/weather.js`'s `{ now, hours }`. Space's privacy page and Credits now name MET Norway.

**Done in code (not deployed):** Space's `/wx` is ported into `server/index.js`: MET Norway, User-Agent `SkyCollector/1.0 (https://skycollector.app; hello@skycollector.app)`, 30-minute cache per 0.1° square, 30 requests a minute per caller. The app doesn't use it yet.

**To finish (needs Sevaan):**
1. Deploy the function, using the command in `server/index.js`'s header.
2. Then point the app at it. In `js/weather.js`, use `SERVER || SKY_API` for the `/wx` request (import `SKY_API` from `js/server.js`).
3. Change Credits (`js/main.js` `SKY_CREDITS`) to "Weather: MET Norway · CC BY 4.0, https://www.met.no/en".
4. Page: "**To get the weather.** The forecast comes from MET Norway through our server, asked with a position rounded to about 10 km." Our server caches it and passes on only the rounded square. With the ① exclusion on, the server keeps no log of it.

Doing step 2 before step 1 would break weather, so step 2 waits for the deploy.

## ③ Leaving an aircraft out on request: DECIDED, the sentence is dropped (Sevaan, 2026-11-20).

**VERIFIED that no mechanism exists.** There's no blocklist anywhere: `grep` of `js/` and `server/` finds no hex or registration exclusion list, and `server/planes-relay.js` passes on everything FlyItalyADSB returns. What does exist:
- Aircraft in LADD or PIA (`dbFlags` 8 and 4) are anonymous: type only, `js/planes.js` `isAnonymous`.
- Every non-airline aircraft is anonymous, with its hex replaced by a salted hash (`anonId`).
- The sample pack never uses a flagged aircraft (`js/pack-flight.js` `rankFlights`).

So the closest honest statement is the one the page already makes: an owner who has asked not to be tracked publicly through the FAA's LADD/PIA programmes is shown by type only.

**Other places that promise or plan removal. VERIFIED by grep** of privacy.html, site/, scripts/build-site.mjs, content/, docs/, index.html and js/:
- **`privacy.html` line 71, and its built copy `site/public/privacy.html` line 71:** "Questions, or an aircraft you would like left out? Email hello@skycollector.app". **This is the only live promise.** Proposed wording, not applied:
  > `<p>Questions? Email <a href="mailto:hello@skycollector.app">hello@skycollector.app</a></p>`

  After changing it, run `node scripts/build-site.mjs` so the built copy matches. (The two files already differ in other ways.)
- `content/sky-privacy-page-2026-11-20.md` line 57 (the superseded v1 draft) has the same sentence. It's a draft and not published.
- `docs/PRIVACY-AND-DATA.md` line 34 ("Still to add: a removal request route") and line 50 ("keep the per-airline removal route", which is about airline logos). These are internal notes, not promises. Worth marking the first one "dropped, Sevaan 2026-11-20".
- No promise was found on the site's home or pack pages (their footer says only "Questions? hello@skycollector.app"), in any store-listing draft, or in the app's own text.

## ④ Android Auto Backup: ON.

**VERIFIED (native-shell worktree, `native/android/app/src/main/AndroidManifest.xml`):** `android:allowBackup="true"`. There is no `android:dataExtractionRules` or `android:fullBackupContent`, and `res/xml/` has only `file_paths.xml`. So Auto Backup uses its defaults: the whole app data folder goes to the player's Google backup, and device-to-device transfer is included (targetSdk 36).

**INFERRED:** that the collection is included. The default rules cover the WebView's data folder (localStorage and IndexedDB), and Space ships the same setting and says "Backed up with your phone". I did not test a restore. It also only happens if the player has Google backup turned on. The page's "it is saved with your phone's own Google backup" is fair. Something like "if your phone's Google backup is on" would be more exact.

## ⑤ Does Reset everything clear the iCloud backup? YES.

**VERIFIED (code):**
- `js/main.js` (the `set-reset` handler) calls `await clearBackup()` before wiping local storage and IndexedDB.
- `js/cloud-backup.js` `clearBackup()` calls `ICloudKV.remove({ key: 'sky-backup' })`.
- The native-shell `native/ios/App/App/ICloudKV.swift` implements `remove`.
- The confirm dialog says "…here and in your iCloud backup" when iCloud is on.

Two notes for the page:
1. **INFERRED:** the remove call's errors are swallowed. iCloud key-value storage applies the removal locally and syncs it later, so it should still reach iCloud.
2. **VERIFIED:** the reset deliberately **keeps** the anonymous usage ID (`tid`), the usage on/off choice and the testing-tools flag, so a reset doesn't count as a new install. "Starts you again as a new player" is true for the game, but the usage-notes ID stays. If the page should promise a clean slate for the notes too, then either say "your anonymous usage ID stays the same", or drop `tid`/`tidAt`/`tidNight` from the kept list (a one-line code change, which would count a reset as a new install on /stats).

On Android, Reset clears the app's data. **INFERRED:** the Google backup is replaced at the next backup, which Android runs about once a day.

## ⑥ Is the 90-day deletion on `sky_packs` switched on? YES.

**VERIFIED (gcloud, read-only):** `gcloud firestore fields ttls list` shows `collectionGroups/sky_packs/fields/exp` with `ttlConfig.state: ACTIVE`.

**VERIFIED (code):** `server/index.js` `savePack` writes `exp = now + 90 days`, and `GET /pack/<id>` returns 404 once `exp` has passed, even before the TTL sweep. (Firestore TTL deletes usually within 24 hours of expiry, so "then deleted" is fair.)

Also checked: Firestore point-in-time recovery is DISABLED, and there are no backup schedules. So deleted packs don't live on in a Sky backup.

Sub-question, does a pack hold an airline flight's callsign? **INFERRED from `js/gift.js`/`scrubSightings`:** airline catches keep their callsign and anonymous ones lose it. So "the flight number" is a fair addition for airline cards.

---

## Plus

**Credits with adsb.lol's ODbL in the store build: YES. VERIFIED (code).** Settings → About → "Credits and sources" (`index.html` `#set-credits`, not inside Testing tools, not gated by TESTER). In the native apps, `js/main.js` `SKY_CREDITS` says "Live aircraft: adsb.lol contributors · ODbL 1.0, asked from your phone; FlyItalyADSB through Sky Collector's server when it is busy", linked to adsb.lol. The page's suggested "If Sky has no credits screen" line isn't needed. The Weather credit must change with ②.

**Camera view in a store build: it WAS reachable. Now hidden in code.**
- **VERIFIED (code):** `devMode()` in `js/main.js` unlocks Testing tools in any native build when you tap the version line 7 times. Testing tools held "Camera view" (`#btn-cam` → `getUserMedia`).
- On iOS, the native-shell `Info.plist` has `NSCameraUsageDescription` ("Camera view shows the real sky behind the plane labels."), so it would have worked.
- On Android, the manifest doesn't request CAMERA (**INFERRED:** it fails with "Camera not available").
- The website test build always shows Testing tools.
- **Fix made (main repo, `js/main.js`):** in Sky's native store builds (`SKY_ONLY && isNative() && !TESTER`), the Camera view and Camera fit rows are hidden. They stay in the website test build and the Tester app.
- **Still to do on native-shell (not done; not the main repo):** remove `NSCameraUsageDescription` from `native/ios/App/App/Info.plist` for store builds. Its presence invites an App Review question and contradicts "no camera". If the Tester app needs it, keep it only in the tester build.

**RevenueCat: anonymous ID only. VERIFIED (code).**
- `js/plus.js` calls only `Purchases.configure({ apiKey })`. There's no `logIn`, `appUserID`, `setEmail`, `setAttributes` or `setDisplayName` anywhere in `js/`, so RevenueCat uses its own anonymous `$RCAnonymousID`.
- It is **switched on for iOS** (`RC_KEYS.ios` is Sky's real `appl_` key) and **off for Android** (`android: ''`, so `storeOpen()` is false and configure is never called).
- The page sentence holds. As it already notes, Plus isn't on sale on Google Play yet.

**How long are usage notes kept? Until now, with no end date. Code fix made; the TTL policy needs Sevaan.**
- **VERIFIED:**
  - `gcloud firestore fields ttls list` shows no TTL on `sky_events` (only `sky_packs.exp`).
  - The rows had no timestamp field a TTL could use (`ts` and `rt` are numbers).
  - `bq ls` shows no BigQuery datasets, so nothing is exported.
  - The stats page reads 120 days. Its gzipped snapshot in `sky_statcache` keeps only rows from the last 120 days.
  - Point-in-time recovery is off.
- **Fix made (`server/index.js`):** every new note row gets `exp = received + 180 days` (`EVENT_DAYS = 180`; Sevaan may prefer another period). Takes effect at the next deploy.
- **Needs Sevaan (cloud, NOT APPLIED):**
  ```
  gcloud firestore fields ttls update exp --collection-group=sky_events --enable-ttl --project=sky-collector-app --account=sevaan@gmail.com
  ```
  Rows written before the deploy have no `exp`, so the TTL never deletes them. They'd need a one-off backfill script (set `exp = rt + 180 days`) or a one-off delete. Either one also needs his yes.
- **Page, once both are done:** "Notes are deleted after six months." Until then the honest wording is "kept on our server, in Google Cloud", with no period.

---

## Code changes made (main repo, uncommitted; `node --test`: 402 pass)

1. `js/main.js`: Camera view and Camera fit hidden in Sky's native store builds (website test build and Tester app keep them).
2. `server/index.js`: `/wx` (MET Norway, ported from Space's `functions/index.js`) and an `exp` field on `sky_events` rows (180 days). Neither has effect until the function is redeployed. The app keeps asking Open-Meteo until `js/weather.js` is switched (② step 2).

Not changed: `privacy.html` (③ wording above), Credits text (waits for ②), the native-shell `Info.plist`, and any cloud setting.
