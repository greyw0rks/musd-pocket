"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import type { Hash } from "viem";
import { useSession } from "@/lib/auth/session";
import { ApiError, useApi } from "@/lib/auth/client";
import { CHAIN_ID, EXPLORER_URL, MUSD_ADDRESS } from "@/lib/mezo/config";
import { getPublicClient, MUSD_ABI, parseMusd } from "@/lib/mezo/musd";
import type { SerializedRequest } from "@/lib/requests/serialize";
import { checkoutBlockReason } from "@/lib/requests/rules";
import { Button } from "@/components/ui/button";
import { PaymentLink } from "./PaymentLink";

export function Checkout({
  shortId,
  embedded = false,
}: {
  shortId: string;
  embedded?: boolean;
}) {
  const { walletAddress } = useSession();
  return (
    <ActiveCheckout
      key={`${shortId}:${walletAddress}`}
      shortId={shortId}
      embedded={embedded}
    />
  );
}

function ActiveCheckout({
  shortId,
  embedded,
}: {
  shortId: string;
  embedded: boolean;
}) {
  const { walletAddress } = useSession();
  const { data: wallet } = useWalletClient();
  const api = useApi();
  const cache = useQueryClient();
  const storageKey = `pocket:checkout:${CHAIN_ID}:${walletAddress}:${shortId}`;
  const [pendingHash, setPendingHash] = useState<Hash | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved && /^0x[\da-f]{64}$/i.test(saved) ? (saved as Hash) : null;
    } catch {
      return null;
    }
  });
  const [recoveryHash, setRecoveryHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);
  const query = useQuery({
    queryKey: ["checkout", shortId, walletAddress],
    queryFn: () => api<SerializedRequest>(`/api/requests/${shortId}`),
    refetchInterval: 5_000,
    retry: false,
  });
  const request = query.data;
  const paid = request?.status === "PAID" || request?.status === "LATE_PAID";
  const owner = request?.creatorAddress === walletAddress?.toLowerCase();
  const activeHash =
    pendingHash ??
    (request?.payerAddress === walletAddress?.toLowerCase()
      ? (request?.txHash as Hash | null)
      : null);
  const saveHash = useCallback(
    (hash: Hash) => {
      setPendingHash(hash);
      try {
        localStorage.setItem(storageKey, hash);
      } catch {
        /* Keep the hash in state and on screen if storage is unavailable. */
      }
    },
    [storageKey],
  );
  const clearHash = useCallback(
    (confirmedHash: Hash) => {
      // An older poll or a manually entered proof must never clear a different
      // transfer that is still being confirmed in this tab or another one.
      setPendingHash((current) =>
        current?.toLowerCase() === confirmedHash.toLowerCase() ? null : current,
      );
      try {
        if (
          localStorage.getItem(storageKey)?.toLowerCase() ===
          confirmedHash.toLowerCase()
        )
          localStorage.removeItem(storageKey);
      } catch {
        /* The matching in-memory hash was cleared above. */
      }
    },
    [storageKey],
  );
  const confirm = useCallback(
    async (hash: Hash, recover = false) => {
      try {
        const result = await api<SerializedRequest & { pending: boolean }>(
          `/api/requests/${shortId}/pay`,
          { method: "POST", body: JSON.stringify({ txHash: hash }) },
        );
        cache.setQueryData(["checkout", shortId, walletAddress], result);
        setError(null);
        if (recover && result.pending) {
          if (result.txHash?.toLowerCase() === hash.toLowerCase())
            saveHash(hash);
          else
            setError(
              "This transaction is not readable yet. Check the hash and try again before sending any new payment.",
            );
        }
        if (!result.pending) {
          clearHash(hash);
          void cache.invalidateQueries({ queryKey: ["pocket-user"] });
        }
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not confirm the payment. Keep the transaction hash and try again.",
        );
        if (
          failure instanceof ApiError &&
          failure.code === "TRANSACTION_REVERTED"
        ) {
          clearHash(hash);
          void cache.invalidateQueries({ queryKey: ["checkout", shortId] });
        }
      }
    },
    [api, cache, shortId, walletAddress, saveHash, clearHash],
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === storageKey &&
        event.newValue &&
        /^0x[\da-f]{64}$/i.test(event.newValue)
      )
        setPendingHash(event.newValue as Hash);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, [storageKey]);
  useEffect(() => {
    if (!activeHash || paid) return;
    const timer = window.setInterval(() => {
      void confirm(activeHash);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [activeHash, paid, confirm]);

  async function pay() {
    if (
      !request ||
      !walletAddress ||
      !wallet?.account ||
      inFlight.current ||
      activeHash ||
      recoveryHash.trim()
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const send = async () => {
      // A second tab may have signed while this tab was waiting for the lock.
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(storageKey);
      } catch {
        /* Current tab still retains its hash in state. */
      }
      if (saved && /^0x[\da-f]{64}$/i.test(saved)) {
        saveHash(saved as Hash);
        await confirm(saved as Hash);
        return;
      }
      // Refresh before signing; a closed request never triggers a wallet write.
      const current = await api<SerializedRequest>(`/api/requests/${shortId}`);
      cache.setQueryData(["checkout", shortId, walletAddress], current);
      const refused = checkoutBlockReason(current, walletAddress);
      if (refused) throw new Error(refused);
      if (
        current.amount !== request.amount ||
        current.recipientAddress !== request.recipientAddress
      )
        throw new Error("The request changed. Review it before paying.");
      if (
        wallet.account.address.toLowerCase() !== walletAddress.toLowerCase() ||
        wallet.chain?.id !== CHAIN_ID
      )
        throw new Error(
          "Connect your Pocket wallet on the requested Mezo network.",
        );
      const rpc = getPublicClient();
      if ((await rpc.getChainId()) !== CHAIN_ID)
        throw new Error("The payment network could not be verified.");
      const simulation = await rpc.simulateContract({
        account: wallet.account.address,
        address: MUSD_ADDRESS,
        abi: MUSD_ABI,
        functionName: "transfer",
        args: [
          current.recipientAddress as `0x${string}`,
          parseMusd(current.amount),
        ],
      });
      if (!simulation.result)
        throw new Error(
          "The token refused this transfer. Check your balance before trying again.",
        );
      const hash = await wallet.writeContract(simulation.request);
      saveHash(hash); // Persist before waiting or recording; retries submit this proof only.
      await confirm(hash);
    };
    try {
      if (navigator.locks) {
        await navigator.locks.request(
          storageKey,
          { ifAvailable: true },
          async (lock) => {
            if (!lock)
              throw new Error(
                "This payment is already open in another tab. Finish it there first.",
              );
            await send();
          },
        );
      } else await send();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not prepare the payment.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const reason =
    request && walletAddress
      ? checkoutBlockReason(request, walletAddress, now)
      : null;
  const Container = embedded ? "div" : "main";
  const Heading = embedded ? "h2" : "h1";
  const title = paid
    ? embedded
      ? "You're on the waitlist"
      : request?.status === "LATE_PAID"
        ? "Payment received after expiry"
        : "Payment confirmed"
    : owner
      ? "Your payment request"
      : embedded
        ? "Review your payment"
        : "Pay with Pocket";
  return (
    <Container
      className={
        embedded
          ? "flex min-w-0 flex-col gap-4"
          : "mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-5 py-8"
      }
    >
      {!embedded ? (
        <Link href="/home" className="text-sm text-primary">
          ← Back to Pocket
        </Link>
      ) : null}
      <header>
        <p className="text-sm text-muted">
          Mezo {CHAIN_ID === 31611 ? "testnet" : "mainnet"}
        </p>
        <Heading
          className={`mt-1 font-semibold tracking-tight ${embedded ? "text-xl" : "text-3xl"}`}
        >
          {title}
        </Heading>
      </header>
      {query.isPending ? <p role="status">Loading payment request…</p> : null}
      {query.isError ? (
        <div role="alert">
          <p>{query.error.message}</p>
          <Button className="mt-3" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}
      {request ? (
        <>
          <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
            {request.merchantName ? (
              <h2 className="text-lg font-semibold">{request.merchantName}</h2>
            ) : null}
            <p className="break-words text-4xl font-semibold tabular-nums">
              {request.amount} <span className="text-xl">mUSD</span>
            </p>
            <p>{request.description || "Payment request"}</p>
            <div className="text-sm">
              <p className="text-muted">Paid directly to</p>
              <p className="break-all font-mono text-xs">
                {request.recipientAddress}
              </p>
            </div>
            <p className="text-sm text-muted">
              {request.expiresAt
                ? `Expires ${new Date(request.expiresAt).toLocaleString()}`
                : "No expiry"}
            </p>
            {paid && request.txHash ? (
              <a
                className="inline-block text-primary underline"
                href={`${EXPLORER_URL}/tx/${request.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View confirmed transaction
              </a>
            ) : null}
          </section>
          {owner &&
          request.version === 2 &&
          !paid &&
          request.status === "PENDING" &&
          (!request.expiresAt ||
            new Date(request.expiresAt).getTime() > now) ? (
            <PaymentLink shortId={shortId} />
          ) : null}
          {!paid && reason ? (
            <p role="status" className="text-sm">
              {reason}
            </p>
          ) : null}
          {activeHash && !paid ? (
            <section className="space-y-3 rounded-2xl border border-border p-4">
              <p className="font-semibold">
                Payment sent · checking confirmation
              </p>
              <p className="text-sm">
                Keep this transaction hash. Check confirmation instead of
                sending again.
              </p>
              <a
                className="block break-all font-mono text-xs text-primary underline"
                href={`${EXPLORER_URL}/tx/${activeHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {activeHash}
              </a>
              <Button
                fullWidth
                variant="secondary"
                onClick={() => void confirm(activeHash)}
              >
                Check confirmation
              </Button>
            </section>
          ) : null}
          {!owner && !paid && !activeHash ? (
            <Button
              fullWidth
              size="lg"
              loading={busy}
              disabled={
                Boolean(reason) ||
                !wallet?.account ||
                Boolean(recoveryHash.trim())
              }
              onClick={() => void pay()}
            >
              Pay {request.amount} mUSD
            </Button>
          ) : null}
          {!owner && !paid ? (
            <p className="text-center text-sm text-muted">
              Your wallet sends mUSD directly. BTC pays network gas.
            </p>
          ) : null}
          {!owner && !paid ? (
            <details className="text-sm">
              <summary className="cursor-pointer">
                Already sent a payment?
              </summary>
              <label className="mt-3 block" htmlFor="payment-hash">
                Transaction hash
              </label>
              <input
                id="payment-hash"
                value={recoveryHash}
                onChange={(event) => setRecoveryHash(event.target.value.trim())}
                className="my-2 w-full rounded-lg border border-border bg-transparent p-3 font-mono text-xs"
                placeholder="0x…"
              />
              <Button
                variant="secondary"
                disabled={!/^0x[\da-f]{64}$/i.test(recoveryHash)}
                onClick={() => {
                  void confirm(recoveryHash as Hash, true);
                }}
              >
                Check existing payment
              </Button>
            </details>
          ) : null}
        </>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="break-words rounded-xl bg-error/10 p-3 text-sm text-error"
        >
          {error}
        </p>
      ) : null}
    </Container>
  );
}
