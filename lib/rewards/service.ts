import "server-only";

import { decodeFunctionData, erc20Abi, formatUnits, getAddress, keccak256, toBytes, zeroAddress, type Address } from "viem";
import type { PrivyIdentity } from "@/lib/auth/privy-server";
import { HttpError } from "@/lib/auth/request";
import { ACTIVE_ENV, activeChain, CHAIN_ID } from "@/lib/mezo/config";
import { getPublicClient } from "@/lib/mezo/musd";
import { getRelayerWallet, hasRelayer } from "@/lib/relayer";
import { epochUnlockAt, MEZO_REWARD_TOKEN, REWARD_EPOCH_SECONDS, TESTNET_VEMEZO, WELCOME_CLAIM_TYPES, WELCOME_ESCROW_ABI, WELCOME_LOCK_DURATION, WELCOME_MEZO_AMOUNT, WELCOME_REWARD_ABI } from "./abi";
import type { WelcomeRewardStatus } from "./types";

function campaignAddress(): Address | null {
  const configured = process.env.POCKET_WELCOME_REWARD_ADDRESS?.trim();
  if (!configured) return null;
  const address = getAddress(configured);
  if (address === zeroAddress) throw new Error("Invalid welcome campaign address.");
  if (process.env.POCKET_WELCOME_REWARD_CHAIN_ID !== String(CHAIN_ID)) {
    throw new Error("Welcome campaign network does not match Pocket.");
  }
  return address;
}

/** Stable across wallet changes; raw Privy identities never leave the server. */
export function welcomeClaimId(privyId: string) {
  return keccak256(toBytes(`pocket:welcome:v1:${privyId}`));
}

function unavailable(reason: string, address: Address | null = null): WelcomeRewardStatus {
  return {
    enabled: Boolean(address), state: "unavailable", reason, chainId: CHAIN_ID,
    campaignAddress: address, escrowAddress: null, rewardAmount: null,
    lockWeeks: null, unlockAt: null, claim: null,
  };
}

async function readCampaign(identity: PrivyIdentity) {
  if (ACTIVE_ENV !== "testnet") return { view: unavailable("Welcome rewards are only available on testnet.") };
  const address = campaignAddress();
  if (!address) return { view: unavailable("Welcome rewards are not available yet.") };
  const rpc = getPublicClient();
  const [chainId, block] = await Promise.all([rpc.getChainId(), rpc.getBlock()]);
  if (chainId !== CHAIN_ID) throw new Error("Reward RPC network mismatch.");
  const blockNumber = block.number;
  const read = <N extends "rewardToken" | "votingEscrow" | "authorizer" | "rewardAmount" | "lockDuration" | "paused">(functionName: N) =>
    rpc.readContract({ address, abi: WELCOME_REWARD_ABI, functionName, blockNumber });
  const claimId = welcomeClaimId(identity.privyId);
  const recipient = getAddress(identity.walletAddress);
  const [token, escrow, authorizer, amount, duration, paused, claim, walletClaimed] = await Promise.all([
    read("rewardToken"), read("votingEscrow"), read("authorizer"), read("rewardAmount"), read("lockDuration"), read("paused"),
    rpc.readContract({ address, abi: WELCOME_REWARD_ABI, functionName: "claims", args: [claimId], blockNumber }),
    rpc.readContract({ address, abi: WELCOME_REWARD_ABI, functionName: "walletClaimed", args: [recipient], blockNumber }),
  ]);
  const [escrowToken, decimals, inventory] = await Promise.all([
    rpc.readContract({ address: escrow, abi: WELCOME_ESCROW_ABI, functionName: "token", blockNumber }),
    rpc.readContract({ address: token, abi: erc20Abi, functionName: "decimals", blockNumber }),
    rpc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address], blockNumber }),
  ]);
  if (getAddress(token) !== getAddress(MEZO_REWARD_TOKEN) || getAddress(escrowToken) !== getAddress(token)
    || getAddress(escrow) !== getAddress(TESTNET_VEMEZO)
    || decimals !== 18 || amount !== WELCOME_MEZO_AMOUNT || duration !== WELCOME_LOCK_DURATION) {
    throw new Error("Invalid MEZO welcome campaign configuration.");
  }

  const hasClaim = claim[0] !== zeroAddress;
  const view: WelcomeRewardStatus = {
    enabled: true, state: hasClaim ? "claimed" : walletClaimed ? "wallet-claimed" : "available",
    reason: null, chainId: CHAIN_ID, campaignAddress: address, escrowAddress: escrow,
    rewardAmount: formatUnits(amount, decimals), lockWeeks: Number(duration / REWARD_EPOCH_SECONDS),
    unlockAt: new Date(Number(hasClaim ? claim[3] : epochUnlockAt(block.timestamp, duration)) * 1_000).toISOString(),
    claim: hasClaim ? {
      recipient: claim[0], tokenId: claim[1].toString(), amount: formatUnits(claim[2], decimals),
      unlockAt: new Date(Number(claim[3]) * 1_000).toISOString(),
    } : null,
  };
  // Already-delivered positions remain visible even while a campaign is paused or empty.
  if (!hasClaim && !walletClaimed) {
    let reason: string | null = null;
    if (paused) reason = "Welcome claims are paused. Try again later.";
    else if (inventory < amount) reason = "Welcome rewards are being restocked. Try again later.";
    else if (!hasRelayer() || getAddress(getRelayerWallet().account.address) !== getAddress(authorizer)) {
      reason = "Welcome claims are temporarily unavailable.";
    } else {
      const gas = await rpc.getBalance({ address: getRelayerWallet().account.address, blockNumber });
      if (gas === 0n) reason = "Welcome claims are temporarily unavailable.";
    }
    if (reason) { view.state = "unavailable"; view.reason = reason; }
  }
  return { view, address, recipient, claimId, block, rpc };
}

export async function welcomeRewardStatus(identity: PrivyIdentity, pendingTxHash?: string | null): Promise<WelcomeRewardStatus> {
  try {
    const context = await readCampaign(identity);
    const view = context.view;
    if (!pendingTxHash || view.state === "claimed" || !context.rpc || !context.address
      || !/^0x[0-9a-fA-F]{64}$/.test(pendingTxHash)) return view;
    const hash = pendingTxHash as `0x${string}`;
    const tx = await context.rpc.getTransaction({ hash });
    if (!tx.to || getAddress(tx.to) !== context.address) return view;
    const call = decodeFunctionData({ abi: WELCOME_REWARD_ABI, data: tx.input });
    if (call.functionName !== "claim" || call.args[0] !== context.claimId
      || getAddress(call.args[1]) !== context.recipient) return view;
    try {
      const receipt = await context.rpc.getTransactionReceipt({ hash });
      if (receipt.status === "reverted") return { ...view, pendingStatus: "reverted", reason: "Your previous claim reverted. You can try again." };
    } catch { /* Not mined yet, or receipt lookup is unavailable. */ }
    return { ...view, pendingTxHash: hash, pendingStatus: "pending" };
  } catch {
    // A failed RPC/configuration read is unknown, never a zero reward balance.
    return unavailable("Could not load welcome rewards. Try again shortly.");
  }
}

export async function claimWelcomeReward(identity: PrivyIdentity): Promise<WelcomeRewardStatus> {
  const context = await readCampaign(identity).catch(() => {
    throw new HttpError("Could not load welcome rewards. Try again shortly.", 503);
  });
  if (context.view.state === "claimed") return context.view;
  if (context.view.state === "wallet-claimed") throw new HttpError("This wallet has already received a welcome reward.", 409);
  if (context.view.state !== "available" || !context.address || !context.rpc || !context.block || !context.recipient || !context.claimId) {
    throw new HttpError(context.view.reason ?? "Welcome rewards are unavailable.", 503);
  }
  const { account, client } = getRelayerWallet();
  const deadline = context.block.timestamp + 300n;
  const signature = await account.signTypedData({
    domain: { name: "PocketWelcomeReward", version: "1", chainId: CHAIN_ID, verifyingContract: context.address },
    types: WELCOME_CLAIM_TYPES, primaryType: "WelcomeClaim",
    message: { claimId: context.claimId, recipient: context.recipient, deadline },
  });
  let hash: `0x${string}`;
  try {
    const { request } = await context.rpc.simulateContract({
      address: context.address, abi: WELCOME_REWARD_ABI, functionName: "claim",
      args: [context.claimId, context.recipient, deadline, signature], account,
    });
    hash = await client.writeContract({ ...request, chain: activeChain });
  } catch {
    // A competing request may have won. The contract prevents a second reward.
    const latest = await welcomeRewardStatus(identity);
    if (latest.state === "claimed") return latest;
    throw new HttpError("The welcome claim could not be sent. Try again shortly.", 502);
  }
  let receipt;
  try {
    receipt = await context.rpc.waitForTransactionReceipt({ hash, timeout: 25_000, pollingInterval: 1_000 });
  } catch {
    // Preserve the hash; another POST cannot pay twice, even after a server restart.
    return { ...context.view, pendingTxHash: hash, pendingStatus: "pending" };
  }
  const latest = await welcomeRewardStatus(identity);
  if (latest.state === "claimed") return latest;
  if (receipt.status === "reverted") throw new HttpError("The welcome claim failed on-chain. Try again.", 502);
  return { ...latest, pendingTxHash: hash, pendingStatus: "pending" };
}
