# mPocket Android 0.2.2

Download: https://mpocket.tech/downloads/mpocket-0.2.2.apk

Install over the existing app. Package `tech.mpocket.testing`, versionCode 4, minimum Android API 24, same signing certificate as 0.2.1.

- Twitter authorization opens an Android browser Custom Tab. Privy's live OAuth initialization accepts the dedicated `https://mpocket.tech/auth/android` redirect.
- Pending state and the original Home/payment route are persisted privately. A matching, unexpired callback is consumed before returning to the bundled WebView. Privy's PKCE verifier stays in WebView storage. No native wallet or signing interface was added.
- Cancelling the tab returns to a retryable sign-in screen. The pending record remains briefly valid to tolerate a delayed callback; starting a new sign-in replaces it. A standalone browser fallback offers **Return to mPocket** when automatic App Link handling is unavailable.
- The web `/home` install gate is removed. Native detection suppresses PWA installation offers, and the callback route contains no Providers, manifest, service worker or install component.
- Home no longer shows the mainnet pilot waitlist. It remains under verified merchants on Send, alongside the per-account Greylabs discount. Weekly activity tasks remain unchanged.

Validation: TypeScript and scoped ESLint pass; Vite client build succeeds; Android release assembly and lint succeed with no lint errors; JVM checks cover destination/state/provider validation, expiry, rejected callbacks and cold-return metadata. Five browser scenarios run the actual bundled Privy SDK against mocked provider/authentication endpoints with separate browser and app storage: Home, payment, wrong state, cancellation/retry and process recreation. The original verifier matches the initialization challenge on valid callbacks. Callback HTML/header checks verify no-store, package handoff, no PWA markup and malformed callback rejection. APK signature and alignment pass, its certificate matches the prior release, and every packaged web asset matches the Vite output.

Actual Android device installation, opening the physical Custom Tab, X account authentication, App Link resolution and device cancellation timing remain unverified. Browser fixtures simulate Android navigation and stop before account login. A browser tab can reuse the browser's X session, not the separate native X app session. No financial transaction or account login was performed during validation.

Production deployment, download hash and endpoint verification are recorded in `docs/evidence/android-0.2.2-release.json` after publication.
