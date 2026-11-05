#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

: "${JAVA_HOME:?Set JAVA_HOME to your JDK 17 installation}"
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK installation}"
export PATH="$JAVA_HOME/bin:$PATH"
sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
"$sdkmanager" --install "platform-tools" "platforms;android-36" "build-tools;35.0.0" "build-tools;36.0.0"

if [[ ! -f .private/mpocket-testing.keystore || ! -f .private/keystore-password ]]; then
  echo "Missing the private testing keystore/password. Restore the original signing files before building an update." >&2
  exit 1
fi

./gradlew --no-daemon --max-workers=2 assembleRelease
unsigned_apk="app/build/outputs/apk/release/app-release-unsigned.apk"
signed_apk="mpocket-test-0.1.0.apk"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" sign \
  --ks .private/mpocket-testing.keystore --ks-key-alias mpocket-testing \
  --ks-pass file:.private/keystore-password \
  --out "$signed_apk" "$unsigned_apk"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose --print-certs "$signed_apk"
sha256sum "$signed_apk"
