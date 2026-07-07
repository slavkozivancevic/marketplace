/**
 * OpenNext config (consumed by `@opennextjs/aws`, which SST's Nextjs component
 * runs at deploy - see `openNextVersion` in sst.config.ts).
 *
 * Why this file exists: the app processes uploaded product images with `sharp`
 * (a native module) inside the Next.js *server* Lambda. OpenNext only installs
 * sharp into the *image optimization* function by default, never the server
 * one, and `sharp` is in `serverExternalPackages` (next.config.ts) so Next
 * leaves it out of the bundle. The result: `await import("sharp")` in
 * src/services/imageProcessor.ts throws "Cannot find module 'sharp'" at runtime
 * and every /api/uploads/<type>/process call 400s.
 *
 * `default.install` forces a Lambda-compatible sharp into the server function
 * bundle at build time. Target must match the deployed server Lambda:
 *   - architecture x86_64  -> arch "x64"   (SST default; not overridden in sst.config.ts)
 *   - runtime nodejs24.x on Amazon Linux 2023 -> libc "glibc"
 * Keep the pinned version in sync with `sharp` in package.json.
 *
 * Written untyped on purpose: `@opennextjs/aws` is not a project dependency
 * (SST fetches it via npx at deploy), so importing its `OpenNextConfig` type
 * would break `tsc`/`next build`. OpenNext compiles this file itself.
 */
const config = {
  default: {
    install: {
      packages: ["sharp@0.34.5"],
      arch: "x64",
      libc: "glibc",
    },
  },
};

export default config;
