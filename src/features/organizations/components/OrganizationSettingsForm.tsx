"use client";

import { useEffect, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useTranslations } from "next-intl";
import { useForm, useFormState } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
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
import { RequiredFieldsNote } from "@/components/forms/RequiredFieldsNote";
import { FieldChangedHint } from "@/components/forms/FieldChangedHint";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  updateOrganizationNameSchema,
  UpdateOrganizationNameInput,
} from "../schema/organizations";
import { updateOrganizationNameAction } from "../actions/organizations";

interface OrganizationSettingsFormProps {
  currentName: string;
  canEdit: boolean;
}

export function OrganizationSettingsForm({
  currentName,
  canEdit,
}: OrganizationSettingsFormProps) {
  const t = useTranslations("organization");
  const onInvalid = useInvalidToast();
  const [isPending, startTransition] = useTransition();
  const announceSaved = useAnnounceWhenSettled(isPending);
  const whenSettled = useWhenSettled(isPending);

  const navGeneration = useNavigationGeneration();

  // Single dirty baseline: `defaultValues` only. We deliberately do NOT pass
  // RHF's `values` prop here - mixing `values` + `defaultValues` made
  // `isDirty` unreliable (the unsaved-changes bar never appeared while typing).
  const form = useForm<UpdateOrganizationNameInput>({
    mode: "onChange",
    resolver: useZodResolver(updateOrganizationNameSchema),
    defaultValues: { name: currentName },
  });

  // Re-baseline the form to the server-supplied name when it actually changes
  // (after a successful save) or when navigating back to this page. Next.js can
  // keep the route's React tree warm, so without this an unsaved edit could
  // survive a leave-and-return. Keyed on `currentName` + the navigation-
  // generation counter (bumps on every real path change, including returning to
  // the same route), and stable while you stay on the page so it never
  // interrupts editing.
  useEffect(() => {
    form.reset({ name: currentName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentName, navGeneration]);

  // `form.formState.x` is a proxy getter, unsafe to read during render under
  // the React Compiler (it treats `form` as a stable dependency and can
  // cache a stale snapshot - see the identical fix in VariantsEditor.tsx).
  const { isDirty } = useFormState({ control: form.control });

  useUnsavedChangesWarning(isDirty);

  // Block saving while the name is invalid (consistent with all admin forms).
  // `Object.keys(errors)` reads the WHOLE error object, whose identity never
  // changes (react-hook-form mutates it in place), so under the React Compiler
  // it memoizes to its first result and the flag freezes at `false`. Reading it
  // through the hook keeps it live. See useSaveBlockedReason for the details.
  const hasErrors = useHasFormErrors(form.control);

  const saveBlockedReason = useSaveBlockedReason(form.control);

  const onSubmit = (data: UpdateOrganizationNameInput) => {
    startTransition(async () => {
      const result = await updateOrganizationNameAction(data);

      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        // Adopt the saved name as the new baseline. The re-baseline effect above
        // only fires once the server sends a new `currentName`, which lands after
        // the action resolves - so the bar, and the unsaved-changes guard with
        // it, outlived the save that cleared them.
        //
        // Deferred to the settled frame: doing it while the save is in flight
        // clears the dirty flag, the "saved value" hint under the field vanishes,
        // and the save bar jumps up with its own spinner still running.
        whenSettled(() => form.reset(data));
        // Announced when the bar collapses to "all changes saved" - see the
        // same note in OrgShippingForm.
        announceSaved({ message: t("nameUpdated") });
      }
    });
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
        <RequiredFieldsNote />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>{t("orgName")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("orgNamePlaceholder")}
                  disabled={!canEdit}
                  {...field}
                />
              </FormControl>
              <FieldChangedHint />
              <FormMessage />
              {!canEdit && (
                <p className="text-xs text-muted-foreground">
                  {t("editRestricted")}
                </p>
              )}
            </FormItem>
          )}
        />

        {canEdit && (
          <FormSaveBar
            isDirty={isDirty}
            isPending={isPending}
            onDiscard={() => form.reset()}
            saveLabel={t("saveChanges")}
            saveDisabled={hasErrors}
          saveDisabledReason={saveBlockedReason}
          />
        )}
      </form>
    </Form>
  );
}
