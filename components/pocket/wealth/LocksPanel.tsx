"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseUnits, type Address } from "viem";
import { ArrowRight, LockKeyhole, Clock3, CalendarDays } from "lucide-react";
import { useMezoLocks } from "@/hooks/use-mezo-locks";
import { useWealthAction } from "@/hooks/use-wealth-action";
import { useSession } from "@/lib/auth/session";
import { timeToUnlock } from "@/lib/mezo/locks";
import { ACTIVE_ENV, CHAIN_ID } from "@/lib/mezo/config";
import { formatTokenBalance } from "@/lib/mezo/wealth/format";
import { LOCK_CONTRACTS, type LockAsset } from "@/lib/mezo/wealth/contracts";
import {
  quoteLock,
  readLockAccount,
  type LockIntent,
} from "@/lib/mezo/wealth/lock-actions";
import { Button } from "@/components/pocket/ui/Button";
import {
  AmountField,
  FinanceSelect,
  FinanceTabs,
} from "@/components/pocket/ui/Finance";
import { ActionReview } from "./ActionReview";

const DURATIONS = [1, 2, 3, 4, 13, 26, 52, 104, 208];
function Duration({
  value,
  onChange,
  disabled,
  asset,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  asset: LockAsset;
}) {
  return (
    <FinanceSelect
      label="Time from today"
      aria-label="Lock duration"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {DURATIONS.filter(weeks => BigInt(weeks) * 604800n <= LOCK_CONTRACTS[asset].maxLockTime).map((weeks) => (
        <option key={weeks} value={weeks}>
          {weeks} {weeks === 1 ? "week" : "weeks"}
        </option>
      ))}
    </FinanceSelect>
  );
}
export function LocksPanel({ open }: { open: boolean }) {
  const { walletAddress } = useSession();
  if (ACTIVE_ENV !== "testnet")
    return (
      <p className="pk-m mt-5">
        In-app lock management is currently available on Mezo testnet.
      </p>
    );
  if (!walletAddress)
    return <p className="pk-m mt-5">Your Pocket wallet is getting ready.</p>;
  return (
    <WalletLocks
      key={walletAddress}
      owner={walletAddress as Address}
      open={open}
    />
  );
}
function WalletLocks({ open, owner }: { open: boolean; owner: Address }) {
  const [asset, setAsset] = useState<LockAsset>("btc");
  const config = LOCK_CONTRACTS[asset];
  const symbol = config.asset.symbol;
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [amount, setAmount] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"increase" | "extend">("increase");
  const [extra, setExtra] = useState("");
  const [extendWeeks, setExtendWeeks] = useState(4);
  const query = useMezoLocks(open, page, asset);
  const account = useQuery({
    queryKey: ["mezo-lock-account", CHAIN_ID, config.escrow, owner],
    queryFn: () => readLockAccount(owner, asset),
    enabled: open,
    refetchInterval: open ? 15000 : false,
  });
  const action = useWealthAction();
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [open]);
  const review = (intent: LockIntent) =>
    void action.review(() => quoteLock(owner, intent, asset));
  return (
    <section className="pk-locks" aria-label="Your locks">
      <FinanceTabs
        label="Lock asset"
        value={asset}
        disabled={action.busy}
        options={[{ value: "btc", label: "BTC" }, { value: "mezo", label: "Existing MEZO" }]}
        onChange={(value) => {
          setAsset(value);
          setPage(0);
          setSelected(null);
          setAmount("");
          setExtra("");
          setExtendWeeks(value === "btc" ? 4 : 13);
        }}
      />
      <div className="pk-finance-hero pk-finance-hero--soft pk-lock-wallet">
        <div className="pk-finance-hero-top">
          <span className="pk-eyebrow">{asset === "btc" ? "Available to lock" : "In your wallet"}</span>
          <LockKeyhole size={22} aria-hidden="true" />
        </div>
        <p className="pk-finance-value">
          {account.data ? formatTokenBalance(account.data.balance, 18) : "—"}{" "}
          <small>{symbol}</small>
        </p>
        <p className="pk-m">
          {account.isError
            ? `Could not read your ${symbol} balance`
            : account.data
              ? "In your Pocket wallet"
              : "Reading your wallet…"}
        </p>
      </div>
      {asset === "btc" ? <div className="pk-finance-workspace">
        <div className="pk-lock-form-heading">
          <h3>Create a lock</h3>
          <span className="pk-pill">veBTC</span>
        </div>
        <AmountField
          symbol="BTC"
          label="BTC amount"
          inputMode="decimal"
          value={amount}
          disabled={action.busy}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.0000"
          hint={
            account.data
              ? `${formatTokenBalance(account.data.balance, 18)} BTC available. Keep BTC for network fees.`
              : account.isError
                ? "Could not read your BTC balance"
                : "Reading balance…"
          }
        />
        <Duration value={weeks} onChange={setWeeks} disabled={action.busy} asset={asset} />
        <p className="pk-finance-note">
          Unlock dates round down to a weekly boundary. Review the exact date
          before signing.
        </p>
        <Button
          full
          className="pk-finance-submit"
          disabled={!amount || !account.data || action.busy}
          onClick={() => review({ kind: "create", amount, weeks })}
        >
          <span>Review new lock</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div> : <p className="pk-m mt-4">
        Manage your previous MEZO positions here. New lock deposits use BTC.
      </p>}
      <ActionReview action={action} />
      <div className="pk-lock-section-heading">
        <h3>Your positions</h3>
        {query.data ? (
          <span className="pk-pill">{query.data.totalCount}</span>
        ) : null}
      </div>
      {query.isPending ? (
        <p className="pk-m mt-4" role="status">
          Loading your locks…
        </p>
      ) : null}
      {query.isError ? (
        <div className="mt-4" role="alert">
          <p>Could not read your locks.</p>
          <Button
            variant="secondary"
            onClick={() => void query.refetch()}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      ) : null}
      {query.data?.locks.length === 0 ? (
        <p className="pk-m mt-4">No locks on this page.</p>
      ) : null}
      <ul className="pk-lock-list">
        {query.data?.locks.map((lock) => {
          const expired =
            !lock.permanent &&
            lock.unlockAt !== null &&
            new Date(lock.unlockAt).getTime() <= now;
          return (
            <li key={lock.tokenId} className="pk-lock-position">
              <div className="pk-lock-position-heading">
                <span className="pk-m">Position #{lock.tokenId}</span>
                <span
                  className={`pk-pill ${expired ? "pk-pill--ok" : lock.permanent ? "pk-pill--info" : ""}`}
                >
                  {expired
                    ? "Unlocked"
                    : lock.permanent
                      ? "Permanent"
                      : "Active"}
                </span>
              </div>
              <p className="pk-lock-amount">
                {formatTokenBalance(parseUnits(lock.amount, 18), 18)}{" "}
                <small>{symbol}</small>
              </p>
              <p className="pk-lock-countdown">
                <Clock3 size={15} aria-hidden="true" />
                {timeToUnlock(lock.unlockAt, now)}
              </p>
              {lock.unlockAt ? (
                <p className="pk-lock-date">
                  <CalendarDays size={14} aria-hidden="true" />
                  {new Date(lock.unlockAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : (
                <p className="pk-lock-date">
                  {asset === "btc" ? "Start an unlock to set a withdrawal date up to 30 days away." : "Start an unlock to begin the 208-week countdown."}
                </p>
              )}
              <div className="pk-lock-actions">
                {!expired && (asset === "btc" || !lock.permanent) ? (
                  <Button
                    className="pk-finance-secondary"
                    variant="secondary"
                    disabled={action.busy}
                    aria-expanded={selected === lock.tokenId}
                    onClick={() => {
                      setSelected(
                        selected === lock.tokenId ? null : lock.tokenId,
                      );
                      setMode(asset === "btc" ? "increase" : "extend");
                      setExtra("");
                    }}
                  >
                    Manage #{lock.tokenId}
                  </Button>
                ) : null}
                <Button
                  className={
                    expired ? "pk-finance-submit" : "pk-finance-secondary"
                  }
                  variant={expired ? "primary" : "secondary"}
                  disabled={!expired || action.busy}
                  onClick={() =>
                    review({ kind: "withdraw", tokenId: lock.tokenId })
                  }
                >
                  Withdraw
                </Button>
                {lock.permanent ? (
                  <Button
                    className="pk-finance-secondary pk-lock-start-unlock"
                    variant="secondary"
                    disabled={action.busy}
                    onClick={() =>
                      review({ kind: "start-unlock", tokenId: lock.tokenId })
                    }
                  >
                    Start unlock
                  </Button>
                ) : null}
              </div>
              {selected === lock.tokenId && !expired ? (
                <div className="pk-lock-management">
                  <FinanceTabs
                    label={`Manage position #${lock.tokenId}`}
                    value={mode}
                    disabled={action.busy}
                    options={
                      lock.permanent
                        ? asset === "btc" ? [{ value: "increase", label: "Add BTC" }] : []
                        : asset === "btc" ? [
                            { value: "increase", label: "Add BTC" },
                            { value: "extend", label: "Extend" },
                          ] : [{ value: "extend", label: "Extend" }]
                    }
                    onChange={setMode}
                  />
                  {mode === "increase" ? (
                    <AmountField
                      symbol="BTC"
                      label={`BTC to add to #${lock.tokenId}`}
                      inputMode="decimal"
                      value={extra}
                      disabled={action.busy}
                      onChange={(event) => setExtra(event.target.value)}
                      hint={
                        account.data
                          ? `${formatTokenBalance(account.data.balance, 18)} BTC available. Keep BTC for fees.`
                          : "Reading balance…"
                      }
                    />
                  ) : (
                    <Duration
                      value={extendWeeks}
                      onChange={setExtendWeeks}
                      disabled={action.busy}
                      asset={asset}
                    />
                  )}
                  <Button
                    full
                    className="pk-finance-submit"
                    disabled={action.busy || (mode === "increase" && !extra)}
                    onClick={() =>
                      review(
                        mode === "increase"
                          ? {
                              kind: "increase",
                              tokenId: lock.tokenId,
                              amount: extra,
                            }
                          : {
                              kind: "extend",
                              tokenId: lock.tokenId,
                              weeks: extendWeeks,
                            },
                      )
                    }
                  >
                    <span>
                      Review {mode === "increase" ? "added BTC" : "extension"}
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Button>
                  {!lock.permanent ? (
                    <Button
                      full
                      variant="secondary"
                      className="pk-finance-secondary mt-2"
                      disabled={action.busy}
                      onClick={() =>
                        review({ kind: "permanent", tokenId: lock.tokenId })
                      }
                    >
                      Review permanent lock
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {page > 0 || query.data?.hasNext ? (
        <div className="pk-lock-pagination">
          <Button
            className="pk-finance-secondary"
            variant="secondary"
            disabled={page === 0 || action.busy}
            onClick={() => {
              setPage(page - 1);
              setSelected(null);
            }}
          >
            Previous
          </Button>
          <Button
            className="pk-finance-secondary"
            variant="secondary"
            disabled={!query.data?.hasNext || action.busy}
            onClick={() => {
              setPage(page + 1);
              setSelected(null);
            }}
          >
            Next
          </Button>
        </div>
      ) : null}
    </section>
  );
}
