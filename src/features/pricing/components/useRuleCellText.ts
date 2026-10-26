import { useLocale, useTranslations } from "next-intl";
import { useMoney } from "@/lib/useMoney";
import { countryName } from "@/lib/i18n/countries";
import type { RuleRow } from "./PriceRulesTable";

/**
 * The rules table's two written-out cells - what a rule changes and when it
 * applies. One formatter for the table and for the list page's skeleton, which
 * draws the same text so a schedule that wraps onto two lines wraps there too.
 */
export function useRuleCellText(marketNames: Record<string, string>) {
  const t = useTranslations("priceRules");
  const locale = useLocale();
  const { formatOf } = useMoney();

  const time = (minute: number) =>
    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  const duration = (minutes: number) =>
    t("durationHM", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  const dateTime = (d: Date, tz: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(d);
  const date = (d: Date, tz: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: tz }).format(d);
  const weekday = (i: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, i)));

  const change = (r: RuleRow) => {
    if (r.adjustment === "PERCENT" && r.percentBps !== null) {
      const pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Math.abs(r.percentBps) / 100);
      return r.percentBps < 0 ? t("change.percentOff", { value: pct }) : t("change.percentUp", { value: pct });
    }
    const amount = formatOf(r.amountMoney);
    return r.adjustment === "FIXED_PRICE" ? t("change.fixedPrice", { amount }) : t("change.amountOff", { amount });
  };

  const schedule = (r: RuleRow) => {
    // A market rule has no schedule: it is on for its buyers while active.
    if (r.kind === "REGION") {
      const target = r.countryCode
        ? countryName(r.countryCode, locale)
        : (marketNames[r.marketId ?? ""] ?? "");
      return t("schedule.market", { target });
    }
    if (r.recurrence === "NONE") {
      return t("schedule.once", { from: dateTime(r.startsAt, r.timezone), to: r.endsAt ? dateTime(r.endsAt, r.timezone) : "" });
    }
    const at = time(r.startMinute ?? 0);
    const len = duration(r.durationMinutes ?? 0);
    const base =
      r.recurrence === "DAILY"
        ? t("schedule.daily", { time: at, duration: len })
        : r.recurrence === "WEEKLY"
          ? t("schedule.weekly", { days: r.weekdays.map(weekday).join(", "), time: at, duration: len })
          : t("schedule.monthly", { day: r.monthDay ?? 1, time: at, duration: len });
    // A series ends at the end of its last day, so show the day before endsAt.
    return r.endsAt
      ? `${base} ${t("schedule.until", { date: date(new Date(r.endsAt.getTime() - 1), r.timezone) })}`
      : base;
  };

  return { change, schedule };
}
