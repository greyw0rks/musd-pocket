import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: [
      "lib/payments/**/*.test.ts",
      "features/payments/*.recovery.test.ts",
      "lib/settlement/*.isolation.test.ts",
    ],
    environment: "node",
  },
});
