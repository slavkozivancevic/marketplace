import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { asLocale, DEFAULT_LOCALE } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value ?? DEFAULT_LOCALE;
  const validLocale = asLocale(raw);

  return {
    locale: validLocale,
    messages: (await import(`../../messages/${validLocale}.json`)).default,
  };
});
