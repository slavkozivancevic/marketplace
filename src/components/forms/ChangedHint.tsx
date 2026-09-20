"use client";

import { useTranslations } from "next-intl";

/**
 * Presentational "saved value" line shown under an edited field. Renders
 * nothing while `changed` is false. When `changed`, shows the saved (active)
 * value so the user can compare it against what they are now typing. Pass a
 * pre-formatted `savedText` (already localized / currency-formatted).
 *
 * A null `savedText` means the field was saved EMPTY, and it says so - "Saved:
 * (empty)" - rather than a bare "edited" marker. The marker answered the wrong
 * question: the user can see they edited the field, they are reading this line
 * to find out what was there before, and "edited" left them unable to tell an
 * empty baseline from a hint that simply could not render one.
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
      {t("savedValue", { value: savedText ?? t("emptyValue") })}
    </p>
  );
}
