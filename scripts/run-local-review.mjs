import { spawn } from "node:child_process";
process.loadEnvFile(process.argv[2] || "/home/greyw0rks/musd-pocket/.env");
process.env.POCKET_WELCOME_REWARD_ADDRESS = "0x3469818359ce1bae2d137531dcd78c5cc4ec14ba";
process.env.POCKET_WELCOME_REWARD_CHAIN_ID = "31611";
process.env.POCKET_ENABLE_LEGACY_SETTLEMENT = "false";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--turbopack", "--hostname", "127.0.0.1", "--port", "3097"], { stdio: "inherit", env: process.env });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code || 0; });
