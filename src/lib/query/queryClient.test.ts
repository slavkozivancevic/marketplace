import { describe, it, expect } from "vitest";
import { makeQueryClient } from "./queryClient";
import { OrgChangedError, isOrgChangedError } from "@/features/organizations/orgScope";

const retry = makeQueryClient().getDefaultOptions().queries?.retry as (
  failureCount: number,
  error: Error,
) => boolean;

describe("query retry", () => {
  it("retries an ordinary failure once", () => {
    expect(retry(0, new Error("network"))).toBe(true);
    expect(retry(1, new Error("network"))).toBe(false);
  });

  it("never retries ORG_CHANGED: the same stale org would only earn another 409", () => {
    expect(retry(0, new OrgChangedError())).toBe(false);
  });
});

describe("isOrgChangedError", () => {
  it("tells the org change apart from any other error", () => {
    expect(isOrgChangedError(new OrgChangedError())).toBe(true);
    expect(isOrgChangedError(new Error("ORG_CHANGED"))).toBe(false);
    expect(isOrgChangedError(undefined)).toBe(false);
  });
});
