import { z } from "zod/v4";
import { moneyInputSchema } from "@/lib/money-input";
import { normalizeCountryCode } from "@/lib/i18n/countries";
import type { MoneySet } from "@/lib/money";
import {
  isValidTimeZone,
  parseCivilDate,
  parseMinuteOfDay,
  zonedToUtc,
} from "../engine/timezone";

/**
 * These mirror the Prisma enums of the same names. The engine works on its own
 * string types so it stays pure and testable without the generated client.
 */
export const PRICE_RULE_KINDS = ["SCHEDULE", "REGION"] as const;
export type PriceRuleKind = (typeof PRICE_RULE_KINDS)[number];

export const PRICE_ADJUSTMENT_TYPES = ["PERCENT", "FIXED_PRICE", "AMOUNT_OFF"] as const;
export type PriceAdjustmentType = (typeof PRICE_ADJUSTMENT_TYPES)[number];

export const PRICE_RECURRENCES = ["NONE", "DAILY", "WEEKLY", "MONTHLY"] as const;
export type PriceRecurrence = (typeof PRICE_RECURRENCES)[number];

/** Which picker a market rule's form shows. Form-only: the row stores one of the two ids. */
export const PRICE_REGION_SCOPES = ["MARKET", "COUNTRY"] as const;
export type PriceRegionScope = (typeof PRICE_REGION_SCOPES)[number];

/**
 * Limits. Exported because the db layer checks them again: a write that skips
 * the form must not skip the limit, and both sides must read the same number.
 */
/** Rules per product, product-level and variant-level together. */
export const PRICE_RULES_PER_PRODUCT_MAX = 20;
/** Shortest window a rule may produce. Nothing finer than daily recurs. */
export const PRICE_WINDOW_MIN_MINUTES = 60;
/** Longest single occurrence of a recurring rule, so occurrences never overlap. */
export const PRICE_OCCURRENCE_MAX_MINUTES = 24 * 60;
/** How far ahead windows are materialised. */
export const PRICE_WINDOW_HORIZON_DAYS = 90;
/** How far back the Omnibus "was" price looks. */
export const PRICE_REFERENCE_LOOKBACK_DAYS = 30;
export const PRICE_RULE_NAME_MAX_LENGTH = 80;
export const PRICE_RULE_PRIORITY_MAX = 1000;

/**
 * A percent rule stores signed basis points: -2000 is 20% off, +1000 is a 10%
 * markup. Basis points keep 12.5% expressible in integer math. A rule can never
 * take 100% or more off, which would make the price zero or negative.
 */
export const PRICE_PERCENT_BPS_MIN = -9999;
export const PRICE_PERCENT_BPS_MAX = 10000;

/**
 * A rule as the engine sees it: already validated, already in UTC.
 *
 * For `NONE` the window is `[startsAt, endsAt)`. For a recurring rule
 * `startsAt` / `endsAt` bound the series (`endsAt` null = no end) and each
 * occurrence starts at `startMinute` local time in `timezone` and lasts
 * `durationMinutes` of wall-clock time.
 */
export type EngineRule = {
  id: string;
  productId: string;
  variantId: string | null;
  kind: PriceRuleKind;
  name: string;
  adjustment: PriceAdjustmentType;
  percentBps: number | null;
  amountMoney: MoneySet | null;
  priority: number;
  active: boolean;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  recurrence: PriceRecurrence;
  startMinute: number | null;
  durationMinutes: number | null;
  /** ISO weekdays, 1 = Monday. WEEKLY only. */
  weekdays: number[];
  /** 1-31. MONTHLY only; months without that day are skipped. */
  monthDay: number | null;
  createdAt: Date;
  /** REGION targeting, from Phase 4. Null on schedule rules. */
  countryCode?: string | null;
  marketId?: string | null;
};

/**
 * The seller's rule form.
 *
 * Like the coupon form, every field always exists and only the ones the current
 * `adjustment` and `recurrence` use are validated, so switching a select keeps
 * what was typed in the other fields.
 *
 * Times are LOCAL to `timezone` ("2026-12-24" + "18:00"); the server converts
 * them with `zonedToUtc`, never the browser. For `NONE`, start and end are the
 * window. For a recurring rule, `startDate` / `endDate` bound the series,
 * `startTime` is when each occurrence begins and `durationMinutes` how long it
 * lasts.
 *
 * A market (`REGION`) rule has no schedule - it applies while active - so its
 * time fields are carried but never validated; it targets either a market or
 * one country, as `regionScope` says.
 */
export const priceRuleSchema = z
  .object({
    kind: z.enum(PRICE_RULE_KINDS),
    regionScope: z.enum(PRICE_REGION_SCOPES),
    marketId: z.string().nullable(),
    countryCode: z.string().nullable(),
    name: z.string().trim().min(1).max(PRICE_RULE_NAME_MAX_LENGTH),
    variantId: z.string().nullable(),
    adjustment: z.enum(PRICE_ADJUSTMENT_TYPES),
    percentBps: z.number().int(),
    amount: moneyInputSchema,
    priority: z.number().int().min(0).max(PRICE_RULE_PRIORITY_MAX),
    active: z.boolean(),
    timezone: z.string(),
    recurrence: z.enum(PRICE_RECURRENCES),
    startDate: z.string(),
    startTime: z.string(),
    endDate: z.string().nullable(),
    endTime: z.string().nullable(),
    durationMinutes: z.number().int().nullable(),
    weekdays: z.array(z.number().int().min(1).max(7)),
    monthDay: z.number().int().nullable(),
  })
  // Localized via the Zod error map - custom issues carry `params.i18n`.
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], i18n: string, extra?: object) =>
      ctx.addIssue({ code: "custom", path, params: { i18n, ...extra } });

    if (v.adjustment === "PERCENT") {
      if (
        v.percentBps === 0 ||
        v.percentBps < PRICE_PERCENT_BPS_MIN ||
        v.percentBps > PRICE_PERCENT_BPS_MAX
      ) {
        issue(["percentBps"], "priceRulePercentRange");
      }
    } else if (v.amount.amount <= 0) {
      issue(["amount", "amount"], "priceRuleAmountPositive");
    }

    if (v.kind === "REGION") {
      if (v.regionScope === "MARKET" && !v.marketId) {
        issue(["marketId"], "priceRuleMarketRequired");
      }
      if (v.regionScope === "COUNTRY" && (v.countryCode === null || normalizeCountryCode(v.countryCode) !== v.countryCode)) {
        issue(["countryCode"], "priceRuleCountryRequired");
      }
      return;
    }

    const timezoneOk = isValidTimeZone(v.timezone);
    if (!timezoneOk) issue(["timezone"], "priceRuleTimezoneInvalid");

    const startDate = parseCivilDate(v.startDate);
    const startMinute = parseMinuteOfDay(v.startTime);
    if (!startDate) issue(["startDate"], "invalid");
    if (startMinute === null) issue(["startTime"], "invalid");

    if (v.recurrence === "NONE") {
      if (v.endDate === null || v.endTime === null) {
        issue(["endDate"], "priceRuleEndRequired");
        return;
      }
      const endDate = parseCivilDate(v.endDate);
      const endMinute = parseMinuteOfDay(v.endTime);
      if (!endDate) issue(["endDate"], "invalid");
      if (endMinute === null) issue(["endTime"], "invalid");
      if (!timezoneOk || !startDate || startMinute === null || !endDate || endMinute === null) {
        return;
      }
      const start = zonedToUtc(startDate, startMinute, v.timezone).getTime();
      const end = zonedToUtc(endDate, endMinute, v.timezone).getTime();
      if (end <= start) {
        issue(["endDate"], "priceRuleEndBeforeStart");
      } else if (end - start < PRICE_WINDOW_MIN_MINUTES * 60_000) {
        issue(["endTime"], "priceRuleWindowTooShort", { minutes: PRICE_WINDOW_MIN_MINUTES });
      }
      return;
    }

    if (
      v.durationMinutes === null ||
      v.durationMinutes < PRICE_WINDOW_MIN_MINUTES ||
      v.durationMinutes > PRICE_OCCURRENCE_MAX_MINUTES
    ) {
      issue(["durationMinutes"], "priceRuleDurationRange", {
        min: PRICE_WINDOW_MIN_MINUTES,
        max: PRICE_OCCURRENCE_MAX_MINUTES,
      });
    }
    if (v.recurrence === "WEEKLY" && v.weekdays.length === 0) {
      issue(["weekdays"], "priceRuleWeekdaysRequired");
    }
    if (v.recurrence === "MONTHLY" && (v.monthDay === null || v.monthDay < 1 || v.monthDay > 31)) {
      issue(["monthDay"], "priceRuleMonthDayRange");
    }
    if (v.endDate !== null) {
      const endDate = parseCivilDate(v.endDate);
      if (!endDate) {
        issue(["endDate"], "invalid");
      } else if (startDate && v.endDate < v.startDate) {
        issue(["endDate"], "priceRuleEndBeforeStart");
      }
    }
  });

export type PriceRuleInput = z.infer<typeof priceRuleSchema>;

/**
 * The UTC bounds a validated input stores as `startsAt` / `endsAt`.
 *
 * A recurring series ends at the END of its last day, so "until 2026-12-31"
 * still includes an occurrence that starts that evening.
 */
export function ruleBoundsUtc(input: PriceRuleInput): { startsAt: Date; endsAt: Date | null } {
  const startDate = parseCivilDate(input.startDate)!;
  const startMinute = parseMinuteOfDay(input.startTime)!;
  if (input.recurrence === "NONE") {
    return {
      startsAt: zonedToUtc(startDate, startMinute, input.timezone),
      endsAt: zonedToUtc(
        parseCivilDate(input.endDate!)!,
        parseMinuteOfDay(input.endTime!)!,
        input.timezone,
      ),
    };
  }
  return {
    startsAt: zonedToUtc(startDate, 0, input.timezone),
    endsAt:
      input.endDate === null
        ? null
        : zonedToUtc(parseCivilDate(input.endDate)!, 24 * 60, input.timezone),
  };
}
