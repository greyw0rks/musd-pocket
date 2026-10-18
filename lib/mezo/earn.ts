import type { Address } from "viem";
import { ACTIVE_ENV, activeMezo } from "./config";
import { getPublicClient } from "./musd";

/**
 * The Mezo MUSD Savings Vault (sMUSD) — the yield side of MUSD.
 *
 * Deposit MUSD and the vault issues sMUSD; withdraw and it burns them back.
 * This is the whole of the user's interface to it, and it is deliberately this
 * small because the vault's own surface is small: it is **not** ERC-4626.
 *
 * ## What the deployed contract actually is
 *
 * None of `asset()`, `totalAssets()`, `convertToShares`, `previewDeposit` or
 * `maxWithdraw` exist on it. The functions below were recovered from the
 * implementation bytecode — a Solidity dispatcher compiles each external
 * function to a `DUP1 PUSH4 <selector> EQ` run, i.e. the bytes
 * `80 63 <selector> 14`, so every selector it accepts is recoverable from the
 * runtime code as a text scan — and then **confirmed by calling them**, on both
 * networks. That order matters:
 * a selector can appear in a dispatcher and still revert, which is exactly what
 * `token()` and `vault()` do here.
 *
 * ## What a share is worth — the one thing not to guess
 *
 * This module does **not** value a position by deriving a share price from the
 * vault's balances, and that is a deliberate refusal rather than an omission.
 *
 * The vault lends its MUSD out through a separate `strategy()` contract, so the
 * vault's own MUSD balance is not the vault's assets. Deriving a price from
 * `MUSD.balanceOf(vault) / totalSupply()` reads **3.17 MUSD per share** on
 * testnet — a number that looks like a 217% return and is an artefact of most
 * of the money sitting somewhere else.
 *
 * What the vault does instead is mint 1:1 and pay interest separately. A real
 * deposit, decoded from its events:
 *
 *     depositor → vault : 177,316.381738273580677615 MUSD
 *     vault mints       : 177,316.381738273580677615 sMUSD
 *     vault → strategy  : 177,316.381738273580677615 MUSD
 *
 * Identical to the last digit, and the holder's `balanceOf` still reads exactly
 * that today. So **a holder's sMUSD balance is their MUSD principal, one for
 * one** — a fact established from an event rather than inferred from a ratio —
 * and interest arrives as a separate claimable amount (`claimableYield`), never
 * by the share moving. `yieldIndex()` exists but is an internal accumulator
 * (162.97 on testnet, 0.215 on mainnet — not a price on either) and is not
 * surfaced.
 *
 * Read-only and client- and server-safe: no key, no `server-only`. Writes live
 * in `earn-actions.ts` and are signed by the user's own wallet.
 */

/**
 * The vault per network, plus the strategy it allocates to.
 *
 * Both proxies were read on the network they belong to and answered
 * `symbol()` = `sMUSD`, `name()` = "MUSD Savings Rate", `decimals()` = 18, and
 * a `musdToken()` equal to that network's real MUSD. The strategies are the
 * addresses the vaults reported for themselves.
 *
 * They are EIP-1967 proxies (1,159 bytes) over a much larger implementation, so
 * the address here is the one to call and the implementation is not pinned —
 * an upgrade changes behaviour without changing this table, which is why every
 * figure the UI shows is read at the moment it is shown.
 */
export const EARN = {
  mainnet: {
    savingsVault: "0xb4D498029af77680cD1eF828b967f010d06C51CC" as Address,
    strategy: "0x0C0944713c185ea3e64F5609ECee3fB3C054a295" as Address,
  },
  testnet: {
    savingsVault: "0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16" as Address,
    strategy: "0x6abE6853f3006f304709084AC37f826Be50847E0" as Address,
  },
} as const;

export const activeEarn = EARN[ACTIVE_ENV];

/**
 * The vault's surface, exactly as deployed.
 *
 * Only the functions that were called and answered. `deposit` and `withdraw`
 * each take one `uint256` in MUSD — not shares, and not the ERC-4626
 * `deposit(uint256,address)` shape, which the contract does not have.
 *
 * `claimYield()` takes no arguments and is the only entry here that was *not*
 * exercised before being written down: it is `nonpayable`, so there is nothing
 * to call without a signer. It is included on two narrower facts, both checked
 * — the selector `0x406cf229` is in the implementation dispatcher (41 selectors
 * were extracted from the 11,928-byte runtime, and this is one of them), and it
 * is `keccak("claimYield()")` to the byte. So the call the app builds is the
 * call the contract dispatches. Whether the vault *accepts* it is left to the
 * simulation in `earn-actions.ts`, which is the same gate every other write in
 * this app passes and which refuses without signing if the chain says no.
 */
export const SAVINGS_VAULT_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "musdToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "strategy",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "pendingYield",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimableYield",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimYield",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

/**
 * A holder's position, all of it 18-decimal MUSD wei.
 *
 * `shares` and `principal` are the same number and the second is not redundant:
 * naming both is what stops a future edit from quietly treating shares as
 * something that needs converting. `claimableYield` is `null` when the call did
 * not answer — an unread figure, which the UI must withhold rather than print
 * as zero.
 */
export interface EarnPosition {
  /** sMUSD held, 18-decimal. Also the MUSD principal — see the note above. */
  shares: bigint;
  /** The same figure, named for what it means when it is spent. */
  principal: bigint;
  /** Interest the vault says this holder can claim. `null` if unreadable. */
  claimableYield: bigint | null;
  /** Total sMUSD outstanding, so a holder's slice of the vault is expressible. */
  totalShares: bigint;
  /** Whether the holder has anything in the vault at all. */
  hasPosition: boolean;
}

/**
 * Read a holder's Savings Vault position.
 *
 * `claimableYield` is read on its own and its failure is contained: a
 * signed-out or brand-new holder on a vault whose yield accounting is unhappy
 * should still see their principal, so a revert there degrades one field
 * instead of the whole screen.
 */
export async function getEarnPosition(owner: Address): Promise<EarnPosition> {
  const client = getPublicClient();
  const vault = activeEarn.savingsVault;

  const [shares, totalShares] = await Promise.all([
    client.readContract({
      address: vault,
      abi: SAVINGS_VAULT_ABI,
      functionName: "balanceOf",
      args: [owner],
    }),
    client.readContract({
      address: vault,
      abi: SAVINGS_VAULT_ABI,
      functionName: "totalSupply",
    }),
  ]);

  let claimableYield: bigint | null = null;
  try {
    claimableYield = await client.readContract({
      address: vault,
      abi: SAVINGS_VAULT_ABI,
      functionName: "claimableYield",
      args: [owner],
    });
  } catch {
    claimableYield = null;
  }

  return {
    shares,
    principal: shares,
    claimableYield,
    totalShares,
    hasPosition: shares > 0n,
  };
}

/**
 * Whether the vault is pointed at the MUSD this build transfers.
 *
 * A cheap guard with a real failure behind it: if a network's vault were
 * rebuilt against a different token, a deposit would move money into a vault
 * this app cannot reason about. The screen calls this before offering the
 * action, and a mismatch is reported rather than swallowed.
 */
export async function vaultAcceptsMusd(): Promise<boolean> {
  const client = getPublicClient();
  const token = await client.readContract({
    address: activeEarn.savingsVault,
    abi: SAVINGS_VAULT_ABI,
    functionName: "musdToken",
  });
  return token.toLowerCase() === activeMezo.musd.toLowerCase();
}
