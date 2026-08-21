import type { Metadata } from "next";
import { Suspense } from "react";
import { safeAuth } from "@/lib/auth/safeAuth";
import { Link, getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Zap,
  Globe,
  ArrowRight,
} from "lucide-react";
import { HeroBackground } from "@/components/layout/hero-background";
import { Footer } from "@/components/layout/footer";
import { BrandWordmark } from "@/components/layout/brand-wordmark";
import { StatsSection } from "@/components/layout/stats-section";
import { getLocale, getTranslations } from "next-intl/server";
import { cacheTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";
import { getFeaturedDepartmentsWithImages } from "@/features/categories/db/categories";
import { DepartmentCards } from "@/features/categories/components/DepartmentCards";
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
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
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
  const featuredDepartments = await fetchFeaturedDepartments();

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

  const features = [
    {
      icon: ShieldCheck,
      title: t("home.security"),
      description: t("home.securityDesc"),
    },
    {
      icon: Zap,
      title: t("home.performance"),
      description: t("home.performanceDesc"),
    },
    {
      icon: Globe,
      title: t("home.scale"),
      description: t("home.scaleDesc"),
    },
  ];

  return (
    <div className="star-field flex-1 overflow-y-auto min-h-0">
      <JsonLdScript data={orgSchema} />
      <JsonLdScript data={websiteSchema} />
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-14 sm:pt-0">
        <HeroBackground />

        {/* Hero overlay gradient */}
        <div className="absolute inset-0 bg-linear-to-b from-background/60 via-background/40 to-background pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="animate-slide-down mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t("home.badge")}
          </div>

          {/* Main heading */}
          <h1 className="animate-slide-up text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            <BrandWordmark />
            <br />
            <span className="text-gradient-platinum">{t("home.headlineGradient")}</span>
          </h1>

          <p className="animate-slide-up delay-200 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl opacity-0">
            {t("home.subheadline")}
          </p>

          {/* CTA Buttons */}
          <div className="animate-slide-up delay-400 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0">
            <Button
              asChild
              size="lg"
              className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 group"
            >
              <Link href="/products">
                {t("home.exploreProducts")}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base font-semibold backdrop-blur-xs hover:-translate-y-0.5 transition-all duration-300"
            >
              <Link href="/dashboard">{t("home.startSelling")}</Link>
            </Button>
          </div>

          {/* Stats */}
          <StatsSection />
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background to-transparent" />
      </section>

      {/* Department Cards Section */}
      <DepartmentCards departments={featuredDepartments} />

      {/* Features Section */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("home.whyChoose")}
              <span className="text-gradient-cosmos">{t("home.whyChooseGradient")}</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("home.whyChooseDesc")}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group relative rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur-xs transition-all duration-300 hover:border-border hover:bg-card hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/80 p-10 sm:p-16 text-center backdrop-blur-xs">
            {/* Decorative gradient orbs */}
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />

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
