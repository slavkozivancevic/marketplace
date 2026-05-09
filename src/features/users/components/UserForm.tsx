"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
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
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateUserRoleInput>({
    resolver: zodResolver(updateUserRoleSchema),
    defaultValues: {
      role: currentRole,
    },
  });

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("role")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectRole")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {UserRoleEnum.options.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0) + role.slice(1).toLowerCase()}
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
