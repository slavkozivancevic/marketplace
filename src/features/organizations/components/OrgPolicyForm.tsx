"use client";

import { useRef, useTransition } from "react";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
import { useWhenSettled } from "@/lib/hooks/useWhenSettled";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import {
  useHasFormErrors,
  useSaveBlockedReason,
} from "@/lib/forms/useSaveBlockedReason";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { ChangedHint } from "@/components/forms/ChangedHint";
import { RequiredFieldsNote } from "@/components/forms/RequiredFieldsNote";
import {
  MAX_POLICY_DAYS,
  updateOrganizationPolicySchema,
  type UpdateOrganizationPolicyInput,
} from "../schema/organizations";
import { updateOrganizationPolicyAction } from "../actions/organizations";

/** Default range offered when the seller switches the delivery estimate on for
 *  the first time. A starting point to edit, never what gets saved behind their
 *  back: with the switch off both columns stay null and the storefront says
 *  nothing about delivery time. */
const DEFAULT_LEAD_TIME: { min: number; max: number } = { min: 2, max: 7 };

/** The two halves of the estimate, always revalidated together. */
const LEAD_TIME_FIELDS = ["leadTimeMinDays", "leadTimeMaxDays"] as const;

type PolicyField = "leadTimeMinDays" | "leadTimeMaxDays" | "returnWindowDays";

/**
 * The two promises a seller makes to a buyer: how long delivery takes, and how
 * long they accept returns.
 *
 * Neither is cosmetic. The return window is what `createReturn` measures the
 * deadline against, so the number typed here is the number the server enforces.
 */
export function OrgPolicyForm({
  leadTimeMinDays,
  leadTimeMaxDays,
  returnWindowDays,
  canEdit,
}: {
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
  returnWindowDays: number;
  canEdit: boolean;
}) {
  const t = useTranslations("organization");
  const onInvalid = useInvalidToast();
  const [isPending, start] = useTransition();
  const announceSaved = useAnnounceWhenSettled(isPending);
  const whenSettled = useWhenSettled(isPending);

  const { handleSubmit, control, setValue, reset, trigger } =
    useForm<UpdateOrganizationPolicyInput>({
      mode: "onChange",
      resolver: useZodResolver(updateOrganizationPolicySchema),
      defaultValues: { leadTimeMinDays, leadTimeMaxDays, returnWindowDays },
    });

  // Read through `useFormState`, not by destructuring `formState` off `useForm`:
  // that is a proxy getter on an object whose identity never changes, so the
  // React Compiler caches the first read and freezes the flags. Same reason as
  // in OrgShippingForm.
  const { isDirty, dirtyFields, errors } = useFormState({ control });
  useUnsavedChangesWarning(isDirty);
  const hasErrors = useHasFormErrors(control);
  const saveBlockedReason = useSaveBlockedReason(control);

  const min = useWatch({ control, name: "leadTimeMinDays" });
  const max = useWatch({ control, name: "leadTimeMaxDays" });
  const returnWindow = useWatch({ control, name: "returnWindowDays" });
  const leadTimeEnabled = min != null || max != null;

  // Remember the last range so switching the estimate off and back on restores
  // what the seller had typed instead of snapping to the default.
  const lastRangeRef = useRef<{ min: number; max: number }>({
    min: leadTimeMinDays ?? DEFAULT_LEAD_TIME.min,
    max: leadTimeMaxDays ?? DEFAULT_LEAD_TIME.max,
  });

  // Controlled rather than `register`d, for the same reason the product form's
  // warranty field is: these inputs hold `number | null`, and handing a null
  // straight to an <input> flips it to uncontrolled mid-edit. Null is also the
  // shape the schema speaks - for the optional pair it means "no promise", and
  // for the required window it is what produces the "required" message, which
  // `valueAsNumber`'s NaN would have reported as a type error instead.
  const numberOrNull = (raw: string): number | null => {
    if (raw.trim() === "") return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  // The range is validated as a PAIR, so revalidating only the field that just
  // changed is not enough. The schema puts its cross-field issue on whichever
  // half is missing, and `shouldValidate` clears the error on the named field
  // only: clearing min first moved the issue onto min, clearing max then left
  // that issue behind - on a field the switch had just unmounted, with Save
  // locked and nothing on screen to fix. Editing one half out of a bad range
  // had the same hole in the other direction.
  const revalidateFor = (name: PolicyField) =>
    void trigger(name === "returnWindowDays" ? name : LEAD_TIME_FIELDS);

  const setDays = (name: PolicyField, raw: string) => {
    setValue(name, numberOrNull(raw) as never, { shouldDirty: true });
    revalidateFor(name);
  };

  const onSubmit = (data: UpdateOrganizationPolicyInput) => {
    start(async () => {
      const res = await updateOrganizationPolicyAction(data);
      if (res && "error" in res) {
        toast.error(res.message);
        return;
      }
      // Adopt the saved values as the new baseline, on the settled frame - the
      // same reasoning as OrgShippingForm: re-baselining mid-flight collapses
      // the hints under the fields and makes the save bar jump.
      whenSettled(() => reset(data));
      announceSaved({ message: t("policyUpdated") });
    });
  };

  const days = (value: number | null | undefined) =>
    value == null ? null : t("daysValue", { count: value });

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4 max-w-md">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5 pr-4">
          <Label htmlFor="lead-time">{t("leadTimeEnabled")}</Label>
          <p className="text-sm text-muted-foreground">{t("leadTimeEnabledHint")}</p>
        </div>
        <Switch
          id="lead-time"
          checked={leadTimeEnabled}
          disabled={!canEdit}
          onCheckedChange={(checked) => {
            if (checked) {
              setValue("leadTimeMinDays", lastRangeRef.current.min, { shouldDirty: true });
              setValue("leadTimeMaxDays", lastRangeRef.current.max, { shouldDirty: true });
            } else {
              if (min != null && max != null) lastRangeRef.current = { min, max };
              setValue("leadTimeMinDays", null, { shouldDirty: true });
              setValue("leadTimeMaxDays", null, { shouldDirty: true });
            }
            void trigger(LEAD_TIME_FIELDS);
          }}
        />
      </div>

      {leadTimeEnabled && (
        <div className="flex gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <Label htmlFor="lead-min">{t("leadTimeMinDays")}</Label>
            <Input
              id="lead-min"
              type="number"
              step="1"
              min={0}
              max={MAX_POLICY_DAYS}
              disabled={!canEdit}
              aria-invalid={!!errors.leadTimeMinDays}
              value={min ?? ""}
              onChange={(e) => setDays("leadTimeMinDays", e.target.value)}
            />
            {errors.leadTimeMinDays?.message && (
              <p className="text-xs text-destructive">{errors.leadTimeMinDays.message}</p>
            )}
            <ChangedHint
              changed={!!dirtyFields.leadTimeMinDays}
              savedText={days(leadTimeMinDays)}
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <Label htmlFor="lead-max">{t("leadTimeMaxDays")}</Label>
            <Input
              id="lead-max"
              type="number"
              step="1"
              min={0}
              max={MAX_POLICY_DAYS}
              disabled={!canEdit}
              aria-invalid={!!errors.leadTimeMaxDays}
              value={max ?? ""}
              onChange={(e) => setDays("leadTimeMaxDays", e.target.value)}
            />
            {errors.leadTimeMaxDays?.message && (
              <p className="text-xs text-destructive">{errors.leadTimeMaxDays.message}</p>
            )}
            <ChangedHint
              changed={!!dirtyFields.leadTimeMaxDays}
              savedText={days(leadTimeMaxDays)}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {/* Asterisk only on the required field - the delivery estimate above is
            genuinely optional, and marking it would say the opposite. */}
        <Label htmlFor="return-window" required>
          {t("returnWindowDays")}
        </Label>
        <Input
          id="return-window"
          type="number"
          step="1"
          min={0}
          max={MAX_POLICY_DAYS}
          disabled={!canEdit}
          aria-invalid={!!errors.returnWindowDays}
          value={returnWindow ?? ""}
          onChange={(e) => setDays("returnWindowDays", e.target.value)}
        />
        {errors.returnWindowDays?.message && (
          <p className="text-xs text-destructive">{errors.returnWindowDays.message}</p>
        )}
        <ChangedHint
          changed={!!dirtyFields.returnWindowDays}
          savedText={days(returnWindowDays)}
        />
        <p className="text-xs text-muted-foreground">{t("returnWindowDaysHint")}</p>
      </div>

      {canEdit ? (
        <>
          <RequiredFieldsNote />
          <FormSaveBar
            isDirty={isDirty}
            isPending={isPending}
            onDiscard={() => reset()}
            saveLabel={t("saveChanges")}
            saveDisabled={hasErrors}
            saveDisabledReason={saveBlockedReason}
          />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t("editRestricted")}</p>
      )}
    </form>
  );
}
