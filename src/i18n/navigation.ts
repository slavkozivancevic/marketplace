import { createNavigation } from "next-intl/navigation";
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
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
