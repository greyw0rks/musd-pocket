# Pocket Test for Android

An installable Android test app for https://mpocket.tech/home. It uses a Trusted Web Activity in Chrome, so Pocket's existing Privy sign-in, wallet, payments and finance screens use the same HTTPS origin and session as the website.

The app's launcher name is **Pocket Test**, its package is `tech.mpocket.testing`, and the first build is `0.1.0-test.1` (version code 1). It requires Android 6 or later and an up-to-date Chrome browser. Pocket currently runs on Mezo testnet; the APK does not enable mainnet.

## Install and test

1. Download `mpocket-test-0.1.0.apk` from the repository's Android testing release on your phone.
2. Open the download. If Android asks, allow this browser to install unknown apps, then install Pocket Test.
3. Open Pocket Test and sign in with your existing Pocket account.
4. Check Swap, Vault, Borrow, Pools and Locks in both themes. Pool balances should show at most six decimal places, for example `0.713197 LP`.
5. Check that approvals and final actions each show a review, and that reopening a pending transaction checks its existing receipt. Confirm financial actions only when you intend to perform them with your testnet wallet.

The app requires an internet connection. The website's service worker keeps wallet and API reads on the network. Existing website accounts and Chrome sessions are reused; the APK contains no backend credentials or wallet keys.

Website updates appear in the Android app without reinstalling. A new APK is needed for changes to its Android package, launcher metadata or native configuration. Keep the same private signing key for future APK updates and increase the version code.

## Rebuild

The generated Android project is committed, including its Gradle wrapper. Install JDK 17 and Android SDK command-line tools, set `JAVA_HOME` and `ANDROID_HOME`, and run:

```sh
cd apps/android
./build-test.sh
```

The script installs the required SDK packages when they are missing, builds the APK, and signs it using `.private/mpocket-testing.keystore`. The keystore and its password file are local and ignored by Git. Use the original signing files to rebuild updates for an already installed app; a different key requires a fresh installation and an updated website association.

`twa-manifest.json` is the Bubblewrap configuration used to generate the project. The generated source uses Bubblewrap core 1.27.0, Gradle 8.11.1 and Android Gradle Plugin 8.9.1. Regeneration uses Bubblewrap CLI 1.23.0; custom build and documentation files are maintained separately.

The public certificate fingerprint in `public/.well-known/assetlinks.json` connects this package to mpocket.tech. Chrome may initially show a toolbar until its domain verification completes. Other origins, including sign-in providers, use browser controls.

Build and signature verification are checked before publishing a testing APK. Sign-in and signing on an actual Android phone remain device acceptance checks.
