import { spawn } from "node:child_process";
const campaign = "0x3469818359ce1bae2d137531dcd78c5cc4ec14ba";
const values = {
  DATABASE_URL: process.env.DATABASE_URL, DIRECT_URL: process.env.DIRECT_URL,
  PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET, RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY,
  NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  NEXT_PUBLIC_MEZO_ENV: "testnet", NEXT_PUBLIC_MEZO_RPC_URL: "https://rpc.test.mezo.org",
  POCKET_WELCOME_REWARD_ADDRESS: campaign, POCKET_WELCOME_REWARD_CHAIN_ID: "31611",
  POCKET_ENABLE_LEGACY_SETTLEMENT: "false",
};
for (const [key, value] of Object.entries(values)) {
  if (!value) throw new Error(`Required environment variable missing: ${key}`);
  const secret = ["DATABASE_URL", "DIRECT_URL", "PRIVY_APP_SECRET", "RELAYER_PRIVATE_KEY"].includes(key);
  const result = await new Promise(resolve => {
    const child = spawn("rtk", ["proxy", "vercel", "env", "add", key, "preview", "--force", "--yes", secret ? "--sensitive" : "--no-sensitive", "--scope", "greyw0rks-projects"], { stdio: ["pipe", "ignore", "ignore"] });
    child.stdin.end(value); child.on("exit", code => resolve(code)); child.on("error", () => resolve(-1));
  });
  console.log(JSON.stringify({ key, configured: result === 0, target: "preview" }));
  if (result !== 0) { process.exitCode = 1; break; }
}
