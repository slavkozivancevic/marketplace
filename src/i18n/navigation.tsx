import type { ComponentProps } from "react";
import { createNavigation } from "next-intl/navigation";
import { LinkPendingMark } from "@/components/ui/pressable";
import { routing } from "./routing";

/**
 * Typed navigation primitives. Use these everywhere we'd otherwise use
 * `next/link` / `next/navigation` in app code so locale + pathname
 * localization happens automatically. API:
 *   - `<Link href="/products" />`   -> serves /en/products on en, /sr/proizvodi on sr.
 *   - `<Link href={{ pathname: "/products/[slug]", params: { slug } }} />`
 *   - `router.push({ pathname: "/products/[slug]", params: { slug } })`
 *   - `redirect({ href: ..., locale: "sr" })` in server components
 *   - `getPathname({ href, locale })` to render a URL for a specific locale
 *     (used by hreflang and the language switcher).
 *
 * The wrapper picks pathnames from `routing.pathnames`, which is where the
 * `products <-> proizvodi <-> produkte <-> productos` mapping lives.
 */
const navigation = createNavigation(routing);
export const { redirect, usePathname, useRouter, getPathname } = navigation;

const BaseLink = navigation.Link;

/**
 * Every link carries `LinkPendingMark`, so the link itself - and anything
 * styled on it, like a `<Button asChild>` - can tell that the navigation it
 * started is still in flight and keep its pressed look until the next page
 * arrives (see `pressable.tsx`). The mark renders nothing at rest.
 */
export const Link = function Link({ children, ...props }: ComponentProps<typeof BaseLink>) {
  return (
    <BaseLink {...props}>
      {children}
      <LinkPendingMark />
    </BaseLink>
  );
} as typeof BaseLink;
