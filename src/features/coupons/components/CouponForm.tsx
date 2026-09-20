"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { setFlash } from "@/lib/navigation/flash";
import { useForm, useFormState } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { useTranslations, useLocale } from "next-intl";
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
import {
  useHasFormErrors,
  useSaveBlockedReason,
} from "@/lib/forms/useSaveBlockedReason";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { SaveBlockedNotice } from "@/components/forms/SaveBlockedNotice";
import { RequiredFieldsNote } from "@/components/forms/RequiredFieldsNote";
import { ChangedHint } from "@/components/forms/ChangedHint";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice } from "@/lib/currency";
import { moneyIn, type MoneySet } from "@/lib/money";
import { emptyMoneyInput, toMoneyInput } from "@/lib/money-input";
import type { Currency } from "@/lib/currency-config";
import { MoneyField } from "@/components/forms/MoneyField";
import { couponSchema, type CouponInput } from "../schema/coupons";
import { createCouponAction, updateCouponAction } from "../actions/coupons";

type CouponRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  /** PERCENT: the percent. FIXED: the USD-cent mirror of `valueMoney`. */
  value: number;
  /** FIXED only - the exact discount per currency. Null on a PERCENT coupon. */
  valueMoney: MoneySet | null;
  minOrder: number | null;
  minOrderMoney: MoneySet | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  expiresAt: string | null;
  active: boolean;
};

export function CouponForm({ coupon }: { coupon?: CouponRow }) {
  const t = useTranslations("coupons");
  const locale = useLocale();
  const router = useRouter();
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
            // `percent` and `amount` both always exist; only the one matching
            // `type` is validated and saved. A FIXED coupon therefore still
            // shows a sensible percent if you flip the type, and vice versa.
            percent: coupon.type === "PERCENT" ? coupon.value : 10,
            amount:
              coupon.type === "FIXED" && coupon.valueMoney
                ? toMoneyInput(coupon.valueMoney)
                : emptyMoneyInput(currency),
            minOrder: coupon.minOrderMoney ? toMoneyInput(coupon.minOrderMoney) : null,
            usageLimit: coupon.usageLimit,
            perUserLimit: coupon.perUserLimit,
            expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : null,
            active: coupon.active,
          }
        : {
            code: "",
            type: "PERCENT",
            percent: 10,
            amount: emptyMoneyInput(currency),
            minOrder: null,
            usageLimit: null,
            perUserLimit: null,
            expiresAt: null,
            active: true,
          },
    // `currency` participates: a blank amount field opens in whatever currency
    // the screen is showing, and the store rehydrates to the cookie value after
    // the first client render.
    [coupon, currency],
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
  // `Object.keys(errors)` reads the WHOLE error object, whose identity never
  // changes (react-hook-form mutates it in place), so under the React Compiler
  // it memoizes to its first result and the flag freezes at `false`. Reading it
  // through the hook keeps it live. See useSaveBlockedReason for the details.
  const hasErrors = useHasFormErrors(control);

  const saveBlockedReason = useSaveBlockedReason(control);

  // Percent and amount are separate fields now, so flipping the type no longer
  // needs to stash and restore one shared value - each keeps its own, and the
  // schema only validates the one the current type uses. All that is left is
  // clearing the stale error from the field being left behind.
  const handleTypeChange = (next: "PERCENT" | "FIXED") => {
    setValue("type", next, { shouldDirty: true, shouldValidate: true });
    clearErrors(next === "PERCENT" ? "amount" : "percent");
  };

  // Not gated on edit mode: a half-filled create form is exactly as easy to
  // lose to a stray nav click, and `isDirty` compares against the empty
  // defaults, so an untouched form still never prompts.
  useUnsavedChangesWarning(isDirty);

  // Next.js can keep this route's React tree warm, so without an explicit reset
  // unsaved edits survive navigating away from the form and back. Resetting to
  // the stored coupon (or blank defaults) on every entry to the route discards
  // them. The navigation-generation counter bumps on *every* path change - unlike
  // `usePathname`, which is identical when you leave and return to the same route
  // (e.g. /coupons/new -> /coupons -> /coupons/new) and so never fired the reset.
  // It's stable while the form is on screen, so active editing is never disrupted.
  useEffect(() => {
    reset(derivedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const type = watch("type");
  const percent = watch("percent");
  const amount = watch("amount");
  const minOrder = watch("minOrder");
  const usageLimit = watch("usageLimit");
  const perUserLimit = watch("perUserLimit");
  const expiresAt = watch("expiresAt");
  const active = watch("active");

  // The saved amount, read in whichever currency the field is currently showing.
  // A stored amount, not a conversion, which is why it stays put as rates move.
  const fmtMoney = (set: MoneySet, cur: Currency) =>
    formatPrice(moneyIn(set, cur, rates), cur, locale);

  // Saved (active) values, formatted for the changed-field hints. Only present
  // in edit mode (there is nothing "saved" yet when creating).
  const savedValueText = coupon
    ? coupon.type === "PERCENT"
      ? `${coupon.value}%`
      : coupon.valueMoney
        ? fmtMoney(coupon.valueMoney, amount?.currency ?? currency)
        : null
    : null;

  const onSubmit = (data: CouponInput) => {
    start(async () => {
      const res = coupon
        ? await updateCouponAction(coupon.id, data)
        : await createCouponAction(data);
      if (res && "error" in res) {
        toast.error(res.message);
      } else {
        // Not re-baselined here - see the note in BrandForm.
        // Queued for the list we are about to land on - see the note in TagForm.
        const target = `/${locale}${res.redirectTo}`;
        setFlash(t(coupon ? "updated" : "created"), { path: target });
        router.push(target);
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
              aria-invalid={!!errors.percent}
              id="value"
              min={0}
              max={100}
              value={Number.isFinite(percent) ? percent : 0}
              onChange={(v) =>
                setValue("percent", v ?? 0, { shouldValidate: true, shouldDirty: true })
              }
            />
          ) : (
            <MoneyField
              aria-invalid={!!errors.amount?.amount}
              value={amount ?? emptyMoneyInput(currency)}
              onChange={(next) =>
                setValue("amount", next, { shouldValidate: true, shouldDirty: true })
              }
              rates={rates}
              stored={coupon?.type === "FIXED" ? coupon.valueMoney : null}
              preferredCurrency={currency}
              showDerived
            />
          )}
          {type === "PERCENT"
            ? errors.percent && (
                <p className="text-xs text-destructive">{errors.percent.message}</p>
              )
            : errors.amount?.amount && (
                <p className="text-xs text-destructive">{errors.amount.amount.message}</p>
              )}
          {coupon && (
            <ChangedHint
              changed={type === "PERCENT" ? !!dirtyFields.percent : !!dirtyFields.amount}
              savedText={savedValueText}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <div className="space-y-1.5">
          <Label>{t("form.minOrder")}</Label>
          <MoneyField
            aria-invalid={!!errors.minOrder?.amount}
            value={minOrder ?? emptyMoneyInput(currency)}
            // Amount 0 means "no minimum" and is stored as null. A negative is
            // kept so the schema rejects it and shows an error, matching every
            // other number input (no silent reset to 0).
            onChange={(next) =>
              setValue("minOrder", next.amount === 0 ? null : next, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            rates={rates}
            stored={coupon?.minOrderMoney}
            preferredCurrency={currency}
            // The buyer sees this amount: a rejected coupon quotes the minimum
            // back in their own currency, so the seller has to be able to see
            // and pin what it comes to there.
            showDerived
          />
          {errors.minOrder?.amount && (
            <p className="text-xs text-destructive">{errors.minOrder.amount.message}</p>
          )}
          {coupon && (
            <ChangedHint
              changed={!!dirtyFields.minOrder}
              savedText={
                coupon.minOrderMoney
                  ? fmtMoney(coupon.minOrderMoney, minOrder?.currency ?? currency)
                  : t("form.none")
              }
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="usageLimit">{t("form.usageLimit")}</Label>
          <NumberStepper
            aria-invalid={!!errors.usageLimit}
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
            aria-invalid={!!errors.perUserLimit}
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
          saveDisabledReason={saveBlockedReason}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isPending || hasErrors}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isPending ? t("form.creating") : t("form.create")}
          </Button>
          <SaveBlockedNotice blocked={hasErrors} reason={saveBlockedReason} />
        </div>
      )}
    </form>
  );
}
