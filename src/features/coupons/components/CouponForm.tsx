"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useForm, useFormState } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { RequiredFieldsNote } from "@/components/forms/RequiredFieldsNote";
import { ChangedHint } from "@/components/forms/ChangedHint";
import { useCurrencyStore } from "@/store/currency";
import { convertCents, formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import { PriceInput } from "@/features/products/components/PriceInput";
import { couponSchema, type CouponInput } from "../schema/coupons";
import { createCouponAction, updateCouponAction } from "../actions/coupons";

type CouponRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minOrder: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  expiresAt: string | null;
  active: boolean;
};

export function CouponForm({ coupon }: { coupon?: CouponRow }) {
  const t = useTranslations("coupons");
  const onInvalid = useInvalidToast();
  const { rates, currency } = useCurrencyStore();
  const [isPending, start] = useTransition();

  // Memoized so RHF's `values` re-sync below only fires when the coupon actually
  // changes, not on every render.
  const derivedValues = useMemo<CouponInput>(
    () =>
      coupon
        ? {
            code: coupon.code,
            type: coupon.type,
            // FIXED value + minOrder are stored in cents; the form works in dollars.
            value: coupon.type === "FIXED" ? coupon.value / 100 : coupon.value,
            minOrder: coupon.minOrder != null ? coupon.minOrder / 100 : null,
            usageLimit: coupon.usageLimit,
            perUserLimit: coupon.perUserLimit,
            expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : null,
            active: coupon.active,
          }
        : { code: "", type: "PERCENT", value: 10, minOrder: null, usageLimit: null, perUserLimit: null, expiresAt: null, active: true },
    [coupon],
  );

  const navGeneration = useNavigationGeneration();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    clearErrors,
    control,
  } = useForm<CouponInput>({
    // Validate on every change so the percent-range / required errors appear
    // immediately (not a keystroke late) and `isValid` can gate the save button.
    mode: "onChange",
    resolver: useZodResolver(couponSchema),
    defaultValues: derivedValues,
  });

  // Read via `useFormState`, not by destructuring `formState` off `useForm`:
  // that is a proxy getter whose values change while the returned object's
  // reference never does, so the React Compiler (`reactCompiler: true`) caches
  // the first read and leaves errors/isDirty frozen (see VariantsEditor.tsx).
  const { errors, isDirty, dirtyFields } = useFormState({ control });

  // Block saving while any field is invalid. Error-based (not `!isValid`) so a
  // freshly-loaded valid coupon isn't disabled before the first validation runs.
  const hasErrors = Object.keys(errors).length > 0;

  // `value` means different things per type (a percent vs a dollar amount), so
  // remember each type's value separately. Flipping PERCENT <-> FIXED restores
  // what you last had for the type you're switching to - a fixed $50 never
  // bleeds across as an invalid "50%", but it's also not lost when you flip back.
  const lastPercentRef = useRef<number>(
    coupon?.type === "PERCENT" ? coupon.value : 10,
  );
  const lastFixedRef = useRef<number>(
    coupon?.type === "FIXED" ? coupon.value / 100 : 10,
  );

  // Re-seed the per-type memory from a baseline (form values are already in the
  // form's units). Called whenever the form resets - navigating away and back
  // (discard) or after a save - so a later type flip reflects the saved value
  // instead of a stale pre-reset edit. The non-baseline type falls back to its
  // default, exactly as a fresh load would show it.
  const reseedTypeMemory = (vals: CouponInput) => {
    lastPercentRef.current = vals.type === "PERCENT" ? vals.value : 10;
    lastFixedRef.current = vals.type === "FIXED" ? vals.value : 10;
  };

  const handleTypeChange = (next: "PERCENT" | "FIXED") => {
    const prevType = watch("type");
    const prevValue = watch("value");
    // Stash the current value under the type we're leaving.
    if (Number.isFinite(prevValue)) {
      if (prevType === "PERCENT") lastPercentRef.current = prevValue;
      else lastFixedRef.current = prevValue;
    }
    setValue("type", next, { shouldDirty: true });
    setValue(
      "value",
      next === "PERCENT" ? lastPercentRef.current : lastFixedRef.current,
      { shouldDirty: true, shouldValidate: true },
    );
    clearErrors("value");
  };

  useUnsavedChangesWarning(Boolean(coupon) && isDirty);

  // Next.js can keep this route's React tree warm, so without an explicit reset
  // unsaved edits survive navigating away from the form and back. Resetting to
  // the stored coupon (or blank defaults) on every entry to the route discards
  // them. The navigation-generation counter bumps on *every* path change - unlike
  // `usePathname`, which is identical when you leave and return to the same route
  // (e.g. /coupons/new -> /coupons -> /coupons/new) and so never fired the reset.
  // It's stable while the form is on screen, so active editing is never disrupted.
  useEffect(() => {
    reset(derivedValues);
    reseedTypeMemory(derivedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const type = watch("type");
  const value = watch("value");
  const minOrder = watch("minOrder");
  const usageLimit = watch("usageLimit");
  const perUserLimit = watch("perUserLimit");
  const expiresAt = watch("expiresAt");
  const active = watch("active");

  // Each PriceInput carries its own currency selector; mirror it so the saved
  // amounts read in the same currency the field currently shows.
  const [valueCurrency, setValueCurrency] = useState<Currency>(currency);
  const [minOrderCurrency, setMinOrderCurrency] = useState<Currency>(currency);
  const fmtMoney = (cents: number, cur: Currency) => {
    const rate = cur === "usd" ? 1 : (rates[cur] ?? 1);
    return formatPrice(convertCents(cents, cur, rate), cur);
  };

  // Saved (active) values, formatted for the changed-field hints. Only present
  // in edit mode (there is nothing "saved" yet when creating).
  const savedValueText = coupon
    ? coupon.type === "PERCENT"
      ? `${coupon.value}%`
      : fmtMoney(coupon.value, valueCurrency)
    : null;

  const onSubmit = (data: CouponInput) => {
    start(async () => {
      const res = coupon
        ? await updateCouponAction(coupon.id, data)
        : await createCouponAction(data);
      if (res && "error" in res) {
        toast.error(res.message);
      } else if (coupon) {
        // Adopt the just-saved values as the new baseline so the form is no
        // longer "dirty" (the save bar clears and the nav guard stops prompting).
        reset(data);
        reseedTypeMemory(data);
      }
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit, onInvalid)} className="max-w-lg space-y-5">
      <RequiredFieldsNote />
      <div className="space-y-1.5">
        <Label htmlFor="code" required>{t("form.code")}</Label>
        <Input
          id="code"
          {...register("code")}
          autoComplete="off"
          className="uppercase"
          aria-invalid={!!errors.code}
        />
        {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
        {coupon && (
          <ChangedHint changed={!!dirtyFields.code} savedText={coupon.code} />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("form.type")}</Label>
          <Select value={type} onValueChange={(v) => handleTypeChange(v as "PERCENT" | "FIXED")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENT">{t("form.percent")}</SelectItem>
              <SelectItem value="FIXED">{t("form.fixed")}</SelectItem>
            </SelectContent>
          </Select>
          {coupon && (
            <ChangedHint
              changed={!!dirtyFields.type}
              savedText={coupon.type === "PERCENT" ? t("form.percent") : t("form.fixed")}
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="value" required>{type === "PERCENT" ? t("form.valuePercent") : t("form.valueFixed")}</Label>
          {type === "PERCENT" ? (
            <NumberStepper
              id="value"
              min={0}
              max={100}
              value={Number.isFinite(value) ? value : 0}
              onChange={(v) => setValue("value", v ?? 0, { shouldValidate: true, shouldDirty: true })}
            />
          ) : (
            <PriceInput
              value={Number.isFinite(value) ? value : 0}
              onChange={(usd) => setValue("value", usd, { shouldValidate: true, shouldDirty: true })}
              rates={rates}
              defaultCurrency={currency}
              onCurrencyChange={setValueCurrency}
            />
          )}
          {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
          {coupon && (
            <ChangedHint changed={!!dirtyFields.value} savedText={savedValueText} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <div className="space-y-1.5">
          <Label>{t("form.minOrder")}</Label>
          <PriceInput
            value={minOrder ?? 0}
            // `usd || null`: 0 means "no minimum" (null); a negative is kept so
            // the schema's nonnegative check rejects it and shows an error -
            // matching every other number input (no silent reset to 0).
            onChange={(usd) => setValue("minOrder", usd || null, { shouldValidate: true, shouldDirty: true })}
            rates={rates}
            defaultCurrency={currency}
            onCurrencyChange={setMinOrderCurrency}
          />
          {errors.minOrder && <p className="text-xs text-destructive">{errors.minOrder.message}</p>}
          {coupon && (
            <ChangedHint
              changed={!!dirtyFields.minOrder}
              savedText={
                coupon.minOrder != null
                  ? fmtMoney(coupon.minOrder, minOrderCurrency)
                  : t("form.none")
              }
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="usageLimit">{t("form.usageLimit")}</Label>
          <NumberStepper
            id="usageLimit"
            min={1}
            allowEmpty
            placeholder={t("form.optional")}
            value={usageLimit ?? null}
            onChange={(v) => setValue("usageLimit", v, { shouldValidate: true, shouldDirty: true })}
          />
          {errors.usageLimit && <p className="text-xs text-destructive">{errors.usageLimit.message}</p>}
          {coupon && (
            <ChangedHint
              changed={!!dirtyFields.usageLimit}
              savedText={coupon.usageLimit != null ? String(coupon.usageLimit) : t("form.unlimited")}
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="perUserLimit">{t("form.perUserLimit")}</Label>
          <NumberStepper
            id="perUserLimit"
            min={1}
            allowEmpty
            placeholder={t("form.optional")}
            value={perUserLimit ?? null}
            onChange={(v) => setValue("perUserLimit", v, { shouldValidate: true, shouldDirty: true })}
          />
          <p className="text-xs text-muted-foreground">{t("form.perUserLimitDesc")}</p>
          {errors.perUserLimit && <p className="text-xs text-destructive">{errors.perUserLimit.message}</p>}
          {coupon && (
            <ChangedHint
              changed={!!dirtyFields.perUserLimit}
              savedText={coupon.perUserLimit != null ? String(coupon.perUserLimit) : t("form.unlimited")}
            />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("form.expiresAt")}</Label>
        <DatePicker
          value={expiresAt}
          onChange={(v) => setValue("expiresAt", v, { shouldDirty: true })}
          placeholder={t("form.optional")}
          className="max-w-xs"
        />
        {coupon && (
          <ChangedHint
            changed={!!dirtyFields.expiresAt}
            savedText={coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : t("form.noExpiry")}
          />
        )}
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="coupon-active" className="text-base">{t("form.active")}</Label>
            <p className="text-sm text-muted-foreground">{t("form.activeDesc")}</p>
          </div>
          <Switch id="coupon-active" checked={active} onCheckedChange={(c) => setValue("active", c, { shouldDirty: true })} />
        </div>
        {coupon && (
          <div className="mt-2">
            <ChangedHint
              changed={!!dirtyFields.active}
              savedText={coupon.active ? t("form.active") : t("form.inactive")}
            />
          </div>
        )}
      </div>

      {coupon ? (
        <FormSaveBar
          isDirty={isDirty}
          isPending={isPending}
          onDiscard={() => reset()}
          saveLabel={t("form.save")}
          saveDisabled={hasErrors}
        />
      ) : (
        <Button type="submit" disabled={isPending || hasErrors}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isPending ? t("form.creating") : t("form.create")}
        </Button>
      )}
    </form>
  );
}
