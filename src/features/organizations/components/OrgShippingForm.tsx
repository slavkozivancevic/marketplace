"use client";

import { useRef, useTransition } from "react";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { useTranslations, useLocale } from "next-intl";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import {
  useHasFormErrors,
  useSaveBlockedReason,
} from "@/lib/forms/useSaveBlockedReason";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { MoneyField } from "@/components/forms/MoneyField";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice } from "@/lib/currency";
import { moneyIn, type MoneySet } from "@/lib/money";
import { emptyMoneyInput, toMoneyInput, type MoneyInput } from "@/lib/money-input";
import type { Currency } from "@/lib/currency-config";
import {
  updateOrganizationShippingSchema,
  type UpdateOrganizationShippingInput,
} from "../schema/organizations";
import { updateOrganizationShippingAction } from "../actions/organizations";

/**
 * Both values are MoneySets: the seller enters a fee in whichever currency they
 * think in, and buyers in that currency are charged that exact amount. Nothing
 * here converts on the way in or out - see src/lib/money.ts.
 */
export function OrgShippingForm({
  flatRate,
  freeThreshold,
  canEdit,
}: {
  flatRate: MoneySet;
  freeThreshold: MoneySet | null;
  canEdit: boolean;
}) {
  const t = useTranslations("organization");
  const locale = useLocale();
  const tForm = useTranslations("form");
  const onInvalid = useInvalidToast();
  const { rates, currency } = useCurrencyStore();
  const [isPending, start] = useTransition();

  const { handleSubmit, control, setValue, reset } =
    useForm<UpdateOrganizationShippingInput>({
      mode: "onChange",
      resolver: useZodResolver(updateOrganizationShippingSchema),
      defaultValues: {
        shippingFlatRate: toMoneyInput(flatRate),
        shippingFreeThreshold: freeThreshold ? toMoneyInput(freeThreshold) : null,
      },
    });

  // Read via `useFormState`, not by destructuring the `formState` returned by
  // `useForm`: that is a proxy getter whose values change while the returned
  // object's reference never does, so the React Compiler (`reactCompiler:
  // true`) caches the first read and leaves isDirty/errors/dirtyFields frozen
  // (see the identical fix in VariantsEditor.tsx).
  const { isDirty, dirtyFields, errors } = useFormState({ control });
  useUnsavedChangesWarning(isDirty);

  // Block saving while any field is invalid (consistent across all admin forms).
  // `Object.keys(errors)` reads the WHOLE error object, whose identity never
  // changes (react-hook-form mutates it in place), so under the React Compiler
  // it memoizes to its first result and the flag freezes at `false`. Reading it
  // through the hook keeps it live. See useSaveBlockedReason for the details.
  const hasErrors = useHasFormErrors(control);

  const saveBlockedReason = useSaveBlockedReason(control);

  const flat = useWatch({ control, name: "shippingFlatRate" });
  const threshold = useWatch({ control, name: "shippingFreeThreshold" });
  const freeEnabled = threshold != null;

  // Remember the last entered threshold so toggling free shipping off and back
  // on restores it instead of snapping to 0 (seeded with the saved value).
  const lastThresholdRef = useRef<MoneyInput>(
    freeThreshold ? toMoneyInput(freeThreshold) : emptyMoneyInput(currency),
  );

  // The saved amount, shown in whatever currency the field is currently in, so
  // old and new are directly comparable without mental arithmetic. This is a
  // stored amount, not a conversion.
  const fmtSaved = (set: MoneySet, cur: Currency) =>
    formatPrice(moneyIn(set, cur, rates), cur, locale);

  const onSubmit = (data: UpdateOrganizationShippingInput) => {
    start(async () => {
      const res = await updateOrganizationShippingAction(data);
      if (res && "error" in res) toast.error(res.message);
      else toast.success(t("shippingUpdated"));
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          {t("shippingFlatRate")}
          {dirtyFields.shippingFlatRate && (
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
          )}
        </Label>
        <MoneyField
          aria-invalid={!!errors.shippingFlatRate}
          value={flat ?? emptyMoneyInput(currency)}
          onChange={(next) =>
            setValue("shippingFlatRate", next, { shouldValidate: true, shouldDirty: true })
          }
          rates={rates}
          stored={flatRate}
          preferredCurrency={currency}
          showDerived
          disabled={!canEdit}
        />
        {errors.shippingFlatRate?.amount?.message && (
          <p className="text-xs text-destructive">{errors.shippingFlatRate.amount.message}</p>
        )}
        {/* Saved-value reminder is additive while editing; the instructional
            hint always stays so the field never loses its explanation. */}
        {dirtyFields.shippingFlatRate && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
            <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
            {tForm("savedValue", {
              value: fmtSaved(flatRate, flat?.currency ?? currency),
            })}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t("shippingFlatRateHint")}</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5 pr-4">
          <Label htmlFor="free-ship">{t("shippingFreeEnabled")}</Label>
          <p className="text-sm text-muted-foreground">{t("shippingFreeEnabledHint")}</p>
        </div>
        <Switch
          id="free-ship"
          checked={freeEnabled}
          disabled={!canEdit}
          onCheckedChange={(checked) => {
            if (checked) {
              setValue("shippingFreeThreshold", lastThresholdRef.current, {
                shouldDirty: true,
                shouldValidate: true,
              });
            } else {
              // Capture the current value before clearing so re-enabling restores it.
              if (threshold != null) lastThresholdRef.current = threshold;
              setValue("shippingFreeThreshold", null, { shouldDirty: true });
            }
          }}
        />
      </div>

      {freeEnabled && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            {t("shippingFreeThreshold")}
            {dirtyFields.shippingFreeThreshold && (
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
            )}
          </Label>
          <MoneyField
            aria-invalid={!!errors.shippingFreeThreshold}
            value={threshold ?? emptyMoneyInput(currency)}
            onChange={(next) =>
              setValue("shippingFreeThreshold", next, { shouldValidate: true, shouldDirty: true })
            }
            rates={rates}
            stored={freeThreshold}
            preferredCurrency={currency}
            showDerived
            disabled={!canEdit}
          />
          {errors.shippingFreeThreshold?.amount?.message && (
            <p className="text-xs text-destructive">
              {errors.shippingFreeThreshold.amount.message}
            </p>
          )}
          {/* Saved-value reminder only when there's a saved threshold to compare;
              the instructional hint always stays below it. */}
          {dirtyFields.shippingFreeThreshold && freeThreshold != null && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
              <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
              {tForm("savedValue", {
                value: fmtSaved(freeThreshold, threshold?.currency ?? currency),
              })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t("shippingFreeThresholdHint")}</p>
        </div>
      )}

      {canEdit ? (
        <FormSaveBar
          isDirty={isDirty}
          isPending={isPending}
          onDiscard={() => reset()}
          saveLabel={t("saveChanges")}
          saveDisabled={hasErrors}
          saveDisabledReason={saveBlockedReason}
        />
      ) : (
        <p className="text-xs text-muted-foreground">{t("editRestricted")}</p>
      )}
    </form>
  );
}
