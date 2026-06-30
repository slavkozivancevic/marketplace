// Shared CSV helpers for the product bulk-import and translations-import panels.
// One RFC 4180-compatible parser + delimiter sniffing + field escaping, so both
// flows behave identically (incl. EU-Excel `;` / tab files).

// Columns of the Translations CSV (separate from the main product template).
// Lives here (not in the "use server" actions file, which may only export async
// functions) so both the server export and the client panel can share it.
export const TRANSLATION_CSV_COLUMNS = [
  "productRef",
  "locale",
  "title",
  "slug",
  "shortDescription",
  "description",
  "metaTitle",
  "metaDescription",
] as const;

/**
 * Sniffs the field delimiter from the header row. Excel saved under a European
 * locale uses `;` (and German/French Excel may even use a tab), which would
 * otherwise collapse the whole file into one column. We pick whichever of
 * `, ; \t` appears most in the first line, defaulting to comma.
 */
export function detectDelimiter(raw: string): "," | ";" | "\t" {
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? "";
  const candidates: Array<"," | ";" | "\t"> = [",", ";", "\t"];
  let best: "," | ";" | "\t" = ",";
  let bestCount = 0;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** RFC 4180-compatible CSV parser (handles quoted fields, escaped quotes, CRLF). */
export function parseCsv(raw: string, delimiter: string = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        row.push(cell);
        cell = "";
        i++;
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && raw[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c !== "")) rows.push(row);
  }

  return rows;
}

/** Quotes a CSV field when it contains a comma, quote, or newline. */
export function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
