"use client";

import { useEffect, useMemo } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount, useBalance } from "wagmi";
import { formatEther } from "viem";
import { useMezoNetwork } from "@/hooks/use-mezo-network";
import { useBtcPrice } from "@/hooks/use-btc-price";
import { useSession } from "@/lib/auth/session";
import { btcValueUnits } from "@/features/payments/amount";

/**
 * The wallet's on-chain readings that are *not* the balance, plus what its gas
 * is worth.
 *
 * There is one balance and it lives in the user's wallet — but it is not read
 * here. It is read through the payment service (`getBalance` in
 * `features/payments/chain-payment.adapter.ts`) and held in the store, so that
 * one number has one path and one owner; a second `balanceOf` call in this file
 * would be the same fact fetched twice on two schedules. What is left here is
 * the pair the balance is not, and the price that turns one of them into money:
 *
 *  - **BTC** — the native gas token. It is *not* spendable MUSD, so it is kept
 *    out of the available balance however it is priced; but it is still money
 *    the user holds, so it is valued (`btcValueUnits`) and folded into the
 *    *total*. Those two figures answer different questions and the cards keep
 *    them apart: available is what can be sent now, total is everything.
 *  - **network** — which chain the reads came from, for the row that says so.
 *
 * It composes the hook that already existed for the desktop app
 * (`useMezoNetwork`) rather than growing a second one, and adds the read the
 * mobile app was missing: native gas.
 */

/**
 * BTC is shown to satoshi resolution. Mezo's gas token carries 18 decimals but
 * the last ten are sub-satoshi, so keeping them would be noise: precision the
 * chain has and money does not.
 */
export function btcAmount(raw: bigint): string {
  const [whole, frac = ""] = formatEther(raw).split(".");
  const trimmed = frac.slice(0, 8).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export interface LiveWallet {
  /**
   * The account the readings below actually targeted — `useAccount()`, not the
   * session's address, so the numbers and the address always describe one wallet
   * even in the moment before the embedded wallet becomes the active one.
   */
  address: `0x${string}`;
  /** Native BTC for gas, already formatted. `null` until the read resolves. */
  btc: string | null;
  /**
   * What that BTC is worth, in MUSD minor units — `null` when either the
   * balance or the price is unknown.
   *
   * Both halves are required and neither is defaulted: a balance with no price
   * is an amount nobody has valued, and a price with no balance is a rate for
   * nothing. The card treats `null` as "unpriced" and keeps it out of the
   * total rather than adding a zero the user cannot see.
   */
  btcValueUnits: bigint | null;
  /** The network the reads came from, for display. */
  network: { name: string; chainId: number; wrongNetwork: boolean };
}

export function useLiveWallet(): LiveWallet | null {
  const { address } = useAccount();
  const { data: native } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });
  const { networkName, expectedChainId, wrongNetwork } = useMezoNetwork();
  const price = useBtcPrice();

  /*
    Nothing to describe until there is an account.

    Both readings are about a wallet, and at boot there often is not one yet —
    Privy mints the embedded wallet after the app mounts. Returning `null`
    rather than an object full of nulls keeps "no wallet" and "a wallet whose
    gas has not been read" as the two different facts they are.
  */
  if (!address) return null;

  /*
    The raw balance, kept because the valuation needs wei and the display needs
    a string — deriving one from the other by re-parsing the formatted figure
    would be a round-trip through text for a number viem already handed us in
    full precision.
  */
  const wei = native?.value ?? null;

  return {
    address: address as `0x${string}`,
    /*
      `null` rather than a zero when the read has not answered: an absent reading
      and a real zero balance are different facts, and only one of them should be
      printed as `0`. The card decides how to say what is not known about it.
    */
    btc: wei === null ? null : btcAmount(wei),
    /*
      Priced only when both halves are known. `0n` is a real answer here and is
      left to mean what it means — a balance too small to reach a cent — while
      `null` stays reserved for "not known", which the card renders as unpriced
      rather than as nothing.
    */
    btcValueUnits:
      wei !== null && price !== null ? btcValueUnits(wei, price) : null,
    network: {
      name: networkName,
      chainId: expectedChainId,
      wrongNetwork,
    },
  };
}

/**
 * Makes the Privy embedded wallet the account `useAccount()` answers with.
 *
 * Without this the reads above target nothing: `/spike` proved the pattern
 * before this app had a use for it. Split into its own component because the
 * Privy hooks it needs only exist under `PrivyProvider`, which `app/providers`
 * mounts *only when a Privy app id is configured* — so this must be rendered
 * conditionally rather than called unconditionally, or the app stops working
 * entirely without keys.
 *
 * **Which embedded wallet**, when Privy holds more than one. It holds more than
 * one here in practice: a Privy user in this app carries two embedded wallets
 * (`wallet_index` 0 and 1, minted one second apart by two concurrent
 * `createOnLogin` calls), both with `walletClientType === "privy"`, and only
 * one of them is the wallet that holds the money. Picking "the first one" is
 * therefore not a tie-break, it is a coin toss — and it was being tossed
 * independently here and in `lib/auth/session.tsx`, which is how the app came
 * to show a balance read from one wallet while signing from the other.
 *
 * The result was not a wrong number on screen. It was a send from the empty
 * wallet, whose estimate reverted and came back as a zero gas limit, so the
 * user was shown "gas limit must not be zero" and "Missing or invalid
 * parameters" — Privy reading a revert as a malformed request, which is the
 * one thing it is not.
 *
 * So the address is the tie-break, and it comes from the session, because the
 * session is what the *server* agrees with: `pickWallet` in
 * `lib/auth/privy-server.ts` names the same wallet, that address is what the
 * Pocket row stores, and `session.tsx` says so itself — "the server stores that
 * address and the client pays from it". This is the line that makes that true.
 *
 * With two candidates and neither matching the session's address, nothing is
 * activated. That is deliberate: the app cannot attribute a signature from a
 * wallet it does not think it is, the record route would refuse the transfer
 * for coming from the wrong address, and the money would move with no row to
 * show for it. An empty account state that says "not ready" is recoverable; a
 * send that succeeds invisibly is not.
 */
export function EmbeddedWalletActivator() {
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { walletAddress } = useSession();

  const embedded = useMemo(
    () => wallets.filter((w) => w.walletClientType === "privy"),
    [wallets],
  );

  const target = useMemo(() => {
    // One wallet is unambiguous whatever the session says — and this is the
    // case that has to keep working while the session is still loading.
    if (embedded.length === 1) return embedded[0];

    if (walletAddress) {
      // `walletAddress` is lowercased by the session; the SDK checksums.
      const named = embedded.find(
        (w) => w.address.toLowerCase() === walletAddress,
      );
      if (named) return named;
    }

    return null;
  }, [embedded, walletAddress]);

  useEffect(() => {
    if (target) setActiveWallet(target).catch(() => {});
  }, [target, setActiveWallet]);

  return null;
}
