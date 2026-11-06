import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "../..");

export default defineConfig(({ mode }) => {
  // Only explicitly public settings enter the APK. Never serialize process.env.
  const env = loadEnv(mode, repo, "NEXT_PUBLIC_");
  if (!env.NEXT_PUBLIC_PRIVY_APP_ID) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is required for the Android build");
  const publicSettings = ["NEXT_PUBLIC_PRIVY_APP_ID", "NEXT_PUBLIC_MEZO_ENV", "NEXT_PUBLIC_MEZO_RPC_URL", "NEXT_PUBLIC_POCKET_VAULT_ADDRESS", "NEXT_PUBLIC_APP_URL"];
  return {
    root: import.meta.dirname,
    base: "/_android/web/",
    publicDir: false,
    plugins: [react(), tailwindcss()],
    resolve: { alias: [
      { find: "@/components/checkout/WaitlistCheckout", replacement: path.resolve(import.meta.dirname, "waitlist.tsx") },
      { find: "next/link", replacement: path.resolve(import.meta.dirname, "link.tsx") },
      { find: "@", replacement: repo },
    ] },
    define: Object.fromEntries(publicSettings.map((key) => [`process.env.${key}`, JSON.stringify(env[key] ?? "")])),
    build: {
      outDir: path.resolve(repo, "apps/android/app/src/main/assets/web"),
      emptyOutDir: true,
      target: "es2020",
      sourcemap: false,
      rollupOptions: {
        onwarn(warning, warn) {
          // Privy's published PURE comments are misplaced; Rollup safely removes them.
          if (warning.code === "INVALID_ANNOTATION") return;
          warn(warning);
        },
      },
    },
  };
});
