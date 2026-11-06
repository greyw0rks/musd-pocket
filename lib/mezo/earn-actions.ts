import { pendingClaim, rememberClaim } from "./claim-journal";
import { decodeEventLog, type WalletClient, type TransactionReceipt } from "viem";
import { assertCurrentSigner } from "@/lib/wallet/session-wallet";
import { getPublicClient, MUSD_ABI } from "./musd";
import { MUSD_ADDRESS, CHAIN_ID } from "./config";
import { SAVINGS_VAULT_ABI, activeEarn, readClaimableYield } from "./earn";

/**
 * Depositing into and withdrawing from the Mezo MUSD Savings Vault.
 *
 * Signed by the user's own embedded wallet, like every other write in this app.
 * The vault credits the caller, so the wallet that deposits is the wallet the
 * shares belong to — Pocket holds no key here and cannot deposit on anyone's
 * behalf.
 *
 * ## The shape this module copies, and why
 *
 * `borrow-actions.ts` carries the lesson and it is re-stated rather than
 * imported: **the chain is asked before the wallet is.** Every refusal below is
 * an `eth_call` or an arithmetic check that runs first, because the alternative
 * is discovering the problem inside a Privy gas estimate, which surfaces to the
 * user as "gas limit must not be zero" over the actual reason — a wallet that
 * did not hold enough MUSD. Asking first costs nothing and replaces that with a
 * sentence in the app's own voice.
 *
 * The small helpers (`broadcast`, `simulate`, `isUserRejection`, the number
 * formatters) are therefore duplicated from `borrow-actions.ts` rather than
 * lifted into a shared module. That is the idiom this codebase already chose
 * for the same reason it did before: the versions differ in the nouns they say
 * out loud, and a shared helper would have to be told which feature it is
 * speaking for. If a third caller appears, that is the moment to extract them.
 *
 * ## Two transactions, not one
 *
 * A first deposit is `approve` then `deposit` — the vault pulls MUSD with
 * `transferFrom`, so it needs an allowance. That is deliberate and not a wasted
 * step to hide: the wallet prompt the user sees is the approval, and the amount
 * it approves is exactly the deposit, never an unlimited allowance. The second
 * deposit from the same wallet asks for nothing, because the allowance is still
 * there, and `deposit()` checks before it approves so the user is not prompted
 * for something that is already true.
 *
 * A withdrawal is one transaction and needs no approval: the vault burns the
 * caller's own shares and pays MUSD back to the caller. So is a claim, which
 * pays out the interest the shares have earned.
 */

/**
 * The two MUSD functions the vault needs, which `musd.ts` deliberately omits.
 *
 * `MUSD_ABI` is a minimal surface — read a balance, move a balance — and it is
 * used by the payment verifier, so it stays that way. This adds only what an
 * allowance needs. The approval is bounded to the exact deposit amount rather
 * than a max-uint allowance, because an unlimited approval to a contract is a
 * standing permission the user never asked for and cannot see.
 */
export const MUSD_ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type EarnWriteResult =
  | { ok: true; hash: `0x${string}`; claimedWei?: bigint }
  | { ok: false; error: string; hash?: `0x${string}` };

const claimsInFlight = new Map<string, Promise<EarnWriteResult>>();

/** Mezo mines in about seven seconds; a wait that has not answered in 30s will not. */
const RECEIPT_TIMEOUT_MS = 30_000;

/** 18-decimal wei to a short human figure, for use inside refusal sentences. */
function musd(v: bigint): string {
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n) / 10n ** 14n;
  const f = frac.toString().padStart(4, "0").replace(/0+$/, "");
  return f ? `${whole}.${f}` : whole.toString();
}

/**
 * Did the user turn the prompt down? The spelling differs per connector, and
 * getting it wrong in the other direction would tell someone who changed their
 * mind that their money had a problem.
 */
function isUserRejection(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? "";
  const message = e instanceof Error ? e.message : String(e);
  return (
    name === "UserRejectedRequestError" ||
    /reject|denied|declined|cancell?ed by user/i.test(message)
  );
}

export function createEarnActions(deps: {
  /**
   * The wallet that signs — a getter, not a value, because these actions are
   * built once for the lifetime of the mount and the embedded wallet can arrive
   * after that.
   */
  getWalletClient: () => WalletClient | null;
}) {
  const { getWalletClient } = deps;

  let publicClient: ReturnType<typeof getPublicClient> | null = null;
  const rpc = () => (publicClient ??= getPublicClient());

  /**
   * The signing wallet, or the sentence explaining why there is none.
   *
   * The chain check is separate from the wallet check because depositing to the
   * wrong chain's vault is the one mistake here that cannot be walked back.
   */
  async function signer(): Promise<{ wallet: WalletClient } | { error: string }> {
    const wallet = getWalletClient();
    if (!wallet?.account) {
      return { error: "Your wallet is not ready yet. Try again in a moment." };
    }
    if (wallet.chain && wallet.chain.id !== CHAIN_ID) {
      return { error: "Switch to Mezo to save." };
    }
    try { await assertCurrentSigner(wallet, getWalletClient, rpc()); }
    catch (e) { return { error: e instanceof Error ? e.message : "Could not verify your Pocket wallet. Try again." }; }
    return { wallet };
  }

  /**
   * Hand a prepared call to the wallet and read what happened to it.
   *
   * The three-way outcome is the point, and it is the same three ways as
   * everywhere else in this app: a throw from `writeContract` means nothing was
   * broadcast (and a rejection is reported as a decline, not as a fault); a
   * reverted receipt is the chain speaking and is a settled negative; a throw
   * from `waitForTransactionReceipt` is neither, and must not be reported as
   * either.
   */
  async function broadcast(
    wallet: WalletClient,
    send: () => Promise<`0x${string}`>,
    done: string,
    trackClaim = false,
  ): Promise<EarnWriteResult> {
    let hash: `0x${string}`;
    try { await assertCurrentSigner(wallet, getWalletClient, rpc()); }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Could not verify your Pocket wallet. Nothing was signed." }; }
    try {
      hash = await send();
    } catch (e) {
      if (isUserRejection(e)) {
        return { ok: false, error: "You declined. Nothing was signed." };
      }
      console.error("[pocket] earn write not broadcast", {
        error: e instanceof Error ? e.message : String(e),
      });
      return {
        ok: false,
        error: "Could not start that. Nothing has left your wallet.",
      };
    }

    if (trackClaim) rememberClaim(wallet.account!.address, hash);
    try {
      const receipt = await rpc().waitForTransactionReceipt({
        hash,
        timeout: RECEIPT_TIMEOUT_MS,
      });
      if (trackClaim) return await verifyClaim(wallet, hash, receipt);
      if (receipt.status === "reverted") {
        return {
          ok: false,
          hash,
          error: "The transaction was rejected on-chain. Nothing changed.",
        };
      }
      return { ok: true, hash };
    } catch (e) {
      console.error("[pocket] earn receipt not read", {
        hash,
        error: e instanceof Error ? e.message : String(e),
      });
      /*
        Broadcast and unread. Said as exactly that, with the hash, because the
        one thing the user must not do is assume it failed and deposit twice.
      */
      return {
        ok: false,
        hash,
        error: `${done} was signed and broadcast, but this app could not read the receipt yet. Do not repeat it — ${hash} can be checked on the explorer.`,
      };
    }
  }

  async function verifyClaim(wallet: WalletClient, hash: `0x${string}`, receipt: TransactionReceipt): Promise<EarnWriteResult> {
    const owner = wallet.account!.address;
    const tx = await rpc().getTransaction({ hash });
    if (tx.from.toLowerCase() !== owner.toLowerCase() ||
        tx.to?.toLowerCase() !== activeEarn.savingsVault.toLowerCase() ||
        tx.input !== "0x406cf229" || tx.value !== 0n ||
        receipt.transactionHash !== hash ||
        receipt.from.toLowerCase() !== owner.toLowerCase() ||
        receipt.to?.toLowerCase() !== activeEarn.savingsVault.toLowerCase()) {
      return { ok: false, hash, error: "The saved claim could not be verified. Check its transaction before trying again." };
    }
    if (receipt.status === "reverted") {
      rememberClaim(owner, null);
      return { ok: false, hash, error: "The claim reverted. You can try again." };
    }
    let claimedWei = 0n;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== MUSD_ADDRESS.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: MUSD_ABI, data: log.data, topics: log.topics, strict: true });
        if (decoded.eventName === "Transfer" && decoded.args.from.toLowerCase() === activeEarn.savingsVault.toLowerCase() && decoded.args.to.toLowerCase() === owner.toLowerCase())
          claimedWei += decoded.args.value;
      } catch { /* Other mUSD events are unrelated to the payout. */ }
    }
    if (claimedWei <= 0n) {
      return { ok: false, hash, error: "The claim confirmed, but its mUSD payout could not be verified. Check the transaction before claiming again." };
    }
    rememberClaim(owner, null);
    return { ok: true, hash, claimedWei };
  }

  /**
   * The `eth_call` that keeps the wallet from being asked to sign something
   * that cannot work. Reported as what is certainly true — that the operation
   * could not be checked — rather than as a guess at which rule fired.
   */
  async function simulate<T>(
    run: () => Promise<{ request: T; result?: unknown }>,
    what: string,
    from: string,
  ): Promise<{ request: T; result?: unknown } | { error: string }> {
    try {
      return await run();
    } catch (e) {
      console.error("[pocket] earn simulation refused", {
        from,
        what,
        error: e instanceof Error ? e.message : String(e),
      });
      return {
        error: `The vault would not accept that ${what}, so nothing was signed. Check the amount against what the screen shows and try again in a moment.`,
      };
    }
  }

  async function recoverClaim(
    wallet: WalletClient,
    hash: `0x${string}`,
  ): Promise<EarnWriteResult> {
    try {
      const tx = await rpc().getTransaction({ hash });
      if (
        tx.from.toLowerCase() !== wallet.account!.address.toLowerCase() ||
        tx.to?.toLowerCase() !== activeEarn.savingsVault.toLowerCase() ||
        tx.input !== "0x406cf229" ||
        tx.value !== 0n
      ) {
        return {
          ok: false,
          hash,
          error:
            "The saved claim could not be verified. Check its transaction before trying again.",
        };
      }
      const receipt = await rpc().getTransactionReceipt({ hash });
      return await verifyClaim(wallet, hash, receipt);
    } catch {
      return {
        ok: false,
        hash,
        error:
          "Your claim is still awaiting confirmation. Check again shortly.",
      };
    }
  }

  async function performClaim(): Promise<EarnWriteResult> {
    const signed = await signer();
    if ("error" in signed) return { ok: false, error: signed.error };
    const from = signed.wallet.account!.address;
    const vault = activeEarn.savingsVault;
    const existing = pendingClaim(from);
    if (existing) return recoverClaim(signed.wallet, existing);

    /*
        Asked first, because it turns the common case — pressing Claim with
        nothing accrued — into a sentence in the app's voice rather than a
        reverted transaction the user paid BTC gas for.
      */
    const claimable = await readClaimableYield(from).catch(() => null);

    if (claimable === null) {
      return {
        ok: false,
        error:
          "Could not read what is claimable, so nothing was signed. Try again in a moment.",
      };
    }
    if (claimable === 0n) {
      return { ok: false, error: "There is no interest to claim yet." };
    }

    /*
        Simulated with no `value` and no `args`, which is all the contract takes.
        A revert here is the interesting case and is reported as a refusal: the
        selector is dispatched by the contract but the *conditions* for a claim
        are not something this app can see, so a no here means the vault knows
        something the screen does not.
      */
    const sim = await simulate(
      () =>
        rpc().simulateContract({
          account: from,
          address: vault,
          abi: SAVINGS_VAULT_ABI,
          functionName: "claimYield",
        }),
      "claim",
      from,
    );
    if ("error" in sim) return { ok: false, error: sim.error };

    if (typeof sim.result !== "bigint" || sim.result <= 0n) {
      return {
        ok: false,
        error:
          "The vault currently has no yield to pay. Refresh your Savings balance.",
      };
    }

    return broadcast(
      signed.wallet,
      () => signed.wallet.writeContract(sim.request),
      "The claim",
      true,
    );
  }

  return {
    pendingClaimHash: () => {
      const wallet = getWalletClient();
      return wallet?.account ? pendingClaim(wallet.account.address) : null;
    },
    /**
     * Put MUSD into the Savings Vault.
     *
     * `amountWei` is measured in MUSD, not shares, and the two are the same
     * number — see the note at the top of `earn.ts`, where a real deposit's
     * events are decoded to show the vault minting sMUSD one-for-one against
     * the MUSD that arrived. There is therefore no conversion anywhere in this
     * path, and deliberately so: a conversion here would be the bug.
     */
    async deposit(amountWei: bigint): Promise<EarnWriteResult> {
      if (amountWei <= 0n) {
        return { ok: false, error: "Enter how much to save." };
      }

      const signed = await signer();
      if ("error" in signed) return { ok: false, error: signed.error };
      const from = signed.wallet.account!.address;
      const vault = activeEarn.savingsVault;

      /*
        Checked against the chain, not against whatever number the screen
        happens to be showing. A stale balance is the most likely reason for a
        refusal to be wrong, and reading it here removes that possibility
        entirely.
      */
      const held = await rpc()
        .readContract({
          address: MUSD_ADDRESS,
          abi: MUSD_ABI,
          functionName: "balanceOf",
          args: [from],
        })
        .catch(() => null);

      if (held === null) {
        return {
          ok: false,
          error:
            "Could not read your MUSD balance, so nothing was signed. Try again in a moment.",
        };
      }
      if (held < amountWei) {
        return {
          ok: false,
          error: `That is more than this wallet holds — it has ${musd(held)} MUSD. Gas is paid in BTC, so the MUSD is not needed for it.`,
        };
      }

      /*
        The allowance decides whether this is one transaction or two. Reading it
        rather than approving unconditionally means the second deposit onwards
        is a single prompt, and it means a user who has already approved exactly
        this amount is not asked again for a permission they granted.
      */
      const allowance = await rpc()
        .readContract({
          address: MUSD_ADDRESS,
          abi: MUSD_ALLOWANCE_ABI,
          functionName: "allowance",
          args: [from, vault],
        })
        .catch(() => 0n);

      if (allowance < amountWei) {
        const approveSim = await simulate(
          () =>
            rpc().simulateContract({
              account: from,
              address: MUSD_ADDRESS,
              abi: MUSD_ALLOWANCE_ABI,
              functionName: "approve",
              args: [vault, amountWei],
            }),
          "approval",
          from,
        );
        if ("error" in approveSim) {
          return { ok: false, error: approveSim.error };
        }

        const approved = await broadcast(
          signed.wallet,
          () => signed.wallet.writeContract(approveSim.request),
          "The approval",
        );
        /*
          An unread approval is not a reason to go on and deposit: the deposit
          would then fail on a missing allowance and the user would have paid
          gas twice for one intent. Stopping here is the honest outcome, and the
          message already told them not to repeat it.
        */
        if (!approved.ok) return approved;
      }

      const sim = await simulate(
        () =>
          rpc().simulateContract({
            account: from,
            address: vault,
            abi: SAVINGS_VAULT_ABI,
            functionName: "deposit",
            args: [amountWei],
          }),
        "deposit",
        from,
      );
      if ("error" in sim) return { ok: false, error: sim.error };

      return broadcast(
        signed.wallet,
        () => signed.wallet.writeContract(sim.request),
        "The deposit",
      );
    },

    /**
     * Take MUSD back out of the Savings Vault.
     *
     * One transaction and no approval: the vault burns the caller's own sMUSD
     * and pays MUSD to the caller. `amountWei` is MUSD, which is also the share
     * count — see `deposit` above.
     */
    async withdraw(amountWei: bigint): Promise<EarnWriteResult> {
      if (amountWei <= 0n) {
        return { ok: false, error: "Enter how much to take out." };
      }

      const signed = await signer();
      if ("error" in signed) return { ok: false, error: signed.error };
      const from = signed.wallet.account!.address;
      const vault = activeEarn.savingsVault;

      const shares = await rpc()
        .readContract({
          address: vault,
          abi: SAVINGS_VAULT_ABI,
          functionName: "balanceOf",
          args: [from],
        })
        .catch(() => null);

      if (shares === null) {
        return {
          ok: false,
          error:
            "Could not read your savings balance, so nothing was signed. Try again in a moment.",
        };
      }
      if (shares < amountWei) {
        return {
          ok: false,
          error:
            shares === 0n
              ? "There is nothing saved in this wallet yet."
              : `That is more than is saved here — this wallet has ${musd(shares)} MUSD in the vault.`,
        };
      }

      const sim = await simulate(
        () =>
          rpc().simulateContract({
            account: from,
            address: vault,
            abi: SAVINGS_VAULT_ABI,
            functionName: "withdraw",
            args: [amountWei],
          }),
        "withdrawal",
        from,
      );
      if ("error" in sim) return { ok: false, error: sim.error };

      return broadcast(
        signed.wallet,
        () => signed.wallet.writeContract(sim.request),
        "The withdrawal",
      );
    },

    /**
     * Claim the interest the vault has accrued for this holder.
     *
     * Interest is the *other* half of this vault and it arrives separately:
     * shares do not move when interest is earned, so nothing about the sMUSD
     * balance behind `deposit`/`withdraw` reflects it. This is the only way it
     * reaches the wallet.
     *
     * No amount is passed and none is invented. `claimYield()` takes no
     * arguments — it updates the yield index and pays the accrued amount — so the
     * figure the screen shows is a preview, and the chain decides the real one
     * at the moment of the call. The confirmed transaction determines the final payout.
     */
    async claim(): Promise<EarnWriteResult> {
      const address = getWalletClient()?.account?.address;
      if (!address) return performClaim();
      const key = `pocket:savings-claim:${CHAIN_ID}:${address.toLowerCase()}`;
      const existing = claimsInFlight.get(key);
      if (existing) return existing;
      const work = async (): Promise<EarnWriteResult> => {
        if (typeof navigator !== "undefined" && navigator.locks) {
          return navigator.locks.request(
            key,
            { ifAvailable: true },
            async (lock) =>
              lock
                ? performClaim()
                : {
                    ok: false,
                    error: "A claim is already being checked in another tab.",
                  },
          );
        }
        return performClaim();
      };
      const promise = work()
        .catch(
          (): EarnWriteResult => ({
            ok: false,
            hash: pendingClaim(address) ?? undefined,
            error:
              "Could not finish checking the claim. Refresh and check its confirmation before trying again.",
          }),
        )
        .finally(() => claimsInFlight.delete(key));
      claimsInFlight.set(key, promise);
      return promise;
    },
  };
}
