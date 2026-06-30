"use client";

import { useEffect, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
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

  useUnsavedChangesWarning(form.formState.isDirty);

  // Block saving while the name is invalid (consistent with all admin forms).
  const hasErrors = Object.keys(form.formState.errors).length > 0;

  const onSubmit = (data: UpdateOrganizationNameInput) => {
    startTransition(async () => {
      const result = await updateOrganizationNameAction(data);

      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("nameUpdated"));
      }
    });
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("orgName")}</FormLabel>
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
            isDirty={form.formState.isDirty}
            isPending={isPending}
            onDiscard={() => form.reset()}
            saveLabel={t("saveChanges")}
            saveDisabled={hasErrors}
          />
        )}
      </form>
    </Form>
  );
}
