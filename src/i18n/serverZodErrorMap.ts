import "server-only";
import { getTranslations } from "next-intl/server";
import type { $ZodErrorMap } from "zod/v4/core";
import { createZodErrorMap, type ValidationT } from "./zodErrorMap";

/**
 * Server-side counterpart to {@link useZodResolver}. Server actions validate
 * defensively after the client form, so when a parse fails the surfaced message
 * should still follow the request locale. Pass the result as the parse context:
 *
 *   const parsed = schema.safeParse(input, { error: await getServerZodErrorMap() });
 */
export async function getServerZodErrorMap(): Promise<$ZodErrorMap> {
  const t = await getTranslations("validation");
  const translate: ValidationT = (key, values) =>
    t(key as Parameters<typeof t>[0], values);
  return createZodErrorMap(translate);
}
