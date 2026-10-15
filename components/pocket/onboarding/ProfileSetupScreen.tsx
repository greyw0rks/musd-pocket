"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { BackIcon } from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN_PLAIN } from "@/components/pocket/theme";
import { Button, IconButton } from "@/components/pocket/ui/Button";
import { TextField, type FieldStatus } from "@/components/pocket/ui/TextField";
import { normaliseHandle } from "@/features/session/handle";

/** How long to wait after the last keystroke before checking a username. */
const CHECK_DEBOUNCE_MS = 450;

/**
 * Screen 04 — Profile setup.
 *
 * Two fields and a username, because that is genuinely what Pocket needs: a
 * name to show, and a handle to be paid at. Anything else belongs in settings
 * where it can be changed.
 *
 * The picture is the initials of whatever name is typed, live. That is not a
 * placeholder for a file picker — uploading a photo needs storage, which needs
 * a backend, and shipping a fake "choose photo" button that discards the file
 * is the exact flavour of dishonesty this build is trying to avoid.
 */
export function ProfileSetupScreen() {
  const { session, back, push, saveProfile, checkHandle, canGoBack } = usePocket();

  const [name, setName] = useState(session?.user.name ?? "");
  const [handle, setHandle] = useState("");
  const [businessName, setBusinessName] = useState(session?.user.businessName ?? "");
  const [status, setStatus] = useState<FieldStatus>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isMerchant = session?.user.accountType === "merchant";

  /** The latest check wins; an earlier slow reply must not overwrite it. */
  const checkId = useRef(0);

  useEffect(() => {
    const clean = normaliseHandle(handle);

    if (clean.length === 0) {
      setStatus("idle");
      setProblem(null);
      return;
    }

    setStatus("checking");
    const id = (checkId.current += 1);

    const timer = setTimeout(() => {
      void (async () => {
        const reason = await checkHandle(clean);
        if (checkId.current !== id) return;
        setProblem(reason);
        setStatus(reason ? "invalid" : "valid");
      })();
    }, CHECK_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [handle, checkHandle]);

  const ready = name.trim().length >= 2 && status === "valid" && !saving;

  async function next() {
    if (!ready) return;
    setSaving(true);
    const reason = await saveProfile({
      name: name.trim(),
      handle: normaliseHandle(handle),
      businessName: isMerchant ? businessName.trim() : undefined,
    });
    setSaving(false);
    if (reason) {
      setProblem(reason);
      return;
    }
    push("onboarding-done");
  }

  return (
    <div className={SCREEN_PLAIN}>
      <div className="flex min-h-11 items-center">
        {canGoBack ? (
          <IconButton label="Back" onClick={back}>
            <BackIcon size={22} />
          </IconButton>
        ) : null}
      </div>

      <div className="flex items-center gap-3.5 pt-5">
        <Avatar name={name.trim() || "?"} size={56} />
        <div className="min-w-0">
          <h1 className="pk-h2">
            {isMerchant ? "Set up your business" : "Set up your profile"}
          </h1>
          <p className="pk-m mt-0.5">This is how people find you.</p>
        </div>
      </div>

      <div className="mt-7 flex-1 space-y-1">
        <TextField
          label="Display name"
          placeholder="Alex Morgan"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          hint="Shown on your receipts and in other people's contact lists."
        />

        <TextField
          label="Username"
          prefix="@"
          placeholder="alex"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={handle}
          status={status}
          error={status === "invalid" ? (problem ?? undefined) : undefined}
          onChange={(event) => setHandle(normaliseHandle(event.target.value))}
          hint={
            status === "valid"
              ? `People can send to @${normaliseHandle(handle)}.`
              : "Lowercase letters, numbers and underscores."
          }
        />

        {isMerchant ? (
          <TextField
            label="Business name"
            placeholder="Corner Coffee"
            autoComplete="organization"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            hint="Appears on payment requests you send to customers."
          />
        ) : null}
      </div>

      <div className="pt-5">
        <Button
          full
          size="lg"
          loading={saving}
          disabled={!ready}
          onClick={() => void next()}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
