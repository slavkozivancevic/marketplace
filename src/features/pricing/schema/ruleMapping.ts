import type { MoneySet } from "@/lib/money";
import { addCivilDays, parseMinuteOfDay, zonedParts, type CivilDate } from "../engine/timezone";
import { ruleBoundsUtc, type PriceRuleInput } from "./priceRules";

/** The schedule, targeting and adjustment columns a validated form input maps to. */
export type RuleColumns = {
  kind: PriceRuleInput["kind"];
  marketId: string | null;
  countryCode: string | null;
  name: string;
  variantId: string | null;
  adjustment: PriceRuleInput["adjustment"];
  percentBps: number | null;
  priority: number;
  active: boolean;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  recurrence: PriceRuleInput["recurrence"];
  startMinute: number | null;
  durationMinutes: number | null;
  weekdays: number[];
  monthDay: number | null;
};

/**
 * The time columns of a market rule. It has no schedule - it applies while it
 * is active - but the columns are NOT NULL, so they hold fixed values nothing
 * reads: the window engine and the calendar only ever look at SCHEDULE rules.
 * Fixed rather than "now", so saving the same rule twice writes the same row.
 */
const NO_SCHEDULE = {
  startsAt: new Date(0),
  endsAt: null,
  timezone: "UTC",
  recurrence: "NONE",
  startMinute: null,
  durationMinutes: null,
  weekdays: [],
  monthDay: null,
} as const satisfies Partial<RuleColumns>;

/**
 * Form input -> stored columns. Only the fields the chosen kind, adjustment and
 * recurrence use are kept; the rest are cleared, so a rule switched from
 * weekly to one-off does not carry stale weekdays the engine would ignore but
 * a reader of the row would not. The database's CHECK holds the same targeting
 * rule: a schedule rule has no geography, a market rule exactly one target.
 *
 * Money is handled by the caller (it needs rates from the database).
 */
export function toRuleColumns(input: PriceRuleInput): RuleColumns {
  const shared = {
    kind: input.kind,
    name: input.name.trim(),
    variantId: input.variantId,
    adjustment: input.adjustment,
    percentBps: input.adjustment === "PERCENT" ? input.percentBps : null,
    priority: input.priority,
    active: input.active,
  };

  if (input.kind === "REGION") {
    const byCountry = input.regionScope === "COUNTRY";
    return {
      ...shared,
      ...NO_SCHEDULE,
      weekdays: [],
      marketId: byCountry ? null : input.marketId,
      countryCode: byCountry ? input.countryCode : null,
    };
  }

  const { startsAt, endsAt } = ruleBoundsUtc(input);
  const recurring = input.recurrence !== "NONE";
  return {
    ...shared,
    marketId: null,
    countryCode: null,
    startsAt,
    endsAt,
    timezone: input.timezone,
    recurrence: input.recurrence,
    startMinute: recurring ? parseMinuteOfDay(input.startTime) : null,
    durationMinutes: recurring ? input.durationMinutes : null,
    weekdays:
      input.recurrence === "WEEKLY" ? [...new Set(input.weekdays)].sort((a, b) => a - b) : [],
    monthDay: input.recurrence === "MONTHLY" ? input.monthDay : null,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const civil = (d: CivilDate) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;
const clock = (minute: number) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

/** A stored rule as `toRuleInput` reads it; the engine type has the targeting optional. */
type StoredColumns = Omit<RuleColumns, "marketId" | "countryCode"> & {
  marketId?: string | null;
  countryCode?: string | null;
};

/**
 * Stored rule -> form input, in the rule's own time zone: the inverse of
 * `toRuleColumns` + `ruleBoundsUtc`, so an edit form opens on exactly what the
 * seller typed. A market rule's time fields come back as the neutral values
 * it stores; the form hides them, and a rule's kind never changes on edit.
 */
export function toRuleInput(
  rule: StoredColumns,
  amount: MoneySet | null,
  fallbackCurrency: PriceRuleInput["amount"]["currency"],
): PriceRuleInput {
  const tz = rule.timezone;
  const start = zonedParts(rule.startsAt.getTime(), tz);
  const recurring = rule.recurrence !== "NONE";

  let endDate: string | null = null;
  let endTime: string | null = null;
  if (rule.endsAt) {
    const end = zonedParts(rule.endsAt.getTime(), tz);
    if (recurring) {
      // A series ends at the END of its last day (local midnight after it).
      endDate = civil(addCivilDays(end, -1));
    } else {
      endDate = civil(end);
      endTime = clock(end.minuteOfDay);
    }
  }

  return {
    kind: rule.kind,
    regionScope: rule.countryCode ? "COUNTRY" : "MARKET",
    marketId: rule.marketId ?? null,
    countryCode: rule.countryCode ?? null,
    name: rule.name,
    variantId: rule.variantId,
    adjustment: rule.adjustment,
    percentBps: rule.percentBps ?? -1000,
    amount: amount
      ? { currency: amount.primary, amount: amount.amounts[amount.primary] ?? 0 }
      : { currency: fallbackCurrency, amount: 0 },
    priority: rule.priority,
    active: rule.active,
    timezone: tz,
    recurrence: rule.recurrence,
    startDate: civil(start),
    startTime: clock(recurring ? (rule.startMinute ?? 0) : start.minuteOfDay),
    endDate,
    endTime,
    durationMinutes: rule.durationMinutes,
    weekdays: rule.weekdays,
    monthDay: rule.monthDay,
  };
}
