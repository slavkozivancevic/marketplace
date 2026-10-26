"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonHint,
  SkeletonLabel,
  SkeletonMoneyField,
  SkeletonSelectTail,
  SkeletonSwitchCard,
} from "@/components/ui/skeleton";
import type { MoneySet } from "@/lib/money";
import { emptyMoneyInput, toMoneyInput } from "@/lib/money-input";
import { readRouteShape } from "@/lib/navigation/routeShape";
import { useCurrencyStore } from "@/store/currency";

/**
 * What the coupons list hands an edit's skeleton (see CouponsView): the type,
 * which decides whether the value is a stepper or a money field, and the two
 * stored amounts, whose currency blocks read and size by what they hold.
 */
export type CouponFormShape = {
  type: "PERCENT" | "FIXED";
  valueMoney: MoneySet | null;
  minOrderMoney: MoneySet | null;
};

export function couponShapeKey(couponId: string): string {
  return `coupon:${couponId}`;
}

/**
 * Placeholder for <CouponForm>, shared by the create and edit loading states.
 *
 * Coupons are the one admin form with no translatable sections: a flat stack at
 * `max-w-lg space-y-5` of raw <Label> + control rows (`space-y-1.5`).
 *
 * Layout: code on its own; type + value; a second two-column grid holding
 * THREE fields, so the per-user limit wraps onto its own row. Min order - and
 * a FIXED coupon's value - is a `showDerived` <MoneyField>, whose block of
 * other currencies is always there. Then the expiry picker (h-9, `max-w-xs`)
 * and the active card. A create opens as PERCENT with no minimum; an edit
 * draws the coupon's own type and amounts when the list handed them over.
 * Labels and hints are the real copy.
 */
export function CouponFormSkeleton({
  mode = "create",
}: {
  mode?: "create" | "edit";
} = {}) {
  const t = useTranslations("coupons.form");
  const { currency } = useCurrencyStore();
  const params = useParams<{ id?: string }>();
  const shape = mode === "edit" && params.id ? readRouteShape<CouponFormShape>(couponShapeKey(params.id)) : null;
  const fixed = shape?.type === "FIXED";

  return (
    <SkeletonAdminForm
      maxWidth="max-w-lg"
      spacing="space-y-5"
      mode={mode}
      submitLabel={t("create")}
      submitMinWidth={false}
    >
      <div className="space-y-1.5">
        <SkeletonLabel label={t("code")} required />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <SkeletonLabel label={t("type")} />
          <Skeleton className="h-8 w-full rounded-lg" />
          <SkeletonSelectTail />
        </div>
        <div className="space-y-1.5">
          <SkeletonLabel label={fixed ? t("valueFixed") : t("valuePercent")} required />
          {fixed ? (
            <SkeletonMoneyField
              value={shape?.valueMoney ? toMoneyInput(shape.valueMoney) : emptyMoneyInput(currency)}
              stored={shape?.valueMoney ?? null}
              display={currency}
            />
          ) : (
            <Skeleton className="h-8 w-full rounded-lg" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <div className="space-y-1.5">
          <SkeletonLabel label={t("minOrder")} />
          <SkeletonMoneyField
            value={shape?.minOrderMoney ? toMoneyInput(shape.minOrderMoney) : emptyMoneyInput(currency)}
            stored={shape?.minOrderMoney ?? null}
            display={currency}
          />
        </div>
        <div className="space-y-1.5">
          <SkeletonLabel label={t("usageLimit")} />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <SkeletonLabel label={t("perUserLimit")} />
          <Skeleton className="h-8 w-full rounded-lg" />
          <SkeletonHint>{t("perUserLimitDesc")}</SkeletonHint>
        </div>
      </div>

      <div className="space-y-1.5">
        <SkeletonLabel label={t("expiresAt")} />
        {/* <DatePicker> is h-9, capped at `max-w-xs` here. */}
        <Skeleton className="h-9 w-full max-w-xs rounded-lg" />
      </div>

      {/* An edit ends the card in an `mt-2` slot for the saved-value hint. */}
      <SkeletonSwitchCard label={t("active")} description={t("activeDesc")} hintSlot={mode === "edit"} />
    </SkeletonAdminForm>
  );
}
