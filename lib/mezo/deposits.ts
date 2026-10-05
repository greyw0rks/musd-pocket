import "server-only";
import { parseAbiItem } from "viem";
import type { Address, Hash } from "viem";
import { getPublicClient } from "./musd";
import { MUSD_ADDRESS } from "./config";
import { getVaultAddress } from "./vault";

/**
 * Deposit indexing. A deposit is simply a MUSD ERC-20 Transfer whose recipient
 * is the PocketVault. We detect it the same trust-minimised way `verify.ts`
 * verifies a payment: read Transfer logs emitted BY the MUSD contract, filtered
 * to `to == vault`. Each deposit is keyed by its txHash (Deposit.txHash @unique),
 * so crediting is idempotent even if we re-scan an overlapping block range.
 */

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

/**
 * Where to start scanning when the caller doesn't pin a fromBlock. Anchoring at
 * the vault's deploy block (POCKET_VAULT_DEPLOY_BLOCK, server-only env) is what
 * keeps old deposits from being stranded — without it we can only look back a
 * fixed window and anything older is invisible. Falls back to a lookback window
 * if the env isn't set (and we log that fallback so the cap isn't silent).
 */
const DEPLOY_BLOCK = process.env.POCKET_VAULT_DEPLOY_BLOCK
  ? BigInt(process.env.POCKET_VAULT_DEPLOY_BLOCK)
  : null;

/** Fallback window when neither fromBlock nor a deploy-block anchor is given. */
const DEFAULT_LOOKBACK = 50_000n;

/**
 * Credit only sufficiently-buried blocks. The chain tip can reorg; a deposit
 * credited at the tip could be un-mined, leaving the ledger over-credited. A
 * small confirmation depth makes that vanishingly unlikely on Mezo testnet.
 */
const CONFIRMATIONS = 2n;

/** Max block span per getLogs call — many RPCs reject very wide ranges. */
const MAX_RANGE = 10_000n;

export type VaultDeposit = {
  from: Address;
  value: bigint;
  txHash: Hash;
  blockNumber: bigint;
};

/**
 * Find MUSD transfers into the vault. Optionally narrow to a single depositor
 * (the logged-in user) and/or a starting block (e.g. the vault deploy block or
 * a stored high-water mark). Scans up to `head - CONFIRMATIONS`, chunked across
 * MAX_RANGE-block windows so a wide range never trips an RPC limit.
 */
export async function findVaultDeposits(opts: {
  from?: string;
  fromBlock?: bigint;
} = {}): Promise<VaultDeposit[]> {
  const client = getPublicClient();
  const vault = getVaultAddress();

  const head = await client.getBlockNumber();
  const toBlock = head > CONFIRMATIONS ? head - CONFIRMATIONS : 0n;

  let fromBlock: bigint;
  if (opts.fromBlock !== undefined) {
    fromBlock = opts.fromBlock;
  } else if (DEPLOY_BLOCK !== null) {
    fromBlock = DEPLOY_BLOCK;
  } else {
    fromBlock = head > DEFAULT_LOOKBACK ? head - DEFAULT_LOOKBACK : 0n;
    console.warn(
      `[deposits] POCKET_VAULT_DEPLOY_BLOCK unset — scanning only the last ${DEFAULT_LOOKBACK} blocks; deposits older than that are not detected.`,
    );
  }

  if (fromBlock > toBlock) return [];

  const deposits: VaultDeposit[] = [];
  for (let start = fromBlock; start <= toBlock; start += MAX_RANGE) {
    const end = start + MAX_RANGE - 1n > toBlock ? toBlock : start + MAX_RANGE - 1n;
    const logs = await client.getLogs({
      address: MUSD_ADDRESS,
      event: TRANSFER_EVENT,
      args: {
        to: vault,
        ...(opts.from ? { from: opts.from as Address } : {}),
      },
      fromBlock: start,
      toBlock: end,
    });
    for (const l of logs) {
      if (l.args.value === undefined || !l.transactionHash || l.blockNumber === null) {
        continue;
      }
      deposits.push({
        from: l.args.from as Address,
        value: l.args.value as bigint,
        txHash: l.transactionHash as Hash,
        blockNumber: l.blockNumber as bigint,
      });
    }
  }

  return deposits;
}
