"use client";

import { useEffect, useRef, useState } from "react";
import { useWalletClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Address, WalletClient } from "viem";
import { useSession } from "@/lib/auth/session";
import { usePocket } from "@/components/pocket/store";
import {
  prepareWealthStep,
  executeWealthStep,
  recoverWealth,
} from "@/lib/mezo/wealth/transactions";
import {
  readPendingWealth,
  clearPendingWealth,
} from "@/lib/mezo/wealth/journal";
import type {
  WealthPlan,
  WealthReceipt,
  WealthStep,
} from "@/lib/mezo/wealth/types";

function message(error: unknown) {
  if (error instanceof Error && /reject|denied|cancelled/i.test(error.message))
    return "You cancelled the wallet request.";
  if (error instanceof Error && "shortMessage" in error)
    return "The network could not confirm this step. Refresh the quote and check your wallet's balance and network.";
  return error instanceof Error
    ? error.message
    : "Could not prepare this action. Try again.";
}

export function useWealthAction() {
  const { walletAddress } = useSession();
  const { data: wallet } = useWalletClient();
  const { refresh } = usePocket();
  const cache = useQueryClient();
  const latest = useRef({
    owner: walletAddress,
    wallet: wallet as WalletClient | undefined,
  });
  const generation = useRef(0);
  useEffect(() => {
    latest.current = {
      owner: walletAddress,
      wallet: wallet as WalletClient | undefined,
    };
    return () => {
      latest.current = { owner: null, wallet: undefined };
    };
  }, [walletAddress, wallet]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<WealthPlan | null>(null);
  const [step, setStep] = useState<WealthStep | null>(null);
  const [receipt, setReceipt] = useState<WealthReceipt | null>(() => {
    const pending = walletAddress
      ? readPendingWealth(walletAddress as Address)
      : null;
    return pending
      ? {
          requestId: pending.requestId,
          hash: pending.hash,
          kind: pending.kind,
          title: pending.title,
          status: "pending",
        }
      : null;
  });
  const builder = useRef<(() => Promise<WealthPlan>) | null>(null);

  async function updateResult(
    result: WealthReceipt,
    currentPlan: WealthPlan | null,
  ) {
    setReceipt(result);
    if (result.status === "confirmed") {
      void cache.invalidateQueries({ queryKey: ["mezo-pool"] });
      void cache.invalidateQueries({ queryKey: ["mezo-locks"] });
      void cache.invalidateQueries({ queryKey: ["mezo-lock-account"] });
      void cache.invalidateQueries({ queryKey: ["wallet-token"] });
      void refresh().catch(() => {});
      if (result.kind === "approval" && currentPlan) {
        try {
          setStep(await prepareWealthStep(currentPlan));
        } catch (e) {
          setError(`Approval confirmed. ${message(e)}`);
        }
      }
    } else if (result.status === "reverted")
      setError(
        "The transaction reverted. Review a fresh quote before trying again.",
      );
  }

  async function review(makePlan: () => Promise<WealthPlan>) {
    if (busy) return;
    const version = ++generation.current;
    builder.current = makePlan;
    setOpen(true);
    setBusy(true);
    setError(null);
    setStep(null);
    setPlan(null);
    try {
      const owner = latest.current.owner;
      if (!owner) throw new Error("Your Pocket wallet is not ready.");
      const pending = readPendingWealth(owner as Address);
      if (pending) {
        setReceipt({ ...pending, status: "pending" });
        return;
      }
      setReceipt(null);
      const next = await makePlan();
      if (version !== generation.current) return;
      setPlan(next);
      const prepared = await prepareWealthStep(next);
      if (version === generation.current) setStep(prepared);
    } catch (e) {
      if (version === generation.current) setError(message(e));
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  async function confirm() {
    if (!step || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await executeWealthStep(
        step,
        () => latest.current.wallet ?? null,
        () => latest.current.owner,
      );
      setStep(null);
      await updateResult(result, plan);
    } catch (e) {
      setStep(null);
      setError(message(e));
      const pending = readPendingWealth(step.plan.owner);
      if (pending) {
        setPlan(null);
        setReceipt({ ...pending, status: "pending" });
      }
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    if (busy || !walletAddress) return;
    setBusy(true);
    setError(null);
    setStep(null);
    try {
      const result = await recoverWealth(walletAddress as Address);
      if (result) {
        const sameRequest = receipt?.requestId === result.requestId;
        if (!sameRequest) setPlan(null);
        await updateResult(result, sameRequest ? plan : null);
      } else {
        setReceipt(null);
        setPlan(null);
        setError(
          "This request was cleared in another tab. Review a fresh quote.",
        );
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return {
    open,
    busy,
    error,
    plan,
    step,
    receipt,
    review,
    confirm,
    check,
    close: () => {
      if (!busy) {
        generation.current++;
        setOpen(false);
      }
    },
    reopen: () => setOpen(true),
    retry: () => {
      if (builder.current) void review(builder.current);
    },
    clearUnsent: () => {
      if (
        !busy &&
        walletAddress &&
        receipt?.status === "pending" &&
        !receipt.hash
      ) {
        const pending = readPendingWealth(walletAddress as Address);
        if (
          pending &&
          pending.requestId === receipt.requestId &&
          pending.hash === null &&
          clearPendingWealth(walletAddress as Address, pending)
        ) {
          setReceipt(null);
          setPlan(null);
          setStep(null);
          setOpen(false);
        } else
          setError("The saved transaction changed. Check confirmation again.");
      }
    },
  };
}
export type WealthAction = ReturnType<typeof useWealthAction>;
