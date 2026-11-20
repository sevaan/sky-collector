# Sky Collector: precise location, store privacy checklist (2026-11-20)

Sevaan's decision: **Sky asks for precise location; Space Collector stays approximate.** Nothing here has been entered
in Play Console or App Store Connect; this is the list of what to change there, by hand, before the next store build.

## What the app does with location

| | |
|---|---|
| Precise fix | Used on the phone only, to place each plane in your sky (js/planes.js skyPosition). Kept on the device (the current place, and each catch's place as part of the card). |
| Plane requests | adsb.lol (from the phone) and Sky's relay (Cloud Run) get a position **rounded to 0.05°** (about 5 km), radius 43 NM instead of 40 so nothing is missed (js/planes.js feedPoint; tests/location-privacy.test.mjs). |
| Weather | Open-Meteo (or our /wx) gets a **0.1°** square. |
| Usage reports (/t, sky_events) | **No location** of any kind. |
| Sent packs, widgets | No location (gift.js asGift strips it; widgets get names and times). |
| Our server | Answers from 1° squares held in memory; app code never logs coordinates. Cloud Run's request log does record the rounded 0.05° point in the URL (see docs/PRIVACY-AND-DATA.md for how to remove that). |

## Google Play: Data safety form

- **Location → Precise location: Collected = Yes** (add it; today only Approximate is declared, if anything).
  Google counts data sent off the device as "collected", even when it's rounded, because the app holds the precise
  permission. Mark: **Processed ephemerally = Yes** (the relay keeps answers under a minute and stores nothing per
  user), **Required = No** (the player can pick a city or use the time-zone sky), **Purpose = App functionality**.
- **Approximate location**: same answers (Collected, ephemeral, optional, App functionality).
- **Shared = No.** Sending the rounded point to adsb.lol to get planes back is a service the app uses on the player's
  behalf; if Play's reviewer reads adsb.lol as a third party, declare **Shared: Approximate location, App
  functionality** (never Precise: the precise fix never leaves the phone).
- Not used for: advertising, analytics, personalization, fraud. Not linked to an identity (no accounts).
- Data is encrypted in transit: Yes (https). Deletion request: not applicable (nothing stored per user), keep the
  in-app Reset everything.
- Permissions declaration: Play shows ACCESS_FINE_LOCATION in the app's permissions list; no special declaration
  form is needed for foreground fine location (only background location needs one, and Sky doesn't ask for it).

## App Store: App Privacy labels

- **Precise Location: Data Not Collected** is only true if Apple's "collected" means "sent off the device in a form
  that can be tied back". Apple's rule: data is collected when it's transmitted off the device and kept longer than
  needed to serve the request in real time. The plane request is served in real time and not kept, so precise
  location can stay **Not Collected**.
- **Coarse Location**: if Sevaan wants to be conservative, declare **Coarse Location → App Functionality, Not linked
  to you, Not used for tracking**. That matches what leaves the phone (a 5 km grid point).
- **Usage Data / Diagnostics** (the anonymous /t notes): unchanged from the current label; they carry no location.
- Info.plist: NSLocationWhenInUseUsageDescription should say why precise helps, in plain words (draft below). Precise
  is iOS's default; if the player turns Precise off, the app works and Settings says planes may be a little off.

## Permission strings (drafts, plain words)

- iOS NSLocationWhenInUseUsageDescription: "Sky Collector uses your location so planes are drawn where they really
  are in your sky. Your exact position stays on your phone."
- iOS NSLocationAlwaysAndWhenInUseUsageDescription: "Sky Collector uses your location only while you use the app, so
  planes are drawn where they really are. Your exact position stays on your phone."
- Android has no custom permission text; the tour card says it ("Share your location so you see the planes flying
  over you").

## Why precise: the measured benefit

A plane's direction on screen comes from the phone's position. With a position error of 3 km (a typical Android
"Approximate" fix) versus a precise fix of a few metres, the worst-case angle between where the plane is drawn and
where it really is (worst direction of the error):

| Plane | Height | Elevation | 3 km error | 1.5 km error | 100 m error | 5 m (precise) |
|---|---|---|---|---|---|---|
| 5 km away | 3 km (climbing) | 31° | 31° | 15° | 1.0° | 0.05° |
| 10 km away | 3 km | 17° | 17° | 8.3° | 0.55° | 0.03° |
| 20 km away | 3 km | 9° | 8.5° | 4.3° | 0.28° | 0.01° |
| 5 km away | 10.7 km (cruise) | 65° | 15° | 7.3° | 0.49° | 0.02° |
| 10 km away | 10.7 km | 47° | 12° | 5.9° | 0.39° | 0.02° |
| 20 km away | 10.7 km | 28° | 7.6° | 3.8° | 0.25° | 0.01° |

(5 km etc. is the ground distance. Computed by moving the observer by the error in each of 360 directions and taking
the largest angle between the true and the drawn direction.)

So with approximate location the nearby planes, the ones a player is most likely to aim at, are drawn many circle-widths
from where they are; with a precise fix the error is far below anything the phone's compass can show.

## Done in the apps (2026-11-20, after Sevaan's "Yes, precise")

- Android: ACCESS_FINE_LOCATION next to COARSE (native-shell AndroidManifest.xml). The first ask shows Precise /
  Approximate; Approximate works and is never re-asked by itself; Settings → Location says "Approximate · planes may be
  drawn a little off" and its sheet's **Use precise location** shows Android's "change to precise?" dialog (js/native.js
  getPosition askPrecise, js/main.js renderPreciseOffer). Tested on the API 37 emulator: design/playtest/android-precise-*.
- iOS: asks with enableHighAccuracy now (the plugin otherwise sets desiredAccuracy to 3 km, so iPhone fixes were 3 km
  even with Precise on); Precise Location: Off shows as a fix of 1 km or worse, and the sheet points to Settings → Sky
  Collector → Location. Info.plist strings applied (native-shell). Not run on an iPhone yet.
- Then fill in both store forms as above.
