# mPocket Android 0.2.3

Download: https://mpocket.tech/downloads/mpocket-0.2.3.apk

Install over the existing app. Package `tech.mpocket.testing`, versionCode 5, minimum Android API 24, original signing certificate.

- Login uses Privy's X and email chooser, including after sign-out. Telegram is removed. A dismissed chooser can be reopened; an OAuth return retains Privy's callback/error screen rather than starting another login.
- Google receipt linking uses the real Privy account. Entered email and Google receipt preferences are stored privately per wallet and survive reloads. The server resolves Google's address from the authenticated Privy account. Removing the preference leaves the linked login identity intact. Automatic receipt email delivery is not configured.
- Any confirmed positive direct mUSD payment to the registered merchant `@grey_labs` unlocks a random 10–30% Greylabs code. No minimum payment. Sender, merchant wallet, active network/token, positive amount, successful recorded payment, transaction hash and confirmation time are required. Pending/self payments and old free coupons do not unlock it, including through the public code validator. One coupon stays fixed per account.
- The Pay merchant button enters the normal amount/review/sign flow using the server's verified recipient. Revealing a discount does not send a payment. Greylabs merchandise previews stay inside the app; a user can open a prefilled email enquiry.
- The bundled interface fills the Android viewport, with shared headers, bottom navigation, page transitions, touch targets and dismissible sheets. Sheets render outside screen scrollers; Android Back closes overlays before navigating. This updates the existing Android/WebView app, not a native-screen rewrite.
- Home has no waitlist or Chrome install gate. Pocket mainnet access remains under Send → Verified merchants. Weekly tasks continue to update automatically from confirmed activity.
- X and Google authorization use a browser Custom Tab and the dedicated `/auth/android` return. The callback checks the pending state, expected provider and expiry; the original route and WebView PKCE storage remain in the app. Live Privy initialization accepts both providers. Google can use Privy's shared credentials; custom Google credentials are optional for branding.

Receipt schema was added using the reviewed standalone SQL, without unrelated Prisma schema synchronization. Before/after counts of users, payments and invoices were unchanged. Evidence: `docs/evidence/receipt-preferences-database.json`.

Validation records live under `docs/evidence/android/`: merchant/payment gate and weekly-task browser fixtures, mobile screen/receipt/sign-out checks, actual bundled Privy OAuth regressions, live provider configuration. Backend checks cover private receipt preference authorization, payment eligibility, persistent random coupons, rewards and direct-payment recovery. TypeScript, scoped ESLint, Vite, JVM callback checks, Android assembly/lint, signing, alignment and packaged-asset comparison are checked for this release. Existing broad repository lint errors in unrelated ref/state-effect patterns remain outside this change.

Browser fixtures mock sessions, balances and financial APIs, and stop before account login or signing. Physical Android installation, real X/Google account authorization and device App Link resolution remain unverified. No payment, account login or message was sent during verification. Production checks and APK hash are recorded in `docs/evidence/android-0.2.3-release.json` after publication.
