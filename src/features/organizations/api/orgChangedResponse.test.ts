import { describe, it, expect } from "vitest";
import { orgChangedResponse } from "./orgChangedResponse";
import { ACTIVE_ORG_HEADER, ORG_CHANGED } from "../orgScope";

const req = (org?: string) =>
  new Request("https://example.test/api/dashboard/my-products", {
    headers: org ? { [ACTIVE_ORG_HEADER]: org } : {},
  });

describe("orgChangedResponse", () => {
  it("serves a client that sends no org, as before the contract", () => {
    expect(orgChangedResponse(req(), { organizationId: "org_a" })).toBeNull();
  });

  it("serves a client showing the org the request resolves to", () => {
    expect(orgChangedResponse(req("org_a"), { organizationId: "org_a" })).toBeNull();
  });

  it("refuses a client still showing another org, without naming the new one", async () => {
    const res = orgChangedResponse(req("org_a"), { organizationId: "org_b" });
    expect(res?.status).toBe(409);
    expect(await res?.json()).toEqual({ code: ORG_CHANGED });
  });
});
