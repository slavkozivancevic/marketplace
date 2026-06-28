"use client";

import { useTranslations } from "next-intl";

/**
 * Presentational "saved value" line shown under an edited field. Renders
 * nothing while `changed` is false. When `changed`, shows the saved (active)
 * value so the user can compare it against what they are now typing. Pass a
 * pre-formatted `savedText` (already localized / currency-formatted); a null
 * `savedText` falls back to a plain "edited" marker (e.g. when there is no
 * meaningful prior value).
 *
 * Used directly by raw (non-`<FormField>`) forms; `<FieldChangedHint>` wraps it
 * for react-hook-form `<FormField>` contexts.
 */
export function ChangedHint({
  changed,
  savedText,
}: {
  changed: boolean;
  savedText: string | null;
}) {
  const t = useTranslations("form");

  if (!changed) return null;

  return (
    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
      <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
      {savedText != null ? t("savedValue", { value: savedText }) : t("changed")}
    </p>
  );
}
