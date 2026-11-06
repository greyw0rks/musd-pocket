"use client";

import { RewardsIcon } from "@/components/pocket/icons";
import { Button } from "@/components/pocket/ui/Button";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { useWelcomeReward } from "@/hooks/use-welcome-reward";
import { EXPLORER_URL } from "@/lib/mezo/config";
import { WeeklyTasks } from "./WeeklyTasks";

/** One-time, Pocket-funded testnet welcome reward. */
export function RewardsSheet({
  open,
  onClose,
  onManageLocks,
}: {
  open: boolean;
  onClose: () => void;
  onManageLocks: () => void;
}) {
  const reward = useWelcomeReward(open);
  const { data } = reward;
  const claimed = data?.state === "claimed";
  const unlockDate = data?.unlockAt ? new Date(data.unlockAt) : null;
  const dateLabel = unlockDate?.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const ready = data?.state === "available" && !reward.pendingTxHash;

  return (
    <Sheet open={open} onClose={onClose} title="Rewards & locks">
      <div className="text-center" aria-live="polite">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--s2)]">
          <RewardsIcon size={26} />
        </span>

        <p className="pk-h2 mt-4">
          {claimed ? "Welcome reward received" : "Welcome to Pocket"}
        </p>
        <p className="pk-m mt-2 leading-relaxed">
          {claimed
            ? "Your wallet received a veMEZO position. Manage it in Pocket to add MEZO, extend the lock or withdraw after expiry."
            : "Claim 20 testnet MEZO, locked in a veMEZO position owned by your wallet. One welcome reward per account and wallet."}
        </p>
      </div>

      {data?.rewardAmount ? (
        <dl className="mt-5 space-y-3 rounded-2xl bg-[var(--s2)] p-4 text-[13px]">
          <div className="flex justify-between gap-4">
            <dt className="pk-m">Reward</dt>
            <dd className="font-semibold">
              {data.claim?.amount ?? data.rewardAmount} MEZO
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="pk-m">Lock</dt>
            <dd>2 weekly epochs</dd>
          </div>
          {dateLabel ? (
            <div className="flex justify-between gap-4">
              <dt className="pk-m">
                {claimed ? "Original unlock" : "Estimated unlock"}
              </dt>
              <dd className="text-right">{dateLabel}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {!claimed && data?.rewardAmount ? (
        <p className="pk-m mt-3 text-[12px] leading-relaxed">
          Mezo rounds locks down to the weekly boundary, so the wait is between
          7 and 14 days. The final unlock date is set when your claim confirms.
          Pocket covers the claim&apos;s gas.
        </p>
      ) : null}
      {reward.loading ? (
        <p className="pk-m mt-5 text-center" role="status">
          Checking your welcome reward…
        </p>
      ) : null}
      {data?.reason ? (
        <p className="pk-m mt-4 text-center" role="status">
          {data.reason}
        </p>
      ) : null}
      {data?.state === "wallet-claimed" ? (
        <p className="pk-m mt-4 text-center">
          This wallet has already received a welcome reward.
        </p>
      ) : null}
      {reward.error ? (
        <p
          className="mt-4 text-center text-[13px] text-[var(--rd)]"
          role="alert"
        >
          {reward.error}
        </p>
      ) : null}
      {reward.pendingTxHash ? (
        <p className="pk-m mt-4 text-center" role="status">
          Your claim is confirming.{" "}
          <a
            className="underline"
            href={`${EXPLORER_URL}/tx/${reward.pendingTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View transaction
          </a>
        </p>
      ) : null}
      {data?.claim && data.escrowAddress ? (
        <p className="pk-m mt-4 text-center">
          <a
            className="underline"
            href={`${EXPLORER_URL}/token/${data.escrowAddress}/instance/${data.claim.tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View veMEZO position #{data.claim.tokenId}
          </a>
        </p>
      ) : null}
      {claimed ? (
        <Button
          full
          className="mt-5"
          onClick={() => {
            onClose();
            onManageLocks();
          }}
        >
          Manage your lock
        </Button>
      ) : ready ? (
        <Button
          full
          size="lg"
          className="mt-5"
          loading={reward.claiming}
          onClick={() => void reward.claim()}
        >
          Claim 20 locked MEZO
        </Button>
      ) : !reward.loading && !reward.pendingTxHash ? (
        <Button
          full
          size="lg"
          variant="secondary"
          className="mt-5"
          onClick={reward.refresh}
        >
          Check again
        </Button>
      ) : null}

      {claimed || data?.state === "wallet-claimed" ? <WeeklyTasks /> : null}

      <Button full size="lg" variant="ghost" className="mt-2" onClick={onClose}>
        Close
      </Button>
    </Sheet>
  );
}
