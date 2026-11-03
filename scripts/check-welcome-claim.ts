// Read-only verification of the user's new-campaign reward and replay refusal.
import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";
import { decodeEventLog, decodeFunctionData, erc20Abi, formatUnits, type Hex } from "viem";
import { getPublicClient } from "../lib/mezo/musd";
import { CHAIN_ID } from "../lib/mezo/config";
import { WELCOME_REWARD_ABI, WELCOME_ESCROW_ABI, WELCOME_MEZO_AMOUNT, MEZO_REWARD_TOKEN, TESTNET_VEMEZO, epochUnlockAt, WELCOME_LOCK_DURATION } from "../lib/rewards/abi";
async function main() {
  const campaign = "0xa78709beb3841aac1ed8fc3d8dedf74d55f62432" as const;
  const owner = "0xe66d1c48792a320c16d7abd90c835b25a0ac37db" as const;
  if (process.env.POCKET_WELCOME_REWARD_ADDRESS?.toLowerCase() !== campaign || CHAIN_ID !== 31611) throw new Error("New testnet campaign only.");
  const db = new PrismaClient({ log: [] });
  let attempt;
  try { attempt = await db.welcomeRewardAttempt.findFirst({ where: { campaign, walletAddress: owner, chainId: 31611 }, select: { txHash: true, claimId: true, state: true }, orderBy: { createdAt: "desc" } }); }
  finally { await db.$disconnect(); }
  if (!attempt?.txHash) throw new Error("No recorded claim transaction yet.");
  const hash = attempt.txHash as Hex;
  const rpc = getPublicClient();
  if (await rpc.getChainId() !== 31611) throw new Error("Wrong chain.");
  const receipt = await rpc.waitForTransactionReceipt({ hash, timeout: 60_000, pollingInterval: 1_000 });
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== campaign) throw new Error("Claim failed or targets a different campaign.");
  let input: Hex;
  try { input = (await rpc.getTransaction({ hash })).input; }
  catch {
    const response = await fetch(`https://api.explorer.test.mezo.org/api/v2/transactions/${hash}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Claim calldata unavailable.");
    const tx = await response.json();
    if (tx.hash?.toLowerCase() !== hash || tx.status !== "ok" || BigInt(tx.block_number) !== receipt.blockNumber || tx.to.hash.toLowerCase() !== campaign) throw new Error("Explorer claim does not match the receipt.");
    input = tx.raw_input;
  }
  const call = decodeFunctionData({ abi: WELCOME_REWARD_ABI, data: input });
  if (call.functionName !== "claim" || call.args[0].toLowerCase() !== attempt.claimId.toLowerCase() || call.args[1].toLowerCase() !== owner) throw new Error("Claim calldata does not match the journal and recipient.");
  const events = receipt.logs.filter(log => log.address.toLowerCase() === campaign).flatMap(log => {
    try { return [decodeEventLog({ abi: WELCOME_REWARD_ABI, eventName: "WelcomeClaimed", data: log.data, topics: log.topics }).args]; } catch { return []; }
  });
  if (events.length !== 1) throw new Error("Expected exactly one welcome event.");
  const event = events[0], blockNumber = receipt.blockNumber;
  const [block, position, nftOwner, claim, walletClaimed, inventoryBefore, inventoryAfter] = await Promise.all([
    rpc.getBlock({ blockNumber }),
    rpc.readContract({ address: TESTNET_VEMEZO, abi: WELCOME_ESCROW_ABI, functionName: "locked", args: [event.tokenId], blockNumber }),
    rpc.readContract({ address: TESTNET_VEMEZO, abi: WELCOME_ESCROW_ABI, functionName: "ownerOf", args: [event.tokenId], blockNumber }),
    rpc.readContract({ address: campaign, abi: WELCOME_REWARD_ABI, functionName: "claims", args: [call.args[0]], blockNumber }),
    rpc.readContract({ address: campaign, abi: WELCOME_REWARD_ABI, functionName: "walletClaimed", args: [owner], blockNumber }),
    rpc.readContract({ address: MEZO_REWARD_TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [campaign], blockNumber: blockNumber - 1n }),
    rpc.readContract({ address: MEZO_REWARD_TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [campaign], blockNumber }),
  ]);
  let replayRejected = false;
  try { await rpc.simulateContract({ address: campaign, abi: WELCOME_REWARD_ABI, functionName: "claim", args: call.args, account: receipt.from, blockNumber }); }
  catch (error) {
    let cause: unknown = error;
    while (cause && typeof cause === "object") {
      if ("data" in cause && (cause.data as { errorName?: string } | undefined)?.errorName === "AlreadyClaimed") replayRejected = true;
      cause = "cause" in cause ? cause.cause : null;
    }
    if (!replayRejected) throw error;
  }
  const passed = event.claimId === call.args[0] && event.recipient.toLowerCase() === owner && event.amount === WELCOME_MEZO_AMOUNT
    && nftOwner.toLowerCase() === owner && position.amount === WELCOME_MEZO_AMOUNT && !position.isPermanent
    && position.end === event.unlockAt && event.unlockAt === epochUnlockAt(block.timestamp, WELCOME_LOCK_DURATION)
    && claim[0].toLowerCase() === owner && claim[1] === event.tokenId && claim[2] === WELCOME_MEZO_AMOUNT && claim[3] === event.unlockAt
    && walletClaimed && inventoryBefore - inventoryAfter === WELCOME_MEZO_AMOUNT && replayRejected;
  const report = { capturedAt: new Date().toISOString(), chainId: 31611, campaign, hash, block: String(blockNumber), status: receipt.status, recipient: owner, tokenId: String(event.tokenId), lockedMezo: formatUnits(position.amount, 18), nftOwner, unlockAt: new Date(Number(event.unlockAt) * 1000).toISOString(), lockDurationSeconds: String(event.unlockAt - block.timestamp), journalState: attempt.state, journalMatches: true, walletClaimed, inventoryBeforeMezo: formatUnits(inventoryBefore, 18), inventoryAfterMezo: formatUnits(inventoryAfter, 18), remainingFundedClaims: Number(inventoryAfter / WELCOME_MEZO_AMOUNT), replaySimulationRejectedWith: replayRejected ? "AlreadyClaimed" : null, passed, broadcasts: 0 };
  await writeFile("docs/evidence/wave-2-welcome-claim.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}
main().catch(error => { console.error(error.shortMessage ?? error.message); process.exitCode = 1; });
