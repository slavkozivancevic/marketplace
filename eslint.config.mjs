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
    "public/**",
    // SST infra config (not app source; also excluded in tsconfig). Its required
    // triple-slash reference to the generated ambient globals can't be an import.
    "sst.config.ts",
    ".sst/**",
    // Generated build/type artifacts - not linted.
    ".open-next/**",
    "sst-env.d.ts",
  ]),
]);

export default eslintConfig;
