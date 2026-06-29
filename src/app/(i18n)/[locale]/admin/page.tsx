import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link, getPathname } from "@/i18n/navigation";
import {
  Package,
  Tag,
  Building2,
  Users,
  LayoutDashboard,
  LayoutGrid,
  SlidersHorizontal,
  ScrollText,
  Ticket,
  Star,
  ArrowRight,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export default async function AdminPage() {
  const { userId } = await auth();
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
  ];

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId! },
    select: { name: true },
  });

  const adminCards = [
    {
      href: "/admin/products",
      title: t("admin.products"),
      description: t("admin.productsDesc"),
      icon: Package,
    },
    {
      href: "/admin/brands",
      title: t("admin.brands"),
      description: t("admin.brandsDesc"),
      icon: Tag,
    },
    {
      href: "/admin/categories",
      title: t("admin.categories"),
      description: t("admin.categoriesDesc"),
      icon: LayoutGrid,
    },
    {
      href: "/admin/attributes",
      title: t("admin.attributes"),
      description: t("admin.attributesDesc"),
      icon: SlidersHorizontal,
    },
    {
      href: "/admin/organizations",
      title: t("admin.orgs"),
      description: t("admin.orgsDesc"),
      icon: Building2,
    },
    {
      href: "/admin/users",
      title: t("admin.users"),
      description: t("admin.usersDesc"),
      icon: Users,
    },
    {
      href: "/admin/coupons",
      title: t("coupons.title"),
      description: t("coupons.description"),
      icon: Ticket,
    },
    {
      href: "/admin/reviews",
      title: t("admin.reviews.title"),
      description: t("admin.reviews.description"),
      icon: Star,
    },
    {
      href: "/admin/audit",
      title: t("admin.audit.title"),
      description: t("admin.audit.description"),
      icon: ScrollText,
    },
  ];

  const quickCards = [
    {
      href: "/dashboard",
      title: t("admin.dashboard"),
      description: t("admin.dashboardDesc"),
      icon: LayoutDashboard,
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 sticky-header-bg">
        <div className="pt-2">
          <Breadcrumbs items={breadcrumbItems} seo={false} />
        </div>
        <div className="pt-2 pb-4">
          <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("admin.welcome", { name: user?.name || "Admin" })}
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-6 space-y-8">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {t("admin.management")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adminCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href as never} className="group">
                  <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <CardTitle>{card.title}</CardTitle>
                          <CardDescription>{card.description}</CardDescription>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {t("admin.quickLinks")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href as never} className="group">
                  <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <CardTitle>{card.title}</CardTitle>
                          <CardDescription>{card.description}</CardDescription>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
