// Read-only recovery of historical claims through the production action code.
import assert from "node:assert/strict";
import { loadEnv } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
const env = loadEnv("production", process.cwd(), "NEXT_PUBLIC_");
for (const key of ["NEXT_PUBLIC_MEZO_ENV", "NEXT_PUBLIC_MEZO_RPC_URL"]) if (env[key]) process.env[key] = env[key];
const { getPublicClient, formatMusd } = await import("../lib/mezo/musd.ts");
const { CHAIN_ID, activeChain } = await import("../lib/mezo/config.ts");
const { createEarnActions } = await import("../lib/mezo/earn-actions.ts");
const { rememberClaim, pendingClaim } = await import("../lib/mezo/claim-journal.ts");
assert.equal(CHAIN_ID, 31611, "Historical evidence is from testnet");
const rpc = getPublicClient();
const checks = [];
let signed = false;
for (const hash of ["0x43149c59ae2cafafdc764a234ba6df7050a3981218cebd83ca633caaa608cfdf", "0x5271739bb3e06a0f1233efc0ac85df7d9b79e47126242236b28d29a4ecb7a3af"]) {
  const tx = await rpc.getTransaction({ hash });
  const wallet = { account: { address: tx.from }, chain: activeChain, getChainId: () => rpc.getChainId(), getAddresses: async () => [tx.from], writeContract: async () => { signed = true; throw new Error("Signing forbidden in this check"); } };
  rememberClaim(tx.from, hash);
  const result = await createEarnActions({ getWalletClient: () => wallet }).claim();
  assert.equal(result.ok, true, result.error ?? "Historical payout verification failed");
  assert.ok(result.claimedWei > 0n);
  assert.equal(pendingClaim(tx.from), null);
  checks.push({ hash, confirmedMusd: formatMusd(result.claimedWei) });
}
assert.equal(signed, false);
await mkdir("docs/evidence/android", { recursive: true });
await writeFile("docs/evidence/android/vault-claims-0.2.4.json", JSON.stringify({ createdAt: new Date().toISOString(), chainId: CHAIN_ID, historicalClaims: checks, signingPerformed: false }, null, 2) + "\n");
console.log(JSON.stringify(checks, null, 2));
