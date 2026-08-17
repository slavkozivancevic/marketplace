"use client";

import { createContext, useContext } from "react";
import { useFormField } from "@/components/ui/form";
import { ChangedHint } from "./ChangedHint";

/**
 * Toggles every nested `<FieldChangedHint>` on/off. Forms with a create + edit
 * mode wrap their tree with `<ChangedHintScope enabled={mode === "edit"}>` so
 * the saved-vs-edited hints only appear when there is a saved baseline to
 * compare against. Defaults to enabled, so always-edit forms need no wrapper.
 */
const ChangedHintEnabledContext = createContext(true);

export function ChangedHintScope({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <ChangedHintEnabledContext.Provider value={enabled}>
      {children}
    </ChangedHintEnabledContext.Provider>
  );
}

/** Whether changed-value hints are active (i.e. we're editing an existing record
 *  with a saved baseline). Used by non-`<FormField>` editors (variant rows,
 *  attribute pickers) to decide whether to render their own hints. */
export function useChangedHintEnabled() {
  return useContext(ChangedHintEnabledContext);
}

/** Reads a (possibly dotted) path out of the form's defaultValues object. */
function getByPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc != null && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

/**
 * Renders, for the enclosing `<FormField>`, a small "saved value" line whenever
 * that field has been edited away from its saved baseline. This makes the
 * active (persisted) value visible next to what is currently being typed, so
 * the user can always compare old vs new. Renders nothing while the field is
 * untouched, or when disabled via `<ChangedHintScope enabled={false}>`.
 *
 * Must be used inside a `<FormField>` (it relies on `useFormField`).
 * `format` lets callers render non-trivial values (money, enums, booleans)
 * legibly; without it the raw saved value is shown.
 */
export function FieldChangedHint({
  format,
}: {
  format?: (value: unknown) => string;
}) {
  const enabled = useContext(ChangedHintEnabledContext);
  // Both `isDirty` and `defaultValues` come from useFormField's live
  // `useFormState` subscription. Reading them off `useFormContext().formState`
  // instead returned a compiler-frozen snapshot, so a field edited back to its
  // saved value kept rendering the "changed" hint forever.
  const { name, isDirty, defaultValues } = useFormField();

  if (!enabled) return null;

  const saved = getByPath(defaultValues, name);
  const hasSaved = saved != null && saved !== "";
  const text = hasSaved ? (format ? format(saved) : String(saved)) : null;

  return <ChangedHint changed={isDirty} savedText={text} />;
}
