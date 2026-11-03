"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { useMezoLocks } from "@/hooks/use-mezo-locks";
import { useWealthAction } from "@/hooks/use-wealth-action";
import { useSession } from "@/lib/auth/session";
import { timeToUnlock } from "@/lib/mezo/locks";
import { ACTIVE_ENV, CHAIN_ID } from "@/lib/mezo/config";
import {
  quoteLock,
  readLockAccount,
  type LockIntent,
} from "@/lib/mezo/wealth/lock-actions";
import { Button } from "@/components/pocket/ui/Button";
import { TextField } from "@/components/pocket/ui/TextField";
import { ActionReview } from "./ActionReview";

const DURATIONS = [1, 2, 4, 13, 26, 52, 104, 208];
function Duration({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="pk-m mt-3 block">
      Time from today
      <select
        aria-label="Lock duration"
        className="mt-1 w-full rounded-xl bg-[var(--s2)] p-3 text-[14px] text-[var(--t)]"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {DURATIONS.map((weeks) => (
          <option key={weeks} value={weeks}>
            {weeks} {weeks === 1 ? "week" : "weeks"}
          </option>
        ))}
      </select>
    </label>
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
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [amount, setAmount] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"increase" | "extend">("increase");
  const [extra, setExtra] = useState("");
  const [extendWeeks, setExtendWeeks] = useState(13);
  const query = useMezoLocks(open, page);
  const account = useQuery({
    queryKey: ["mezo-lock-account", CHAIN_ID, owner],
    queryFn: () => readLockAccount(owner),
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
    void action.review(() => quoteLock(owner, intent));
  return (
    <section className="mt-5" aria-label="Your MEZO locks">
      <div className="pk-card">
        <h3 className="text-[16px] font-semibold">Create a lock</h3>
        <p className="pk-m mt-1">
          Lock MEZO in a veMEZO position owned by your wallet.
        </p>
        <TextField
          className="mt-4"
          label="MEZO amount"
          inputMode="decimal"
          value={amount}
          disabled={action.busy}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          hint={
            account.data
              ? `${formatUnits(account.data.balance, 18)} MEZO available`
              : account.isError
                ? "Could not read your MEZO balance"
                : "Reading balance…"
          }
        />
        <Duration value={weeks} onChange={setWeeks} disabled={action.busy} />
        <p className="pk-m mt-2">
          Unlock dates round down to a weekly boundary. Review the exact date
          before signing.
        </p>
        <Button
          full
          className="mt-4"
          disabled={!amount || !account.data || action.busy}
          onClick={() => review({ kind: "create", amount, weeks })}
        >
          Review new lock
        </Button>
      </div>
      <ActionReview action={action} />
      <h3 className="mt-6 text-[16px] font-semibold">Your positions</h3>
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
      <ul className="mt-3 space-y-3">
        {query.data?.locks.map((lock) => {
          const expired =
            !lock.permanent &&
            lock.unlockAt !== null &&
            new Date(lock.unlockAt).getTime() <= now;
          return (
            <li key={lock.tokenId} className="pk-card">
              <div className="flex items-baseline justify-between gap-3">
                <b className="min-w-0 break-all text-[16px] tabular-nums">
                  {lock.amount} MEZO
                </b>
                <span className="pk-m">#{lock.tokenId}</span>
              </div>
              <p className="mt-2 text-[14px] font-semibold">
                {timeToUnlock(lock.unlockAt, now)}
              </p>
              {lock.unlockAt ? (
                <p className="pk-m mt-1">
                  {new Date(lock.unlockAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : (
                <p className="pk-m mt-1">
                  Start an unlock to begin the 208-week countdown.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {!expired ? (
                  <Button
                    style={{
                      width: "auto",
                      flex: "1 1 auto",
                      padding: "0 12px",
                    }}
                    variant="secondary"
                    disabled={action.busy}
                    onClick={() => {
                      setSelected(
                        selected === lock.tokenId ? null : lock.tokenId,
                      );
                      setMode("increase");
                    }}
                  >
                    Manage #{lock.tokenId}
                  </Button>
                ) : null}
                <Button
                  style={{ width: "auto", flex: "1 1 auto", padding: "0 12px" }}
                  variant="secondary"
                  disabled={!expired || action.busy}
                  onClick={() =>
                    review({ kind: "withdraw", tokenId: lock.tokenId })
                  }
                >
                  Withdraw
                </Button>
                {lock.permanent ? (
                  <Button
                    style={{
                      width: "auto",
                      flex: "1 1 auto",
                      padding: "0 12px",
                    }}
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
                <div className="mt-4 border-t border-[var(--s2)] pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      style={{
                        width: "auto",
                        flex: "1 1 auto",
                        padding: "0 12px",
                      }}
                      variant={mode === "increase" ? "primary" : "ghost"}
                      onClick={() => setMode("increase")}
                    >
                      Add MEZO
                    </Button>
                    {!lock.permanent ? (
                      <Button
                        style={{
                          width: "auto",
                          flex: "1 1 auto",
                          padding: "0 12px",
                        }}
                        variant={mode === "extend" ? "primary" : "ghost"}
                        onClick={() => setMode("extend")}
                      >
                        Extend
                      </Button>
                    ) : null}
                  </div>
                  {mode === "increase" ? (
                    <TextField
                      className="mt-3"
                      label={`MEZO to add to #${lock.tokenId}`}
                      inputMode="decimal"
                      value={extra}
                      disabled={action.busy}
                      onChange={(event) => setExtra(event.target.value)}
                    />
                  ) : (
                    <Duration
                      value={extendWeeks}
                      onChange={setExtendWeeks}
                      disabled={action.busy}
                    />
                  )}
                  <Button
                    full
                    className="mt-4"
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
                    Review {mode === "increase" ? "added MEZO" : "extension"}
                  </Button>
                  {!lock.permanent ? (
                    <Button
                      full
                      variant="ghost"
                      className="mt-2"
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
        <div className="mt-3 flex justify-between gap-3">
          <Button
            style={{ width: "auto" }}
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
            style={{ width: "auto" }}
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
