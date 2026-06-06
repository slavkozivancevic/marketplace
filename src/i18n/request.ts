import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * Locale comes from the URL `[locale]` segment, resolved by the next-intl
 * middleware before this config runs. We validate against the configured
 * list to defend against malformed URLs and fall back to the default locale
 * otherwise.
 *
 * No cookie reads here - URL is the source of truth. The cookie still
 * exists but the middleware now writes it (as a preference hint for the
 * next naked-URL visit) instead of being the primary signal.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
