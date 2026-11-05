"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { ArrowDownUp, ArrowRight, Fuel } from "lucide-react";
import { ACTIVE_ENV, CHAIN_ID } from "@/lib/mezo/config";
import { useSession } from "@/lib/auth/session";
import { useWealthAction } from "@/hooks/use-wealth-action";
import { POOLS, poolById, type PoolId } from "@/lib/mezo/wealth/contracts";
import { readPool } from "@/lib/mezo/wealth/pools";
import { quoteSwap } from "@/lib/mezo/wealth/swap";
import { SCREEN } from "@/components/pocket/theme";
import { PageHeading } from "@/components/pocket/ui/ScreenHeader";
import {
  AmountField,
  FinanceSelect,
  SlippageControl,
  TokenBadge,
} from "@/components/pocket/ui/Finance";
import { Button } from "@/components/pocket/ui/Button";
import { ActionReview } from "./ActionReview";

export function SwapScreen() {
  const { walletAddress } = useSession();
  return (
    <div className={`${SCREEN} pk-finance`}>
      <PageHeading title="Swap" />
      <p className="pk-m mt-1">A new token. Same wallet.</p>
      <span className="pk-network">Mezo testnet</span>
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
      <div className="pk-finance-workspace">
        <FinanceSelect
          label="Trading pair"
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
        </FinanceSelect>
        <div className="pk-swap-stack">
          <AmountField
            symbol={input.symbol}
            label={`You pay (${input.symbol})`}
            inputMode="decimal"
            value={amount}
            placeholder="0.00"
            disabled={action.busy}
            onChange={(event) => setAmount(event.target.value)}
            onMax={
              balance !== null && balance > 0n
                ? () => setAmount(formatUnits(balance, input.decimals))
                : undefined
            }
            hint={
              balance !== null
                ? `${formatUnits(balance, input.decimals)} ${input.symbol} available`
                : "Reading balance…"
            }
          />
          <button
            type="button"
            className="pk-swap-direction"
            aria-label="Switch direction"
            title="Switch direction"
            disabled={action.busy}
            onClick={() => {
              setReverse(!reverse);
              setAmount("");
            }}
          >
            <ArrowDownUp size={19} aria-hidden="true" />
          </button>
          <div className="pk-amount-field pk-swap-receive">
            <p className="pk-amount-label">You receive</p>
            <div className="pk-amount-entry">
              <span className="pk-quote-placeholder">—</span>
              <TokenBadge symbol={output.symbol} />
            </div>
            <p className="pk-amount-hint">
              Live rate and minimum received shown at review.
            </p>
          </div>
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
        <SlippageControl
          value={slippageBps}
          disabled={action.busy}
          onChange={setSlippage}
        />
        <Button
          full
          className="pk-finance-submit"
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
          <span>Review swap</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
        <p className="pk-finance-footnote">
          <Fuel size={14} aria-hidden="true" />
          Keep a little BTC for network fees.
        </p>
      </div>
      <ActionReview action={action} />
    </>
  );
}
