"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import { getAddress, parseUnits } from "viem";
import { AppShell } from "@/components/pocket/PhoneShell";
import { Button } from "@/components/pocket/ui/Button";
import { EmbeddedWalletActivator } from "@/hooks/use-live-wallet";
import { useSession } from "@/lib/auth/session";
import { useApi } from "@/lib/auth/client";
import { hasPrivy } from "@/lib/wallet/privy";
import { CHAIN_ID, MUSD_ADDRESS, activeChain } from "@/lib/mezo/config";
import { getPublicClient, MUSD_ABI } from "@/lib/mezo/musd";
import { explorer } from "@/lib/mezo/explorer";
import type { SerializedRequest } from "@/lib/requests/serialize";

type Invoice = SerializedRequest & { pending?: boolean };
function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function readSavedHash(key: string | null): `0x${string}` | null {
  try { const saved = key ? localStorage.getItem(key) : null; return saved && /^0x[0-9a-fA-F]{64}$/.test(saved) ? saved as `0x${string}` : null; }
  catch { return null; }
}

export function Checkout({ shortId }: { shortId: string }) {
  return <AppShell screen="checkout">{hasPrivy() ? <CheckoutBody shortId={shortId} /> : <div className="pk-scr p-6"><h1 className="pk-h1">Checkout unavailable</h1><p className="pk-m mt-3">Pocket sign-in has not been configured.</p></div>}</AppShell>;
}

function CheckoutBody({ shortId }: { shortId: string }) {
  const session = useSession();
  const api = useApi();
  const { data: wallet } = useWalletClient();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [broadcastState, setBroadcastState] = useState<{ key: string | null; hash: `0x${string}` | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storageKey = session.walletAddress ? `pocket:checkout:v1:${CHAIN_ID}:${session.walletAddress}:${shortId}` : null;

  const savedHash = useSyncExternalStore(subscribeToStorage, () => readSavedHash(storageKey), () => null);
  const hash = broadcastState?.key === storageKey ? broadcastState?.hash : savedHash;

  const query = useQuery<Invoice>({
    queryKey: ["checkout", shortId, session.walletAddress],
    queryFn: async () => {
      if (session.authenticated) return api<Invoice>(`/api/checkout/${shortId}`);
      const response = await fetch(`/api/checkout/${shortId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to view this older payment link." : body.error || "Could not load this payment link.");
      return body;
    },
    refetchInterval: 5_000,
    retry: 1,
  });
  const invoice = query.data;
  const paid = invoice?.status === "PAID" || invoice?.status === "LATE_PAID";
  const ownPendingHash = invoice?.payerAddress === session.walletAddress ? invoice?.txHash as `0x${string}` | null : null;
  const sentHash = hash || ownPendingHash;
  const ownInvoice = invoice?.creatorAddress === session.walletAddress;

  async function payOrConfirm() {
    if (busy || !session.user || !invoice) return;
    setBusy(true); setError(null);
    let broadcast = sentHash;
    try {
      if (!broadcast) {
        if (!wallet?.account || wallet.account.address.toLowerCase() !== session.walletAddress) throw new Error("Your Pocket wallet is still loading. Try again shortly.");
        if (await wallet.getChainId() !== CHAIN_ID) throw new Error("Switch your wallet to Mezo before paying.");
        const fresh = await api<Invoice>(`/api/checkout/${shortId}`, { method: "POST" });
        if (fresh.amount !== invoice.amount || fresh.recipientAddress !== invoice.recipientAddress || fresh.token.toLowerCase() !== MUSD_ADDRESS.toLowerCase() || fresh.chainId !== CHAIN_ID) throw new Error("This invoice changed. Refresh before paying.");
        const rpc = getPublicClient();
        const simulation = await rpc.simulateContract({ account: wallet.account.address, address: MUSD_ADDRESS, abi: MUSD_ABI, functionName: "transfer", args: [getAddress(fresh.recipientAddress), parseUnits(fresh.amount, 18)] });
        broadcast = await wallet.writeContract({ ...simulation.request, account: wallet.account, chain: activeChain, gas: 65_000n });
        setBroadcastState({ key: storageKey, hash: broadcast });
        if (storageKey) { try { localStorage.setItem(storageKey, broadcast); } catch { /* Keep the hash in this mounted checkout. */ } }
      }
      const result = await api<Invoice>(`/api/requests/${shortId}/pay`, { method: "POST", body: JSON.stringify({ txHash: broadcast }) });
      qc.setQueryData(["checkout", shortId, session.walletAddress], result);
      await qc.invalidateQueries({ queryKey: ["merchant-invoices"] });
      if (result.pending) setError("Your payment is being confirmed. Keep this transaction; use Confirm payment to retry the receipt check.");
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Could not complete this step.";
      if (broadcast && message === "Transaction reverted") {
        setBroadcastState({ key: storageKey, hash: null }); if (storageKey) { try { localStorage.removeItem(storageKey); } catch { /* Storage can be unavailable. */ } }
        setError("The transfer reverted. No mUSD was sent. You can try again.");
        await query.refetch();
      } else setError(broadcast ? `Your transfer was sent. ${message} Retry confirmation without paying again.` : message);
    } finally { setBusy(false); }
  }

  return <>
    <EmbeddedWalletActivator />
    <main className="pk-scr flex flex-1 flex-col overflow-y-auto px-6 py-6">
      <Link href="/home" className="pk-m mb-8 w-fit">← Pocket</Link>
      <p className="pk-m uppercase">mUSD checkout · Mezo {CHAIN_ID === 31611 ? "testnet" : "mainnet"}</p>
      <h1 className="pk-h1 mt-2">{paid ? "Payment received" : invoice?.merchantName || "Payment request"}</h1>
      {query.isLoading ? <p className="pk-m mt-6">Loading invoice…</p> : null}
      {query.error && !invoice ? <p role="alert" className="pk-m mt-6">{query.error.message}</p> : null}
      {invoice ? <>
        <div className="pk-card mt-6 text-center">
          <p className="text-[36px] font-bold tabular-nums">{invoice.amount} <span className="text-lg">mUSD</span></p>
          {invoice.description ? <p className="pk-m mt-3">{invoice.description}</p> : null}
          <p className="pk-m mt-4 break-all">To {invoice.recipientAddress}</p>
          <p className="pk-m mt-2">{invoice.expiresAt ? `Expires ${new Date(invoice.expiresAt).toLocaleString()}` : "No expiry"}</p>
        </div>
        {paid ? <p role="status" className="pk-m mt-5">{invoice.status === "LATE_PAID" ? "The merchant received this payment after the request closed." : "The merchant received mUSD directly in their wallet."}</p> : <p className="pk-m mt-5">{sentHash || invoice.status === "PROCESSING" ? "Payment confirmation is in progress." : invoice.status === "PENDING" ? "Review the amount and recipient before paying. Your wallet pays the BTC network fee." : `This request is ${invoice.status.toLowerCase()}.`}</p>}
        {error ? <p role="alert" className="pk-m mt-5 leading-relaxed">{error}</p> : null}
        {(sentHash || invoice.txHash) ? <a className="pk-m mt-4 break-all underline" href={explorer.tx(sentHash || invoice.txHash!)} target="_blank" rel="noreferrer">View transaction {sentHash || invoice.txHash}</a> : null}
      </> : null}
      <div className="mt-auto space-y-3 pt-8">
        {!session.authenticated ? <Button full size="lg" disabled={!session.ready} onClick={session.login}>Sign in to Pocket</Button> : session.walletMissing ? <Button full size="lg" loading={session.isCreatingWallet} onClick={() => void session.createWallet()}>Create your Pocket wallet</Button> : invoice && !paid && !ownInvoice && (sentHash || invoice.status === "PENDING") ? <Button full size="lg" loading={busy} disabled={!session.user} onClick={() => void payOrConfirm()}>{sentHash ? "Confirm payment" : `Pay ${invoice.amount} mUSD`}</Button> : null}
        {ownInvoice && !paid ? <p className="pk-m text-center">Share this link with your customer. You cannot pay your own invoice.</p> : null}
        {session.error || session.createWalletError ? <p role="alert" className="pk-m">{session.error || session.createWalletError}</p> : null}
        <Link href="/home" className="pk-m block text-center underline">Open Pocket</Link>
      </div>
    </main>
  </>;
}
