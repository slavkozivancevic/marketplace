import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it, expect } from "vitest";

// Every ellipsis in a table hides text the reader may need, and a native
// `title` never shows on touch. So a truncated table element sits inside a
// TruncatedTooltip (hover on desktop, long press on touch), or carries a
// `truncate-ok: <reason>` comment for the few controls that are not cells,
// such as a select trigger whose open list already shows the full label.

const SRC = join(__dirname, "..");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "generated" ? [] : tsxFiles(p);
    return p.endsWith(".tsx") && !/skeleton/i.test(e.name) ? [p] : [];
  });
}

const tables = tsxFiles(SRC)
  .map((file) => ({
    rel: relative(SRC, file).split(sep).join("/"),
    text: readFileSync(file, "utf8"),
  }))
  .filter(({ text }) => /role="(cell|row|columnheader)"|<TableCell|<TableScroll/.test(text));

describe("TruncatedTooltip", () => {
  it("wraps every truncated element in a table", () => {
    const offenders: string[] = [];
    for (const { rel, text } of tables) {
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith("//") || code.startsWith("*") || code.startsWith("{/*")) return;
        if (!/className=[^>]*\b(truncate|line-clamp-\d)\b/.test(line)) return;
        // The wrapper (or the marker) is the line directly above: a tooltip on
        // the neighbouring cell must not count for this one.
        const above = lines.slice(0, i).reverse().find((l) => l.trim() !== "") ?? "";
        if (/<TruncatedTooltip\b/.test(above) || /truncate-ok:/.test(above)) return;
        offenders.push(`${rel}:${i + 1}`);
      });
    }

    expect(
      offenders,
      "Wrap the truncated element in <TruncatedTooltip content={...}>, or mark a non-cell control with {/* truncate-ok: <reason> */}",
    ).toEqual([]);
  });
});
