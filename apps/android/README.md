# mPocket for Android

mPocket 0.2.2 bundles the actual React interface, styles, fonts, wallet adapters and transaction recovery code in the APK. The previous 0.1.0 build was a Trusted Web Activity that launched Chrome. This version runs in Android System WebView and does not need Chrome to start.

Home, payments, contacts, requests, activity, Swap, Vault, Borrow, Pools, Locks and Settings reuse the web app’s real components. Android adds a QR camera scanner, the native share sheet, hardware Back navigation, payment-link handling, Twitter authentication return and startup recovery. API responses, balances, prices and transaction receipts always come from the live backend or chain. An internet connection is required for sign-in and financial operations.

## Install

Install **mpocket-0.2.2.apk** over Pocket Test. The package remains `tech.mpocket.testing`, with the original certificate, so this is an update rather than a different wallet app. The launcher now reads **mPocket**. Android 7.0 or newer is required. Keep Android System WebView updated.

Sign in using the same linked email, X or Telegram identity as your existing account. The app has its own stored session; it does not import Chrome’s session. Using a different identity can create a different account. mPocket remains on the configured Mezo testnet; this build does not enable mainnet.

Camera access is requested only when you tap Open camera. Scanning resolves the payment code and opens a review; it never sends money automatically. Denying camera permission leaves the manual payment-link entry available. Passkeys use Android WebView’s Credential Manager integration when supported, with the app’s certificate verified against the HTTPS origin’s assetlinks.json.

## Build

Install JDK 17, Android SDK platform 36 and build-tools 36.0.0. Set `JAVA_HOME` and `ANDROID_HOME` (the build script also recognizes the local mpocket-build tool directory). Install the repository’s locked pnpm dependencies and set the public settings from `.env.example`, including `NEXT_PUBLIC_PRIVY_APP_ID`.

```sh
pnpm install --frozen-lockfile
pnpm run build:android
```

The build first compiles `apps/mobile-client` into Android assets, then runs the release build and Android lint, aligns the APK, signs it and verifies its signature. Only the explicitly allowlisted `NEXT_PUBLIC_*` settings enter the bundle. Private backend settings and wallet keys are never bundled.

Restore `.private/mpocket-testing.keystore` and `.private/keystore-password` to sign an update. These files are ignored by Git. Keep the same key and increment versionCode for subsequent releases. Output: `apps/android/mpocket-0.2.2.apk` and its SHA-256 checksum. This APK contains no ABI-specific native library and is suitable for ARM and x86 Android devices.

## Architecture

`apps/mobile-client/main.tsx` mounts the existing Providers, AuthGate and HomePage, with local handling for `/pay/<id>`. Vite packages only the client graph. LauncherActivity serves these files through Android’s HTTPS asset loader at `https://mpocket.tech`; it never proxies or caches `/api/*`. Keeping the same HTTPS origin preserves API and Privy origin rules. Twitter authorization opens an Android browser Custom Tab. Its verified HTTPS /auth/android callback validates saved state and returns to the original bundled Home or payment checkout. The Privy PKCE verifier stays in WebView storage; the tab can reuse the browser’s X session. A standalone fallback page offers Return to mPocket if automatic App Link handling is unavailable. OAuth popups retain their opener and shared cookies, load the bundled callback, display a close control, and receive no native bridge.

The small WebMessage bridge permits camera, text sharing and preparing browser OAuth only from the main Pocket origin. There is no native signing API or wallet-key access. APK updates carry new interface versions; backend changes remain online. The old `twa-manifest.json` records the previous Chrome-based build and is not used by the new build script.

The mainnet-pilot waitlist appears only under verified merchants on Send. Its Android adapter probes endpoint availability without creating or paying an invoice. The current production backend includes the waitlist checkout.

## Acceptance

See `docs/evidence/android-0.2.0-validation.json` for performed checks and their limits. A phone acceptance run should confirm existing-account sign-in, any enrolled passkey, camera permission/scan/cancel, sharing, and an intended testnet payment with a confirmed receipt. Emulator and fixture checks do not prove real account access or successful financial transactions.

## 0.2.1 features

Send includes verified merchant offers: a fixed random 10–30% Greylabs merch discount per account and the existing Pocket mainnet-pilot waitlist checkout. The welcome Rewards sheet shows a seven-task weekly checklist after claiming. Progress comes from verified Mezo receipts and new Pocket accounts attributed through an invite link; weeks reset Monday at 00:00 UTC. No additional financial reward is promised by this checklist. The new additive database tables and endpoints must be deployed with the app update.

## 0.2.2 changes

X sign-in uses a browser Custom Tab and returns to the Android app, including after process recreation. Browser cancellation resets the sign-in screen for retry. Home no longer has a duplicate mainnet waitlist; the offer remains under verified merchants. The web /home install gate is removed, native app detection suppresses PWA install offers, and the auth callback contains no app or PWA startup code. See docs/android-0.2.2-handoff.md for validation.
