import type { $ZodErrorMap, $ZodRawIssue } from "zod/v4/core";

/**
 * Loose translator signature so this module stays decoupled from next-intl's
 * strictly-typed `t`. Both the client hook (`useZodResolver`) and the server
 * helper (`getServerZodErrorMap`) adapt their `t` to this shape and pass it in.
 */
export type ValidationT = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/**
 * Builds a Zod v4 error map that translates issues through the `validation`
 * message namespace, so validation messages follow the active locale instead of
 * the English strings baked into Zod's defaults.
 *
 * Schemas therefore omit inline message strings for standard validators (an
 * inline message would win over this map). Bespoke `superRefine` issues opt in
 * by carrying `params.i18n` (the message key) plus any interpolation values.
 */
export function createZodErrorMap(t: ValidationT): $ZodErrorMap {
  return (issue: $ZodRawIssue) => {
    switch (issue.code) {
      case "invalid_type": {
        // A missing field surfaces as invalid_type with undefined input - treat
        // that as "required" rather than a type mismatch.
        if (issue.input === undefined || issue.input === null) return t("required");
        if (issue.expected === "int") return t("notInteger");
        return t("invalidType");
      }
      case "too_small": {
        const min = Number(issue.minimum);
        if (issue.origin === "string") {
          return min <= 1 ? t("required") : t("tooSmallString", { min });
        }
        if (issue.origin === "array" || issue.origin === "set") {
          return min <= 1 ? t("required") : t("tooSmallArray", { min });
        }
        // number / int / bigint
        if (min === 0) return issue.inclusive ? t("nonnegative") : t("positive");
        return t("numberMin", { min });
      }
      case "too_big": {
        const max = Number(issue.maximum);
        if (issue.origin === "string") return t("tooBigString", { max });
        return t("numberMax", { max });
      }
      case "invalid_format": {
        if (issue.format === "email") return t("invalidEmail");
        if (issue.format === "url") return t("invalidUrl");
        return t("invalidFormat");
      }
      case "not_multiple_of":
        return t("notInteger");
      case "invalid_value":
        return t("invalidOption");
      case "custom": {
        const params = issue.params as
          | (Record<string, string | number> & { i18n?: string })
          | undefined;
        if (params?.i18n) return t(params.i18n, params);
        return t("custom");
      }
      case "invalid_union":
        // A value matched none of a union's branches. Zod v4 already flattens
        // the common "X or empty" shape into the branch's own issue (e.g. an
        // email format error), so this only fires for genuinely ambiguous
        // unions where no single branch message is meaningful. Keep it
        // localized rather than leaking Zod's English default; a form needing a
        // specific message should opt in via `superRefine` + `params.i18n`.
        return t("invalid");
      default:
        // Anything we don't model explicitly (unrecognized_keys, invalid_key,
        // invalid_element, ...) still gets a localized fallback - a validation
        // message must never surface in English regardless of the locale.
        return t("invalid");
    }
  };
}
