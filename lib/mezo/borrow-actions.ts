import type { WalletClient } from "viem";
import { getPublicClient, MUSD_ABI } from "./musd";
import { MUSD_ADDRESS, CHAIN_ID, activeBorrow } from "./config";
import { TROVE_MANAGER_ABI, PRICE_FEED_ABI } from "./borrow";
import {
  BORROWER_OPERATIONS,
  BORROWER_OPERATIONS_ABI,
  ZERO_HINTS,
  OPEN_GAS_RESERVE,
} from "./borrow-write";
import {
  collateralRatio,
  maxRepayable,
  MUSD_GAS_COMPENSATION,
  CCR,
} from "./borrow-math";

/**
 * The three things a user can *do* to a Mezo Trove from Pocket: open one, repay
 * against one, close one. Reads are in `borrow.ts`; this is the write half.
 *
 * Every one is signed by the user's own embedded wallet. That is not a
 * convenience — it is the only thing that can work: the contracts use
 * `msg.sender` as the borrower, so the wallet that holds the Trove is the wallet
 * that must authorize every change to it. Pocket holds no key here, cannot
 * borrow on the user's behalf, and does not try to.
 *
 * ## What this module refuses to do
 *
 * `chain-payment.adapter.ts` learned this the expensive way and the lesson is
 * copied here whole: **the chain is asked before the wallet is.** Without it the
 * first thing to discover that an operation cannot happen is the Privy prompt,
 * and it discovers it inside a failed gas estimate — which surfaces to the user
 * as "gas limit must not be zero" and "Missing or invalid parameters" over a
 * wallet that simply had too little mUSD. Both read as the app having built a
 * malformed request. Asking first replaces them with a sentence about the actual
 * reason, in the app's own voice, and costs nothing: every check below is an
 * `eth_call`.
 *
 * ## The three numbers that decide everything
 *
 * Mezo Borrow is a Liquity v1 fork, so a Trove carries three debts, not one, and
 * confusing them is how a form ends up off by 200 MUSD:
 *
 *   - the **drawn** amount — what the borrower asked for;
 *   - the **net** debt — drawn plus the borrowing fee, which is what
 *     `minNetDebt` is checked against;
 *   - the **composite** debt — net plus the 200 MUSD gas reserve, which is what
 *     the collateral ratio is computed from and what `getTroveDebt` returns.
 *
 * Every rule encoded here was read off the deployed `BorrowerOperations` and
 * then confirmed present in that bytecode:
 *
 *   - open  → `_requireAtLeastMinNetDebt(net)`; ICR vs MCR (or CCR in recovery
 *             mode) and a separate new-TCR-vs-CCR check
 *   - repay → `netDebt - repayment >= minNetDebt`, so a repayment can never take
 *             the remaining net debt below the protocol minimum
 *   - close → `balanceOf(caller) >= debt - 200`, and — this is the one nobody
 *             expects — **impossible while the system is in recovery mode**.
 *             A call to `checkRecoveryMode(uint256)` is answered by the
 *             deployed TroveManager, which is what lets the refusal
 *             name recovery mode instead of shrugging.
 *
 * Client-safe: no private key, no `server-only`, no Pocket relayer. The
 * addresses and ABIs come from the config single-source.
 */

/**
 * What a write reports back.
 *
 * `hash` is present on a failure only when a transaction was actually
 * broadcast, and its presence changes what the sentence means: no hash is
 * "nothing was signed", a hash is "this is on-chain, here is how to look at
 * it". A caller that renders the two identically would be telling a user their
 * money did not move when it did.
 */
export type BorrowWriteResult =
  | { ok: true; hash: `0x${string}` }
  | { ok: false; error: string; hash?: `0x${string}` };

export type BorrowTerms = {
  /** USD per 1 BTC, 18-decimal. */
  price: bigint;
  /** Governance-mutable floor on the *net* debt. */
  minNetDebt: bigint;
  /** Whether the system is in recovery mode at this price. */
  recovery: boolean;
};

/**
 * How long to wait for the receipt before saying we could not read it.
 *
 * Same number and the same reasoning as the transfer path: Mezo mines in about
 * seven seconds, and waiting longer buys nothing because a wait that has not
 * answered in 30s is not going to.
 */
const RECEIPT_TIMEOUT_MS = 30_000;

/** 18-decimal wei to a short human figure, for use inside refusal sentences. */
function musd(v: bigint): string {
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n) / 10n ** 14n; // 4 decimal places
  const f = frac.toString().padStart(4, "0").replace(/0+$/, "");
  return f ? `${whole}.${f}` : whole.toString();
}

/** BTC (18-decimal wei native) to a short human figure. */
function btc(v: bigint): string {
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n) / 10n ** 13n; // 5 decimal places
  const f = frac.toString().padStart(5, "0").replace(/0+$/, "");
  return f ? `${whole}.${f}` : whole.toString();
}

/** A percentage, rounded *down* so no figure can flatter the position. */
function percent(ratio: bigint): string {
  return `${(ratio * 100n) / 10n ** 18n}%`;
}

/** A truncated address, for showing a counterparty that has no handle. */
function shorten(address: string): string {
  return address.length <= 12
    ? address
    : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Did the user turn the prompt down? Same wording-tolerance as the transfer
 * path, and for the same reason: the spelling differs per connector, and
 * getting it wrong in the other direction would tell someone who simply changed
 * their mind that their money had a problem.
 */
function isUserRejection(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? "";
  const message = e instanceof Error ? e.message : String(e);
  return (
    name === "UserRejectedRequestError" ||
    /reject|denied|declined|cancell?ed by user/i.test(message)
  );
}

export function createBorrowActions(deps: {
  /**
   * The wallet that signs. A getter, not a value: the actions are built once
   * for the lifetime of the mount and the embedded wallet can arrive after
   * that, so anything captured at build time would be permanently `null`.
   */
  getWalletClient: () => WalletClient | null;
}) {
  const { getWalletClient } = deps;

  let publicClient: ReturnType<typeof getPublicClient> | null = null;
  const rpc = () => (publicClient ??= getPublicClient());

  /**
   * The signing wallet, or the sentence explaining why there is none.
   *
   * The chain check is separate from the wallet check on purpose: sending a
   * Trove operation to the wrong chain would sign against a different
   * protocol's contract at the same address, which is the one mistake here that
   * cannot be walked back.
   */
  function signer(): { wallet: WalletClient } | { error: string } {
    const wallet = getWalletClient();
    if (!wallet?.account) {
      return { error: "Your wallet is not ready yet. Try again in a moment." };
    }
    if (wallet.chain && wallet.chain.id !== CHAIN_ID) {
      return { error: "Switch to Mezo to borrow." };
    }
    return { wallet };
  }

  /**
   * The terms that are read at the moment of use rather than assumed.
   *
   * `minNetDebt` and the borrowing fee are governance-mutable storage and the
   * price is whatever the oracle says right now, so all three are read per
   * operation. A hardcoded copy would keep pricing a loan the protocol no
   * longer offers — and the price is the one that moves every block.
   *
   * The price read is not optional and not degraded. `fetchPrice()` reverts when
   * the oracle is stale (>60s), and every path here *needs* a price: without one
   * the ratio cannot be computed and `openTrove` would revert on the same
   * staleness. So a missing price is a refusal with a reason, not a `null` to
   * carry around and paper over later.
   */
  async function terms(): Promise<BorrowTerms | { error: string }> {
    const price = await rpc()
      .readContract({
        address: activeBorrow.priceFeed,
        abi: PRICE_FEED_ABI,
        functionName: "fetchPrice",
        args: [],
      })
      .catch(() => null);

    if (price === null) {
      return {
        error:
          "The Mezo price feed is not answering, so the protocol cannot value Bitcoin right now. Nothing was signed — try again in a minute.",
      };
    }

    const [minNetDebt, recovery] = await Promise.all([
      rpc().readContract({
        address: BORROWER_OPERATIONS,
        abi: BORROWER_OPERATIONS_ABI,
        functionName: "minNetDebt",
        args: [],
      }),
      /*
        Read rather than inferred from the ratio: recovery mode is a property of
        the whole system (total collateral ratio below the CCR), not of this
        position, so a perfectly healthy Trove can still be unable to close.
      */
      rpc()
        .readContract({
          address: activeBorrow.troveManager,
          abi: TROVE_MANAGER_ABI,
          functionName: "checkRecoveryMode",
          args: [price],
        })
        .catch(() => false),
    ]);

    return { price, minNetDebt, recovery };
  }

  /**
   * Broadcast, then wait — and report the wait honestly.
   *
   * The three-way outcome is the whole point. A throw from `writeContract` is
   * "nothing was signed" (unless the user declined, which is its own sentence). A
   * throw from `waitForTransactionReceipt` is *not* a failure and not a success:
   * this RPC is on record in this repo's probes for answering
   * `TransactionReceiptNotFound` for a transaction buried hundreds of blocks
   * deep and then answering fine seconds later, so all a throw establishes is
   * that this client could not read the receipt. Reporting that as "failed"
   * would be a false claim about the user's Bitcoin.
   *
   * Only a receipt with `status: "reverted"` is a settled negative, because that
   * one is the chain speaking.
   */
  async function broadcast(
    wallet: WalletClient,
    send: () => Promise<`0x${string}`>,
    done: string,
  ): Promise<BorrowWriteResult> {
    let hash: `0x${string}`;
    try {
      hash = await send();
    } catch (e) {
      if (isUserRejection(e)) {
        return { ok: false, error: "You declined. Nothing was signed." };
      }
      console.error("[pocket] borrow write not broadcast", {
        error: e instanceof Error ? e.message : String(e),
      });
      return { ok: false, error: "Could not start that. Nothing has left your wallet." };
    }

    try {
      const receipt = await rpc().waitForTransactionReceipt({
        hash,
        timeout: RECEIPT_TIMEOUT_MS,
      });
      if (receipt.status === "reverted") {
        return {
          ok: false,
          hash,
          error: "The transaction was rejected on-chain. Nothing changed.",
        };
      }
      return { ok: true, hash };
    } catch (e) {
      console.error("[pocket] borrow receipt not read", {
        hash,
        error: e instanceof Error ? e.message : String(e),
      });
      /*
        Broadcast and unread. Said as exactly that, with the hash, because the
        one thing the user must not do is assume it failed and try again — a
        second open would be a second Trove.
      */
      return {
        ok: false,
        hash,
        error: `${done} was signed and broadcast, but this app could not read the receipt yet. Do not repeat it — ${hash} will confirm shortly, and the Borrow screen will show it.`,
      };
    }
  }

  /**
   * The `eth_call` that decides the wallet is never asked to sign something
   * that cannot work.
   *
   * A simulation is strictly stronger than the arithmetic above it: it catches
   * everything those checks cannot see (a paused protocol, a value the contract
   * computes differently, a rule this build has not read). Its failure is
   * therefore reported as what is certainly true — the operation could not be
   * checked against the chain — rather than as a guess at which rule fired. The
   * checks above exist so that the *common* refusals read better than that.
   *
   * The thunk is what keeps the request's type: `simulateContract`'s return
   * carries the prepared call, and the caller hands exactly that to
   * `writeContract`. Taking the call as an argument instead would erase it.
   */
  async function simulate<T>(
    run: () => Promise<{ request: T }>,
    what: string,
    from: string,
  ): Promise<{ request: T } | { error: string }> {
    try {
      return { request: (await run()).request };
    } catch (e) {
      console.error("[pocket] borrow simulation refused", {
        from,
        what,
        error: e instanceof Error ? e.message : String(e),
      });
      return {
        error: `The chain would not accept that ${what}, so nothing was signed. ${shorten(from)} holds what the Borrow screen shows; if the numbers look right, try again in a moment.`,
      };
    }
  }

  /**
   * The borrowing fee for a draw, 18-decimal. One read, used by both the open
   * path and the form's preview, so the number the user is shown before signing
   * and the number the contract charges come from the same call.
   *
   * `getBorrowingFee` takes the amount *drawn*, not the resulting debt, and the
   * rate behind it is governance-mutable storage — a preview computed from a
   * remembered 0.1% would drift from what the chain charges. `null` on a failed
   * read, so a caller withholds the figure rather than printing a zero the fee
   * is not.
   */
  async function readFee(drawWei: bigint): Promise<bigint | null> {
    if (drawWei <= 0n) return 0n;
    return rpc()
      .readContract({
        address: BORROWER_OPERATIONS,
        abi: BORROWER_OPERATIONS_ABI,
        functionName: "getBorrowingFee",
        args: [drawWei],
      })
      .catch(() => null);
  }

  return {
    /**
     * The live terms, for a form to read before it offers anything.
     *
     * Exposed because the write paths are not the only things that need them: a
     * repay form has to quote the ceiling it will accept, and a close form has
     * to know whether closing is possible *before* the user commits to it
     * rather than after they press the button. Everything here is read per call
     * — `minNetDebt` is governance-mutable and the price moves every block — so
     * a screen holding a copy would price a loan the protocol may no longer
     * offer.
     */
    terms,

    /** The borrowing fee for a draw, read live. See `readFee`. */
    fee: readFee,

    /**
     * Open a Trove: lock BTC as collateral and draw MUSD against it.
     *
     * `collateralWei` is the BTC that leaves the wallet as the call's `value` —
     * native, not an ERC-20 — which is why the balance check below is against
     * the wallet's native balance and why a gas reserve is held back. Signing a
     * call that spends the wallet's entire balance leaves nothing to pay the gas
     * for the call itself.
     */
    async open(input: {
      collateralWei: bigint;
      drawWei: bigint;
    }): Promise<BorrowWriteResult> {
      if (input.collateralWei <= 0n) {
        return { ok: false, error: "Enter how much BTC to lock as collateral." };
      }
      if (input.drawWei <= 0n) {
        return { ok: false, error: "Enter how much MUSD to borrow." };
      }

      const signed = signer();
      if ("error" in signed) return { ok: false, error: signed.error };

      const t = await terms();
      if ("error" in t) return { ok: false, error: t.error };

      const signerAddress = signed.wallet.account!.address as `0x${string}`;

      /*
        The fee is read for the amount being drawn, because that is the argument
        `getBorrowingFee` takes — confirmed against the deployed contract,
        which matched `x * borrowingRate / 1e18`
        at three different amounts and returned 0 for an argument of 0 (so there
        is no flat minimum fee hiding in it).
      */
      const fee = await readFee(input.drawWei);

      /*
        A failed read stops the open rather than being treated as a zero fee.
        The fee is part of the debt the ratio is computed from, so guessing it
        would be guessing whether the position is safe — and the guess that
        makes a position look better is the one that costs money.
      */
      if (fee === null) {
        return {
          ok: false,
          error:
            "The Mezo borrowing fee could not be read, so this app cannot tell what the loan would cost. Nothing was signed — try again in a moment.",
        };
      }

      /*
        Rule 1 — the floor is on net + fee, not on the amount asked for. Reading
        `BorrowerOperations` shows `vars.netDebt += vars.fee` happening *before*
        `_requireAtLeastMinNetDebt`, so a draw of exactly `minNetDebt` would
        revert. Quoting the number is right here and not in the dashboard's copy:
        this one was read from the chain a moment ago, so it is a fact about the
        operation being attempted rather than a constant pretending to be one.
      */
      const net = input.drawWei + fee;
      if (net < t.minNetDebt) {
        return {
          ok: false,
          error: `The protocol requires at least ${musd(t.minNetDebt)} MUSD of net debt, and borrowing ${musd(input.drawWei)} plus the ${musd(fee)} MUSD fee comes to ${musd(net)}. Borrow more.`,
        };
      }

      /*
        Rule 2 — the ratio. The composite debt is net + the 200 MUSD gas reserve,
        which is what the contract divides the collateral value by, and the
        floor used is the CCR (150%) rather than the MCR (110%). Requiring the
        stricter one is deliberate: it keeps the open valid even if the system
        slips into recovery mode between the simulation and the signature, and it
        leaves the position with real headroom instead of one tick above
        liquidation.

        The ratio comes from `borrow-math.collateralRatio` rather than being
        recomputed here — same single division the chain's `getCurrentICR` does,
        and one definition of "collateral ratio" for the whole app instead of a
        dashboard copy and a form copy that can drift apart.
      */
      const composite = net + MUSD_GAS_COMPENSATION;
      const icr = collateralRatio(input.collateralWei, composite, t.price);

      if (icr === null || icr < CCR) {
        return {
          ok: false,
          error: `That would open at a ${icr === null ? "0%" : percent(icr)} collateral ratio, below the ${percent(CCR)} this app requires. Add BTC or borrow less.`,
        };
      }

      /*
        Rule 3 — enough BTC to collateralize *and* to pay for it. Read from the
        signing account, because that is the wallet the balance leaves, and the
        address is in the message because the usual way to arrive here is a
        wallet the user did not mean to be in.
      */
      const held = await rpc().getBalance({ address: signerAddress });
      if (held < input.collateralWei + OPEN_GAS_RESERVE) {
        return {
          ok: false,
          error: `This wallet holds ${btc(held)} BTC — not enough to lock ${btc(input.collateralWei)} and still pay the network fee. (${shorten(signerAddress)})`,
        };
      }

      /*
        The simulation runs the real call with the real value, so it also prices
        the gas; the same request is then handed to the wallet, which is viem's
        simulate-then-write flow and avoids a second estimate. Zero hints are
        passed deliberately — see `ZERO_HINTS`, which explains the trade.
      */
      const sim = await simulate(
        () =>
          rpc().simulateContract({
            account: signerAddress,
            address: BORROWER_OPERATIONS,
            abi: BORROWER_OPERATIONS_ABI,
            functionName: "openTrove",
            args: [input.drawWei, ...ZERO_HINTS],
            value: input.collateralWei,
          }),
        "borrow",
        signerAddress,
      );
      if ("error" in sim) return { ok: false, error: sim.error };

      return broadcast(
        signed.wallet,
        () => signed.wallet.writeContract(sim.request),
        "Borrowing",
      );
    },

    /**
     * Repay MUSD against an open Trove.
     *
     * No ERC-20 approval, deliberately: the contract moves the tokens with
     * `musd.burn(caller, …)` rather than `transferFrom`, so an approval would be
     * a wasted transaction and a misleading prompt. Repaying does not close the
     * position — see `maxRepayable` for why it cannot.
     */
    async repay(amountWei: bigint): Promise<BorrowWriteResult> {
      if (amountWei <= 0n) {
        return { ok: false, error: "Enter an amount to repay." };
      }

      const signed = signer();
      if ("error" in signed) return { ok: false, error: signed.error };

      const signerAddress = signed.wallet.account!.address as `0x${string}`;

      const [t, debt] = await Promise.all([
        terms(),
        rpc().readContract({
          address: activeBorrow.troveManager,
          abi: TROVE_MANAGER_ABI,
          functionName: "getTroveDebt",
          args: [signerAddress],
        }),
      ]);
      if ("error" in t) return { ok: false, error: t.error };

      if (debt <= 0n) {
        return { ok: false, error: "There is no open position to repay." };
      }

      /*
        Rule — a repayment can never take the remaining *net* debt below the
        protocol minimum. From the source: `_requireAtLeastMinNetDebt(netDebt -
        repayment)`, where `netDebt = debt - 200`. So the ceiling is
        `debt - 200 - minNetDebt`, and the second guard (`repayment <= debt -
        200`) is automatically satisfied below it. Both numbers are read live,
        so the sentence quotes rules rather than remembered constants.
      */
      const netDebt = debt - MUSD_GAS_COMPENSATION;
      const maxRepay = netDebt - t.minNetDebt;

      if (maxRepay <= 0n) {
        return {
          ok: false,
          error: `This position is already down to the protocol's ${musd(t.minNetDebt)} MUSD minimum net debt. It can be closed, but not repaid any further.`,
        };
      }
      if (amountWei > maxRepay) {
        return {
          ok: false,
          error: `You can repay up to ${musd(maxRepay)} MUSD. The protocol keeps every position at ${musd(t.minNetDebt)} MUSD of net debt, so the rest has to come off by closing.`,
        };
      }

      /*
        The third requirement is the caller's own balance. Checked here so the
        refusal names the wallet rather than arriving as a revert inside the
        wallet prompt.
      */
      const heldMusd = await rpc().readContract({
        address: MUSD_ADDRESS,
        abi: MUSD_ABI,
        functionName: "balanceOf",
        args: [signerAddress],
      });
      if (heldMusd < amountWei) {
        return {
          ok: false,
          error: `This wallet holds ${musd(heldMusd)} mUSD — not enough to repay ${musd(amountWei)}. (${shorten(signerAddress)})`,
        };
      }

      const sim = await simulate(
        () =>
          rpc().simulateContract({
            account: signerAddress,
            address: BORROWER_OPERATIONS,
            abi: BORROWER_OPERATIONS_ABI,
            functionName: "repayMUSD",
            args: [amountWei, ...ZERO_HINTS],
          }),
        "repayment",
        signerAddress,
      );
      if ("error" in sim) return { ok: false, error: sim.error };

      return broadcast(
        signed.wallet,
        () => signed.wallet.writeContract(sim.request),
        "The repayment",
      );
    },

    /**
     * Close the Trove: clear the whole debt and take all the collateral back.
     *
     * This is the only way the debt actually reaches zero, and the only way the
     * BTC comes home — which is why the repay screen offers it as a separate
     * choice rather than as "repay everything".
     */
    async close(): Promise<BorrowWriteResult> {
      const signed = signer();
      if ("error" in signed) return { ok: false, error: signed.error };

      const signerAddress = signed.wallet.account!.address as `0x${string}`;

      const [t, debt] = await Promise.all([
        terms(),
        rpc().readContract({
          address: activeBorrow.troveManager,
          abi: TROVE_MANAGER_ABI,
          functionName: "getTroveDebt",
          args: [signerAddress],
        }),
      ]);
      if ("error" in t) return { ok: false, error: t.error };

      if (debt <= 0n) {
        return { ok: false, error: "There is no open position to close." };
      }

      /*
        Closing costs the debt *less* the gas reserve — the 200 MUSD is burned
        from the protocol's gas pool, not from the borrower. Quoting the exact
        figure matters: it is the difference between "I have enough" and "I
        borrowed 2,000 and the app wants 2,000 from me".
      */
      const required = debt - MUSD_GAS_COMPENSATION;

      const heldMusd = await rpc().readContract({
        address: MUSD_ADDRESS,
        abi: MUSD_ABI,
        functionName: "balanceOf",
        args: [signerAddress],
      });
      if (heldMusd < required) {
        return {
          ok: false,
          error: `Closing needs ${musd(required)} mUSD — the position's debt less the ${musd(MUSD_GAS_COMPENSATION)} mUSD gas reserve. This wallet holds ${musd(heldMusd)}. (${shorten(signerAddress)})`,
        };
      }

      /*
        The unusual one, and the reason the recovery-mode check is read first.

        Read off the deployed `closeTrove()`: when `canMint` — the ordinary case
        for a Trove that has not been redeemed against — the contract calls
        `_requireNotInRecoveryMode(price)` and reverts. So the system can be in
        recovery mode, the borrower's own position can be perfectly healthy, and
        a close is still impossible. That is temporary and out of the user's
        hands, which is exactly the kind of refusal that must name itself: the
        generic message would read like a bug and invite retrying forever.
      */
      if (t.recovery) {
        return {
          ok: false,
          error:
            "The protocol is in recovery mode right now, and closing is not allowed while it is. Repaying part of the debt still works, and closing will work again once the system recovers.",
        };
      }

      const sim = await simulate(
        () =>
          rpc().simulateContract({
            account: signerAddress,
            address: BORROWER_OPERATIONS,
            abi: BORROWER_OPERATIONS_ABI,
            functionName: "closeTrove",
            args: [],
          }),
        "close",
        signerAddress,
      );
      if ("error" in sim) return { ok: false, error: sim.error };

      return broadcast(
        signed.wallet,
        () => signed.wallet.writeContract(sim.request),
        "Closing",
      );
    },
  };
}
