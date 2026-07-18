import { NextResponse } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { HERO_IMAGE_URL } from "@/components/layout/hero-image";

/**
 * A real HTTP 404 served from the proxy (middleware) for entity-detail URLs
 * whose slug doesn't resolve.
 *
 * Why a hand-rolled page instead of the React `not-found.tsx`: with
 * `cacheComponents` (PPR) every `/[locale]/...` route ships a prerendered
 * static shell that is served with a 200 status, so rewriting to a real page
 * always yields 200 - the deep `notFound()` can't change it. A response
 * returned directly from the proxy carries the status we set, so this is the
 * only way to get a true 404 while keeping PPR on for every valid page.
 *
 * It runs before the React/client runtime, so it can't use the app's
 * components or providers. Instead it mirrors the styled `not-found.tsx`
 * (icon badge, eyebrow, title, description, primary button) plus a minimal
 * static header and footer, with inline CSS driven by the same design tokens
 * and honouring the user's saved theme cookie (light / dark / cosmos), falling
 * back to the system preference. The header/footer links are plain anchors -
 * the app's interactive widgets (theme/currency/auth/cart) need React and are
 * deliberately left off this pre-render-time page.
 */

type Copy = {
  // Main content - mirrors the React not-found page (notFound.* messages) 1:1.
  eyebrow: string; // notFound.title, e.g. "404 - Not Found"
  heading: string; // notFound.page
  body: string; // notFound.pageDescription
  home: string; // notFound.backToHome
  tagline: string; // short header eyebrow under the brand name
  products: string;
  brands: string;
  footer: {
    tagline: string; // longer marketing line in the footer brand column
    platform: string;
    pricing: string;
    company: string;
    about: string;
    blog: string;
    careers: string;
    legal: string;
    privacy: string;
    terms: string;
    cookies: string;
    crafted: string;
    copyright: string; // `{year}` is substituted at render time
  };
};

const COPY: Record<string, Copy> = {
  en: {
    eyebrow: "404 - Not Found",
    heading: "The page you are looking for does not exist.",
    body: "The URL you entered does not match any page on this site.",
    home: "Back to Home",
    tagline: "Enterprise Platform",
    products: "Products",
    brands: "Brands",
    footer: {
      tagline: "The enterprise-grade commerce platform built for modern sellers and buyers.",
      platform: "Platform",
      pricing: "Pricing",
      company: "Company",
      about: "About",
      blog: "Blog",
      careers: "Careers",
      legal: "Legal",
      privacy: "Privacy",
      terms: "Terms",
      cookies: "Cookies",
      crafted: "Crafted with precision for enterprise commerce.",
      copyright: "© {year} MarketVerse. All rights reserved.",
    },
  },
  sr: {
    eyebrow: "404 - Nije pronađeno",
    heading: "Stranica koju tražite ne postoji.",
    body: "URL koji ste uneli ne odgovara nijednoj stranici na ovom sajtu.",
    home: "Nazad na početnu",
    tagline: "Enterprise platforma",
    products: "Proizvodi",
    brands: "Brendovi",
    footer: {
      tagline: "Enterprise platforma za modernu trgovinu, za prodavce i kupce.",
      platform: "Platforma",
      pricing: "Cene",
      company: "Kompanija",
      about: "O nama",
      blog: "Blog",
      careers: "Karijera",
      legal: "Pravno",
      privacy: "Privatnost",
      terms: "Uslovi",
      cookies: "Kolačići",
      crafted: "Napravljeno s pažnjom za ozbiljnu trgovinu.",
      copyright: "© {year} MarketVerse. Sva prava zadržana.",
    },
  },
  de: {
    eyebrow: "404 - Nicht gefunden",
    heading: "Die gesuchte Seite existiert nicht.",
    body: "Die eingegebene URL entspricht keiner Seite auf dieser Website.",
    home: "Zurück zur Startseite",
    tagline: "Enterprise-Plattform",
    products: "Produkte",
    brands: "Marken",
    footer: {
      tagline: "Die Enterprise-Commerce-Plattform für moderne Verkäufer und Käufer.",
      platform: "Plattform",
      pricing: "Preise",
      company: "Unternehmen",
      about: "Über uns",
      blog: "Blog",
      careers: "Karriere",
      legal: "Rechtliches",
      privacy: "Datenschutz",
      terms: "AGB",
      cookies: "Cookies",
      crafted: "Mit Präzision für Enterprise-Commerce entwickelt.",
      copyright: "© {year} MarketVerse. Alle Rechte vorbehalten.",
    },
  },
  es: {
    eyebrow: "404 - No encontrado",
    heading: "La página que buscas no existe.",
    body: "La URL que has introducido no coincide con ninguna página de este sitio.",
    home: "Volver al inicio",
    tagline: "Plataforma empresarial",
    products: "Productos",
    brands: "Marcas",
    footer: {
      tagline: "La plataforma de comercio empresarial creada para vendedores y compradores modernos.",
      platform: "Plataforma",
      pricing: "Precios",
      company: "Empresa",
      about: "Acerca de",
      blog: "Blog",
      careers: "Carreras",
      legal: "Legal",
      privacy: "Privacidad",
      terms: "Términos",
      cookies: "Cookies",
      crafted: "Creado con precisión para el comercio empresarial.",
      copyright: "© {year} MarketVerse. Todos los derechos reservados.",
    },
  },
};

// Localized URL segments for the storefront list pages, so the header/footer
// links point at the visitor's locale (mirrors routing.pathnames).
const NAV_SEGMENTS: Record<string, { products: string; brands: string }> = {
  en: { products: "products", brands: "brands" },
  sr: { products: "proizvodi", brands: "brendovi" },
  de: { products: "produkte", brands: "marken" },
  es: { products: "productos", brands: "marcas" },
};

// App design tokens (see globals.css) inlined so this standalone page matches
// the themed UI without loading any stylesheet.
type Tokens = {
  bg: string;
  fg: string;
  muted: string;
  mutedFg: string;
  primary: string;
  primaryFg: string;
  border: string;
  // Background hero image treatment per theme (mirrors HeroBackground's
  // grayscale/opacity classes) so the 404 shares the same subtle backdrop.
  imgOpacity: string;
  imgFilter: string;
};

const LIGHT: Tokens = {
  bg: "oklch(0.94 0.008 240)",
  fg: "oklch(0.145 0 0)",
  muted: "oklch(0.885 0.012 240)",
  mutedFg: "oklch(0.46 0.012 240)",
  primary: "oklch(0.205 0 0)",
  primaryFg: "oklch(0.985 0 0)",
  border: "oklch(0.855 0.014 240)",
  imgOpacity: "0.08",
  imgFilter: "grayscale(1)",
};

const DARK: Tokens = {
  bg: "oklch(0.13 0 0)",
  fg: "oklch(0.985 0 0)",
  muted: "oklch(0.22 0 0)",
  mutedFg: "oklch(0.65 0 0)",
  primary: "oklch(0.922 0 0)",
  primaryFg: "oklch(0.145 0 0)",
  border: "oklch(1 0 0 / 10%)",
  imgOpacity: "0.05",
  imgFilter: "grayscale(1)",
};

const COSMOS: Tokens = {
  bg: "oklch(0.12 0.03 275)",
  fg: "oklch(0.95 0.01 80)",
  muted: "oklch(0.2 0.04 280)",
  mutedFg: "oklch(0.65 0.06 270)",
  primary: "oklch(0.85 0.02 255)",
  primaryFg: "oklch(0.12 0.03 275)",
  border: "oklch(0.35 0.08 285 / 40%)",
  imgOpacity: "0.07",
  imgFilter: "grayscale(0.4) hue-rotate(220deg)",
};

function vars(t: Tokens): string {
  return [
    `--bg:${t.bg}`,
    `--fg:${t.fg}`,
    `--muted:${t.muted}`,
    `--muted-fg:${t.mutedFg}`,
    `--primary:${t.primary}`,
    `--primary-fg:${t.primaryFg}`,
    `--border:${t.border}`,
    `--img-opacity:${t.imgOpacity}`,
    `--img-filter:${t.imgFilter}`,
  ].join(";");
}

/**
 * Emits the `:root` token block for the resolved theme. "system" (and any
 * unknown value) paints light by default and swaps to dark via the OS media
 * query, matching how the app paints before its client JS resolves the cookie.
 */
function themeCss(theme: string | undefined): string {
  if (theme === "dark") {
    return `:root{${vars(DARK)};--radius:0.625rem;color-scheme:dark}`;
  }
  if (theme === "cosmos") {
    return `:root{${vars(COSMOS)};--radius:0.625rem;color-scheme:dark}`;
  }
  if (theme === "light") {
    return `:root{${vars(LIGHT)};--radius:0.625rem;color-scheme:light}`;
  }
  // system / unknown: light default + dark via OS preference.
  return (
    `:root{${vars(LIGHT)};--radius:0.625rem;color-scheme:light dark}` +
    `@media (prefers-color-scheme:dark){:root{${vars(DARK)}}}`
  );
}

const SEARCH_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

const HOME_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';

// MarketVerse mark (comet + bag + stars), white variant for the fixed dark
// brand tile. Header uses 28px, footer 24px. Keep in sync with BrandMark.
const storeIcon = (px: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64"><defs><linearGradient id="nf-tail-${px}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f2eee7" stop-opacity="0"/><stop offset=".55" stop-color="#c9c7d0" stop-opacity=".5"/><stop offset="1" stop-color="#f2eee7"/></linearGradient></defs><path d="M3 7 C20 8 34 12 44.2 17.8 L43.6 23.3 C32 18.5 17 12 3 7 Z" fill="url(#nf-tail-${px})"/><circle cx="47" cy="20.5" r="4.2" fill="#f2eee7"/><path d="M20 30 L44 30 L47.3 46.8 Q48 50 44.5 50 L19.5 50 Q16 50 16.7 46.8 Z" fill="#0a0b1e" stroke="#f2eee7" stroke-width="1.5"/><path d="M27 30 v-2.8 a5 5 0 0 1 10 0 V30" fill="none" stroke="#f2eee7" stroke-width="2.4" stroke-linecap="round"/><path d="M10 11.2 Q10.7 13.3 12.8 14 Q10.7 14.7 10 16.8 Q9.3 14.7 7.2 14 Q9.3 13.3 10 11.2 Z" fill="#f2eee7"/><path d="M55 10 Q55.5 11.5 57 12 Q55.5 12.5 55 14 Q54.5 12.5 53 12 Q54.5 11.5 55 10 Z" fill="#c9c7d0" opacity=".9"/><path d="M7 35.6 Q7.6 37.4 9.4 38 Q7.6 38.6 7 40.4 Q6.4 38.6 4.6 38 Q6.4 37.4 7 35.6 Z" fill="#f2eee7" opacity=".85"/><path d="M57 40.2 Q57.45 41.55 58.8 42 Q57.45 42.45 57 43.8 Q56.55 42.45 55.2 42 Q56.55 41.55 57 40.2 Z" fill="#a5a3b0" opacity=".85"/><path d="M12 53.4 Q12.4 54.6 13.6 55 Q12.4 55.4 12 56.6 Q11.6 55.4 10.4 55 Q11.6 54.6 12 53.4 Z" fill="#c9c7d0" opacity=".8"/><circle cx="52" cy="31" r="0.9" fill="#f2eee7" opacity=".55"/><circle cx="34" cy="57.5" r="1" fill="#a5a3b0" opacity=".6"/></svg>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function notFoundResponse(locale: string, theme?: string): NextResponse {
  const lang = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const t = COPY[lang] ?? COPY[DEFAULT_LOCALE];
  const seg = NAV_SEGMENTS[lang] ?? NAV_SEGMENTS[DEFAULT_LOCALE];
  const home = `/${lang}`;
  const copyright = t.footer.copyright.replace("{year}", String(new Date().getFullYear()));

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, follow" />
<title>${escapeHtml(t.eyebrow)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  ${themeCss(theme)}
  * { box-sizing: border-box; }
  /* Geist is the app's --font-sans (next/font/google); load the same family so
     type matches the React pages 1:1. Sizes below mirror the exact Tailwind
     classes used by NotFoundHeader / NotFoundContent / Footer. */
  body {
    margin: 0; min-height: 100vh; display: flex; flex-direction: column;
    position: relative; line-height: 1.5;
    font-family: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: var(--bg); color: var(--fg);
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  a { color: inherit; }
  /* max-w-7xl px-4 sm:px-6 lg:px-8 */
  .container { width: 100%; max-width: 80rem; margin: 0 auto; padding: 0 1rem; }
  @media (min-width: 640px) { .container { padding: 0 1.5rem; } }
  @media (min-width: 1024px) { .container { padding: 0 2rem; } }
  /* Header: sticky top-0 z-50 border-b border-border/50 header-bg (opaque). */
  .site-header {
    position: sticky; top: 0; z-index: 50; width: 100%;
    border-bottom: 1px solid color-mix(in oklch, var(--border) 50%, transparent);
    background: var(--bg);
  }
  .hdr { position: relative; display: flex; align-items: center; height: 4rem; }
  /* group flex items-center gap-2.5 shrink-0 */
  .brand { display: inline-flex; align-items: center; gap: 0.625rem; text-decoration: none; flex-shrink: 0; }
  /* h-9 w-9 rounded-lg bg-primary */
  .brand-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 2.25rem; height: 2.25rem; border-radius: 0.625rem;
    /* Fixed dark brand tile - the mark is drawn for a dark backdrop. */
    background: #0a0b1e; border: 1px solid rgb(255 255 255 / 10%);
  }
  .brand-text { display: flex; flex-direction: column; }
  /* text-lg font-bold tracking-tight leading-tight */
  .brand-name { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.025em; line-height: 1.25; }
  /* text-[10px] font-medium uppercase tracking-[0.2em] leading-tight */
  .brand-tag {
    font-size: 10px; font-weight: 500; line-height: 1.25;
    text-transform: uppercase; letter-spacing: 0.2em; color: var(--muted-fg);
  }
  /* hidden md:flex; centered in the bar like the real header. */
  .nav {
    position: absolute; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 0.25rem;
  }
  /* px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground */
  .nav a {
    padding: 0.5rem 1rem; font-size: 0.875rem; line-height: 1.25rem; font-weight: 500;
    color: var(--muted-fg); text-decoration: none;
  }
  .nav a:hover { color: var(--fg); }
  @media (max-width: 767.98px) { .nav { display: none; } }
  /* flex-1 flex items-center justify-center px-6 py-12 */
  .main {
    flex: 1; display: flex; align-items: center; justify-content: center;
    padding: 3rem 1.5rem;
  }
  /* Footer: border-t border-border/50 bg-card/30 backdrop-blur-xs (4px). */
  .site-footer {
    border-top: 1px solid color-mix(in oklch, var(--border) 50%, transparent);
    background: color-mix(in oklch, var(--card) 30%, transparent);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
  /* grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4 */
  .ftr-grid {
    display: grid; grid-template-columns: 1fr; gap: 2rem;
    padding-top: 3rem; padding-bottom: 3rem;
  }
  @media (min-width: 640px) { .ftr-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .ftr-grid { grid-template-columns: repeat(4, 1fr); } }
  /* Footer brand: h-8 w-8 logo + text-lg, then space-y-4 to the tagline.
     display:flex (block-level, like the real "flex items-center") avoids the
     inline-block baseline gap that would otherwise skew the column height. */
  .ftr-brand { display: flex; width: fit-content; align-items: center; gap: 0.625rem; text-decoration: none; }
  .ftr-brand-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 2rem; height: 2rem; border-radius: 0.625rem;
    background: #0a0b1e; border: 1px solid rgb(255 255 255 / 10%);
  }
  .ftr-brand-name { font-size: 1.125rem; line-height: 1.75rem; font-weight: 700; letter-spacing: -0.025em; }
  /* text-sm text-muted-foreground leading-relaxed max-w-xs, 1rem below brand */
  .ftr-tag {
    margin: 1rem 0 0; max-width: 20rem;
    font-size: 0.875rem; line-height: 1.625; color: var(--muted-fg);
  }
  /* text-sm font-semibold mb-3 */
  .ftr-col h3 { margin: 0 0 0.75rem; font-size: 0.875rem; line-height: 1.25rem; font-weight: 600; }
  .ftr-col ul {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 0.5rem;
  }
  .ftr-col a { font-size: 0.875rem; line-height: 1.25rem; color: var(--muted-fg); text-decoration: none; }
  .ftr-col a:hover { color: var(--fg); }
  /* border-t border-border/50 py-6 */
  .ftr-bottom {
    border-top: 1px solid color-mix(in oklch, var(--border) 50%, transparent);
    padding-top: 1.5rem; padding-bottom: 1.5rem;
    display: flex; flex-wrap: wrap; gap: 1rem;
    align-items: center; justify-content: space-between;
  }
  .ftr-bottom p { margin: 0; font-size: 0.75rem; line-height: 1rem; color: var(--muted-fg); }
  /* Fixed hero backdrop, mirroring HeroBackground's grayscale/low-opacity
     image (the animated particle canvas needs JS, so it's intentionally
     omitted on this static page). */
  .bg {
    position: fixed; inset: 0; z-index: -1;
    background-image: url("${HERO_IMAGE_URL}");
    background-size: cover; background-position: center;
    transform: scale(1.1);
    filter: var(--img-filter); opacity: var(--img-opacity);
  }
  /* NotFoundContent: max-w-md w-full text-center space-y-6 */
  .wrap {
    max-width: 28rem; width: 100%; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
  }
  /* h-20 w-20 rounded-full bg-muted; icon h-9 w-9 text-muted-foreground */
  .badge {
    display: flex; align-items: center; justify-content: center;
    width: 5rem; height: 5rem; border-radius: 9999px; background: var(--muted);
  }
  .badge svg { color: var(--muted-fg); }
  /* space-y-2 */
  .text { display: flex; flex-direction: column; gap: 0.5rem; }
  /* text-sm font-medium tracking-widest uppercase text-muted-foreground */
  .code {
    margin: 0; font-size: 0.875rem; line-height: 1.25rem; font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted-fg);
  }
  /* text-3xl font-bold tracking-tight sm:text-4xl */
  h1 {
    margin: 0; font-size: 1.875rem; line-height: 2.25rem; font-weight: 700;
    letter-spacing: -0.025em; color: var(--fg);
  }
  @media (min-width: 640px) { h1 { font-size: 2.25rem; line-height: 2.5rem; } }
  /* text-base text-muted-foreground */
  .desc { margin: 0; font-size: 1rem; line-height: 1.5rem; color: var(--muted-fg); }
  /* pt-2 row wrapping the primary button */
  .btn-row { padding-top: 0.5rem; }
  /* Button default size/variant: h-8 gap-1.5 px-2.5 text-sm font-medium rounded-lg */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
    height: 2rem; padding: 0 0.625rem; border-radius: 0.625rem;
    background: var(--primary); color: var(--primary-fg);
    text-decoration: none; font-weight: 500; font-size: 0.875rem;
  }
</style>
</head>
<body>
  <div class="bg"></div>
  <header class="site-header">
    <div class="container hdr">
      <a class="brand" href="${home}">
        <span class="brand-mark">${storeIcon(28)}</span>
        <span class="brand-text">
          <span class="brand-name">MarketVerse</span>
          <span class="brand-tag">${escapeHtml(t.tagline)}</span>
        </span>
      </a>
      <nav class="nav">
        <a href="/${lang}/${seg.products}">${escapeHtml(t.products)}</a>
        <a href="/${lang}/${seg.brands}">${escapeHtml(t.brands)}</a>
      </nav>
    </div>
  </header>
  <main class="main">
    <div class="wrap">
      <div class="badge">${SEARCH_ICON}</div>
      <div class="text">
        <p class="code">${escapeHtml(t.eyebrow)}</p>
        <h1>${escapeHtml(t.heading)}</h1>
        <p class="desc">${escapeHtml(t.body)}</p>
      </div>
      <div class="btn-row">
        <a class="btn" href="${home}">${HOME_ICON}${escapeHtml(t.home)}</a>
      </div>
    </div>
  </main>
  <footer class="site-footer">
    <div class="container">
      <div class="ftr-grid">
        <div>
          <a class="ftr-brand" href="${home}">
            <span class="ftr-brand-mark">${storeIcon(24)}</span>
            <span class="ftr-brand-name">MarketVerse</span>
          </a>
          <p class="ftr-tag">${escapeHtml(t.footer.tagline)}</p>
        </div>
        <div class="ftr-col">
          <h3>${escapeHtml(t.footer.platform)}</h3>
          <ul>
            <li><a href="/${lang}/${seg.products}">${escapeHtml(t.products)}</a></li>
            <li><a href="/${lang}/${seg.brands}">${escapeHtml(t.brands)}</a></li>
            <li><a href="${home}">${escapeHtml(t.footer.pricing)}</a></li>
          </ul>
        </div>
        <div class="ftr-col">
          <h3>${escapeHtml(t.footer.company)}</h3>
          <ul>
            <li><a href="${home}">${escapeHtml(t.footer.about)}</a></li>
            <li><a href="${home}">${escapeHtml(t.footer.blog)}</a></li>
            <li><a href="${home}">${escapeHtml(t.footer.careers)}</a></li>
          </ul>
        </div>
        <div class="ftr-col">
          <h3>${escapeHtml(t.footer.legal)}</h3>
          <ul>
            <li><a href="${home}">${escapeHtml(t.footer.privacy)}</a></li>
            <li><a href="${home}">${escapeHtml(t.footer.terms)}</a></li>
            <li><a href="${home}">${escapeHtml(t.footer.cookies)}</a></li>
          </ul>
        </div>
      </div>
      <div class="ftr-bottom">
        <p>${escapeHtml(copyright)}</p>
        <p>${escapeHtml(t.footer.crafted)}</p>
      </div>
    </div>
  </footer>
</body>
</html>`;

  return new NextResponse(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}