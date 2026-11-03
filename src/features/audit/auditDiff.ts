import { intlLocale } from "@/lib/i18n/dateLocale";
import { countryName } from "@/lib/i18n/countries";
import { AUDIT_MONEY_KEYS, currencyShownByMoney, formatAuditMoney } from "./auditMoney";

/**
 * Every key a `recordAudit` writer puts in a diff that a reader is shown, each
 * with a label under `admin.audit.fields.<key>` in all four locales.
 * `auditDiff.test.ts` scans the writers and fails on a key missing here, so a
 * new field cannot reach the log as a raw identifier.
 */
export const AUDIT_FIELD_KEYS = [
  "count", "fields", "from", "amount", "currency", "seller", "status", "role", "member",
  "verified", "leadTimeMinDays", "leadTimeMaxDays", "returnWindowDays", "version", "carrier",
  "tracking", "created", "totalRows", "errors", "external", "settled", "reason", "error",
  "orgName", "deletedClerkUserId", "promotedUserId", "productCount", "name", "fee", "paid",
  "codNetted", "orderCancelled", "countries", "email", "isActive", "orderId", "productId",
  "variantId", "marketId", "countryCode", "adjustment", "percentBps", "recurrence", "startsAt",
  "endsAt", "timezone", "priority", "active",
] as const;

/** Recorded, never shown: machine links and flags that only restate the row. */
export const AUDIT_INTERNAL_KEYS = new Set(["byFilter", "kind", "orgId", "fromId"]);

/** Product columns a bulk update lists in `fields` (`admin.audit.columns.<key>`). */
export const AUDIT_COLUMN_KEYS = [
  "status", "brandId", "price", "compareAtPrice", "costPrice", "taxable", "requiresShipping",
  "isDigital", "warrantyMonths", "countryOfOrigin", "stock", "categories", "tags", "translations",
] as const;

/** Enum values and reason codes shown in words (`admin.audit.values.<value>`). */
export const AUDIT_VALUE_KEYS = [
  "USER", "ADMIN", "SELLER", "OWNER", "MEMBER", "REQUESTED", "APPROVED", "REJECTED", "SHIPPED",
  "REFUNDED", "PUBLISHED", "DRAFT", "ARCHIVED", "true", "false", "PERCENT", "FIXED_PRICE",
  "AMOUNT_OFF", "NONE", "DAILY", "WEEKLY", "MONTHLY", "external_refund", "variantRemoved",
] as const;

/** Keys holding a record id: shown as the same `#last8` handle the entity column uses. */
const ID_KEYS = new Set([
  "orderId", "productId", "variantId", "marketId", "seller", "promotedUserId", "deletedClerkUserId",
]);
const DATE_KEYS = new Set(["startsAt", "endsAt"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** An id-shaped token: uuid, cuid, Clerk id. A name (with spaces) never matches. */
const ID_RE = /^[A-Za-z0-9_-]{20,}$/;

export type AuditDiffLabels = {
  field: (key: string) => string;
  column: (key: string) => string | undefined;
  value: (code: string) => string | undefined;
  /** The app locale of the reader. */
  locale: string;
};

const shortId = (s: string) => `#${s.slice(-8)}`;


function formatDate(iso: string, timeZone: unknown, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  try {
    // The rule's own zone, so "from midnight" reads as midnight where it applies.
    return d.toLocaleString(intlLocale(locale), typeof timeZone === "string" ? { ...opts, timeZone } : opts);
  } catch {
    return d.toLocaleString(intlLocale(locale), opts);
  }
}

/** One value, in words and in the reader's number and date formats. */
function formatValue(key: string, v: unknown, record: Record<string, unknown>, labels: AuditDiffLabels): string {
  const { locale } = labels;
  if (v === null || v === undefined || v === "") return "∅";
  if (AUDIT_MONEY_KEYS.has(key) && typeof v === "number") return formatAuditMoney(v, record.currency, locale);
  // A price rule's amount: one exact figure per currency.
  if (key === "amount" && typeof v === "object" && !Array.isArray(v)) {
    const parts = Object.entries(v as Record<string, unknown>)
      .filter(([, n]) => typeof n === "number")
      .map(([cur, n]) => formatAuditMoney(n as number, cur, locale));
    return parts.length ? parts.join(" / ") : "∅";
  }
  if (key === "percentBps" && typeof v === "number") {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "percent",
      maximumFractionDigits: 2,
      signDisplay: "exceptZero",
    }).format(v / 10000);
  }
  if (DATE_KEYS.has(key) && typeof v === "string") return formatDate(v, record.timezone, locale);
  if (key === "countryCode" && typeof v === "string") return countryName(v, locale);
  if (key === "countries" && typeof v === "string") {
    return v
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => (/^[A-Z]{2}$/.test(c) ? countryName(c, locale) : c))
      .join(", ");
  }
  if (Array.isArray(v)) return v.map((x) => labels.column(String(x)) ?? String(x)).join(", ");
  if (typeof v === "number") {
    return new Intl.NumberFormat(intlLocale(locale), { useGrouping: "always" }).format(v);
  }
  const s = String(v);
  const word = labels.value(s);
  if (word) return word;
  if (UUID_RE.test(s) || (ID_KEYS.has(key) && ID_RE.test(s))) return shortId(s);
  return s;
}

/**
 * The audit log's details column: every field labelled, every value in words
 * and in the reader's formats - money with its currency, percentages, dates in
 * the rule's own zone, countries by name, ids as `#last8`, "from -> to" pairs.
 * Null when there is nothing to show.
 */
export function renderAuditDiff(diff: unknown, labels: AuditDiffLabels): string | null {
  if (!diff || typeof diff !== "object") return null;
  const record = diff as Record<string, unknown>;
  // Money already shows its currency; a separate "Currency: rsd" would repeat it.
  const hideCurrency = currencyShownByMoney(record);
  // An empty value says nothing on its own ("Variant: none" on every rule for
  // all variants); inside a "from -> to" pair it does, and is kept there.
  const entries = Object.entries(record).filter(
    ([k, v]) =>
      !AUDIT_INTERNAL_KEYS.has(k) && !(hideCurrency && k === "currency") && v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) return null;
  return entries
    .map(([k, v]) => {
      if (v && typeof v === "object" && !Array.isArray(v) && "from" in v && "to" in v) {
        const o = v as { from: unknown; to: unknown };
        return `${labels.field(k)}: ${formatValue(k, o.from, record, labels)} → ${formatValue(k, o.to, record, labels)}`;
      }
      return `${labels.field(k)}: ${formatValue(k, v, record, labels)}`;
    })
    .join("  ·  ");
}
