"use client";

import { useEffect, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useTranslations } from "next-intl";
import { Loader2, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
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
import { sendInviteFormSchema, SendInviteInput } from "../schema/invites";
import { sendInviteAction } from "../actions/invites";
import { INVITABLE_ROLES } from "@/types/types";

export function InviteForm() {
  const t = useTranslations("invite");
  const onInvalid = useInvalidToast();
  const [isPending, startTransition] = useTransition();

  const navGeneration = useNavigationGeneration();

  const form = useForm<SendInviteInput>({
    // Validate as the user types so the message tracks the current value.
    mode: "onChange",
    resolver: useZodResolver(sendInviteFormSchema),
    defaultValues: {
      email: "",
      role: "MEMBER",
    },
  });

  // Reset to empty on entry so a half-filled invite doesn't survive
  // leave-and-return (Next.js keeps the route's React tree warm). Keyed on the
  // navigation-generation counter, which bumps on every path change - including
  // returning to the same route (`usePathname` stays identical there and so
  // never fired the reset).
  useEffect(() => {
    form.reset({ email: "", role: "MEMBER" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  // Empty is valid in the form schema, so a cleared field renders neutral on its
  // own (no imperative error-clearing needed); a non-empty invalid address still
  // shows the localized error. Submit stays gated on a non-empty value below.
  const email = useWatch({ control: form.control, name: "email" });

  const hasErrors = Object.keys(form.formState.errors).length > 0;

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
      <form noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("email")}</FormLabel>
              <FormControl>
                <div className="relative flex items-center">
                  <Input placeholder={t("emailPlaceholder")} className="pr-9" {...field} />
                  {/* Inline clear (X) - lets the user bail out of a typed/invalid
                      email without leaving the field red. Same pattern as the
                      product search bar. Shown only while there's a value.
                      Returns focus to the input so keyboard/SR users don't lose
                      their place when the button unmounts. */}
                  {field.value && (
                    <button
                      type="button"
                      onClick={() => {
                        // shouldValidate re-runs the resolver so the error clears
                        // (empty is valid in the form schema) - matching what a
                        // manual delete does. Without it the old error lingers.
                        form.setValue("email", "", {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        form.setFocus("email");
                      }}
                      className="absolute right-3 cursor-pointer rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label={t("clear")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
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

        <Button type="submit" disabled={isPending || hasErrors || !email}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? t("sending") : t("send")}
        </Button>
      </form>
    </Form>
  );
}
