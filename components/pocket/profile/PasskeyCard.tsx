"use client";

import { useState } from "react";
import { useMfa, useMfaEnrollment } from "@privy-io/react-auth";
import { AlertIcon, CheckIcon, ShieldIcon } from "@/components/pocket/icons";
import { Button } from "@/components/pocket/ui/Button";

/**
 * The passkey, and the honest sentence about what it does.
 *
 * This card exists because of a trade made one file over. `privyConfig` turns
 * Privy's confirmation sheet off (`embeddedWallets.showWalletUIs: false`), and
 * `MfaGate` puts the device's passkey where that sheet used to be. The sheet
 * being off is invisible — nothing on screen says a prompt was skipped — so the
 * only place the trade can be stated is here, in the section a person opens when
 * they want to know what protects their money.
 *
 * Which is why the two states read so differently. Enrolled, the card says what
 * is standing in front of every signature. Not enrolled, it says the plain
 * thing: nothing is, and a transfer will sign without asking. That is not a
 * scare to drive enrolment — it is the actual behaviour of the build, and a
 * security section that described it as anything else would be lying to the
 * person least equipped to check.
 *
 * Enrolment itself is Privy's modal (`showMfaEnrollmentModal`). That is the one
 * screen of Privy's still reachable from here, and it is the right one to keep:
 * it is where the WebAuthn credential is created against the account, it runs
 * once, and nothing about the money passes through it.
 *
 * The card also speaks up about the case that would otherwise fail silently: a
 * user who enrolled SMS or TOTP instead. `MfaGate` completes passkeys only —
 * the others want a code this app has nowhere to collect — so a non-passkey
 * method is flagged as something that will block a transfer, rather than left
 * to be discovered at the till.
 */
export function PasskeyCard() {
  const { mfaMethods } = useMfa();
  const { showMfaEnrollmentModal, unenrollWithPasskey } = useMfaEnrollment();
  const [removing, setRemoving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const enrolled = mfaMethods.includes("passkey");
  const otherMethods = mfaMethods.filter((method) => method !== "passkey");

  async function remove() {
    setProblem(null);
    setRemoving(true);

    try {
      await unenrollWithPasskey();
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Could not remove the passkey.",
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="pk-card" style={{ padding: "16px 20px" }}>
      <div className="pk-row" style={{ gap: 12, alignItems: "flex-start" }}>
        <span
          className="pk-ico"
          style={{ flex: "none", color: enrolled ? "var(--g)" : undefined }}
        >
          {enrolled ? <ShieldIcon size={18} /> : <AlertIcon size={18} />}
        </span>

        <div className="min-w-0">
          <b className="text-[14px]">
            {enrolled ? "Passkey is on" : "No passkey yet"}
          </b>
          <p className="pk-m" style={{ marginTop: 2 }}>
            {enrolled ? (
              <>
                Every transfer asks for your face or fingerprint before it signs.
                Pocket draws no confirmation sheet of its own — this is what
                stands in its place, and it is checked on the device that holds
                the credential rather than on our servers.
              </>
            ) : (
              <>
                Right now a transfer signs without asking you anything. Pocket
                draws no confirmation sheet of its own, so a passkey is the only
                thing that would stand between a signature and whoever is holding
                the phone. Add one on this device and it is asked for every time.
              </>
            )}
          </p>
        </div>
      </div>

      {otherMethods.length > 0 && (
        <p
          className="text-[11px] leading-relaxed"
          style={{
            marginTop: 10,
            color: "color-mix(in srgb, var(--y) 42%, var(--t))",
          }}
        >
          {/*
            Stated rather than hidden: MfaGate finishes passkeys only. A user
            who enrolled one of these would meet a prompt that never completes,
            and finding that out at the till is the worst possible time.
          */}
          Also enrolled: {otherMethods.join(", ")}. Pocket can only answer the
          passkey prompt on its own — a transfer may ask for a{" "}
          {otherMethods[0]} code, which this screen cannot collect yet.
        </p>
      )}

      {problem && (
        <p
          className="text-[11px] leading-relaxed"
          style={{ marginTop: 10, color: "var(--rd)" }}
        >
          {problem}
        </p>
      )}

      <div className="pk-row" style={{ marginTop: 14, gap: 10 }}>
        {enrolled ? (
          <Button
            variant="secondary"
            size="sm"
            loading={removing}
            onClick={remove}
          >
            Remove passkey
          </Button>
        ) : (
          <Button
            size="sm"
            icon={<CheckIcon size={15} />}
            onClick={showMfaEnrollmentModal}
          >
            Add a passkey
          </Button>
        )}
      </div>
    </div>
  );
}
