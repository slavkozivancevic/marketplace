import {
  Building2,
  ClipboardList,
  Package,
  PackageCheck,
  ShoppingBag,
  Tag,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";

export type HomeCard = { href: string; title: string; description: string; icon: LucideIcon };

/** The facts that decide which cards a viewer gets. */
export type DashboardCardsViewer = {
  role: UserRole;
  hasActiveOrg: boolean;
  canManagePayouts: boolean;
};

/**
 * The dashboard home's card grid for one viewer. Shared by the page and its
 * skeleton (which reads the viewer from the layout's DashboardViewerContext),
 * so the skeleton draws the same cards, with the same copy, as the page.
 */
export function dashboardHomeCards(t: (key: string) => string, viewer: DashboardCardsViewer): HomeCard[] {
  return [
    { href: "/products", title: t("dashboard.browse"), description: t("dashboard.browseDesc"), icon: ShoppingBag },
    {
      href: "/brands",
      title: t("dashboard.browseBrands"),
      description: t("dashboard.browseBrandsDesc"),
      icon: Tag,
    },
    ...(viewer.role === "SELLER"
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
    ...(viewer.hasActiveOrg
      ? [
          {
            href: "/dashboard/organization/orders",
            title: t("dashboard.receivedOrders"),
            description: t("dashboard.receivedOrdersDesc"),
            icon: PackageCheck,
          },
        ]
      : []),
    // Payouts card: OWNER/ADMIN only, matching the payouts page guard.
    ...(viewer.canManagePayouts
      ? [
          {
            href: "/dashboard/organization/payouts",
            title: t("dashboard.payouts"),
            description: t("dashboard.payoutsDesc"),
            icon: Wallet,
          },
        ]
      : []),
    { href: "/dashboard/organization", title: t("dashboard.org"), description: t("dashboard.orgDesc"), icon: Building2 },
  ];
}
