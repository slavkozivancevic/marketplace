"use client";

import { useMemo } from "react";
import { useFormState, useWatch, type Control, type FieldValues } from "react-hook-form";

/**
 * Whether the form currently differs from its saved baseline, derived by
 * comparing live values against `defaultValues` rather than trusting
 * react-hook-form's own `isDirty`.
 *
 * RHF recomputes `isDirty` only inside the `setValue`/`onChange` call that
 * triggered it, against whatever the rest of the form looked like AT THAT
 * MOMENT. Any field whose value is written in a LATER step therefore isn't
 * accounted for, and the flag is never revisited afterwards. The
 * auto-derived slug is exactly that shape: clearing the title updates
 * `title` first (RHF evaluates while the stale slug still differs -> dirty),
 * then a follow-up write resets `slug`, which never re-evaluates. The bar
 * stayed lit even though every value matched its baseline again.
 *
 * Comparing the values themselves has no such ordering hazard: whenever any
 * value settles, the answer reflects the whole form as it actually stands.
 */
export function useIsFormDirty<T extends FieldValues>(control: Control<T>): boolean {
  const values = useWatch({ control });
  const { defaultValues } = useFormState({ control });

  return useMemo(
    () => !valuesEqual(values, defaultValues),
    [values, defaultValues],
  );
}

/**
 * Deep equality tuned for form values: `undefined`, a missing key and `null`
 * all mean "no value entered", so a field the server returned as null and one
 * the user cleared to "" must not read as a change. Empty string is
 * deliberately NOT lumped in with those - clearing a text field to "" while
 * the baseline holds real text IS a change.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return a == null && b == null;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => valuesEqual(item, b[i]));
  }

  if (a instanceof Date || b instanceof Date) {
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  }

  if (typeof a !== "object" || typeof b !== "object") return false;

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (
      !valuesEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Exposed for unit tests only - not part of the public surface. */
export const __valuesEqualForTests = valuesEqual;
