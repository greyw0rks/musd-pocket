"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { ACTIVE_ENV, CHAIN_ID } from "@/lib/mezo/config";
import { useSession } from "@/lib/auth/session";
import { useWealthAction } from "@/hooks/use-wealth-action";
import { POOLS, poolById, type PoolId } from "@/lib/mezo/wealth/contracts";
import { readPool } from "@/lib/mezo/wealth/pools";
import { quoteSwap } from "@/lib/mezo/wealth/swap";
import { SCREEN } from "@/components/pocket/theme";
import { PageHeading } from "@/components/pocket/ui/ScreenHeader";
import { TextField } from "@/components/pocket/ui/TextField";
import { Button } from "@/components/pocket/ui/Button";
import { ActionReview } from "./ActionReview";

export function SwapScreen() {
  const { walletAddress } = useSession();
  return (
    <div className={SCREEN}>
      <PageHeading title="Swap" />
      <p className="pk-m mt-1">
        Exchange tokens in your Pocket wallet · Mezo testnet
      </p>
      {ACTIVE_ENV !== "testnet" ? (
        <p className="pk-m mt-5">
          Swaps are currently available on Mezo testnet.
        </p>
      ) : walletAddress ? (
        <SwapWorkspace key={walletAddress} owner={walletAddress as Address} />
      ) : (
        <p className="pk-m mt-5">Your Pocket wallet is getting ready.</p>
      )}
    </div>
  );
}

function SwapWorkspace({ owner }: { owner: Address }) {
  const [id, setId] = useState<PoolId>("musd-btc");
  const [reverse, setReverse] = useState(false);
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippage] = useState(50);
  const action = useWealthAction();
  const pool = poolById(id);
  const query = useQuery({
    queryKey: ["mezo-pool", CHAIN_ID, owner, id],
    queryFn: () => readPool(owner, id),
    refetchInterval: 15000,
  });
  const input = reverse ? pool.token1 : pool.token0;
  const output = reverse ? pool.token0 : pool.token1;
  const balance = query.data
    ? reverse
      ? query.data.balance1
      : query.data.balance0
    : null;
  const empty = query.data?.totalSupply === 0n;
  return (
    <>
      <label className="pk-m mt-6 block">
        Trading pair
        <select
          aria-label="Trading pair"
          className="mt-1 w-full rounded-xl bg-[var(--s2)] p-3 text-[14px] text-[var(--t)]"
          disabled={action.busy}
          value={id}
          onChange={(event) => {
            setId(event.target.value as PoolId);
            setAmount("");
          }}
        >
          {POOLS.map((pair) => (
            <option key={pair.id} value={pair.id}>
              {pair.token0.symbol} / {pair.token1.symbol}
            </option>
          ))}
        </select>
      </label>
      <div className="pk-card mt-4">
        <TextField
          label={`You pay (${input.symbol})`}
          inputMode="decimal"
          value={amount}
          placeholder="0.00"
          disabled={action.busy}
          onChange={(event) => setAmount(event.target.value)}
          hint={
            balance !== null
              ? `${formatUnits(balance, input.decimals)} ${input.symbol} available`
              : "Reading balance…"
          }
        />
        <Button
          full
          variant="ghost"
          className="my-3"
          disabled={action.busy}
          onClick={() => {
            setReverse(!reverse);
            setAmount("");
          }}
        >
          Switch direction
        </Button>
        <p className="pk-m">You receive</p>
        <p className="mt-1 text-[22px] font-semibold">{output.symbol}</p>
        <p className="pk-m mt-2">
          Review the live rate and minimum received before signing.
        </p>
      </div>
      {query.isError ? (
        <div className="mt-3" role="alert">
          <p className="pk-m">Could not read this pair.</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {empty ? (
        <p className="pk-m mt-3" role="status">
          This pair has no liquidity yet. Choose another pair.
        </p>
      ) : query.data?.paused ? (
        <p className="pk-m mt-3" role="status">
          Swaps are paused.
        </p>
      ) : null}
      <label className="pk-m mt-4 block">
        Slippage tolerance
        <select
          aria-label="Slippage tolerance"
          className="mt-1 w-full rounded-xl bg-[var(--s2)] p-3 text-[14px] text-[var(--t)]"
          value={slippageBps}
          disabled={action.busy}
          onChange={(event) => setSlippage(Number(event.target.value))}
        >
          <option value={10}>0.1%</option>
          <option value={50}>0.5%</option>
          <option value={100}>1%</option>
        </select>
      </label>
      <p className="pk-m mt-3">
        Keep a little BTC for network fees. The swap returns tokens to this
        wallet.
      </p>
      <Button
        full
        className="mt-5"
        disabled={
          !amount ||
          action.busy ||
          !query.data ||
          query.isError ||
          empty ||
          query.data?.paused
        }
        onClick={() =>
          void action.review(() =>
            quoteSwap(owner, id, { amount, reverse, slippageBps }),
          )
        }
      >
        Review swap
      </Button>
      <ActionReview action={action} />
    </>
  );
}
