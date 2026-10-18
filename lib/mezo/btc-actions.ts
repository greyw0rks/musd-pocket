import { isAddress, type WalletClient } from "viem";
import { getPublicClient } from "./musd";
import { CHAIN_ID } from "./config";
import { formatBtc } from "./borrow-format";

/**
 * Sending native BTC out of the wallet.
 *
 * This is the withdrawal, and it is deliberately the same thing as a send: on
 * Mezo the gas token *is* BTC, so moving it is a plain value transfer — no
 * bridge, no peg-out, no Bitcoin script, nothing that leaves this chain. There
 * is no second rail here and this module exists so nothing pretends there is.
 *
 * Everything the mUSD path learned is applied again, because the same mistakes
 * are available:
 *
 *  - **the chain is asked before the wallet is.** Without that, the first thing
 *    to discover a transfer cannot happen is the signature prompt, and it
 *    discovers it inside a failed gas estimate — which surfaces as "gas limit
 *    must not be zero" over a wallet that simply holds too little.
 *  - **a fee is reserved, not spent.** The amount and the gas come out of the
 *    same balance, so a transfer of everything the user holds can never be
 *    mined. This module answers with the largest amount that can actually
 *    arrive, and refuses the rest by name rather than letting the failure be
 *    discovered on-chain.
 *  - **an unread receipt is not a failure.** Reported as broadcast-and-unread,
 *    with the hash, because the one thing the user must not do is assume it
 *    failed and send again.
 *
 * Client-safe: no private key, no `server-only`, no Pocket relayer. The
 * transfer is signed by the user's own wallet, which is the only account that
 * can move that wallet's BTC.
 */

/**
 * What a write reports back.
 *
 * `hash` is present on a failure only when a transaction was actually
 * broadcast, and its presence changes what the sentence means: no hash is
 * "nothing was signed", a hash is "this is on-chain, here is how to look at
 * it". A caller that renders the two identically would be telling a user their
 * money did not move when it did. Same shape and same reasoning as
 * `BorrowWriteResult`.
 */
export type BtcWriteResult =
  | { ok: true; hash: `0x${string}` }
  | { ok: false; error: string; hash?: `0x${string}` };

/**
 * How long to wait for the receipt before saying we could not read it.
 *
 * Same number and same reasoning as the other two write paths: Mezo mines in
 * about seven seconds, and a wait that has not answered in 30s is not going to.
 */
const RECEIPT_TIMEOUT_MS = 30_000;

/**
 * The gas an ordinary value transfer costs, to an account that runs no code.
 *
 * 21,000 is the intrinsic cost of a transfer on any EVM chain and it is not an
 * estimate — it is arithmetic the protocol performs identically everywhere. It
 * is used for one thing only: sizing the fee that has to be left behind when
 * the user asks for *everything*. The real limit for a given transfer is
 * measured below, because a destination that is a contract costs more.
 */
const PLAIN_TRANSFER_GAS = 21_000n;

/**
 * Did the user turn the prompt down?
 *
 * Third copy of this predicate, and that is a deliberate duplication rather
 * than an oversight: the other two live in the money paths
 * (`chain-payment.adapter.ts`, `borrow-actions.ts`) and pulling them into a
 * shared module would mean editing both while adding a feature neither asked
 * for. viem surfaces a refusal as a `UserRejectedRequestError` whose message
 * varies by connector, and Privy's embedded wallet has its own spelling.
 * Matching on the words rather than on one class name is the version that keeps
 * working across providers — and getting it wrong in the other direction would
 * tell a user who simply changed their mind that their money had a problem.
 */
function isUserRejection(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? "";
  const message = e instanceof Error ? e.message : String(e);
  return (
    name === "UserRejectedRequestError" ||
    /reject|denied|declined|cancell?ed by user/i.test(message)
  );
}

/**
 * A truncated address, for showing a counterparty that has no handle.
 *
 * Exported because it is also how a *balance* is labelled. A figure without the
 * address it belongs to is the figure that gets misread — the most common way to
 * arrive at a refusal here is a wallet the user did not realise was active — so
 * the screen that shows the ceiling has to be able to name the wallet beside it,
 * and it must name it exactly as the refusal does.
 */
export function shortenAddress(address: string): string {
  return address.length <= 12
    ? address
    : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function createBtcActions(deps: {
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
   * The chain check is separate from the wallet check on purpose: a value
   * transfer signed on the wrong chain moves that chain's gas token to the same
   * address, which looks like it worked and is not the money the user meant.
   */
  function signer(): { wallet: WalletClient } | { error: string } {
    const wallet = getWalletClient();
    if (!wallet?.account) {
      return { error: "Your wallet is not ready yet. Try again in a moment." };
    }
    if (wallet.chain && wallet.chain.id !== CHAIN_ID) {
      return { error: "Switch to Mezo to send BTC." };
    }
    return { wallet };
  }

  /**
   * What one unit of gas costs right now, read from the chain.
   *
   * `estimateFeesPerGas` rather than a remembered constant, because the fee is
   * what decides whether a given amount can be sent at all and a stale figure
   * would produce a refusal that is wrong about the user's own money. `null` on
   * a failed read, so a caller withholds the ceiling rather than computing one
   * from a zero that no transaction would be mined at.
   *
   * The *shape* is kept, not just the number. It is handed straight back to
   * `sendTransaction` below, so the fee that was checked against the balance is
   * the fee that gets signed — pricing the transfer a second time inside the
   * wallet would let the base fee tick up between the two reads and turn a
   * maximal send that passed the check into one the chain refuses.
   */
  type FeeValues =
    | { gasPrice: bigint }
    | { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint };

  async function fees(): Promise<FeeValues | null> {
    try {
      const fee = await rpc().estimateFeesPerGas();
      if (fee.maxFeePerGas !== undefined && fee.maxPriorityFeePerGas !== undefined) {
        return {
          maxFeePerGas: fee.maxFeePerGas,
          maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
        };
      }
      if (fee.gasPrice !== undefined) return { gasPrice: fee.gasPrice };
      return null;
    } catch (e) {
      console.error("[pocket] btc fee not read", {
        error: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  }

  /** The single per-gas figure a ceiling can be computed from. */
  function rateOf(fee: FeeValues): bigint {
    return "maxFeePerGas" in fee ? fee.maxFeePerGas : fee.gasPrice;
  }

  return {
    /**
     * The most BTC that can be sent and actually arrive.
     *
     * Not the balance. The balance pays for the transfer as well as being
     * transferred, so the last sliver of it can never leave — which is why this
     * reports the amount *and* the fee it set aside rather than a single figure
     * the screen would then have to explain.
     *
     * Priced for a plain transfer, since that is what "the most" means: the
     * destination of a maximal send is the cheapest kind. A send to somewhere
     * that costs more gas is refused by name in `send` below, which reads the
     * real limit for the real recipient.
     *
     * The address comes back with the figures rather than being asked for
     * separately, so a screen cannot print a ceiling next to some other wallet's
     * name: both were read in the same breath, from the same account.
     */
    async maxSendable(): Promise<
      { wei: bigint; feeWei: bigint; from: `0x${string}` } | { error: string }
    > {
      const signed = signer();
      if ("error" in signed) return { error: signed.error };

      const from = signed.wallet.account!.address as `0x${string}`;
      const fee = await fees();
      if (fee === null) {
        return {
          error:
            "The network fee could not be read, so the most that can be sent is unknown. Try again in a moment.",
        };
      }

      let held: bigint;
      try {
        held = await rpc().getBalance({ address: from });
      } catch (e) {
        console.error("[pocket] btc balance not read", {
          error: e instanceof Error ? e.message : String(e),
        });
        return { error: "Your BTC balance could not be read. Try again in a moment." };
      }

      const feeWei = PLAIN_TRANSFER_GAS * rateOf(fee);
      // Never negative. A wallet that cannot cover its own fee has nothing
      // sendable, and "-0.00002" is not an amount a screen can offer.
      return { wei: held > feeWei ? held - feeWei : 0n, feeWei, from };
    },

    /**
     * Send BTC to an address.
     *
     * Every check below is an `eth_call` or a read and costs nothing, so a
     * refusal here means no prompt appeared and no gas was spent. That ordering
     * is the point: the common failures are answered in the app's own voice,
     * before the wallet is ever asked to sign.
     */
    async send(input: {
      to: string;
      amountWei: bigint;
    }): Promise<BtcWriteResult> {
      if (input.amountWei <= 0n) {
        return { ok: false, error: "Enter an amount greater than zero." };
      }

      /*
        An address is the only thing that can receive a value transfer. Checked
        here rather than trusted from the caller: this is the boundary where
        money moves.
      */
      if (!isAddress(input.to)) {
        return { ok: false, error: "That is not a wallet address." };
      }
      const to = input.to as `0x${string}`;

      const signed = signer();
      if ("error" in signed) return { ok: false, error: signed.error };

      const wallet = signed.wallet;
      const from = wallet.account!.address as `0x${string}`;

      /*
        Sending to the address you are sending from is a transfer to yourself:
        it cannot fail, it changes no balance, and it costs the fee for nothing.
        Refused as the waste it is rather than signed, because the app should not
        spend a user's BTC to demonstrate that 1 - 1 = 0.
      */
      if (to.toLowerCase() === from.toLowerCase()) {
        return {
          ok: false,
          error: "That is this wallet's own address. Sending to it would only cost the fee.",
        };
      }

      const fee = await fees();
      if (fee === null) {
        return {
          ok: false,
          error:
            "The network fee could not be read, so this transfer was not sent. Nothing has left your wallet.",
        };
      }

      let held: bigint;
      try {
        held = await rpc().getBalance({ address: from });
      } catch (e) {
        console.error("[pocket] btc balance not read", {
          error: e instanceof Error ? e.message : String(e),
        });
        return {
          ok: false,
          error:
            "Your BTC balance could not be read, so this transfer was not sent. Nothing has left your wallet.",
        };
      }

      /*
        The fee is measured for *this* recipient before the balance is judged,
        because the two questions are the same question: what can leave is the
        balance minus what the transfer costs. Measuring first means the refusal
        below quotes a ceiling that is true for the address the user typed —
        a destination that runs code costs more gas, and would otherwise be
        refused against a fee it will never be charged.
      */
      let gasLimit: bigint;
      try {
        gasLimit = await rpc().estimateGas({
          account: from,
          to,
          value: input.amountWei,
        });
      } catch (e) {
        /*
          Worded for what is known rather than for the likeliest cause. A
          recipient that cannot receive, an RPC that will not answer, and a
          value the node will not accept all arrive here looking the same, so
          naming one would be a guess dressed up as a diagnosis. What is certain
          is that the transfer could not be checked against the chain and
          nothing was signed.

          The balance was checked above this, so "too little" is not among the
          causes being conflated.
        */
        console.error("[pocket] btc transfer not simulatable", {
          from,
          to,
          error: e instanceof Error ? e.message : String(e),
        });
        return {
          ok: false,
          error:
            "This transfer could not be checked against the chain, so it was not sent. Nothing has left your wallet.",
        };
      }

      const feeWei = gasLimit * rateOf(fee);
      if (input.amountWei + feeWei > held) {
        /*
          The address is in the message deliberately. The usual way to arrive
          here is a wallet the user did not mean to be in — a second account, an
          embedded wallet that is not the one holding the BTC — and the figure
          alone would leave them comparing it against a balance the app is
          showing for some other address.
        */
        const most = held > feeWei ? held - feeWei : 0n;
        return {
          ok: false,
          error: `This wallet holds ${formatBtc(held)} BTC, and the network fee takes ${formatBtc(feeWei)} of that — so at most ${formatBtc(most)} BTC can be sent. (${shortenAddress(from)})`,
        };
      }

      // 1. Sign and broadcast. Nothing has moved if this throws.
      let hash: `0x${string}`;
      try {
        hash = await wallet.sendTransaction({
          account: wallet.account!,
          chain: wallet.chain,
          to,
          value: input.amountWei,
          gas: gasLimit,
          /*
            The fee that was checked against the balance, handed back verbatim
            rather than re-priced by the wallet — see `fees()` for why the
            difference can cost a maximal send.
          */
          ...fee,
        });
      } catch (e) {
        if (isUserRejection(e)) {
          return { ok: false, error: "You declined. Nothing was sent." };
        }
        console.error("[pocket] btc transfer not broadcast", {
          error: e instanceof Error ? e.message : String(e),
        });
        return {
          ok: false,
          error: "Could not send the transfer. Nothing has left your wallet.",
        };
      }

      /*
        2. Wait for it to be mined — and report the wait honestly.

        A throw here is not a failure and not a success. This RPC is on record,
        in this repo's own probes, for answering `TransactionReceiptNotFound`
        for a transaction buried hundreds of blocks deep and then answering fine
        seconds later, so all a throw establishes is that *this client* could not
        read the receipt.
      */
      try {
        const receipt = await rpc().waitForTransactionReceipt({
          hash,
          timeout: RECEIPT_TIMEOUT_MS,
        });
        if (receipt.status === "reverted") {
          return {
            ok: false,
            hash,
            error: "The transfer was rejected on-chain. Nothing was sent.",
          };
        }
        return { ok: true, hash };
      } catch (e) {
        console.error("[pocket] btc receipt not read", {
          hash,
          error: e instanceof Error ? e.message : String(e),
        });
        return {
          ok: false,
          hash,
          error: `The transfer was signed and broadcast, but this app could not read the receipt yet. Do not send it again — ${hash} will confirm shortly.`,
        };
      }
    },
  };
}
