/**
 * Maps the app locale ("en" | "sr") to the BCP 47 locale tag used for
 * Intl / toLocaleString date formatting.
 * Serbian uses Latin script in this app, so "sr" → "sr-Latn".
 */
export function dateLocale(locale: string): string {
  return locale === "sr" ? "sr-Latn" : "en-US";
}