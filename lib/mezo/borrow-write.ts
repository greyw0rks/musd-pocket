import { zeroAddress } from "viem";
import { activeBorrow } from "./config";

/**
 * Write-side of Mezo Borrow: the BorrowerOperations entrypoints Pocket needs to
 * let a user *open* a Trove and *repay* one, both from their own embedded wallet.
 *
 * Pairs with the read-only `borrow.ts`. This module carries no private key and
 * is import-safe anywhere — the signing happens in the browser through the
 * user's embedded wallet, because every Trove adjustment uses `msg.sender` as
 * the borrower: only the wallet that owns the Trove can touch it. Pocket cannot
 * borrow or repay on the user's behalf, and does not try to.
 *
 * Signatures verified against the *deployed* bytecode on both networks:
 * every selector below — including
 * `openTrove(uint256,address,address)` and
 * `repayMUSD(uint256,address,address)` — is present in the implementation
 * behind the BorrowerOperations proxy, and the four reads in `borrow.ts` answer
 * correctly against the TroveManager proxy. That is the check that matters for
 * a Liquity fork, because the fork has already diverged once: Mezo drops
 * Liquity's `_maxFeePercentage` argument.
 *
 *   - openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint) payable
 *   - repayMUSD(uint256 _amount, address _upperHint, address _lowerHint)
 *   - closeTrove()
 *   - minNetDebt() view returns (uint256)         // governance-mutable
 *   - getBorrowingFee(uint256 _debt) view returns (uint256)
 *
 * openTrove is PAYABLE: the BTC collateral is the native `msg.value`, NOT an
 * ERC-20 pulled via transferFrom and NOT a parameter. `_debtAmount` is the *net*
 * MUSD the borrower draws into their wallet; the contract adds the borrowing
 * fee and the 200-MUSD gas reserve on top to form the recorded (composite)
 * debt, and checks the resulting ICR against the MCR (or CCR in recovery mode).
 *
 * repay/close move tokens via `musd.burn(caller, …)` — NOT `transferFrom` — so no
 * ERC-20 approval is required, and the repay form must not ask for one. Repay
 * checks `balanceOf(borrower) >= _amount`; closeTrove checks the caller holds
 * `debt - MUSD_GAS_COMPENSATION` (the 200-MUSD reserve is burned from the gas
 * pool, not the user).
 */

export const BORROWER_OPERATIONS = activeBorrow.borrowerOperations;

export const BORROWER_OPERATIONS_ABI = [
  {
    type: "function",
    name: "openTrove",
    stateMutability: "payable",
    inputs: [
      { name: "_debtAmount", type: "uint256" },
      { name: "_upperHint", type: "address" },
      { name: "_lowerHint", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "repayMUSD",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_upperHint", type: "address" },
      { name: "_lowerHint", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "closeTrove",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "minNetDebt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getBorrowingFee",
    stateMutability: "view",
    inputs: [{ name: "_debt", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/**
 * The two protocol constants, re-exported from `borrow-math.ts` where they are
 * defined. They live there rather than here because this module imports
 * `viem/chains` through `./config`, and a bare `node` run cannot resolve that —
 * so a constant defined here could only ever be checked by eye, never by a test.
 * The names are kept available from this module because it is the write-side
 * one, and that is where a caller would look for them.
 */
/**
 * Hints tell SortedTroves where to re-insert the position after its collateral
 * ratio changes. Zero hints are always valid: the list then re-sorts by
 * traversing from its end — more gas, but correct. That trade is the right one
 * here; the alternative is a `HintHelpers` round trip whose failure mode is a
 * reverted open the user cannot act on. `activeBorrow.hintHelpers` and
 * `.sortedTroves` are the addresses a production path would use.
 */
export const ZERO_HINTS = [zeroAddress, zeroAddress] as const;

export { MUSD_GAS_COMPENSATION, CCR } from "./borrow-math";

/**
 * BTC kept back from collateral so the signer can still pay gas for the open
 * itself (collateral leaves the wallet as `msg.value`). Tiny — Mezo gas is
 * cheap — but enough that "Max collateral" never leaves the wallet unable to
 * broadcast. The gas-gift relayer tops up a wallet that has none at all.
 */
export const OPEN_GAS_RESERVE = 2n * 10n ** 13n; // 0.00002 BTC
