"use client";

import { useEffect, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { FieldChangedHint } from "@/components/forms/FieldChangedHint";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  updateUserRoleSchema,
  UpdateUserRoleInput,
  UserRoleEnum,
} from "../schema/users";
import { updateUserRoleAction } from "../actions/users";

interface UserFormProps {
  userId: string;
  currentRole: UpdateUserRoleInput["role"];
  onSuccess?: () => void;
}

export function UserForm({ userId, currentRole, onSuccess }: UserFormProps) {
  const t = useTranslations("users");
  const tForm = useTranslations("form");
  const onInvalid = useInvalidToast();
  const [isPending, startTransition] = useTransition();
  const navGeneration = useNavigationGeneration();

  const form = useForm<UpdateUserRoleInput>({
    mode: "onChange",
    resolver: useZodResolver(updateUserRoleSchema),
    defaultValues: { role: currentRole },
    // Rebase the baseline whenever the server-confirmed role changes. After a
    // successful save the action revalidates, so `currentRole` updates in the
    // same commit that clears `isPending` - `isDirty` drops to false at that
    // same moment, so the dot/Discard/Update controls all settle in one frame
    // instead of flashing an intermediate "saving" state. RHF deep-compares
    // `values`, so re-creating this object each render doesn't wipe an in-
    // progress edit (currentRole is unchanged while editing).
    values: { role: currentRole },
  });

  // Reset on every navigation - the admin users list is a long-lived page that
  // Next.js can keep in memory via the Router Cache, so a Select change that
  // wasn't submitted would otherwise persist when the user leaves and returns.
  // RHF's `values` prop only reacts to value changes, not to navigation itself,
  // so it can't cover this case when the server-supplied role is unchanged. The
  // navigation-generation counter bumps on every path change, including a return
  // to the same route (where `usePathname` is identical and so never fired).
  useEffect(() => {
    form.reset({ role: currentRole });
    // Only on navigation - depending on `form`/`currentRole` re-ran this on
    // every render and continuously wiped the dirty state (so Save never enabled
    // and Discard never appeared).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  useUnsavedChangesWarning(form.formState.isDirty);

  const roleLabel = (role: unknown) =>
    role === "USER" ? t("user") : role === "SELLER" ? t("seller") : t("admin");

  const onSubmit = (data: UpdateUserRoleInput) => {
    startTransition(async () => {
      const result = await updateUserRoleAction(userId, data);

      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("roleUpdated"));
        onSuccess?.();
      }
    });
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("role")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    {/* Pass the label explicitly so it shows before the
                        portaled SelectContent has mounted (slow networks,
                        pre-hydration). Without this, Radix Select renders
                        empty until it can look up the matching SelectItem. */}
                    <SelectValue placeholder={t("selectRole")}>
                      {field.value === "USER"
                        ? t("user")
                        : field.value === "SELLER"
                          ? t("seller")
                          : field.value === "ADMIN"
                            ? t("admin")
                            : null}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {UserRoleEnum.options.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === "USER"
                        ? t("user")
                        : role === "SELLER"
                          ? t("seller")
                          : t("admin")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldChangedHint format={roleLabel} />
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-2">
          {/* Per-row discard: only while this user's role is actually changed,
              so the list stays quiet. Reverts to the saved role. */}
          {form.formState.isDirty && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => form.reset({ role: currentRole })}
            >
              {tForm("discard")}
            </Button>
          )}
          <Button
            type="submit"
            disabled={
              isPending ||
              !form.formState.isDirty ||
              Object.keys(form.formState.errors).length > 0
            }
          >
            {isPending && <Loader2 className="animate-spin" />}
            {isPending ? t("saving") : t("updateRole")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
