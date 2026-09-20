import { describe, expect, it } from "vitest";
import { copyIdentifier } from "./copyIdentifier";

// A fixed clock keeps the suffix deterministic: 1_700_000_000_000 -> "mdx7k2ab"
// in base36, the same 8 characters Date.now() produces today.
const NOW = 1_700_000_000_000;
const SUFFIX = `-copy-${NOW.toString(36)}`;

describe("copyIdentifier", () => {
  it("appends the marker and a base36 timestamp", () => {
    expect(copyIdentifier("patike-nike", undefined, NOW)).toBe(`patike-nike${SUFFIX}`);
  });

  it("replaces an existing copy suffix instead of stacking another", () => {
    const once = copyIdentifier("patike-nike", undefined, NOW);
    const twice = copyIdentifier(once, undefined, NOW + 1);
    expect(twice).toBe(`patike-nike-copy-${(NOW + 1).toString(36)}`);
    expect(twice.match(/-copy-/g)).toHaveLength(1);
  });

  it("strips an uppercase suffix too, so coupon codes do not stack", () => {
    const once = copyIdentifier("SAVE10", undefined, NOW).toUpperCase();
    expect(once).toBe(`SAVE10${SUFFIX}`.toUpperCase());
    expect(copyIdentifier(once, undefined, NOW + 1).match(/-copy-/gi)).toHaveLength(1);
  });

  it("keeps the whole timestamp, so two copies minutes apart differ", () => {
    // The old 4-character suffix repeated every 36^4 ms (~28 minutes).
    const cycle = 36 ** 4;
    expect(copyIdentifier("save10", undefined, NOW)).not.toBe(
      copyIdentifier("save10", undefined, NOW + cycle),
    );
  });

  it("clips the base so the result fits maxLength", () => {
    const long = "a".repeat(200);
    const result = copyIdentifier(long, 40, NOW);
    expect(result).toHaveLength(40);
    expect(result.endsWith(SUFFIX)).toBe(true);
  });

  it("does not leave a dangling dash where it clipped", () => {
    // Clipped exactly after "black-": the trailing dash would read "--copy-".
    const result = copyIdentifier("black-friday", `black-${SUFFIX}`.length, NOW);
    expect(result).toBe(`black${SUFFIX}`);
  });

  it("a chain of copies stays inside maxLength", () => {
    let code = "B".repeat(26);
    for (let i = 0; i < 20; i++) {
      code = copyIdentifier(code, 40, NOW + i).toUpperCase();
      expect(code.length).toBeLessThanOrEqual(40);
    }
    // The base survived the whole chain rather than being eaten by suffixes.
    expect(code.startsWith("B".repeat(26))).toBe(true);
  });

  it("never returns an empty base for a value that is only a suffix", () => {
    expect(copyIdentifier(SUFFIX, undefined, NOW + 1)).toBe(
      `${SUFFIX}-copy-${(NOW + 1).toString(36)}`,
    );
  });
});
