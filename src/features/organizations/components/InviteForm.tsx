"use client";

import { useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sendInviteSchema, SendInviteInput } from "../schema/invites";
import { sendInviteAction } from "../actions/invites";
import { INVITABLE_ROLES } from "@/types/types";

export function InviteForm() {
  const t = useTranslations("invite");
  const onInvalid = useInvalidToast();
  const [isPending, startTransition] = useTransition();

  const pathname = usePathname();

  const form = useForm<SendInviteInput>({
    // Validate on blur, then on change, so the message tracks the current value.
    mode: "onTouched",
    resolver: useZodResolver(sendInviteSchema),
    defaultValues: {
      email: "",
      role: "MEMBER",
    },
  });

  // Reset to empty on entry so a half-filled invite doesn't survive
  // leave-and-return (Next.js keeps the route's React tree warm).
  useEffect(() => {
    form.reset({ email: "", role: "MEMBER" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const onSubmit = (data: SendInviteInput) => {
    startTransition(async () => {
      const result = await sendInviteAction(data);

      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("success"));
        form.reset();
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("email")}</FormLabel>
              <FormControl>
                <Input placeholder={t("emailPlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("role")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    {/* Explicit label so it shows pre-hydration (Radix's
                        SelectContent is portaled and the value→item lookup
                        isn't available yet). */}
                    <SelectValue placeholder={t("selectRole")}>
                      {field.value === "ADMIN"
                        ? t("roleAdmin")
                        : field.value === "MEMBER"
                          ? t("roleMember")
                          : null}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INVITABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === "ADMIN" ? t("roleAdmin") : t("roleMember")}
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
          {isPending ? t("sending") : t("send")}
        </Button>
      </form>
    </Form>
  );
}
