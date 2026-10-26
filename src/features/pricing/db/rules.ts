import "server-only";
import { parseMoney } from "@/lib/money";
import type { PriceRule } from "@/generated/prisma/client";
import type { EngineRule } from "../schema/priceRules";

/** A stored rule as the pure engine expects it. */
export function toEngineRule(row: PriceRule): EngineRule {
  return {
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    kind: row.kind,
    name: row.name,
    adjustment: row.adjustment,
    percentBps: row.percentBps,
    amountMoney: parseMoney(row.amountMoney),
    priority: row.priority,
    active: row.active,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    recurrence: row.recurrence,
    startMinute: row.startMinute,
    durationMinutes: row.durationMinutes,
    weekdays: row.weekdays,
    monthDay: row.monthDay,
    createdAt: row.createdAt,
    countryCode: row.countryCode,
    marketId: row.marketId,
  };
}
