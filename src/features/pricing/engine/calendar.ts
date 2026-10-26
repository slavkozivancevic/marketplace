import type { EngineRule } from "../schema/priceRules";
import { expandOccurrences } from "./occurrences";
import { compareRules } from "./precedence";
import { addCivilDays, zonedToUtc, type CivilDate } from "./timezone";
import { buildWindows, type PriceTarget } from "./windows";

export type CalendarDay = { date: string; ruleIds: string[] };
export type CalendarRow = { variantId: string | null; days: CalendarDay[] };

const pad = (n: number) => String(n).padStart(2, "0");
const civil = (d: CivilDate) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;

/**
 * Which rule sets the price on each local day, per target, for `days` days
 * from `start` - the seller's calendar. Built from the same `buildWindows` the
 * storefront prices from, so the calendar can never disagree with the shop. A
 * day lists every rule that wins at least part of it, in time order.
 */
export function buildCalendar(
  targets: PriceTarget[],
  rules: EngineRule[],
  start: CivilDate,
  days: number,
  timeZone: string,
): CalendarRow[] {
  const from = zonedToUtc(start, 0, timeZone);
  const to = zonedToUtc(addCivilDays(start, days), 0, timeZone);

  return targets.map((target) => {
    const windows = buildWindows(target, rules, from, to);
    const out: CalendarDay[] = [];
    for (let i = 0; i < days; i++) {
      const day = addCivilDays(start, i);
      const dayFrom = zonedToUtc(day, 0, timeZone).getTime();
      const dayTo = zonedToUtc(addCivilDays(day, 1), 0, timeZone).getTime();
      const ids: string[] = [];
      for (const w of windows) {
        if (w.startsAt.getTime() < dayTo && w.endsAt.getTime() > dayFrom && !ids.includes(w.ruleId)) {
          ids.push(w.ruleId);
        }
      }
      out.push({ date: civil(day), ruleIds: ids });
    }
    return { variantId: target.variantId, days: out };
  });
}

/** Two rules whose occurrences overlap, and which one the overlap hides. */
export type RuleOverlap = { winnerId: string; hiddenId: string };

/**
 * Pairs of active schedule rules that are live at the same moment for the same
 * target within `[from, to)`. Only one price can apply, so the lower-ranked rule
 * is hidden there - the seller is warned rather than left to wonder why a promo
 * "did nothing".
 */
export function findOverlaps(rules: EngineRule[], from: Date, to: Date): RuleOverlap[] {
  const live = rules.filter((r) => r.kind === "SCHEDULE" && r.active);
  const occurrences = new Map(live.map((r) => [r.id, expandOccurrences(r, from, to)]));
  const out: RuleOverlap[] = [];

  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      const sameTarget =
        a.productId === b.productId &&
        (a.variantId === null || b.variantId === null || a.variantId === b.variantId);
      if (!sameTarget) continue;
      const overlap = occurrences
        .get(a.id)!
        .some((x) => occurrences.get(b.id)!.some((y) => x.start < y.end && y.start < x.end));
      if (!overlap) continue;
      const [winner, hidden] = [a, b].sort(compareRules);
      out.push({ winnerId: winner.id, hiddenId: hidden.id });
    }
  }
  return out;
}

export type RuleStatus = "paused" | "upcoming" | "live" | "ended";

/** Where a rule stands now. A recurring rule is "live" for its whole series. */
export function ruleStatus(rule: Pick<EngineRule, "active" | "startsAt" | "endsAt">, now: Date): RuleStatus {
  if (!rule.active) return "paused";
  if (rule.endsAt !== null && rule.endsAt <= now) return "ended";
  if (rule.startsAt > now) return "upcoming";
  return "live";
}
