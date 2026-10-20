"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { PocketMark } from "@/components/brand/pocket-mark";
import { installSteps } from "@/components/install/steps";
import { useInstall } from "@/components/install/use-install";

/**
 * The install gate.
 *
 * On a phone the app is meant to be an app: one icon, one tap, full screen,
 * signed in. A browser tab is a worse version of the same thing — the address
 * bar eats the top, the back gesture closes the wallet instead of navigating,
 * and the session has no home. So a first-time phone visitor is asked to install
 * before they get in, and can still decline with one tap.
 *
 * On a desktop the gate does not appear at all. There is a desktop site, so
 * asking someone at a keyboard to "add this to your home screen" would be
 * selling them a phone feature they cannot use. They get a small card instead,
 * which they can ignore forever.
 *
 * A person who has installed, or who has already declined, never sees either.
 */
export function InstallGate({ children }: { children: ReactNode }) {
  const { ready, standalone, dismissed, desktop, canPrompt, ios, install, dismiss } =
    useInstall();

  /*
    Render nothing until the browser state is known. Rendering the app first and
    covering it a frame later flashes a screen the person is about to be told to
    leave; rendering the gate first and removing it flashes a demand. Nothing is
    a shorter lie than either.
  */
  if (!ready) return null;

  if (standalone || dismissed) return <>{children}</>;

  if (desktop) {
    return (
      <>
        <DesktopInstallCard canPrompt={canPrompt} onInstall={install} onDismiss={dismiss} />
        {children}
      </>
    );
  }

  return (
    <MobileGate
      canPrompt={canPrompt}
      ios={ios}
      onInstall={install}
      onDismiss={dismiss}
    />
  );
}

function AppMark({ size = 76 }: { size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        borderRadius: size * 0.23,
        boxShadow: "0 14px 34px rgb(166 63 217 / 0.32)",
      }}
    >
      <PocketMark size={size} />
    </div>
  );
}

function MobileGate({
  canPrompt,
  ios,
  onInstall,
  onDismiss,
}: {
  canPrompt: boolean;
  ios: boolean;
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
}) {
  const [showSteps, setShowSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  const steps = installSteps(ios);

  const handleInstall = async () => {
    setBusy(true);
    const accepted = await onInstall();
    setBusy(false);
    // No prompt available (iOS, or Chrome withheld it): the honest response is
    // to show the steps, not to pretend the install happened.
    if (!accepted) setShowSteps(true);
  };

  return (
    <div
      className="pocket-root"
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        display: "grid",
        placeItems: "center",
        // The notch and the home indicator are inside the layout now
        // (`viewport-fit=cover`), so both padding ends carry their insets.
        padding:
          "calc(32px + env(safe-area-inset-top, 0px)) 24px calc(32px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <AppMark />
        </div>

        <h1 className="pk-h1" style={{ marginTop: 22 }}>
          Add Pocket to your home screen
        </h1>

        <p
          className="pk-m"
          style={{ fontSize: 14, lineHeight: 1.65, marginTop: 6 }}
        >
          It opens full screen, keeps you signed in, and is one tap away. The
          browser works too — this just feels like it should be an app.
        </p>

        {showSteps ? (
          <ol
            className="pk-card"
            style={{
              textAlign: "left",
              marginTop: 22,
              padding: "14px 16px",
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {steps.map((step, index) => (
              <li
                key={step.text}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    flex: "none",
                    borderRadius: 15,
                    background: "var(--s2)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {step.icon}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.45 }}>
                  <b style={{ color: "var(--m)", marginRight: 6 }}>
                    {index + 1}.
                  </b>
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            className="pk-btn"
            disabled={busy}
            onClick={handleInstall}
          >
            {busy ? "Opening…" : canPrompt ? "Install Pocket" : "Show me how"}
          </button>

          <button
            type="button"
            className="pk-btn pk-btn--alt"
            onClick={onDismiss}
            disabled={busy}
          >
            Continue in the browser
          </button>
        </div>

        <p className="pk-m" style={{ marginTop: 18, lineHeight: 1.5 }}>
          You can install any time from your browser&rsquo;s menu.
        </p>
      </div>
    </div>
  );
}

function DesktopInstallCard({
  canPrompt,
  onInstall,
  onDismiss,
}: {
  canPrompt: boolean;
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
}) {
  const [hiddenAfterPrompt, setHiddenAfterPrompt] = useState(false);
  if (hiddenAfterPrompt) return null;

  return (
    <div
      className="pocket-root"
      style={{ position: "fixed", left: 20, bottom: 20, zIndex: 60 }}
    >
      <div
        className="pk-card"
        role="complementary"
        aria-label="Install Pocket"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          maxWidth: 340,
          padding: "12px 12px 12px 14px",
          boxShadow: "0 16px 44px rgb(0 0 0 / 0.22)",
        }}
      >
        <AppMark size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 14 }}>Install Pocket</b>
          <span className="pk-m" style={{ lineHeight: 1.4 }}>
            {canPrompt
              ? "Opens in its own window, one click away."
              : "Use the install icon in your address bar."}
          </span>
        </div>
        {canPrompt ? (
          <button
            type="button"
            className="pk-chip"
            onClick={() => {
              void onInstall().then((accepted) => {
                if (!accepted) setHiddenAfterPrompt(true);
              });
            }}
          >
            Install
          </button>
        ) : null}
        <button
          type="button"
          className="pk-ib pk-ib--flat"
          style={{ width: 32, height: 32 }}
          aria-label="Dismiss"
          onClick={() => {
            setHiddenAfterPrompt(true);
            onDismiss();
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
