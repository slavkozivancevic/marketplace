"use client";

import { useTranslations } from "next-intl";
import type { FieldErrors } from "react-hook-form";
import { toast } from "@/components/ui/sonner";
import { collectFormErrorMessages } from "./formErrors";

/**
 * Returns an `onInvalid` handler for `form.handleSubmit(onValid, onInvalid)`
 * that surfaces a toast when a submit is blocked by validation. Shows the first
 * field message (already localized via the zod error map), falling back to a
 * generic `common.validationFailed` string. Keeps the failed-submit feedback
 * consistent across every form.
 */
export function useInvalidToast() {
  const t = useTranslations("common");
  return (errors: FieldErrors) => {
    const first = collectFormErrorMessages(errors)[0];
    toast.error(first ?? t("validationFailed"));
  };
}
