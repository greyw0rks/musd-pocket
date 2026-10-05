import "server-only";
import { createWalletClient, http, publicActions, nonceManager } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { activeChain, RPC_URL, MUSD_ADDRESS } from "@/lib/mezo/config";
import { MUSD_ABI, parseMusd, normalizeAddress } from "@/lib/mezo/musd";

/**
 * Server-side relayer: a BTC-funded hot wallet on Mezo that pays gas on behalf
 * of users, so an end user never needs BTC to receive MUSD.
 *
 * Spike scope: prove gasless-RECEIVE — the relayer sends MUSD straight to a
 * recipient. In a later phase this becomes a claim pulled from the
 * PocketPayments escrow, cryptographically bound to the recipient.
 *
 * RELAYER_PRIVATE_KEY is server-only (gitignored .env); it never reaches the client.
 */
const RAW_KEY = process.env.RELAYER_PRIVATE_KEY;

export function hasRelayer(): boolean {
  return Boolean(RAW_KEY);
}

// Build the account ONCE and cache it. The single hot EOA signs every vault
// release, so concurrent payouts/withdrawals must not race on the same chain
// nonce. viem's `nonceManager` hands out sequential nonces from a shared
// in-memory counter keyed by (address, chainId) — attaching it to one reused
// account instance is what makes that coordination effective.
let cachedAccount: PrivateKeyAccount | null = null;

function relayerAccount(): PrivateKeyAccount {
  if (!RAW_KEY) throw new Error("RELAYER_PRIVATE_KEY is not set");
  if (!cachedAccount) {
    const hex = (RAW_KEY.startsWith("0x") ? RAW_KEY : `0x${RAW_KEY}`) as `0x${string}`;
    cachedAccount = privateKeyToAccount(hex, { nonceManager });
  }
  return cachedAccount;
}

function getRelayer() {
  const account = relayerAccount();
  const client = createWalletClient({
    account,
    chain: activeChain,
    transport: http(RPC_URL),
  }).extend(publicActions);
  return { account, client };
}

/**
 * The relayer wallet, exposed for the settlement engine (lib/settlement/engine.ts)
 * which authors it as the vault's ENGINE_ROLE signer. Same funded hot wallet that
 * pays gas; here it also authorizes vault.payout / vault.withdraw.
 */
export function getRelayerWallet() {
  return getRelayer();
}

/** Relayer address + its BTC (gas) balance — used by the spike to confirm it's funded. */
export async function relayerStatus() {
  const { account, client } = getRelayer();
  const gasBalance = await client.getBalance({ address: account.address });
  return { address: account.address, gasBalance };
}

/** Relayer sends MUSD to `to`, paying BTC gas itself. Returns the tx hash. */
export async function relayerSendMusd(to: string, amount: string) {
  const { account, client } = getRelayer();
  const recipient = normalizeAddress(to);
  const value = parseMusd(amount);
  const hash = await client.writeContract({
    address: MUSD_ADDRESS,
    abi: MUSD_ABI,
    functionName: "transfer",
    args: [recipient, value],
    account,
    chain: activeChain,
  });
  return { hash, relayer: account.address };
}
