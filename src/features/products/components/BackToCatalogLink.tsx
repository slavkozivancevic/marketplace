"use client";

import { useSyncExternalStore } from "react";
import type { Route } from "next";
import NextLink from "next/link";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { readCatalogUrl } from "../utils/catalogReturn";

/** Nothing to subscribe to: the catalog writes its URL before this page is
 *  ever rendered, and it cannot change while the buyer is standing on a
 *  product page. The store exists only so the read happens after hydration. */
const subscribe = () => () => {};

/**
 * "Back to products", pointing at the catalog the buyer actually came from.
 *
 * The server and the hydrating render emit the plain catalog link; the
 * remembered URL is adopted on the first client snapshot. That order is
 * deliberate - the href has to exist for crawlers and for someone who landed
 * here straight from a search engine, and server and client markup have to
 * agree. `useSyncExternalStore` is what makes a browser-only read legal here;
 * an effect that set state would be a cascading render.
 *
 * The remembered URL is already localized and committed, so it goes through
 * `next/link` as-is - next-intl's Link would prefix the locale a second time.
 * It is a runtime string, hence the `Route` cast that typed routes require;
 * `readCatalogUrl` is what guarantees it is a same-origin path.
 *
 * Props are spread onto the anchor because the caller wraps this in a
 * `<Button asChild>`, which hands its styling down through the child.
 */
export function BackToCatalogLink({
  children,
  ...props
}: Omit<React.ComponentProps<"a">, "href">) {
  const locale = useLocale();
  const returnUrl = useSyncExternalStore(
    subscribe,
    () => readCatalogUrl(locale),
    () => null,
  );

  if (!returnUrl) {
    return (
      <Link href="/products" {...props}>
        {children}
      </Link>
    );
  }
  return (
    <NextLink href={returnUrl as Route} {...props}>
      {children}
    </NextLink>
  );
}
