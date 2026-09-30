import type { Metadata } from "next";
import { Suspense } from "react";
import { safeAuth } from "@/lib/auth/safeAuth";
import { Link, getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { HeroBackground } from "@/components/layout/hero-background";
import { Footer } from "@/components/layout/footer";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { getLocale, getTranslations } from "next-intl/server";
import { cacheTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";
import { getFeaturedDepartmentsWithImages } from "@/features/categories/db/categories";
import { DepartmentCards } from "@/features/categories/components/DepartmentCards";
import { DepartmentMosaic } from "@/features/categories/components/DepartmentMosaic";
import {
  MOSAIC_MIN_IMAGES,
  countDepartmentImages,
} from "@/features/categories/utils/mosaic";
import { getAllBrands } from "@/features/brands/db/brands";
import { BrandStrip } from "@/features/brands/components/BrandStrip";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import {
  absoluteUrl,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo/jsonLd";
import { env } from "@/env/server";

async function fetchFeaturedDepartments() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  cacheTag(CacheTags.products.publicAll());
  return getFeaturedDepartmentsWithImages();
}

/** Brands with a logo and at least one product, for the strip under the hero. */
async function fetchStripBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  // `_count.products` is part of the list item, and it moves when a product is
  // created or deleted rather than when a brand is edited - hence the product
  // tag alongside the brand one.
  cacheTag(CacheTags.products.publicAll());
  const brands = await getAllBrands();
  return brands
    .filter((b) => (b.logoUrl || b.logoUrlDark) && b._count.products > 0)
    .slice(0, BRAND_STRIP_LIMIT);
}

/**
 * The strip shows eight at a time and rotates through them, so this is the
 * size of the POOL it rotates within, not the number on screen. Capped so a
 * large catalogue does not hand the client a list of every brand it owns.
 */
const BRAND_STRIP_LIMIT = 24;

/** Shared so the Suspense fallback and both resolved states stay identical. */
async function BrowseProductsButton({ primary = false }: { primary?: boolean }) {
  const t = await getTranslations();
  return (
    <Button
      asChild
      size="lg"
      variant={primary ? "default" : "outline"}
      className={
        primary
          ? "h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20"
          : "h-12 px-8 text-base font-semibold"
      }
    >
      <Link href="/products">{t("home.browseProducts")}</Link>
    </Button>
  );
}

/**
 * Closing CTA. Signed out gets the sign-up call to action with "Browse
 * products" as the secondary; signed in gets "Browse products" alone, promoted
 * to primary so the section still has one clear action instead of a lone
 * outline button.
 */
async function HomeCtaActions() {
  const { userId } = await safeAuth();
  const t = await getTranslations();

  if (userId) return <BrowseProductsButton primary />;

  return (
    <>
      <Button
        asChild
        size="lg"
        className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20 group"
      >
        <Link href="/sign-up/[[...sign-up]]">
          {t("home.createAccount")}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </Button>
      <BrowseProductsButton />
    </>
  );
}

/**
 * Home page metadata. Emits canonical + per-locale alternates so the four
 * landing variants (`/en`, `/sr`, `/de`, `/es`) consolidate into a single
 * indexable entity in Google's eyes - each with the language-appropriate
 * canonical URL.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Route segment, not getLocale() - see the products list page for why.
  const { locale } = await params;
  const t = await getTranslations({ locale });

  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = absoluteUrl(getPathname({ href: "/", locale: l }));
  }
  // Tell Google which URL to serve when no locale matches the visitor.
  languages["x-default"] = languages[routing.defaultLocale];

  return {
    title: t("home.metaTitle"),
    description: t("home.metaDescription"),
    alternates: {
      canonical: languages[locale],
      languages,
    },
    openGraph: {
      title: t("home.metaTitle"),
      description: t("home.metaDescription"),
      locale,
      type: "website",
      url: absoluteUrl(languages[locale]),
      siteName: t("home.siteName"),
      images: [
        { url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: t("home.siteName") },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("home.metaTitle"),
      description: t("home.metaDescription"),
      images: [absoluteUrl("/api/og")],
    },
  };
}

export default async function HomePage() {
  const t = await getTranslations();
  const locale = await getLocale();
  const [featuredDepartments, stripBrands] = await Promise.all([
    fetchFeaturedDepartments(),
    fetchStripBrands(),
  ]);

  // ----- Site-wide JSON-LD -----
  // Organization + WebSite schemas live on the home page (the surface most
  // likely to be the entry point Google indexes). Both contain links to
  // the canonical locale URL so the search box / brand entity gets
  // attributed correctly per language.
  const baseUrl = env.APP_URL.replace(/\/$/, "");
  const homeUrl = absoluteUrl(getPathname({ href: "/", locale }));
  const orgSchema = organizationJsonLd({
    name: t("home.siteName"),
    url: homeUrl,
    logoUrl: `${baseUrl}/api/logo`,
  });
  const websiteSchema = websiteJsonLd({
    name: t("home.siteName"),
    url: homeUrl,
    searchUrl: `${absoluteUrl(getPathname({ href: "/products", locale }))}?search=`,
  });

  // What the platform actually does, in the order a seller meets it. These
  // replaced a Security / Performance / Scale trio whose copy described no
  // particular product - every claim here is something this codebase does.
  const pillars = [
    { title: t("home.pillarPricesTitle"), description: t("home.pillarPricesDesc") },
    { title: t("home.pillarPayoutsTitle"), description: t("home.pillarPayoutsDesc") },
    { title: t("home.pillarLocalesTitle"), description: t("home.pillarLocalesDesc") },
  ];

  // Small factual line under the hero CTAs. It stands where four animated
  // counters used to sit ("2,500+ sellers", "$10M+ transactions") - numbers
  // nothing in the system produced.
  const facts = [
    t("home.factLocales"),
    t("home.factCurrencies"),
    t("home.factCheckout"),
    t("home.factCod"),
  ];

  // Both the threshold and the count come from a plain module, NOT from the
  // `"use client"` mosaic component - a constant imported from a client module
  // arrives here as a client-reference proxy, so `total >= MOSAIC_MIN_IMAGES`
  // would be a number compared against an object: false every time, silently.
  const split =
    countDepartmentImages(featuredDepartments) >= MOSAIC_MIN_IMAGES;

  return (
    <div className="star-field flex-1 overflow-y-auto min-h-0">
      <JsonLdScript data={orgSchema} />
      <JsonLdScript data={websiteSchema} />
      {/*
        Hero. The old one was a centred stack - pinging "Now live" pill, huge
        headline whose second line ran an animated platinum gradient, sub, two
        centred buttons, four counters - over a particle-constellation canvas.
        Every one of those is a generated-landing-page motif, and together they
        made a marketplace front page that showed no merchandise at all.

        It is an asymmetric split now: the claim on the left, the catalogue on
        the right. `overflow-clip` contains both the backdrop glows and the
        drifting mosaic, and `min-w-0` rides along with it - clip is not a
        scroll container, so it does not pick up the automatic `min-size: 0`
        that would otherwise stop a wide child from widening the whole shell.
      */}
      {/* No fixed tall hero below `lg`: the height comes from the content, so
          a narrow screen gets no dead space above the fold and the first CTA
          stays reachable. On wide screens the minimum used to be 86vh, which
          on a short laptop window left a band of nothing above and below the
          content; the wall beside the copy already gives the section its
          height. */}
      <section className="relative flex min-w-0 items-center overflow-clip pt-16 pb-12 sm:pt-14 lg:py-14">
        <HeroBackground />

        <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:items-stretch lg:gap-10 lg:px-8">
          {/*
            The split only exists from `lg` up, where there is room for two
            columns. Below that the copy is CENTRED, not left-aligned: a single
            narrow column pinned to the left edge of a 900px-wide window leaves
            the whole right half empty and reads as a broken layout rather than
            an asymmetric one. `split` therefore drives both the alignment and
            the grid spans, and with no catalogue images the hero stays centred
            at every width - there is nothing for an off-centre column to
            balance against.
          */}
          <div
            className={cn(
              "min-w-0 text-center",
              // 6/6 at `lg`, 5/7 only from `xl`. A 5/12 column at 1024px is
              // ~380px, which the wordmark and the two CTAs both outgrow -
              // they then spill out of the grid track and under the mosaic.
              split
                ? "mx-auto max-w-2xl lg:col-span-5 lg:mx-0 lg:max-w-none lg:text-left"
                : "mx-auto max-w-2xl",
            )}
          >
            {/*
              Three text layers, not four. There was an uppercase eyebrow above
              the wordmark as well ("A marketplace of independent shops"), which
              said roughly what the headline under it said and pushed the claim
              further down the block. A hero that opens with a tracked label
              nobody reads is the generated-landing-page opening; the lockup is
              a better first thing to meet.

              Hierarchy also had to flip: the wordmark used to be the only
              element at full strength, with the actual claim beneath it smaller
              AND in `muted-foreground`, so the whole hero read as one flat grey
              block. The claim leads now; the wordmark introduces it.
            */}
            <h1
              className={cn(
                "animate-slide-up flex flex-col items-center gap-3",
                split && "lg:items-start",
              )}
            >
              <BrandLockup size="hero" effect="sweep" />
              {/* Deliberately quieter than the wordmark above it: at full
                  `foreground` and the same weight the two lines competed and
                  neither led.

                  `muted-foreground`, not an opacity of the text colour. Each
                  theme DEFINES its own value for this token - a cool grey on
                  light, a neutral one on dark, and a violet-cast one in cosmos
                  - whereas `foreground/70` is the same mechanical fade of the
                  same colour everywhere and reads as the heading dimmed rather
                  than as a second voice. The lighter weight drops it back
                  further still. */}
              <span className="text-3xl font-medium tracking-tight text-balance text-muted-foreground sm:text-4xl lg:text-[2.5rem]/[1.1]">
                {t("home.headlineLine2")}
              </span>
            </h1>

            <p
              className={cn(
                "animate-slide-up delay-200 mx-auto mt-4 max-w-md text-base text-pretty text-muted-foreground opacity-0 sm:text-lg",
                split && "lg:mx-0",
              )}
            >
              {t("home.subheadline")}
            </p>

            <div
              className={cn(
                // `flex-wrap` is load-bearing: side by side the two CTAs are
                // wider than the text column at the narrow end of `lg`, and
                // without it they overflow the track instead of stacking.
                "animate-slide-up delay-400 mt-9 flex flex-col flex-wrap gap-3 opacity-0 sm:flex-row sm:items-center sm:justify-center",
                split && "lg:justify-start",
              )}
            >
              <Button asChild size="lg" className="group h-12 px-8 text-base font-semibold">
                <Link href="/products">
                  {t("home.exploreProducts")}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base font-semibold"
              >
                <Link href="/dashboard">{t("home.startSelling")}</Link>
              </Button>
            </div>

            {/*
              One line, with the brand's own sparkle as the separator between
              facts rather than a mark in front of each. Previous passes made
              this a row of pills and then a two-column checklist; both turned
              four short facts into a block of furniture. As a single run they
              read as one quiet credit line under the buttons, which is all
              they need to be.
            */}
            <ul
              className={cn(
                "animate-fade-in delay-700 mt-9 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground opacity-0",
                split && "lg:justify-start",
              )}
            >
              {facts.map((fact, i) => (
                <li key={fact} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden className="brand-pip" />}
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          {/* Catalogue. Below `lg` it sits under the copy, running the full
              width of the container out to the same gutters the "Shop by
              department" row uses. It used to share the copy's `max-w-2xl`
              measure, which left a wide empty margin either side of it on
              anything between a phone and a laptop. The COPY keeps a measure -
              a line of text 900px wide is unreadable - the images do not. */}
          {split && (
            <div className="animate-fade-in delay-300 w-full min-w-0 opacity-0 lg:col-span-7">
              <DepartmentMosaic departments={featuredDepartments} />
            </div>
          )}
        </div>
      </section>

      {/* Real brands from the catalogue, directly under the hero - the first
          concrete thing after the claim. */}
      <BrandStrip brands={stripBrands} label={t("home.brandsLabel")} />

      {/* Department Cards Section */}
      <DepartmentCards departments={featuredDepartments} />

      {/*
        Three pillars. This was a row of cards, each with a lucide icon in a
        `bg-primary/10` rounded square, lifting on hover - the stock shape of a
        generated feature grid, filled with copy ("Enterprise Security",
        "Lightning Performance") that described no particular product.

        It is a numbered editorial row now: a rule, a large muted numeral, and
        one true sentence. No tiles to hover, nothing to lift.
      */}
      <section className="relative py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("home.pillarsTitle")}
            </h2>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              {t("home.pillarsDesc")}
            </p>
          </div>

          <div className="mt-12 grid gap-y-10 sm:grid-cols-3 sm:gap-x-8 lg:gap-x-12">
            {pillars.map((pillar, i) => (
              <div key={pillar.title} className="min-w-0 border-t border-border pt-5">
                <span className="block text-sm font-semibold tabular-nums text-muted-foreground/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-balance">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section. The two `blur-3xl` orbs that used to float in the
          corners are gone - another motif that says "template" more than it
          says anything about the offer. */}
      <section className="relative pb-16 sm:pb-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/80 p-8 text-center backdrop-blur-xs sm:p-16">
            <div className="relative z-10">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t("home.readyToStart")}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
                {t("home.joinThousands")}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                {/* "Create free account" is nonsense for someone already signed
                    in, so the pair is resolved from the session. Reading it
                    needs the request, which would make this whole marketing
                    page dynamic - hence the Suspense boundary: the page keeps
                    its prerendered shell and only this button row streams in.
                    The fallback is the SIGNED-IN variant on purpose, so the
                    button we're removing is never shown to a signed-in visitor
                    even for a frame; a guest just sees the sign-up button join
                    the row. */}
                <Suspense fallback={<BrowseProductsButton primary />}>
                  <HomeCtaActions />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
