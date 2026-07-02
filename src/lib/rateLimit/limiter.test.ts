import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimit } from "./limiter";

// The limiter store is module-global and persists across tests, so every test
// uses a unique key to stay isolated.
afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit", () => {
    const key = "unit:allow";
    expect(checkRateLimit(key, 3, 1000).success).toBe(true);
    expect(checkRateLimit(key, 3, 1000).success).toBe(true);
    expect(checkRateLimit(key, 3, 1000).success).toBe(true);
  });

  it("blocks the request that exceeds the limit", () => {
    const key = "unit:block";
    for (let i = 0; i < 2; i++) checkRateLimit(key, 2, 1000);
    const res = checkRateLimit(key, 2, 1000);
    expect(res.success).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.retryAfterSec).toBeGreaterThan(0);
  });

  it("decrements the remaining allowance", () => {
    const key = "unit:remaining";
    expect(checkRateLimit(key, 5, 1000).remaining).toBe(4);
    expect(checkRateLimit(key, 5, 1000).remaining).toBe(3);
  });

  it("opens a fresh window after the previous one elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const key = "unit:reset";

    checkRateLimit(key, 1, 1000);
    expect(checkRateLimit(key, 1, 1000).success).toBe(false);

    vi.setSystemTime(1001);
    expect(checkRateLimit(key, 1, 1000).success).toBe(true);
  });
});
