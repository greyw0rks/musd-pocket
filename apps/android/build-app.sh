#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

build_tools_root="$HOME/.local/share/mpocket-build"
export JAVA_HOME="${JAVA_HOME:-$build_tools_root/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$build_tools_root/android-sdk}"
export PATH="$JAVA_HOME/bin:$PATH"
if [[ ! -x "$JAVA_HOME/bin/java" || ! -d "$ANDROID_HOME/platforms/android-36" ]]; then
  echo "Install JDK 17 and Android SDK 36, then set JAVA_HOME and ANDROID_HOME." >&2
  exit 1
fi
if [[ ! -f .private/mpocket-testing.keystore || ! -f .private/keystore-password ]]; then
  echo "Restore the original private signing files to build an update." >&2
  exit 1
fi

pnpm --dir ../.. run build:android-ui
test -s app/src/main/assets/web/index.html
./gradlew --no-daemon --max-workers=2 assembleRelease lintRelease

signer="$ANDROID_HOME/build-tools/36.0.0/apksigner"
aligner="$ANDROID_HOME/build-tools/36.0.0/zipalign"
unsigned_apk="app/build/outputs/apk/release/app-release-unsigned.apk"
aligned_apk="app/build/outputs/apk/release/mpocket-aligned.apk"
signed_apk="mpocket-0.2.3.apk"
"$aligner" -f -P 16 4 "$unsigned_apk" "$aligned_apk"
"$signer" sign --ks .private/mpocket-testing.keystore --ks-key-alias mpocket-testing \
  --ks-pass file:.private/keystore-password --out "$signed_apk" "$aligned_apk"
"$signer" verify --verbose --print-certs "$signed_apk"
"$aligner" -c -P 16 4 "$signed_apk"
sha256sum "$signed_apk" > "$signed_apk.sha256"
ls -lh "$signed_apk"
