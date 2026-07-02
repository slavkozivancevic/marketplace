import { describe, it, expect } from "vitest";
import { detectDelimiter, parseCsv, csvEscape } from "./csv";

describe("detectDelimiter", () => {
  it("detects a comma-delimited header", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
  });

  it("detects a semicolon-delimited header (EU Excel)", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
  });

  it("detects a tab-delimited header", () => {
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
  });

  it("defaults to comma when there is no delimiter", () => {
    expect(detectDelimiter("singlecolumn")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("parses simple rows into cells", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a delimiter inside a quoted field", () => {
    expect(parseCsv('name,note\n"Doe, John",hi')).toEqual([
      ["name", "note"],
      ["Doe, John", "hi"],
    ]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(parseCsv('q\n"a ""b"" c"')).toEqual([["q"], ['a "b" c']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips fully empty rows", () => {
    expect(parseCsv("a\n\n\nb")).toEqual([["a"], ["b"]]);
  });

  it("respects a non-comma delimiter", () => {
    expect(parseCsv("a;b\n1;2", ";")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("csvEscape", () => {
  it("leaves a plain value unchanged", () => {
    expect(csvEscape("hello")).toBe("hello");
  });

  it("quotes a value containing the delimiter", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
  });

  it("quotes and doubles embedded quotes", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("returns an empty string unchanged", () => {
    expect(csvEscape("")).toBe("");
  });
});
