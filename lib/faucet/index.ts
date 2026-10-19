import "server-only";

import { Prisma, type User } from "@prisma/client";
import { parseEther, type Address } from "viem";
import { HttpError } from "@/lib/auth/request";
import { prisma } from "@/lib/db";
import { ACTIVE_ENV, activeChain, MUSD_ADDRESS } from "@/lib/mezo/config";
import { getPublicClient, MUSD_ABI, normalizeAddress, parseMusd } from "@/lib/mezo/musd";
import { getRelayerWallet, hasRelayer } from "@/lib/relayer";
import type { FaucetStatusView } from "@/lib/faucet/types";

/**
 * The testnet faucet: one claim per account, enough to try the whole app.
 *
 * 0.015 BTC is the gas the account needs to do anything on Mezo (gas is paid
 * in Bitcoin, not mUSD). 300 mUSD is below the 1,800 mUSD minimum Trove debt,
 * so the claim alone cannot open a loan — but paired with the BTC it lets the
 * user deposit, save, send and repay, and it means a fresh account is never
 * holding a balance it cannot move.
 *
 * The transfers come from the existing relayer hot wallet. It already signs
 * every other testnet payout; a second key would be a second thing to fund and
 * a second thing to leak. The faucet is testnet-only, so the blast radius of
 * that key is testnet funds.
 */

export const FAUCET_BTC = "0.015";
export const FAUCET_MUSD = "300";

/**
 * BTC kept back when deciding whether the funding wallet can cover a claim.
 * The faucet pays gas on both transfers; without a reserve a wallet holding
 * exactly 0.015 BTC would send it all and then fail to move the mUSD.
 */
const GAS_RESERVE = parseEther("0.0005");

/**
 * How long one request may hold the claim lease. Long enough for two waits on
 * receipts (25s each, in parallel) with room to spare; short enough that a
 * process killed mid-claim does not lock the user out for the session.
 */
const LEASE_MS = 5 * 60_000;

/** Receipts are waited for in parallel, so this bounds the whole confirmation. */
const RECEIPT_TIMEOUT_MS = 25_000;

export function faucetEnabled(): boolean {
  return ACTIVE_ENV === "testnet";
}

export function faucetAmounts() {
  return { btc: FAUCET_BTC, musd: FAUCET_MUSD };
}

/**
 * The claim as the app shows it.
 *
 * "Claimed" means both legs have been broadcast, not that receipts have
 * arrived: a hash is irreversible, and re-offering the button while the first
 * claim is mining would invite a second payout. A claim with only one leg is
 * *not* claimed — that is the recoverable half-done state, and the sheet
 * offers to finish it.
 */
export async function faucetStatus(user: User): Promise<FaucetStatusView> {
  if (!faucetEnabled()) return disabledView();

  const claim = await prisma.faucetClaim.findUnique({
    where: { userId: user.id },
  });

  const broadcast = Boolean(claim?.btcTxHash && claim?.musdTxHash);

  return {
    enabled: true,
    claimed: Boolean(claim?.completedAt || broadcast),
    pending: Boolean(broadcast && !claim?.completedAt),
    funded: await fundingState(claim),
    claim: claim
      ? {
          btcTxHash: claim.btcTxHash,
          musdTxHash: claim.musdTxHash,
          completedAt: claim.completedAt?.toISOString() ?? null,
          error: claim.error,
        }
      : null,
    amounts: faucetAmounts(),
  };
}

/**
 * Send the missing legs, then confirm them.
 *
 * Idempotence is per leg and stored: a hash that exists is never sent again.
 * If the process dies after broadcasting the BTC transfer but before the mUSD
 * one, the next request sends only the mUSD. That is the reason the row is
 * created before the first send rather than after the last.
 */
export async function claimFaucet(user: User): Promise<FaucetStatusView> {
  if (!faucetEnabled()) {
    throw new HttpError("The faucet is only available on testnet.", 404);
  }
  if (!hasRelayer()) {
    throw new HttpError("The faucet is not configured.", 503);
  }

  const claim = await openClaim(user.id, user.walletAddress);

  if (claim.completedAt) return faucetStatus(user);

  const lease = await prisma.faucetClaim.updateMany({
    where: {
      id: claim.id,
      completedAt: null,
      // `lt` (not `lte`) is what makes an abandoned lease reclaimable.
      OR: [
        { claimingAt: null },
        { claimingAt: { lt: new Date(Date.now() - LEASE_MS) } },
      ],
    },
    data: { claimingAt: new Date(), error: null },
  });

  if (lease.count === 0) {
    throw new HttpError(
      "A faucet claim is already in progress. Give it a moment.",
      409,
    );
  }

  try {
    // Resolved inside the lease window, not before it: anything that throws
    // here must still release `claimingAt` in the `finally` below, or a broken
    // key or a malformed stored address would lock the user out until the
    // lease expires.
    const { account, client } = getRelayerWallet();
    const to = normalizeAddress(claim.walletAddress);

    // Re-read under the lease: the snapshot taken above may be older than a
    // request that has since paid one of the legs.
    let row = await prisma.faucetClaim.findUniqueOrThrow({
      where: { id: claim.id },
    });

    await assertFunded(row);

    if (!row.btcTxHash) {
      const hash = await client.sendTransaction({
        account,
        chain: activeChain,
        to,
        value: parseEther(FAUCET_BTC),
      });
      row = await prisma.faucetClaim.update({
        where: { id: row.id },
        data: { btcTxHash: hash },
      });
    }

    if (!row.musdTxHash) {
      const hash = await client.writeContract({
        address: MUSD_ADDRESS,
        abi: MUSD_ABI,
        functionName: "transfer",
        args: [to, parseMusd(FAUCET_MUSD)],
        account,
        chain: activeChain,
      });
      row = await prisma.faucetClaim.update({
        where: { id: row.id },
        data: { musdTxHash: hash },
      });
    }

    // Both hashes now exist: the money is committed even if confirmation is
    // slow. From here the user is claimed.
    const [btc, musd] = await Promise.all([
      receiptStatus(client, row.btcTxHash!),
      receiptStatus(client, row.musdTxHash!),
    ]);

    /*
      A reverted receipt is the one failure that safely clears a leg: the tx
      mined and did nothing, so the hash is not evidence of a payment. Clearing
      it lets the retry send that leg again. A timeout returns `null` and keeps
      the hash, because the tx may still mine — resending would pay twice.
    */
    if (btc === "reverted" || musd === "reverted") {
      await prisma.faucetClaim.update({
        where: { id: row.id },
        data: {
          ...(btc === "reverted" ? { btcTxHash: null } : {}),
          ...(musd === "reverted" ? { musdTxHash: null } : {}),
          error: "A faucet transfer reverted on-chain. Try again.",
        },
      });
      throw new HttpError(
        "The faucet transfer failed on-chain. Try again.",
        502,
      );
    }

    if (btc === "success" && musd === "success") {
      await prisma.faucetClaim.update({
        where: { id: row.id },
        data: { completedAt: new Date(), error: null },
      });
    }

    return faucetStatus(user);
  } catch (error) {
    const message =
      error instanceof HttpError
        ? error.message
        : "The faucet could not send right now. Try again.";
    await prisma.faucetClaim
      .update({ where: { id: claim.id }, data: { error: message } })
      .catch(() => {});
    throw error instanceof HttpError ? error : new HttpError(message, 502);
  } finally {
    // A completed row keeps `claimingAt` as an audit trail; an incomplete one
    // releases the lease so the user can retry immediately.
    await prisma.faucetClaim
      .updateMany({
        where: { id: claim.id, completedAt: null },
        data: { claimingAt: null },
      })
      .catch(() => {});
  }
}

/** Create-once; a lost create race resolves to the row the winner made. */
async function openClaim(userId: string, walletAddress: string) {
  const existing = await prisma.faucetClaim.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await prisma.faucetClaim.create({
      data: { userId, walletAddress: walletAddress.toLowerCase() },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.faucetClaim.findUnique({ where: { userId } });
      if (raced) return raced;
    }
    throw error;
  }
}

async function balances(): Promise<{ btc: bigint; musd: bigint }> {
  const { account } = getRelayerWallet();
  const client = getPublicClient();
  const [btc, musd] = await Promise.all([
    client.getBalance({ address: account.address }),
    client.readContract({
      address: MUSD_ADDRESS,
      abi: MUSD_ABI,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);
  return { btc, musd };
}

/**
 * Can the hot wallet cover the legs this claim still owes? Throws a 503 with a
 * message the sheet can show rather than a 500 the user cannot act on.
 */
async function assertFunded(claim: {
  btcTxHash: string | null;
  musdTxHash: string | null;
}) {
  const { btc, musd } = await balances();
  const needBtc =
    (claim.btcTxHash ? 0n : parseEther(FAUCET_BTC)) + GAS_RESERVE;
  const needMusd = claim.musdTxHash ? 0n : parseMusd(FAUCET_MUSD);

  if (btc < needBtc) {
    throw new HttpError(
      "The faucet is out of Bitcoin right now. Try again later.",
      503,
    );
  }
  if (musd < needMusd) {
    throw new HttpError(
      "The faucet is out of mUSD right now. Try again later.",
      503,
    );
  }
}

/** The status view's non-throwing version, so a chain hiccup does not blank it. */
async function fundingState(claim: {
  btcTxHash: string | null;
  musdTxHash: string | null;
} | null): Promise<boolean | null> {
  if (claim?.btcTxHash && claim.musdTxHash) return true;

  try {
    const { btc, musd } = await balances();
    const needBtc =
      (claim?.btcTxHash ? 0n : parseEther(FAUCET_BTC)) + GAS_RESERVE;
    const needMusd = claim?.musdTxHash ? 0n : parseMusd(FAUCET_MUSD);
    return btc >= needBtc && musd >= needMusd;
  } catch {
    // Unknown is not empty: let the claim attempt decide.
    return null;
  }
}

async function receiptStatus(
  client: ReturnType<typeof getRelayerWallet>["client"],
  hash: string,
): Promise<"success" | "reverted" | null> {
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      timeout: RECEIPT_TIMEOUT_MS,
      pollingInterval: 1_000,
    });
    return receipt.status;
  } catch {
    // Timed out or the RPC failed. The tx may still be mined.
    return null;
  }
}

function disabledView(): FaucetStatusView {
  return {
    enabled: false,
    claimed: false,
    pending: false,
    funded: null,
    claim: null,
    amounts: faucetAmounts(),
  };
}

/** Exported for the funding script; not used by the app. */
export async function faucetAddress(): Promise<Address | null> {
  if (!hasRelayer()) return null;
  return getRelayerWallet().account.address;
}
