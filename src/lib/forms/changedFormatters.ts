"use client";

import { useTranslations } from "next-intl";

/**
 * Formatter helpers for `<FieldChangedHint format=...>` / `<ChangedHint>` so
 * boolean toggles render a legible saved value ("On" / "Off") instead of the
 * raw `true` / `false`.
 */
export function useBoolFormat() {
  const t = useTranslations("form");
  return (v: unknown) => (v ? t("on") : t("off"));
}
