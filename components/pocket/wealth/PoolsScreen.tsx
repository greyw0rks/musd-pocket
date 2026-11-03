"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { ACTIVE_ENV, CHAIN_ID } from "@/lib/mezo/config";
import { useSession } from "@/lib/auth/session";
import { useWealthAction } from "@/hooks/use-wealth-action";
import { POOLS, poolById, type PoolId } from "@/lib/mezo/wealth/contracts";
import { quotePool, readPool, type PoolIntent } from "@/lib/mezo/wealth/pools";
import { exactAmount } from "@/lib/mezo/wealth/math";
import { SCREEN } from "@/components/pocket/theme";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { TextField } from "@/components/pocket/ui/TextField";
import { Button } from "@/components/pocket/ui/Button";
import { ActionReview } from "./ActionReview";

export function PoolsScreen({ onBack }: { onBack: () => void }) {
  const { walletAddress } = useSession();
  return (
    <div className={SCREEN}>
      <ScreenHeader title="Pools" subtitle="Mezo testnet" onBack={onBack} />
      {ACTIVE_ENV !== "testnet" ? (
        <p className="pk-m">
          In-app pool management is currently available on Mezo testnet.
        </p>
      ) : walletAddress ? (
        <PoolWorkspace key={walletAddress} owner={walletAddress as Address} />
      ) : (
        <p className="pk-m">Your Pocket wallet is getting ready.</p>
      )}
    </div>
  );
}

function PoolWorkspace({ owner }: { owner: Address }) {
  const [id, setId] = useState<PoolId>("musd-btc");
  return (
    <>
      <label className="pk-m block">
        Pool
        <select
          aria-label="Pool"
          className="mt-1 w-full rounded-xl bg-[var(--s2)] p-3 text-[14px] text-[var(--t)]"
          value={id}
          onChange={(event) => setId(event.target.value as PoolId)}
        >
          {POOLS.map((pool) => (
            <option key={pool.id} value={pool.id}>
              {pool.token0.symbol} / {pool.token1.symbol}
            </option>
          ))}
        </select>
      </label>
      <PoolPosition key={id} owner={owner} id={id} />
    </>
  );
}

function PoolPosition({ owner, id }: { owner: Address; id: PoolId }) {
  const pool = poolById(id);
  const query = useQuery({
    queryKey: ["mezo-pool", CHAIN_ID, owner, id],
    queryFn: () => readPool(owner, id),
    refetchInterval: 15000,
  });
  const action = useWealthAction();
  const [mode, setMode] = useState<"add" | "remove" | "fees">("add");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [liquidity, setLiquidity] = useState("");
  const [slippageBps, setSlippage] = useState(50);
  const data = query.data;
  const review = (intent: PoolIntent) =>
    void action.review(() => quotePool(owner, id, intent));
  function setFirst(value: string) {
    setAmount0(value);
    try {
      if (data && data.reserves[0] > 0n)
        setAmount1(
          formatUnits(
            (exactAmount(value, pool.token0.decimals) * data.reserves[1]) /
              data.reserves[0],
            pool.token1.decimals,
          ),
        );
    } catch {
      setAmount1("");
    }
  }
  return (
    <>
      {query.isPending ? (
        <p className="pk-m mt-4" role="status">
          Reading your pool position…
        </p>
      ) : null}
      {query.isError ? (
        <div className="mt-4" role="alert">
          <p className="text-[13px] text-[var(--r-ink)]">
            Could not read this pool. Balances and quotes are unavailable.
          </p>
          <Button
            className="mt-2"
            variant="secondary"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}
      {data ? (
        <div className="pk-card mt-4">
          <div className="flex justify-between gap-3">
            <b>Your liquidity</b>
            <span className="pk-m">
              {pool.stable ? "Stable" : "Volatile"} · {formatUnits(data.fee, 2)}
              % fee
            </span>
          </div>
          <p className="mt-2 break-all text-[14px]">
            {formatUnits(data.lpBalance, 18)} LP
          </p>
          <p className="pk-m mt-1 break-words">
            Approximately {formatUnits(data.position0, pool.token0.decimals)}{" "}
            {pool.token0.symbol} +{" "}
            {formatUnits(data.position1, pool.token1.decimals)}{" "}
            {pool.token1.symbol}
          </p>
        </div>
      ) : null}
      <div className="mt-5 flex gap-2" aria-label="Pool action">
        {(["add", "remove", "fees"] as const).map((tab) => (
          <Button
            key={tab}
            style={{ width: "auto", flex: "1 1 0", padding: "0 12px" }}
            variant={mode === tab ? "primary" : "secondary"}
            disabled={action.busy}
            onClick={() => setMode(tab)}
          >
            {tab === "add" ? "Add" : tab === "remove" ? "Remove" : "Fees"}
          </Button>
        ))}
      </div>
      {mode === "add" ? (
        <div className="mt-4">
          <TextField
            label={`${pool.token0.symbol} to deposit`}
            inputMode="decimal"
            value={amount0}
            onChange={(event) => setFirst(event.target.value)}
            disabled={action.busy}
            hint={
              data
                ? `${formatUnits(data.balance0, pool.token0.decimals)} available`
                : undefined
            }
          />
          <TextField
            className="mt-3"
            label={`${pool.token1.symbol} to deposit`}
            inputMode="decimal"
            value={amount1}
            onChange={(event) => setAmount1(event.target.value)}
            disabled={action.busy}
            hint={
              data
                ? `${formatUnits(data.balance1, pool.token1.decimals)} available`
                : undefined
            }
          />
          <p className="pk-m mt-2">
            {data?.totalSupply === 0n
              ? "This pool is empty. Enter both amounts; your first deposit sets its starting price."
              : "The second amount follows the pool ratio. You can edit it; unused tokens stay in your wallet."}{" "}
            Providing liquidity exposes you to both assets and changing prices.
          </p>
        </div>
      ) : mode === "remove" ? (
        <div className="mt-4">
          <TextField
            label="LP tokens to remove"
            inputMode="decimal"
            value={liquidity}
            onChange={(event) => setLiquidity(event.target.value)}
            disabled={action.busy}
          />
          <div className="mt-2 flex gap-2">
            {[25, 50, 100].map((percent) => (
              <Button
                key={percent}
                variant="ghost"
                disabled={!data || data.lpBalance === 0n || action.busy}
                onClick={() =>
                  setLiquidity(
                    formatUnits((data!.lpBalance * BigInt(percent)) / 100n, 18),
                  )
                }
              >
                {percent}%
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="pk-card mt-4">
          <h3 className="text-[14px] font-semibold">Your claimable fees</h3>
          <p className="pk-m mt-2 break-words">
            {data?.fees
              ? `${formatUnits(data.fees[0], pool.token0.decimals)} ${pool.token0.symbol} + ${formatUnits(data.fees[1], pool.token1.decimals)} ${pool.token1.symbol}`
              : "Fee balance unavailable"}
          </p>
        </div>
      )}
      {mode !== "fees" ? (
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
      ) : null}
      <Button
        full
        className="mt-5"
        disabled={
          action.busy ||
          !data ||
          query.isError ||
          (mode === "add" && (!amount0 || !amount1 || data.paused)) ||
          (mode === "remove" && (!liquidity || data.lpBalance === 0n)) ||
          (mode === "fees" &&
            (!data.fees || data.fees.every((amount) => amount === 0n)))
        }
        onClick={() =>
          review(
            mode === "add"
              ? { kind: "add", amount0, amount1, slippageBps }
              : mode === "remove"
                ? { kind: "remove", liquidity, slippageBps }
                : { kind: "fees" },
          )
        }
      >
        {mode === "add"
          ? "Review deposit"
          : mode === "remove"
            ? "Review withdrawal"
            : "Review fee claim"}
      </Button>
      <ActionReview action={action} />
    </>
  );
}
