import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { DONE, GATE_SCRIPT, MARK } from "./hydrationGate";

/**
 * Guards HistoryHydrationGate: a Back/Forward that arrives before the streamed
 * app hydrates must become a full load. A header without its marker compiles
 * and renders fine - the gate just opens before that header has hydrated, and
 * the hydration error is back.
 */

const SRC = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("hydration gate wiring", () => {
  it("every layout header carries a HydrationMark (headers hydrate after the providers around them)", () => {
    const dir = join(SRC, "components", "layout");
    const missing = readdirSync(dir)
      .filter((f) => /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f))
      .filter((f) => /<header[\s>]/.test(readFileSync(join(dir, f), "utf8")))
      .filter((f) => !readFileSync(join(dir, f), "utf8").includes("<HydrationMark />"));
    expect(missing, "Add <HydrationMark /> inside the <header> - see src/lib/navigation/hydrationGate.tsx").toEqual([]);
  });

  it("the providers inside the streamed boundary carry one", () => {
    expect(read("providers/providers.tsx")).toContain("<HydrationMark />");
  });

  it("the locale root layout runs the gate", () => {
    expect(read("app/(i18n)/[locale]/layout.tsx")).toContain("<HistoryHydrationGate />");
  });
});

/** Runs the parser-run script against a fake window and fires one popstate. */
function popstate({ marks, from, to }: { marks: boolean[]; from: string; to: string }) {
  const location = { pathname: from, search: "", reload: vi.fn() };
  let listener: ((e: { stopImmediatePropagation: () => void }) => void) | null = null;
  let capture = false;
  const addEventListener = (type: string, fn: typeof listener, useCapture: boolean) => {
    if (type === "popstate") {
      listener = fn;
      capture = useCapture;
    }
  };
  const document = {
    querySelectorAll: (sel: string) => {
      expect(sel).toBe(`[${MARK}]`);
      return marks.map((done) => ({ hasAttribute: (a: string) => a === DONE && done }));
    },
  };
  new Function("location", "addEventListener", "document", GATE_SCRIPT)(location, addEventListener, document);

  location.pathname = to;
  const event = { stopImmediatePropagation: vi.fn() };
  listener!(event);
  return { capture, reloaded: location.reload.mock.calls.length > 0, stopped: event.stopImmediatePropagation.mock.calls.length > 0 };
}

describe("hydration gate script", () => {
  it("listens in the capture phase, so it runs before Next's own popstate listener", () => {
    expect(popstate({ marks: [true], from: "/sr/korpa", to: "/sr" }).capture).toBe(true);
  });

  it("loads the page when a marker has not hydrated yet", () => {
    expect(popstate({ marks: [true, false], from: "/sr/korpa", to: "/sr" })).toMatchObject({ reloaded: true, stopped: true });
  });

  it("loads the page when the boundary has not even streamed in (no marker at all)", () => {
    expect(popstate({ marks: [], from: "/sr/korpa", to: "/sr" })).toMatchObject({ reloaded: true, stopped: true });
  });

  it("steps aside once every marker has hydrated", () => {
    expect(popstate({ marks: [true, true], from: "/sr/korpa", to: "/sr" })).toMatchObject({ reloaded: false, stopped: false });
  });

  it("lets a hash change through - the document's path did not move", () => {
    expect(popstate({ marks: [false], from: "/sr/korpa", to: "/sr/korpa" })).toMatchObject({ reloaded: false, stopped: false });
  });
});
