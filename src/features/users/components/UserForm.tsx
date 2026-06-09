"use client";

import { useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
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
  const onInvalid = useInvalidToast();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();

  const form = useForm<UpdateUserRoleInput>({
    mode: "onTouched",
    resolver: useZodResolver(updateUserRoleSchema),
    defaultValues: { role: currentRole },
  });

  // Reset on every navigation - the admin users list is a long-lived page that
  // Next.js can keep in memory via the Router Cache, so a Select change that
  // wasn't submitted would otherwise persist when the user leaves and returns.
  // RHF's `values` prop only reacts to value changes, not to navigation itself,
  // so it can't cover this case when the server-supplied role is unchanged.
  useEffect(() => {
    form.reset({ role: currentRole });
  }, [pathname, currentRole, form]);

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
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
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
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? t("saving") : t("updateRole")}
        </Button>
      </form>
    </Form>
  );
}
