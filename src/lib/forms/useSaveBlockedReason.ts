"use client";

import { useTranslations } from "next-intl";
import {
  useFormState,
  useWatch,
  type Control,
  type FieldValues,
} from "react-hook-form";
import { collectFormErrorMessages } from "./formErrors";

/**
 * Read the live error tree of a form.
 *
 * Two things make this harder than it looks, and both have bitten us:
 *
 * 1. React Hook Form mutates `formState.errors` IN PLACE (`set`/`unset` on the
 *    same object - see `shouldRenderByError`). The object's identity never
 *    moves, so any value derived from it can be memoized against a dependency
 *    that never changes. With the React Compiler enabled (next.config.ts) that
 *    memoization is automatic and invisible: a `Object.keys(errors).length` or
 *    a `collectFormErrorMessages(errors)` gets frozen at its first result. The
 *    compiler also re-infers `useMemo` dependencies, so padding the dep array
 *    with a value that DOES change (e.g. `useWatch`'s output) does not help -
 *    the compiler drops deps the callback never reads.
 *
 * 2. Validation is async. `useWatch` re-renders the moment a value changes,
 *    which is BEFORE the zod resolver has produced the new errors. Anything
 *    memoized on the watched values therefore reads the previous error set and
 *    is never recomputed when the real one lands - the message would appear one
 *    edit late, which is exactly how a negative price stayed silent until an
 *    unrelated field was touched.
 *
 * The fix for both is to not cache at all: `"use no memo"` opts this hook out
 * of the React Compiler, and the error walk runs on every render. `useFormState`
 * re-renders us when the error set changes (that is the render that matters);
 * `useWatch` additionally re-renders us on every value change, so a render
 * always follows the resolver settling.
 */
function useLiveFormErrors<T extends FieldValues>(control: Control<T>) {
  "use no memo";
  useWatch({ control });
  const { errors } = useFormState({ control });
  return errors;
}

/**
 * True while the form has at least one validation error.
 *
 * Use this instead of reading `formState.errors` in the component: the same
 * stale-identity trap described above applies to a plain
 * `Object.keys(errors).length > 0` in a compiled component, and a stale `false`
 * there leaves the Save button enabled and hides `<SaveBlockedNotice>` even
 * when `reason` is correct.
 */
export function useHasFormErrors<T extends FieldValues>(
  control: Control<T>,
): boolean {
  "use no memo";
  const errors = useLiveFormErrors(control);
  return Object.keys(errors).length > 0;
}

/**
 * The sentence to show next to a Save button that is disabled by validation.
 *
 * Every admin form disables Save while there are errors (the house rule), but a
 * disabled button with no explanation is indistinguishable from a broken one -
 * especially on a tabbed form, where the offending field is often on a tab the
 * user is not looking at. This turns the error tree into one line: the first
 * message, plus how many others are waiting behind it.
 *
 * Returns `undefined` when the form is valid, so it can be passed straight
 * through to `<FormSaveBar saveDisabledReason>` / `<SaveBlockedNotice reason>`.
 */
export function useSaveBlockedReason<T extends FieldValues>(
  control: Control<T>,
): string | undefined {
  "use no memo";
  const t = useTranslations("form");
  const errors = useLiveFormErrors(control);
  const messages = collectFormErrorMessages(errors);

  if (messages.length === 0) return undefined;
  return messages.length > 1
    ? t("saveBlockedMore", { message: messages[0], count: messages.length - 1 })
    : t("saveBlocked", { message: messages[0] });
}
