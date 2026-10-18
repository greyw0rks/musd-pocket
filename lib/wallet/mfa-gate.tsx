"use client";

import { useMfa, useRegisterMfaListener } from "@privy-io/react-auth";

/**
 * The biometric that stands where Privy's confirmation sheet used to be.
 *
 * `privyConfig` turns the sheet off (`embeddedWallets.showWalletUIs: false`),
 * which on its own would mean signatures happen with no prompt at all. This is
 * the other half of that trade: when Privy decides an action needs MFA, it calls
 * back here, and this completes it with the device's passkey — which is the OS
 * sheet the user sees, not a page drawn by Privy.
 *
 * Renders nothing. It is mounted once inside `PrivyProvider` because that is
 * where the hook is legal, and it is the only place in the app that needs to be.
 *
 * Passkey is the only method completed here, and that is not an oversight: it is
 * the only method that can be finished without asking the user to read a code
 * off another screen. A user with no passkey enrolled has no MFA at all, so this
 * never fires for them — Privy only calls back once a method exists. A user who
 * enrolled SMS or TOTP instead would be asked for a code this component cannot
 * collect, so the failure is reported rather than left to time out in silence.
 */
export function MfaGate() {
  const { init, submit } = useMfa();

  useRegisterMfaListener({
    /*
      Typed `=> void`, but the underlying call is awaited by Privy — the docs
      are explicit that this "only returns once MFA has been completed". So it
      is written as an async function and the promise is handed back rather
      than fired and forgotten.

      There is no `onError` to register: the published type declares only
      `onMfaRequired`, whatever the doc comment above it claims. Every failure
      therefore has to be caught here or it becomes an unhandled rejection.
    */
    onMfaRequired: async ({ mfaMethods }) => {
      if (!mfaMethods.includes("passkey")) {
        /*
          Nothing to do headlessly. Reported rather than attempted, so the
          reason is legible in the console instead of arriving as a bare
          timeout several seconds later.
        */
        console.warn(
          "[pocket] MFA required, but no passkey is enrolled. Methods:",
          mfaMethods.join(", ") || "none",
        );
        return;
      }

      /*
        `init` hands back the WebAuthn request options; `submit` is what raises
        the OS sheet. They are two calls rather than one because the same pair
        serves the code-based methods, where `init` sends the message and
        `submit` carries the digits back.
      */
      try {
        const options = await init("passkey");
        if (options) await submit("passkey", options);
      } catch (error) {
        // A dismissed sheet rejects. That is the user saying no, not a bug.
        console.warn("[pocket] passkey prompt did not complete:", error);
      }
    },
  });

  return null;
}
