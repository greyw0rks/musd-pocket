import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, defineChain, http, encodeDeployData, erc20Abi, formatUnits, keccak256, toBytes, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
const mode = process.argv[2] || "check";
if (!["check", "deploy"].includes(mode)) throw new Error("Use check or deploy.");
const chain = defineChain({ id: 31611, name: "Mezo testnet", nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } } });
const rpc = createPublicClient({ chain, transport: http(undefined, { timeout: 20_000, retryCount: 1 }) });
const account = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY);
const wallet = createWalletClient({ account, chain, transport: http() });
const token = "0x7B7c000000000000000000000000000000000001";
const escrow = "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b";
const recipient = "0xe66d1c48792a320c16d7abd90c835b25a0ac37db";
const amount = 200n * 10n ** 18n;
const artifact = JSON.parse(await readFile(new URL("../contracts/out/PocketWelcomeReward.sol/PocketWelcomeReward.json", import.meta.url), "utf8"));
const evidencePath = new URL("../docs/evidence/welcome-rollout.json", import.meta.url);
const escrowAbi = [{ type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }];
const types = { WelcomeClaim: [{ name: "claimId", type: "bytes32" }, { name: "recipient", type: "address" }, { name: "deadline", type: "uint256" }] };
let evidence = { chainId: chain.id, rewardPerClaim: "200", budgetMezo: "200", claimCapacity: 1, recipientOfSimulation: recipient, liveClaim: "pending authenticated user claim" };
try { evidence = { ...evidence, ...JSON.parse(await readFile(evidencePath, "utf8")) }; } catch { /* First rollout. */ }
const save = async () => writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
async function signedClaim(address) {
  const block = await rpc.getBlock();
  const deadline = block.timestamp + 300n;
  const claimId = keccak256(toBytes("pocket:welcome:read-only-rollout-simulation"));
  const signature = await account.signTypedData({ domain: { name: "PocketWelcomeReward", version: "1", chainId: chain.id, verifyingContract: address }, types, primaryType: "WelcomeClaim", message: { claimId, recipient, deadline } });
  return [claimId, recipient, deadline, signature];
}
try {
  if (await rpc.getChainId() !== chain.id) throw new Error("Wrong chain");
  if (getAddress(await rpc.readContract({ address: escrow, abi: escrowAbi, functionName: "token" })) !== getAddress(token)) throw new Error("Escrow token mismatch");
  const [btc, inventory, latestNonce, pendingNonce] = await Promise.all([
    rpc.getBalance({ address: account.address }), rpc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
    rpc.getTransactionCount({ address: account.address, blockTag: "latest" }), rpc.getTransactionCount({ address: account.address, blockTag: "pending" }),
  ]);
  evidence.relayer = account.address; evidence.relayerBtc = formatUnits(btc, 18); evidence.relayerMezo = formatUnits(inventory, 18);
  if (latestNonce !== pendingNonce) throw new Error("Relayer has pending transactions");
  const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [token, escrow, account.address, account.address] });
  if (!evidence.campaignAddress) {
    const deploymentGas = await rpc.estimateGas({ account: account.address, data });
    const runtime = await rpc.call({ account: account.address, data, gas: deploymentGas + 100_000n });
    // An eth_call code override at the existing funded EOA exercises the real
    // Cosmos MEZO precompile and deployed escrow without creating a lock on-chain.
    const simulation = await rpc.simulateContract({ account: account.address, address: account.address, abi: artifact.abi, functionName: "claim", args: await signedClaim(account.address), stateOverride: [{ address: account.address, code: runtime.data }], gas: 2_000_000n });
    evidence.realTokenEscrowSimulation = { accepted: true, simulatedTokenId: simulation.result.toString(), broadcast: false };
    evidence.deploymentGas = deploymentGas.toString();
    if (inventory < amount) throw new Error("One-claim MEZO funding unavailable");
    const gasPrice = await rpc.getGasPrice();
    if (btc < (deploymentGas + 300_000n) * gasPrice) throw new Error("Insufficient gas budget");
    await save();
    if (mode === "deploy") {
      const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [token, escrow, account.address, account.address], gas: deploymentGas + deploymentGas / 5n });
      evidence.deploymentTxHash = hash; await save();
      const receipt = await rpc.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("Deployment failed");
      evidence.campaignAddress = receipt.contractAddress; evidence.deploymentBlock = receipt.blockNumber.toString(); await save();
    }
  }
  if (mode === "deploy" && evidence.campaignAddress) {
    const campaign = getAddress(evidence.campaignAddress);
    const [authorizer, reward, lockDuration] = await Promise.all(["authorizer", "rewardAmount", "lockDuration"].map(functionName => rpc.readContract({ address: campaign, abi: artifact.abi, functionName })));
    if (getAddress(authorizer) !== account.address || reward !== amount || lockDuration !== 1_209_600n) throw new Error("Deployed campaign mismatch");
    let funded = await rpc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [campaign] });
    if (funded < amount) {
      if (evidence.fundingTxHash) {
        const prior = await rpc.waitForTransactionReceipt({ hash: evidence.fundingTxHash, timeout: 60_000 });
        if (prior.status !== "success") throw new Error("Previous funding failed; review required");
        funded = await rpc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [campaign] });
      } else {
        const { request } = await rpc.simulateContract({ account, address: token, abi: erc20Abi, functionName: "transfer", args: [campaign, amount] });
        evidence.fundingTxHash = await wallet.writeContract(request); await save();
        const receipt = await rpc.waitForTransactionReceipt({ hash: evidence.fundingTxHash, timeout: 60_000 });
        if (receipt.status !== "success") throw new Error("Funding failed");
        funded = await rpc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [campaign] });
      }
    }
    if (funded !== amount) throw new Error("Campaign inventory differs from one-claim budget");
    const simulation = await rpc.simulateContract({ account, address: campaign, abi: artifact.abi, functionName: "claim", args: await signedClaim(campaign) });
    evidence.fundedMezo = formatUnits(funded, 18); evidence.deployedClaimSimulation = { accepted: true, simulatedTokenId: simulation.result.toString(), broadcast: false };
    evidence.ready = true; await save();
  }
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  evidence.ready = false; evidence.errorClass = error.name; evidence.errorSummary = error.shortMessage || (error.name === "Error" ? error.message : "RPC or contract check failed"); await save();
  console.error(JSON.stringify({ failed: true, ...evidence }, null, 2)); process.exitCode = 1;
}
