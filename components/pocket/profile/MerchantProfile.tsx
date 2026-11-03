"use client";

import { useState } from "react";
import { usePocket } from "@/components/pocket/store";
import { Button } from "@/components/pocket/ui/Button";
import { TextField } from "@/components/pocket/ui/TextField";
import type { AccountType } from "@/features/session/session.types";

export function MerchantProfile() {
  const { session, saveProfile } = usePocket();
  const [accountType, setAccountType] = useState<AccountType>(
    session?.user.accountType ?? "personal",
  );
  const [name, setName] = useState(session?.user.businessName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const problem = await saveProfile({
        accountType,
        businessName: name.trim(),
      });
      if (problem) {
        setError(problem);
        return;
      }
      setMessage(
        accountType === "merchant"
          ? "Profile saved. New payment links will use your business name."
          : "Personal profile saved.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pk-card mt-4" aria-label="Merchant profile">
      <h2 className="text-[15px] font-semibold">Payment profile</h2>
      <label className="pk-m mt-3 block" htmlFor="account-type">
        Account type
      </label>
      <select
        id="account-type"
        value={accountType}
        disabled={busy}
        onChange={(e) => {
          setAccountType(e.target.value as AccountType);
          setMessage(null);
        }}
        className="mt-1 w-full rounded-xl bg-[var(--s2)] p-3 text-[14px]"
      >
        <option value="personal">Personal</option>
        <option value="merchant">Business</option>
      </select>
      {accountType === "merchant" ? (
        <TextField
          className="mt-3"
          label="Business name"
          value={name}
          maxLength={80}
          disabled={busy}
          onChange={(e) => {
            setName(e.target.value);
            setMessage(null);
          }}
          hint="Saved for new links. Existing invoices keep their original name."
        />
      ) : null}
      {message ? (
        <p className="pk-m mt-3" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-[13px] text-[var(--r-ink)]" role="alert">
          {error}
        </p>
      ) : null}
      <Button full className="mt-4" loading={busy} onClick={() => void save()}>
        Save profile
      </Button>
    </section>
  );
}
