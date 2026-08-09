"use client";

import { useTranslations } from "next-intl";

/**
 * "Fields marked with * are required" legend. Renders once near the top of a
 * form so the asterisk convention (`<FormLabel required>` / `<Label
 * required>`) never needs re-explaining per field - absence of the marker
 * means optional, with nothing extra to render for those fields.
 */
export function RequiredFieldsNote() {
  const t = useTranslations("form");
  return <p className="text-xs text-muted-foreground">{t("requiredHint")}</p>;
}
