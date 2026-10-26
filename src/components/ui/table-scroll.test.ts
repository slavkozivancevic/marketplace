import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it, expect } from "vitest";

const SRC = join(__dirname, "..", "..");
const SELF = "components/ui/table-scroll.tsx";

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "generated" ? [] : tsxFiles(p);
    return p.endsWith(".tsx") ? [p] : [];
  });
}

const sources = tsxFiles(SRC).map((file) => ({
  rel: relative(SRC, file).split(sep).join("/"),
  text: readFileSync(file, "utf8"),
}));

describe("TableScroll", () => {
  it("is the only container that renders role=\"table\"", () => {
    const offenders = sources
      .filter(({ rel, text }) => rel !== SELF && text.includes('role="table"'))
      .map(({ rel }) => rel);

    expect(
      offenders,
      'Render tables in <TableScroll> from "@/components/ui/table-scroll" instead of a hand-written role="table" div',
    ).toEqual([]);
  });

  it("wraps every native <table>", () => {
    const offenders = sources
      .filter(({ rel, text }) => rel !== SELF && /<table[\s>]/.test(text) && !text.includes("<TableScroll"))
      .map(({ rel }) => rel);

    expect(
      offenders,
      "Wrap a native <table> in <TableScroll nativeTable> - its scrollbar is an overlay that takes no width",
    ).toEqual([]);
  });
});
