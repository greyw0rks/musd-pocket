import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: [
      "lib/mezo/earn.test.ts",
      "lib/wallet/session-wallet.test.ts",
      "lib/mezo/wealth/**/*.test.ts",
      "lib/mezo/locks.test.ts",
      "lib/users/**/*.test.ts",
      "lib/rewards/**/*.test.ts",
      "lib/merchants/**/*.test.ts",
    ],
    environment: "node",
  },
});
