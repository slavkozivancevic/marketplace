"use client";

import { useMemo, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { readRouteShape } from "@/lib/navigation/routeShape";
import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonCopy,
  SkeletonHint,
  SkeletonLabel,
  SkeletonMoneyField,
  SkeletonSelectTail,
  SkeletonSwitchCard,
} from "@/components/ui/skeleton";
import { useCurrencyStore } from "@/store/currency";
import { emptyMoneyInput, type MoneyInput } from "@/lib/money-input";
import type { MoneySet } from "@/lib/money";
import type { PriceRuleInput } from "../schema/priceRules";

/**
 * Everything about a rule that decides which rows <PriceRuleForm> draws. The
 * rules table hands it over on the edit click (see `priceRuleFormShape`), so
 * the edit skeleton draws THAT rule's form; without it (a create, or an edit
 * opened by URL) the form's own default applies: schedule, percent, once.
 */
export type PriceRuleFormShape = {
  kind: PriceRuleInput["kind"];
  regionScope: PriceRuleInput["regionScope"];
  adjustment: PriceRuleInput["adjustment"];
  recurrence: PriceRuleInput["recurrence"];
  /** An amount rule's money, as the form opens it: its value and the stored set. */
  money: { value: MoneyInput; stored: MoneySet } | null;
};

const DEFAULT_SHAPE: PriceRuleFormShape = {
  kind: "SCHEDULE",
  regionScope: "MARKET",
  adjustment: "PERCENT",
  recurrence: "NONE",
  money: null,
};

/** A stored rule's form shape - what `toRuleInput` will open it as. */
export function priceRuleFormShape(rule: {
  kind: PriceRuleInput["kind"];
  adjustment: PriceRuleInput["adjustment"];
  recurrence: PriceRuleInput["recurrence"];
  countryCode?: string | null;
  amountMoney: MoneySet | null;
}): PriceRuleFormShape {
  const money = rule.amountMoney;
  return {
    kind: rule.kind,
    regionScope: rule.countryCode ? "COUNTRY" : "MARKET",
    adjustment: rule.adjustment,
    recurrence: rule.recurrence,
    // The value 	oRuleInput opens the field on: the primary amount alone.
    money:
      rule.adjustment !== "PERCENT" && money
        ? { value: { currency: money.primary, amount: money.amounts[money.primary] ?? 0 }, stored: money }
        : null,
  };
}

/** The route-shape key an edit of `ruleId` is handed over under. */
export function priceRuleShapeKey(ruleId: string): string {
  return `price-rule:${ruleId}`;
}

/**
 * The body of the price-rule create / edit skeleton, row for row with
 * <PriceRuleForm>. Known copy is the real text (SkeletonCopy), so every hint
 * wraps onto as many lines as the loaded one.
 */
export function PriceRuleFormSkeleton({ mode }: { mode: "create" | "edit" }) {
  const t = useTranslations("priceRules");
  const { currency } = useCurrencyStore();
  const locale = useLocale();
  const params = useParams<{ ruleId?: string }>();
  const shape =
    (mode === "edit" && params.ruleId
      ? readRouteShape<PriceRuleFormShape>(priceRuleShapeKey(params.ruleId))
      : null) ?? DEFAULT_SHAPE;

  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    // 2024-01-01 was a Monday - the same list the form builds.
    return [1, 2, 3, 4, 5, 6, 7].map((i) => f.format(new Date(Date.UTC(2024, 0, i))));
  }, [locale]);

  const once = shape.recurrence === "NONE";

  return (
    <SkeletonAdminForm spacing="space-y-5" mode={mode} submitLabel={t("form.create")} submitMinWidth={false}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("form.kind")} select>
          <SkeletonHint>{t(`form.kindHint.${shape.kind}`)}</SkeletonHint>
          {mode === "edit" && <SkeletonHint>{t("form.kindLocked")}</SkeletonHint>}
        </Field>
      </div>

      <Field label={t("form.name")} required>
        <SkeletonHint>{t("form.nameHint")}</SkeletonHint>
      </Field>

      {shape.kind === "REGION" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <Field label={t("form.regionScope")} select />
          {/* Market <Select> or <CountrySelect>: both an h-8 trigger. */}
          <Field
            label={shape.regionScope === "MARKET" ? t("form.market") : t("form.country")}
            required
            select={shape.regionScope === "MARKET"}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("form.appliesTo")} select />
        <Field label={t("form.changeType")} select />
      </div>

      {shape.adjustment === "PERCENT" ? (
        <Field label={t("form.percent")} required className="max-w-xs">
          <SkeletonHint>{t("form.percentHint")}</SkeletonHint>
        </Field>
      ) : (
        <div className="space-y-1.5 max-w-sm">
          <SkeletonLabel
            label={shape.adjustment === "FIXED_PRICE" ? t("form.fixedPrice") : t("form.amountOff")}
            required
          />
          <SkeletonMoneyField
            value={shape.money?.value ?? emptyMoneyInput(currency)}
            stored={shape.money?.stored ?? null}
            display={currency}
          />
        </div>
      )}

      {shape.kind === "SCHEDULE" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("form.repeat")} select>
              {!once && <SkeletonHint>{t("form.recurringStrikeNote")}</SkeletonHint>}
            </Field>
            <Field label={t("form.timezone")} select />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <Field label={once ? t("form.startDate") : t("form.seriesStart")} required datePicker />
            <Field label={once ? t("form.startTime") : t("form.dailyStartTime")} required />
          </div>

          {once ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <Field label={t("form.endDate")} required datePicker />
              <Field label={t("form.endTime")} required />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <Field label={t("form.duration")} required />
                <Field label={t("form.seriesEnd")} datePicker />
              </div>

              {shape.recurrence === "WEEKLY" && (
                <div className="space-y-1.5">
                  <SkeletonLabel label={t("form.weekdays")} required />
                  <div className="flex flex-wrap gap-4">
                    {weekdays.map((day) => (
                      // A `text-sm` label: the 16px checkbox beside the day name.
                      <span key={day} className="flex items-center gap-2 text-sm">
                        <Skeleton className="size-4 rounded-lg" />
                        <SkeletonCopy>{day}</SkeletonCopy>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {shape.recurrence === "MONTHLY" && (
                <Field label={t("form.monthDay")} required className="max-w-xs">
                  <SkeletonHint>{t("form.monthDayHint")}</SkeletonHint>
                </Field>
              )}
            </div>
          )}
        </>
      )}

      <Field label={t("form.priority")} className="max-w-xs">
        <SkeletonHint>{t("form.priorityHint")}</SkeletonHint>
      </Field>

      <SkeletonSwitchCard label={t("form.active")} description={t("form.activeDesc")} gap />
    </SkeletonAdminForm>
  );
}

/**
 * <Label> + control + whatever follows it, in the form's `space-y-1.5` stack.
 * <Input>, <SelectTrigger>, <NumberStepper> and the country picker are h-8;
 * <DatePicker> is h-9.
 */
function Field({
  label,
  required = false,
  datePicker = false,
  select = false,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  datePicker?: boolean;
  /** A Radix <Select>: its hidden native select follows the trigger. */
  select?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <SkeletonLabel label={label} required={required} />
      <Skeleton className={datePicker ? "h-9 w-full rounded-lg" : "h-8 w-full rounded-lg"} />
      {select && <SkeletonSelectTail />}
      {children}
    </div>
  );
}
