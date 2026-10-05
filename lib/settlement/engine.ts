import "server-only";
import type { Hash } from "viem";
import { activeChain } from "@/lib/mezo/config";
import { parseMusd, normalizeAddress } from "@/lib/mezo/musd";
import { POCKET_VAULT_ABI, getVaultAddress, hasVault } from "@/lib/mezo/vault";
import { getRelayerWallet, hasRelayer } from "@/lib/relayer";

/**
 * Settlement engine — the authorized ENGINE_ROLE signer for PocketVault on Mezo
 * testnet. This is the server-only trust point named in the pitch: it can *move*
 * vault funds (payout / withdraw) but never custodies them. The real Mezo payout
 * leg of a Pocket send flows through here; Base/Eth payouts are simulated in the
 * ledger (Phase C). paymentId gives on-chain idempotency — a replayed id reverts.
 */

export function settlementEngineReady(): boolean {
  return hasVault() && hasRelayer();
}

type ReleaseResult = { hash: Hash; engine: `0x${string}` };

/**
 * The vault release was BROADCAST but we could not confirm its outcome (RPC/
 * receipt timeout). The funds MAY have moved — so the caller must NOT refund.
 * Instead it should keep the balance committed, persist `hash`, and leave the
 * row for reconciliation. Distinct from a plain throw, which means "no funds
 * moved" (pre-broadcast failure or a reverted receipt) and IS safe to refund.
 */
export class PayoutUnconfirmedError extends Error {
  readonly hash: Hash;
  constructor(fn: string, hash: Hash, options?: { cause?: unknown }) {
    super(`Vault ${fn} broadcast but not confirmed (tx ${hash})`);
    this.name = "PayoutUnconfirmedError";
    this.hash = hash;
    this.cause = options?.cause;
  }
}

async function release(
  fn: "payout" | "withdraw",
  to: string,
  amount: string,
  paymentId: `0x${string}`,
): Promise<ReleaseResult> {
  if (!hasVault()) throw new Error("PocketVault is not deployed (NEXT_PUBLIC_POCKET_VAULT_ADDRESS unset)");
  const { account, client } = getRelayerWallet();

  // writeContract resolves on BROADCAST, not inclusion. A throw here means the tx
  // never entered the mempool (nonce / gas estimation / RPC) → no funds moved →
  // the caller may safely refund.
  const hash = await client.writeContract({
    address: getVaultAddress(),
    abi: POCKET_VAULT_ABI,
    functionName: fn,
    args: [normalizeAddress(to), parseMusd(amount), paymentId],
    account,
    chain: activeChain,
  });

  // Confirm inclusion before reporting success. viem RESOLVES with a receipt even
  // for a reverted tx (status: "reverted"); it only THROWS on timeout / RPC error.
  //  - reverted receipt → the release failed and nothing moved → surface as a plain
  //    error so the caller refunds.
  //  - timeout → the tx may still mine → PayoutUnconfirmedError so the caller leaves
  //    funds committed and reconciles rather than double-spending.
  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
  } catch (err) {
    throw new PayoutUnconfirmedError(fn, hash, { cause: err });
  }
  if (receipt.status !== "success") {
    throw new Error(`Vault ${fn} reverted on-chain (tx ${hash})`);
  }

  return { hash, engine: account.address };
}

/** Release vault liquidity to a Pocket recipient. Real MUSD on Mezo testnet. */
export function vaultPayout(to: string, amount: string, paymentId: `0x${string}`) {
  return release("payout", to, amount, paymentId);
}

/** Cash a user out to an external address. Real MUSD on Mezo testnet. */
export function vaultWithdraw(to: string, amount: string, paymentId: `0x${string}`) {
  return release("withdraw", to, amount, paymentId);
}
