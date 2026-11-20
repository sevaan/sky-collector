#!/bin/bash
# Builds and installs the separate "Sky Tester" app on Sevaan's iPhone (2026-11-19, as Space Collector's SC Tester):
# bundle id app.skycollector.tester, so it sits beside the store app with its own data; Testing tools always on in
# Settings (js/build-flavor.js TESTER = true in this copy only). No iCloud backup or universal links in the tester:
# ios/App/App/Tester.entitlements holds only the App Group the widgets read from. It goes to the app target alone through
# SC_APP_ENTITLEMENTS (the app's CODE_SIGN_ENTITLEMENTS is $(SC_APP_ENTITLEMENTS)); overriding CODE_SIGN_ENTITLEMENTS on
# the command line would also replace the widget extension's own file and its signing would fail (2026-11-19).
# Usage: native/build-tester.sh [device-udid]   (default: the first connected iPhone; it must be unlocked)
set -eo pipefail
cd "$(dirname "$0")"
export PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH
DEV=${1:-$(xcrun devicectl list devices 2>/dev/null | awk '!/simulated/ && (/connected/ || /available/) {for(i=1;i<=NF;i++) if ($i ~ /^[0-9A-F]{8}-/) {print $i; exit}}')}
[ -n "$DEV" ] || { echo "No iPhone connected"; exit 1; }
OUT=${TMPDIR:-/tmp}/sky-tester-build
# Whatever happens, put the normal web copy back so a regular build never ships the tester flag.
# The store app has no camera (js/main.js hides Camera view in Sky's native store builds, 2026-11-20), so the shared
# App/Info.plist has no NSCameraUsageDescription; the tester keeps Camera view, so the key goes in for this build only.
PL=ios/App/App/Info.plist; CAM="Camera view shows the real sky behind the plane labels."
trap 'node copy-web.mjs >/dev/null && npx cap sync ios >/dev/null 2>&1; /usr/libexec/PlistBuddy -c "Delete :NSCameraUsageDescription" "$PL" >/dev/null 2>&1 || true' EXIT
/usr/libexec/PlistBuddy -c "Add :NSCameraUsageDescription string $CAM" "$PL"
SC_TESTER=1 node copy-web.mjs && npx cap sync ios >/dev/null
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination "id=$DEV" -derivedDataPath "$OUT" \
  -packageAuthorizationProvider netrc SC_APP_ID=app.skycollector.tester SC_DISPLAY_NAME="Sky Tester" SC_URL_SCHEME=skytester \
  SC_APP_ENTITLEMENTS=App/Tester.entitlements -allowProvisioningUpdates build | tail -3
xcrun devicectl device install app --device "$DEV" "$OUT/Build/Products/Release-iphoneos/App.app"
echo "Sky Tester installed."
