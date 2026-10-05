"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { getAddress } from "viem";
import { Check, ExternalLink, AlertCircle } from "lucide-react";
import { useRequest, usePayRequest } from "@/hooks/use-requests";
import { useMusdBalance } from "@/hooks/use-musd";
import { useMezoNetwork } from "@/hooks/use-mezo-network";
import { WalletButton } from "@/components/wallet-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddressDisplay } from "@/components/address-display";
import { StatusBadge } from "@/components/ui/status-badge";
import { MUSD_ABI, parseMusd } from "@/lib/mezo/musd";
import { MUSD_ADDRESS, MUSD_SYMBOL, CHAIN_ID } from "@/lib/mezo/config";
import { explorer } from "@/lib/mezo/explorer";
import { formatAmount, shortenAddress } from "@/lib/utils";

type Phase =
  | "ready"
  | "confirming" // waiting for wallet signature
  | "broadcast" // tx submitted, awaiting receipt
  | "verifying" // server verifying transfer
  | "done"
  | "failed";

export function PayFlow({ shortId }: { shortId: string }) {
  const { data: req, isLoading } = useRequest(shortId, true);
  const { address, isConnected } = useAccount();
  const balance = useMusdBalance();
  const { data: native } = useBalance({ address });
  const { wrongNetwork, switchToMezo, isSwitching, networkName } =
    useMezoNetwork();
  const { writeContractAsync } = useWriteContract();
  const pay = usePayRequest(shortId);

  const [phase, setPhase] = useState<Phase>("ready");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  // Once the tx is mined, hand the hash to the server to verify + mark paid.
  useEffect(() => {
    if (phase !== "broadcast" || !receipt.isSuccess || !txHash) return;
    setPhase("verifying");
    pay
      .mutateAsync(txHash)
      .then(() => setPhase("done"))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Verification failed");
        setPhase("failed");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess, phase, txHash]);

  useEffect(() => {
    if (phase === "broadcast" && receipt.isError) {
      setError("Transaction failed on-chain");
      setPhase("failed");
    }
  }, [receipt.isError, phase]);

  if (isLoading) {
    return <Skeleton className="mx-auto h-40 w-full max-w-sm rounded-xl" />;
  }
  if (!req) {
    return (
      <p className="text-center text-muted">This request could not be found.</p>
    );
  }

  const alreadyPaid = req.status === "PAID" || phase === "done";
  const expired = req.status === "EXPIRED";
  const needed = parseMusd(req.amount);
  const insufficient =
    balance.raw !== undefined && balance.raw < needed;
  const noGas = native !== undefined && native.value === 0n;

  const startPayment = async () => {
    if (!req) return;
    setError(null);
    setPhase("confirming");
    try {
      const hash = await writeContractAsync({
        abi: MUSD_ABI,
        address: MUSD_ADDRESS,
        functionName: "transfer",
        args: [getAddress(req.recipientAddress), needed],
        chainId: CHAIN_ID,
      });
      setTxHash(hash);
      setPhase("broadcast");
    } catch (e) {
      // User rejected or wallet error.
      const msg = e instanceof Error ? e.message : "Payment cancelled";
      setError(/reject|denied/i.test(msg) ? "Payment cancelled" : msg);
      setPhase("ready");
    }
  };

  // ---- Confirmation screen ----
  if (alreadyPaid) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-success-soft">
          <Check className="size-8 text-success" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Payment sent
          </h1>
          <p className="tabular mt-3 text-3xl font-semibold text-foreground">
            {formatAmount(req.amount)}{" "}
            <span className="text-base font-normal text-muted">
              {MUSD_SYMBOL}
            </span>
          </p>
          {req.description && (
            <p className="mt-1 text-muted">{req.description}</p>
          )}
        </div>
        {(txHash || req.txHash) && (
          <a
            href={explorer.tx((txHash || req.txHash)!)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            View transaction <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    );
  }

  const busy =
    phase === "confirming" || phase === "broadcast" || phase === "verifying";
  const phaseLabel: Record<Phase, string> = {
    ready: "",
    confirming: "Confirm in your wallet…",
    broadcast: "Confirming payment…",
    verifying: "Verifying payment…",
    done: "",
    failed: "",
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted">Pay request</p>
        <p className="tabular mt-2 text-5xl font-semibold text-foreground">
          {formatAmount(req.amount)}
        </p>
        <p className="text-muted">{MUSD_SYMBOL}</p>
        {req.description && (
          <p className="mt-2 text-foreground">{req.description}</p>
        )}
        <p className="mt-3 text-sm text-muted">
          Requested by{" "}
          <span className="font-mono text-foreground">
            {shortenAddress(getAddress(req.recipientAddress))}
          </span>
        </p>
      </div>

      {expired ? (
        <div className="flex justify-center">
          <StatusBadge status="EXPIRED" />
        </div>
      ) : !isConnected ? (
        <div className="flex justify-center">
          <WalletButton />
        </div>
      ) : wrongNetwork ? (
        <Button fullWidth size="lg" onClick={switchToMezo} loading={isSwitching}>
          Switch to {networkName}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="text-muted">From</span>
              {address && <AddressDisplay address={address} link={false} />}
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted">To</span>
              <AddressDisplay address={req.recipientAddress} link={false} />
            </div>
          </div>

          {insufficient && (
            <p className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="size-4" /> Insufficient mUSD balance
            </p>
          )}
          {noGas && !insufficient && (
            <p className="flex items-center gap-2 text-sm text-warning">
              <AlertCircle className="size-4" /> You need a little BTC to pay gas
              on Mezo
            </p>
          )}
          {error && (
            <p className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="size-4" /> {error}
            </p>
          )}

          <Button
            fullWidth
            size="lg"
            onClick={startPayment}
            loading={busy}
            disabled={insufficient || busy}
          >
            {busy ? phaseLabel[phase] : `Pay ${formatAmount(req.amount)} ${MUSD_SYMBOL}`}
          </Button>
        </div>
      )}
    </div>
  );
}
