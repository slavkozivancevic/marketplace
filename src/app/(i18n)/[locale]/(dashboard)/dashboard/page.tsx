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
  ShoppingBag,
  ClipboardList,
  Building2,
  Package,
  PackageCheck,
  Shield,
  ArrowRight,
  Tag,
  Wallet,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export default async function DashboardPage() {
  const { userId } = await auth();
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
  ];

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId! },
    select: { role: true, name: true },
  });

  const userRole = user?.role ?? "USER";
  const isAdmin = userRole === "ADMIN";

  const showReceivedOrders = userRole === "SELLER" || isAdmin;

  const cards = [
    {
      href: "/products",
      title: t("dashboard.browse"),
      description: t("dashboard.browseDesc"),
      icon: ShoppingBag,
    },
    {
      href: "/brands",
      title: t("dashboard.browseBrands"),
      description: t("dashboard.browseBrandsDesc"),
      icon: Tag,
    },
    ...(userRole === "SELLER"
      ? [
          {
            href: "/dashboard/my-products",
            title: t("dashboard.myProducts"),
            description: t("dashboard.myProductsDesc"),
            icon: Package,
          },
        ]
      : []),
    {
      href: "/dashboard/orders",
      title: t("dashboard.orders"),
      description: t("dashboard.ordersDesc"),
      icon: ClipboardList,
    },
    ...(showReceivedOrders
      ? [
          {
            href: "/dashboard/organization/orders",
            title: t("dashboard.receivedOrders"),
            description: t("dashboard.receivedOrdersDesc"),
            icon: PackageCheck,
          },
          {
            href: "/dashboard/organization/payouts",
            title: t("dashboard.payouts"),
            description: t("dashboard.payoutsDesc"),
            icon: Wallet,
          },
        ]
      : []),
    {
      href: "/dashboard/organization",
      title: t("dashboard.org"),
      description: t("dashboard.orgDesc"),
      icon: Building2,
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 sticky-header-bg">
        <div className="pt-2">
          <Breadcrumbs items={breadcrumbItems} seo={false} />
        </div>
        <div className="pt-2 pb-4">
          <h1 className="text-2xl font-bold">
            {t("dashboard.welcome", { name: user?.name || "User" })}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("dashboard.overview")}
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => {
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

        {isAdmin && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {t("dashboard.quickLinks")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/admin" className="group">
                <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle>{t("dashboard.adminPanel")}</CardTitle>
                        <CardDescription>{t("dashboard.adminDesc")}</CardDescription>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
