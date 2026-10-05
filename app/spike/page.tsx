"use client";

import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import {
  useAccount,
  useBalance,
  useSignMessage,
  useWriteContract,
} from "wagmi";
import { formatEther } from "viem";
import { useMusdBalance } from "@/hooks/use-musd";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import { MUSD_ABI, parseMusd } from "@/lib/mezo/musd";
import { hasPrivy } from "@/lib/wallet/privy";

type Step = { ok: boolean | null; note?: string };

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default function SpikePage() {
  // Privy hooks must run under PrivyProvider, which only mounts when configured.
  if (!hasPrivy()) {
    return (
      <main className="mx-auto max-w-xl p-8 font-mono text-sm">
        <h1 className="text-lg font-semibold">Pocket × Privy spike</h1>
        <p className="mt-4 leading-relaxed">
          Set <code>NEXT_PUBLIC_PRIVY_APP_ID</code> in <code>.env</code> and
          restart dev to run this spike. The relayer check (#5) also needs{" "}
          <code>RELAYER_PRIVATE_KEY</code> funded with testnet BTC.
        </p>
      </main>
    );
  }
  return <SpikeInner />;
}

function SpikeInner() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address, chainId } = useAccount();
  const musd = useMusdBalance();
  const btc = useBalance({ address });

  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();

  const [sign, setSign] = useState<Step>({ ok: null });
  const [send, setSend] = useState<Step>({ ok: null });
  const [sponsor, setSponsor] = useState<Step>({ ok: null });

  const embedded = wallets.find((w) => w.walletClientType === "privy");

  // Make the embedded wallet the active wagmi account so reads/writes target it.
  useEffect(() => {
    if (embedded) setActiveWallet(embedded).catch(() => {});
  }, [embedded, setActiveWallet]);

  async function onSign() {
    setSign({ ok: null, note: "signing…" });
    try {
      const sig = await signMessageAsync({
        message: "Pocket spike: prove embedded-wallet signing on Mezo",
      });
      setSign({ ok: true, note: `${sig.slice(0, 18)}…` });
    } catch (e) {
      setSign({ ok: false, note: errMsg(e) });
    }
  }

  async function onSend() {
    setSend({ ok: null, note: "sending 0.01 mUSD to self…" });
    try {
      if (!address) throw new Error("no active wallet");
      const hash = await writeContractAsync({
        address: MUSD_ADDRESS,
        abi: MUSD_ABI,
        functionName: "transfer",
        args: [address, parseMusd("0.01")],
      });
      setSend({ ok: true, note: hash });
    } catch (e) {
      setSend({ ok: false, note: errMsg(e) });
    }
  }

  async function onSponsor() {
    setSponsor({ ok: null, note: "asking relayer…" });
    try {
      if (!address) throw new Error("no active wallet");
      const res = await fetch("/api/relayer/sponsor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: address, amount: "0.01" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSponsor({ ok: true, note: data.txHash });
    } catch (e) {
      setSponsor({ ok: false, note: errMsg(e) });
    }
  }

  const onMezo = chainId === CHAIN_ID;
  const hasMusd = typeof musd.raw === "bigint" && musd.raw > 0n;

  const checks: { label: string; step: Step }[] = [
    {
      label: `1. Embedded EVM wallet on Mezo ${CHAIN_ID}`,
      step: {
        ok: embedded ? onMezo : null,
        note: embedded ? `${address} @ chain ${chainId}` : "log in to create",
      },
    },
    {
      label: "2. Wallet can receive mUSD",
      step: { ok: hasMusd ? true : null, note: `${musd.formatted ?? "0"} mUSD` },
    },
    {
      label: "3. Wallet can sign + send a tx on Mezo",
      step: send.ok !== null ? send : sign,
    },
    {
      label: "4. No Privy restriction on custom BTC-gas chain",
      step: {
        ok: embedded ? onMezo : null,
        note: `BTC gas: ${btc.data ? formatEther(btc.data.value) : "—"}`,
      },
    },
    {
      label: "5. Relayer submits a gas-sponsored mUSD delivery",
      step: sponsor,
    },
    {
      label: "6. X (twitter) authentication",
      step: { ok: user?.twitter ? true : null, note: user?.twitter?.username ?? "not linked" },
    },
    {
      label: "7. Telegram authentication",
      step: {
        ok: user?.telegram ? true : null,
        note: user?.telegram?.username ?? (user?.telegram ? "linked" : "not linked"),
      },
    },
  ];

  return (
    <main className="mx-auto max-w-xl space-y-6 p-8 font-mono text-sm">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pocket × Privy spike</h1>
        {ready &&
          (authenticated ? (
            <button onClick={logout} className="rounded border px-3 py-1">
              Log out
            </button>
          ) : (
            <button
              onClick={login}
              className="rounded bg-blue-600 px-3 py-1 text-white"
            >
              Log in
            </button>
          ))}
      </header>

      {!ready && <p>Loading Privy…</p>}

      {ready && authenticated && (
        <>
          <section className="space-y-1 rounded border p-4">
            <div>
              wallet: <span className="break-all">{address ?? "—"}</span>
            </div>
            <div>
              chain: {chainId ?? "—"} {onMezo ? "✓ Mezo" : "(switch to Mezo)"}
            </div>
            <div>mUSD: {musd.formatted ?? "0"}</div>
            <div>BTC (gas): {btc.data ? formatEther(btc.data.value) : "—"}</div>
          </section>

          <section className="flex flex-wrap gap-2">
            <button onClick={onSign} className="rounded border px-3 py-1">
              Sign message
            </button>
            <button onClick={onSend} className="rounded border px-3 py-1">
              Send 0.01 mUSD to self (needs BTC)
            </button>
            <button onClick={onSponsor} className="rounded border px-3 py-1">
              Relayer → me 0.01 mUSD (gasless)
            </button>
          </section>
        </>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Checklist</h2>
        <ul className="space-y-1">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-2">
              <span>
                {c.step.ok === true ? "✓" : c.step.ok === false ? "✗" : "•"}
              </span>
              <span className="flex-1">
                {c.label}
                {c.step.note ? (
                  <span className="block break-all text-xs opacity-70">
                    {c.step.note}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
