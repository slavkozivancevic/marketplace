"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateOrganizationNameInput>({
    resolver: zodResolver(updateOrganizationNameSchema),
    defaultValues: { name: currentName },
    // Re-sync when the server-supplied name changes — Next.js can preserve the
    // React tree across navigations, so without this the unsaved edits would
    // persist when the user leaves the page and returns.
    values: { name: currentName },
  });

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <FormMessage />
            </FormItem>
          )}
        />

        {canEdit && (
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isPending ? t("saving") : t("saveChanges")}
          </Button>
        )}
      </form>
    </Form>
  );
}
