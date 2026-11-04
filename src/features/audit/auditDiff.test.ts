import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import en from "../../../messages/en.json";
import sr from "../../../messages/sr.json";
import de from "../../../messages/de.json";
import es from "../../../messages/es.json";
import {
  AUDIT_COLUMN_KEYS,
  AUDIT_FIELD_KEYS,
  AUDIT_INTERNAL_KEYS,
  AUDIT_VALUE_KEYS,
  renderAuditDiff,
  type AuditDiffLabels,
} from "./auditDiff";

type Audit = { fields: Record<string, string>; columns: Record<string, string>; values: Record<string, string> };
const LOCALES = { en, sr, de, es } as unknown as Record<string, { admin: { audit: Audit } }>;

const labelsFor = (locale: "en" | "sr"): AuditDiffLabels => {
  const a = LOCALES[locale].admin.audit;
  return {
    field: (k) => a.fields[k] ?? k,
    column: (k) => a.columns[k],
    value: (c) => a.values[c],
    locale,
  };
};
// Intl puts no-break spaces in some formats; compare on plain spaces.
const plain = (s: string | null) => (s ?? "").replace(/[  ]/g, " ");

/** Top-level keys of every `diff: { ... }` literal passed to recordAudit in src. */
function writerKeys(): Set<string> {
  const keys = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "generated") walk(p);
        continue;
      }
      if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name)) continue;
      const src = fs.readFileSync(p, "utf8");
      if (!src.includes("recordAudit(")) continue;
      for (const m of src.matchAll(/\bdiff:\s*\{/g)) {
        let depth = 0;
        let flat = "";
        for (let i = m.index! + m[0].length - 1; i < src.length; i++) {
          const ch = src[i];
          if ("{[(".includes(ch)) depth++;
          if (depth === 1 && ch !== "{") flat += ch;
          if ("}])".includes(ch)) depth--;
          if (depth === 0) break;
        }
        for (const part of flat.split(",")) {
          const k = part.trim().match(/^([A-Za-z_$][\w$]*)\s*(:|$)/)?.[1];
          if (k) keys.add(k);
        }
      }
    }
  };
  walk(path.resolve(__dirname, "../.."));
  return keys;
}

describe("audit log labels never drift", () => {
  it("has a label for every key a recordAudit writer puts in a diff", () => {
    const known = new Set<string>([...AUDIT_FIELD_KEYS, ...AUDIT_INTERNAL_KEYS]);
    const missing = [...writerKeys()].filter((k) => !known.has(k));
    expect(missing).toEqual([]);
  });

  it("translates every field, column and value in all four locales", () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const a = messages.admin.audit;
      const missing = [
        ...AUDIT_FIELD_KEYS.filter((k) => typeof a.fields[k] !== "string").map((k) => `fields.${k}`),
        ...AUDIT_COLUMN_KEYS.filter((k) => typeof a.columns[k] !== "string").map((k) => `columns.${k}`),
        ...AUDIT_VALUE_KEYS.filter((k) => typeof a.values[k] !== "string").map((k) => `values.${k}`),
      ];
      expect({ locale, missing }).toEqual({ locale, missing: [] });
    }
  });
});

describe("renderAuditDiff - what the details column says", () => {
  const sr_ = labelsFor("sr");

  it("COD paid: the commission in words and as money", () => {
    expect(plain(renderAuditDiff({ seller: "Slavko's Shop", fee: 199959, currency: "rsd" }, sr_))).toBe(
      "Prodavac: Slavko's Shop  ·  Provizija: 1.999,59 RSD",
    );
  });

  it("an older entry without a currency still reads as an amount, never the raw integer", () => {
    expect(plain(renderAuditDiff({ fee: 199959 }, sr_))).toBe("Provizija: 1.999,59");
  });

  it("an ordinary payout says nothing about COD netting", () => {
    expect(plain(renderAuditDiff({ amount: 541339, currency: "rsd", codNetted: 0 }, sr_))).toBe("Iznos: 5.413,39 RSD");
  });

  it("payout that collected a COD debt says so in words", () => {
    expect(plain(renderAuditDiff({ amount: 95968, currency: "rsd", codNetted: 199959 }, sr_))).toBe(
      "Iznos: 959,68 RSD  ·  Naplaćen COD dug: 1.999,59 RSD",
    );
  });

  it("payout with a COD credit", () => {
    expect(plain(renderAuditDiff({ amount: 4690965, currency: "rsd", codNetted: -4413223 }, sr_))).toBe(
      "Iznos: 46.909,65 RSD  ·  Isplaćen dug platforme: 44.132,23 RSD",
    );
  });

  it("price rule: percent, enums, dates in the rule's zone, ids short", () => {
    const out = plain(
      renderAuditDiff(
        {
          productId: "3f1c2a9e-1111-2222-3333-444455556666",
          kind: "SCHEDULE",
          name: "Black Friday",
          variantId: null,
          adjustment: "PERCENT",
          percentBps: -3000,
          amount: null,
          recurrence: "NONE",
          startsAt: "2026-11-26T23:00:00.000Z",
          endsAt: "2026-11-30T23:00:00.000Z",
          timezone: "Europe/Belgrade",
          priority: 10,
          active: true,
        },
        sr_,
      ),
    );
    expect(out).toContain("Proizvod: #55556666");
    expect(out).toContain("Promena cene: Procenat");
    expect(out).toContain("Procenat: -30");
    expect(out).toContain("Ponavljanje: Jednom");
    expect(out).toContain("Početak: 27. 11. 2026. 00:00");
    expect(out).not.toContain("∅");
    expect(out).toContain("Aktivno: Da");
    expect(out).not.toContain("SCHEDULE");
  });

  it("a fixed amount per currency, and a market rule's country by name", () => {
    const out = plain(
      renderAuditDiff({ adjustment: "AMOUNT_OFF", amount: { usd: 1000, rsd: 118000 }, countryCode: "DE" }, labelsFor("en")),
    );
    expect(out).toContain("$10.00");
    expect(out).toContain("RSD 1,180.00");
    expect(out).toContain("Country: Germany");
    expect(out).toContain("Price change: Amount off");
  });

  it("countries by name, bulk columns and reason codes in words", () => {
    const en_ = labelsFor("en");
    expect(plain(renderAuditDiff({ name: "Nordics", countries: "SE, NO" }, en_))).toBe(
      "Name: Nordics  ·  Countries: Sweden, Norway",
    );
    expect(plain(renderAuditDiff({ count: 1250, fields: ["tags", "translations"] }, en_))).toBe(
      "Count: 1,250  ·  Fields: Tags, Translations",
    );
    expect(plain(renderAuditDiff({ reason: "external_refund" }, en_))).toBe("Reason: Refunded outside the app");
  });
});
