"use client";

import { useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { useCurrencyStore } from "@/store/currency";
import { convertCents, formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import { PriceInput } from "@/features/products/components/PriceInput";
import {
  updateOrganizationShippingSchema,
  type UpdateOrganizationShippingInput,
} from "../schema/organizations";
import { updateOrganizationShippingAction } from "../actions/organizations";

/** `flatRate` / `freeThreshold` are stored in USD base cents; the form works in
 *  dollars (PriceInput) and the action converts back. */
export function OrgShippingForm({
  flatRate,
  freeThreshold,
  canEdit,
}: {
  flatRate: number;
  freeThreshold: number | null;
  canEdit: boolean;
}) {
  const t = useTranslations("organization");
  const tForm = useTranslations("form");
  const onInvalid = useInvalidToast();
  const { rates, currency } = useCurrencyStore();
  const [isPending, start] = useTransition();

  const { handleSubmit, control, setValue, reset, formState } =
    useForm<UpdateOrganizationShippingInput>({
      mode: "onChange",
      resolver: useZodResolver(updateOrganizationShippingSchema),
      defaultValues: {
        shippingFlatRate: flatRate / 100,
        shippingFreeThreshold: freeThreshold != null ? freeThreshold / 100 : null,
      },
    });

  const { isDirty, dirtyFields, errors } = formState;
  useUnsavedChangesWarning(isDirty);

  // Block saving while any field is invalid (consistent across all admin forms).
  const hasErrors = Object.keys(errors).length > 0;

  // Each PriceInput has its own currency selector; mirror it so the saved-value
  // hint reads in the same currency the field is currently showing (no mental
  // conversion to compare old vs new).
  const [flatCurrency, setFlatCurrency] = useState<Currency>(currency);
  const [thresholdCurrency, setThresholdCurrency] = useState<Currency>(currency);

  const flat = useWatch({ control, name: "shippingFlatRate" });
  const threshold = useWatch({ control, name: "shippingFreeThreshold" });
  const freeEnabled = threshold != null;

  // Remember the last entered threshold so toggling free shipping off and back
  // on restores it instead of snapping to 0 (seeded with the saved value).
  const lastThresholdRef = useRef<number>(
    freeThreshold != null ? freeThreshold / 100 : 0,
  );

  // Renders a USD-base-cents amount in the given currency, so the saved (active)
  // value stays legible alongside the edited input.
  const fmtSaved = (usdCents: number, cur: Currency) => {
    const rate = cur === "usd" ? 1 : (rates[cur] ?? 1);
    return formatPrice(convertCents(usdCents, cur, rate), cur);
  };

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
        <PriceInput
          value={Number.isFinite(flat) ? flat : 0}
          onChange={(usd) =>
            setValue("shippingFlatRate", usd, { shouldValidate: true, shouldDirty: true })
          }
          rates={rates}
          defaultCurrency={currency}
          onCurrencyChange={setFlatCurrency}
        />
        {errors.shippingFlatRate?.message && (
          <p className="text-xs text-destructive">{errors.shippingFlatRate.message}</p>
        )}
        {/* Saved-value reminder is additive while editing; the instructional
            hint always stays so the field never loses its explanation. */}
        {dirtyFields.shippingFlatRate && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
            <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
            {tForm("savedValue", { value: fmtSaved(flatRate, flatCurrency) })}
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
          <PriceInput
            value={threshold ?? 0}
            onChange={(usd) =>
              setValue("shippingFreeThreshold", usd, { shouldValidate: true, shouldDirty: true })
            }
            rates={rates}
            defaultCurrency={currency}
            onCurrencyChange={setThresholdCurrency}
          />
          {errors.shippingFreeThreshold?.message && (
            <p className="text-xs text-destructive">{errors.shippingFreeThreshold.message}</p>
          )}
          {/* Saved-value reminder only when there's a saved threshold to compare;
              the instructional hint always stays below it. */}
          {dirtyFields.shippingFreeThreshold && freeThreshold != null && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
              <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
              {tForm("savedValue", { value: fmtSaved(freeThreshold, thresholdCurrency) })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t("shippingFreeThresholdHint")}</p>
        </div>
      )}

      {canEdit && (
        <FormSaveBar
          isDirty={isDirty}
          isPending={isPending}
          onDiscard={() => reset()}
          saveLabel={t("saveChanges")}
          saveDisabled={hasErrors}
        />
      )}
    </form>
  );
}
