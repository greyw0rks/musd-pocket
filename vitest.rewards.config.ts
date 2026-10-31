import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["lib/rewards/**/*.test.ts", "lib/faucet/**/*.test.ts", "lib/requests/**/*.test.ts", "lib/payments/**/*.test.ts", "lib/mezo/earn-math.test.ts", "lib/mezo/verify.test.ts", "features/requests/**/*.test.ts"], environment: "node" },
});
