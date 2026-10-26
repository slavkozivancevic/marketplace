import {
  BadgeCheck,
  Building2,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  Package,
  ScrollText,
  SlidersHorizontal,
  Star,
  Tag,
  Tags,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type HomeCard = { href: string; title: string; description: string; icon: LucideIcon };

/**
 * The admin landing page's two card grids. One list for the page and its
 * loading.tsx, so the skeleton always draws exactly these cards - with their
 * real titles and descriptions - and a card added here cannot leave the
 * skeleton a row short again.
 */
export function adminHomeCards(t: (key: string) => string): { manage: HomeCard[]; quick: HomeCard[] } {
  return {
    manage: [
      { href: "/admin/products", title: t("admin.products"), description: t("admin.productsDesc"), icon: Package },
      { href: "/admin/brands", title: t("admin.brands"), description: t("admin.brandsDesc"), icon: Tag },
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
      { href: "/admin/tags", title: t("admin.tags"), description: t("admin.tagsDesc"), icon: Tags },
      {
        href: "/admin/trust-points",
        title: t("admin.trustPoints"),
        // Same sentence the list page's header uses - one description, so the
        // card and the page it opens cannot drift apart.
        description: t("admin.trustPointsManage"),
        icon: BadgeCheck,
      },
      {
        href: "/admin/price-markets",
        title: t("admin.priceMarkets"),
        // The list page's own header sentence, so card and page cannot drift.
        description: t("admin.priceMarketsManage"),
        icon: Globe,
      },
      { href: "/admin/organizations", title: t("admin.orgs"), description: t("admin.orgsDesc"), icon: Building2 },
      { href: "/admin/users", title: t("admin.users"), description: t("admin.usersDesc"), icon: Users },
      { href: "/admin/coupons", title: t("coupons.title"), description: t("coupons.description"), icon: Ticket },
      {
        href: "/admin/cod-balances",
        title: t("adminCodBalances.title"),
        description: t("adminCodBalances.description"),
        icon: Wallet,
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
    ],
    quick: [
      {
        href: "/dashboard",
        title: t("admin.dashboard"),
        description: t("admin.dashboardDesc"),
        icon: LayoutDashboard,
      },
    ],
  };
}
