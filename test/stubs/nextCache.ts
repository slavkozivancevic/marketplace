// No-op stub for `next/cache`, aliased in vitest.integration.config.ts.
// Integration tests exercise db logic against a real Postgres; the Next cache
// primitives have no request/render context to run in, so they're stubbed out.

export function revalidatePath(): void {}
export function revalidateTag(): void {}
export function cacheTag(): void {}
export function cacheLife(): void {}
export function unstable_noStore(): void {}
export function unstable_cache<T extends (...args: unknown[]) => unknown>(fn: T): T {
  return fn;
}
