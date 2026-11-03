import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["lib/requests/**/*.test.ts", "features/requests/**/*.test.ts"],
    environment: "node",
  },
});
