"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { ArrowRight, Plus } from "lucide-react";
import { ACTIVE_ENV, CHAIN_ID } from "@/lib/mezo/config";
import { useSession } from "@/lib/auth/session";
import { useWealthAction } from "@/hooks/use-wealth-action";
import { POOLS, poolById, type PoolId } from "@/lib/mezo/wealth/contracts";
import { quotePool, readPool, type PoolIntent } from "@/lib/mezo/wealth/pools";
import { exactAmount } from "@/lib/mezo/wealth/math";
import { formatTokenBalance } from "@/lib/mezo/wealth/format";
import { SCREEN } from "@/components/pocket/theme";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import {
  AmountField,
  FinanceIntro,
  FinanceSelect,
  FinanceTabs,
  SlippageControl,
  TokenBadge,
} from "@/components/pocket/ui/Finance";
import { Button } from "@/components/pocket/ui/Button";
import { ActionReview } from "./ActionReview";

export function PoolsScreen({ onBack }: { onBack: () => void }) {
  const { walletAddress } = useSession();
  return (
    <div className={`${SCREEN} pk-finance pk-scr--plain`}>
      <ScreenHeader title="Pools" subtitle="Mezo testnet" onBack={onBack} />
      <FinanceIntro title="Put your tokens to work">
        Provide liquidity and collect your share of trading fees.
      </FinanceIntro>
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
      <FinanceSelect
        label="Pool"
        value={id}
        onChange={(event) => setId(event.target.value as PoolId)}
      >
        {POOLS.map((pool) => (
          <option key={pool.id} value={pool.id}>
            {pool.token0.symbol} / {pool.token1.symbol}
          </option>
        ))}
      </FinanceSelect>
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
        <div className="pk-finance-hero pk-finance-hero--soft">
          <div className="pk-finance-hero-top">
            <span className="pk-eyebrow">Your liquidity</span>
            <span className="pk-pill">
              {pool.stable ? "Stable" : "Volatile"} · {formatUnits(data.fee, 2)}
              % fee
            </span>
          </div>
          <p className="pk-finance-value">
            {formatTokenBalance(data.lpBalance, 18)} <small>LP</small>
          </p>
          <div className="pk-position-assets">
            <div>
              <TokenBadge symbol={pool.token0.symbol} />
              <b>{formatTokenBalance(data.position0, pool.token0.decimals)}</b>
            </div>
            <div>
              <TokenBadge symbol={pool.token1.symbol} />
              <b>{formatTokenBalance(data.position1, pool.token1.decimals)}</b>
            </div>
          </div>
        </div>
      ) : null}
      <div className="pk-finance-workspace">
        <FinanceTabs
          label="Pool action"
          options={[
            { value: "add", label: "Add" },
            { value: "remove", label: "Remove" },
            { value: "fees", label: "Fees" },
          ]}
          value={mode}
          onChange={setMode}
          disabled={action.busy}
        />
        {mode === "add" ? (
          <div className="pk-pool-inputs">
            <AmountField
              symbol={pool.token0.symbol}
              label={`${pool.token0.symbol} to deposit`}
              inputMode="decimal"
              value={amount0}
              onChange={(event) => setFirst(event.target.value)}
              disabled={action.busy}
              hint={
                data
                  ? `${formatTokenBalance(data.balance0, pool.token0.decimals)} available`
                  : undefined
              }
            />
            <span className="pk-pool-plus" aria-hidden="true">
              <Plus size={16} />
            </span>
            <AmountField
              symbol={pool.token1.symbol}
              label={`${pool.token1.symbol} to deposit`}
              inputMode="decimal"
              value={amount1}
              onChange={(event) => setAmount1(event.target.value)}
              disabled={action.busy}
              hint={
                data
                  ? `${formatTokenBalance(data.balance1, pool.token1.decimals)} available`
                  : undefined
              }
            />
            <p className="pk-finance-note">
              {data?.totalSupply === 0n
                ? "This pool is empty. Enter both amounts; your first deposit sets its starting price."
                : "The second amount follows the pool ratio. You can edit it; unused tokens stay in your wallet."}{" "}
              Providing liquidity exposes you to both assets and changing
              prices.
            </p>
          </div>
        ) : mode === "remove" ? (
          <div>
            <AmountField
              symbol="LP"
              label="LP tokens to remove"
              inputMode="decimal"
              value={liquidity}
              onChange={(event) => setLiquidity(event.target.value)}
              disabled={action.busy}
            />
            <div className="pk-percent-row">
              {[25, 50, 100].map((percent) => (
                <button
                  type="button"
                  key={percent}
                  disabled={!data || data.lpBalance === 0n || action.busy}
                  onClick={() =>
                    setLiquidity(
                      formatUnits(
                        (data!.lpBalance * BigInt(percent)) / 100n,
                        18,
                      ),
                    )
                  }
                >
                  {percent}%
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pk-fee-card">
            <h3 className="text-[14px] font-semibold">Your claimable fees</h3>
            <p className="pk-m mt-2 break-words">
              {data?.fees
                ? `${formatTokenBalance(data.fees[0], pool.token0.decimals)} ${pool.token0.symbol} + ${formatTokenBalance(data.fees[1], pool.token1.decimals)} ${pool.token1.symbol}`
                : "Fee balance unavailable"}
            </p>
          </div>
        )}
        {mode !== "fees" ? (
          <SlippageControl
            value={slippageBps}
            disabled={action.busy}
            onChange={setSlippage}
          />
        ) : null}
        <Button
          full
          className="pk-finance-submit"
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
          <span>
            {mode === "add"
              ? "Review deposit"
              : mode === "remove"
                ? "Review withdrawal"
                : "Review fee claim"}
          </span>
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div>
      <ActionReview action={action} />
    </>
  );
}
