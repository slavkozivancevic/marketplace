import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";

/**
 * `assertActionOrg` leans on a Next internal: the request store's `phase` is
 * 'action' while a Server Action runs and 'render' for the page render Next
 * does after it in the same request. If an upgrade renames or drops either,
 * the check would either refuse that render again (the tab shows "Something
 * went wrong") or never run at all - silently. This fails first.
 */
const actionHandler = fs.readFileSync(
  path.join(process.cwd(), "node_modules/next/dist/server/app-render/action-handler.js"),
  "utf8",
);

describe("Next Server Action phases (assertActionOrg depends on them)", () => {
  it("still exports the work unit store from the external module", () => {
    expect(typeof workUnitAsyncStorage.getStore).toBe("function");
  });

  it("still runs the action in phase 'action' and the page render after it in phase 'render'", () => {
    expect(actionHandler).toContain("requestStore.phase = 'action'");
    expect(actionHandler).toContain("requestStore.phase = 'render'");
  });
});
