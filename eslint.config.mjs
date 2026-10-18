import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
      The Solidity workspace is not Next: it has its own Hardhat tooling and a
      vendored OpenZeppelin checkout under `contracts/lib`. Linting that tree at
      the app's rules produced several hundred errors in other people's test
      files, which drowned the handful that belong to this repository.
    */
    "contracts/**",
  ]),
]);

export default eslintConfig;
