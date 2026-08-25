import { describe, it, expect } from "vitest";
import { isAfterIdleGap, COLD_GAP_MS } from "./idleGap";

/**
 * This heuristic decides whether a slow query gets reported as a performance
 * problem or as the cost of waking Neon's suspended compute. Getting it wrong
 * in either direction is expensive: too eager and real regressions are
 * dismissed as cold starts, too lax and the slow-query signal fills with noise
 * again.
 */
describe("isAfterIdleGap", () => {
  const now = 1_000_000;

  it("treats a fresh process as cold - there is no previous query to compare to", () => {
    expect(isAfterIdleGap(undefined, now)).toBe(true);
  });

  it("is warm while queries keep flowing", () => {
    expect(isAfterIdleGap(now - 1_000, now)).toBe(false);
  });

  it("is cold once the gap exceeds the threshold", () => {
    expect(isAfterIdleGap(now - (COLD_GAP_MS + 1), now)).toBe(true);
  });

  it("is warm exactly at the threshold - the comparison is strict", () => {
    expect(isAfterIdleGap(now - COLD_GAP_MS, now)).toBe(false);
  });

  it("sits well inside Neon's 5-minute suspend window", () => {
    // If the gap ever grew past the suspend timeout, a genuinely suspended
    // database would be reported as a slow query and the split would silently
    // stop working.
    expect(COLD_GAP_MS).toBeLessThan(5 * 60_000);
  });

  it("accepts an explicit gap so the rule can be tuned without touching callers", () => {
    expect(isAfterIdleGap(now - 500, now, 100)).toBe(true);
    expect(isAfterIdleGap(now - 50, now, 100)).toBe(false);
  });
});