"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";
import { createZodErrorMap, type ValidationT } from "./zodErrorMap";

/**
 * Drop-in replacement for `zodResolver(schema)` that localizes validation
 * messages. It wires the active locale's `validation` namespace into a Zod v4
 * error map and hands it to the resolver as parse-time context, so field errors
 * shown by `<FormMessage />` follow the user's language.
 *
 * The return type mirrors what `zodResolver` itself produces
 * (`Resolver<input, context, output>`) so callers keep full inference and the
 * swap from `zodResolver` stays transparent.
 */
export function useZodResolver<TFieldValues extends FieldValues, TOutput>(
  schema: z.ZodType<TOutput, TFieldValues>,
): Resolver<TFieldValues, unknown, TOutput> {
  const t = useTranslations("validation");
  return useMemo(() => {
    const translate: ValidationT = (key, values) =>
      t(key as Parameters<typeof t>[0], values);
    return zodResolver(schema, {
      error: createZodErrorMap(translate),
    }) as Resolver<TFieldValues, unknown, TOutput>;
  }, [schema, t]);
}
