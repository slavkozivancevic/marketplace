/**
 * Shared encoding for catalog attribute facet selections in the URL.
 *
 * All attribute filters live in a single `attrs` query param so the public
 * products page can keep a static nuqs schema (no dynamic keys) and the API can
 * parse the same string without needing to look up attribute types.
 *
 * Wire format - segments joined by `;`, each `key=payload`:
 *   - option:  `color=red,blue`         (comma-separated option values)
 *   - range:   `screen-size=13~16`      (`min~max`, either side may be empty)
 *   - boolean: `wireless=*`             (presence means "true")
 *
 * Attribute keys and option values are slugs (no `;`, `=`, `,`, `~`), so the
 * format stays unambiguous without escaping.
 */

export type AttributeFilter =
  | { key: string; kind: "option"; values: string[] }
  | { key: string; kind: "range"; min: number | null; max: number | null }
  | { key: string; kind: "bool" };

export function parseAttrs(raw: string | null | undefined): AttributeFilter[] {
  if (!raw) return [];
  const out: AttributeFilter[] = [];
  for (const seg of raw.split(";")) {
    if (!seg) continue;
    const eq = seg.indexOf("=");
    if (eq <= 0) continue;
    const key = seg.slice(0, eq);
    const payload = seg.slice(eq + 1);
    if (payload === "*") {
      out.push({ key, kind: "bool" });
    } else if (payload.includes("~")) {
      const [minStr, maxStr] = payload.split("~");
      const min = minStr === "" ? null : Number(minStr);
      const max = maxStr === "" ? null : Number(maxStr);
      out.push({
        key,
        kind: "range",
        min: min != null && !Number.isNaN(min) ? min : null,
        max: max != null && !Number.isNaN(max) ? max : null,
      });
    } else {
      const values = payload.split(",").map((v) => v.trim()).filter(Boolean);
      if (values.length) out.push({ key, kind: "option", values });
    }
  }
  return out;
}

export function serializeAttrs(filters: AttributeFilter[]): string {
  const segs: string[] = [];
  for (const f of filters) {
    if (f.kind === "option") {
      if (f.values.length) segs.push(`${f.key}=${f.values.join(",")}`);
    } else if (f.kind === "range") {
      if (f.min != null || f.max != null) {
        segs.push(`${f.key}=${f.min ?? ""}~${f.max ?? ""}`);
      }
    } else {
      segs.push(`${f.key}=*`);
    }
  }
  return segs.join(";");
}

/** Convenience lookups used by the facet sidebar to reflect current state. */
export function findOptionFilter(
  filters: AttributeFilter[],
  key: string,
): string[] {
  const f = filters.find((x) => x.key === key && x.kind === "option");
  return f && f.kind === "option" ? f.values : [];
}

export function findRangeFilter(
  filters: AttributeFilter[],
  key: string,
): [number | null, number | null] {
  const f = filters.find((x) => x.key === key && x.kind === "range");
  return f && f.kind === "range" ? [f.min, f.max] : [null, null];
}

export function hasBoolFilter(
  filters: AttributeFilter[],
  key: string,
): boolean {
  return filters.some((x) => x.key === key && x.kind === "bool");
}

/** Immutably upsert/remove a single attribute's selection in the list. */
export function setOptionFilter(
  filters: AttributeFilter[],
  key: string,
  values: string[],
): AttributeFilter[] {
  const rest = filters.filter((f) => f.key !== key);
  return values.length ? [...rest, { key, kind: "option", values }] : rest;
}

export function setRangeFilter(
  filters: AttributeFilter[],
  key: string,
  min: number | null,
  max: number | null,
): AttributeFilter[] {
  const rest = filters.filter((f) => f.key !== key);
  return min != null || max != null
    ? [...rest, { key, kind: "range", min, max }]
    : rest;
}

export function setBoolFilter(
  filters: AttributeFilter[],
  key: string,
  on: boolean,
): AttributeFilter[] {
  const rest = filters.filter((f) => f.key !== key);
  return on ? [...rest, { key, kind: "bool" }] : rest;
}
