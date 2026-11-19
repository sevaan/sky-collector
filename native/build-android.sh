#!/bin/bash
# Android release build (2026-10-20). Usage: native/build-android.sh <versionCode>   e.g. native/build-android.sh 2
# Makes both, signed with the upload key (see app/build.gradle):
#   - an App Bundle (.aab) for Google Play (internal / closed testing, then production)
#   - an APK you can send to a friend directly (they tap it to install)
# Copies them to ~/Desktop/Space Collector Android/.
set -euo pipefail
V="${1:?versionCode, one higher than the last upload (Play rejects repeats)}"
cd "$(dirname "$0")"
[ -f ~/.sky-collector/upload.jks ] || { echo "No upload key yet (~/.sky-collector/upload.jks): Sevaan makes it before the first Play upload, as Space Collector's (its CLAUDE.md 2026-10-20)."; exit 1; }
export PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH
npm run android
cd android
export JAVA_HOME=$(ls -d ~/.jdks/jdk-21*/Contents/Home) ANDROID_HOME=~/Library/Android/sdk
./gradlew -q bundleRelease assembleRelease -PversionCode="$V" -PversionName=1.0
OUT=~/Desktop/"Sky Collector Android"; mkdir -p "$OUT"
cp app/build/outputs/bundle/release/app-release.aab "$OUT/Sky Collector $V.aab"
cp app/build/outputs/apk/release/app-release.apk "$OUT/Sky Collector $V.apk"
ls -la "$OUT"
