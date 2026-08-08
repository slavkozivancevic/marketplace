"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import axios from "axios";

type SlugCheckEntity = "brand" | "category" | "product" | "tag";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "taken" }
  | { kind: "error" };

/**
 * Inline availability indicator for slug inputs. Sits next to the slug
 * field and tells the admin in real time whether `slug` is free for
 * (entity, locale) - matches the `@@unique([locale, slug])` constraint
 * that would otherwise only fail at save time.
 *
 * Debounce: 350ms. Doesn't block submit on its own - the server still
 * enforces uniqueness, the form just won't surface a confusing "slug
 * taken" error after the user has typed past the conflict.
 */
export function SlugAvailabilityIndicator({
  entity,
  locale,
  slug,
  excludeId,
}: {
  entity: SlugCheckEntity;
  locale: string;
  slug: string | undefined | null;
  /** Existing entity id when editing - skips counting "self" as a conflict. */
  excludeId?: string;
}) {
  const t = useTranslations("slugAvailability");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    const trimmed = (slug ?? "").trim();
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "checking" });
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get<{ available: boolean }>(
          "/api/admin/slug-check",
          {
            params: { entity, locale, slug: trimmed, excludeId },
            signal: abort.signal,
          },
        );
        setStatus({ kind: data.available ? "ok" : "taken" });
      } catch (err) {
        // AbortError is the expected "user typed again" path - ignore.
        if (axios.isCancel(err)) return;
        setStatus({ kind: "error" });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [entity, locale, slug, excludeId]);

  if (status.kind === "idle") return null;

  if (status.kind === "checking") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("checking")}
      </span>
    );
  }

  if (status.kind === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <Check className="h-3 w-3" />
        {t("available")}
      </span>
    );
  }

  if (status.kind === "taken") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <X className="h-3 w-3" />
        {t("taken")}
      </span>
    );
  }

  // status.kind === "error" - network glitch / 5xx. Quiet hint, not a
  // blocking error: server still enforces uniqueness at save time.
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {t("checkFailed")}
    </span>
  );
}
