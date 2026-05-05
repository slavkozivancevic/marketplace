"use client";

import {
  ShoppingBag,
  ClipboardList,
  Building2,
  Package,
  Shield,
  LayoutDashboard,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { OrganizationSwitcher } from "@/features/organizations/components/OrganizationSwitcher";
import { SidebarNav, type SidebarLink } from "./sidebar-nav";

interface DashboardSidebarProps {
  userRole: string;
  organizations: { id: string; name: string }[];
  currentOrgId: string;
}

export function DashboardSidebar({
  userRole,
  organizations,
  currentOrgId,
}: DashboardSidebarProps) {
  const t = useTranslations("sidebar");

  const baseLinks: SidebarLink[] = [
    { href: "/dashboard", label: t("overview"), icon: LayoutDashboard },
    { href: "/products", label: t("browseProducts"), icon: ShoppingBag },
    { href: "/dashboard/orders", label: t("myOrders"), icon: ClipboardList },
    { href: "/dashboard/organization", label: t("organization"), icon: Building2 },
  ];

  const sellerLinks: SidebarLink[] = [
    { href: "/dashboard/my-products", label: t("myProducts"), icon: Package },
  ];

  const adminLinks: SidebarLink[] = [
    { href: "/admin", label: t("adminPanel"), icon: Shield },
  ];

  const links = [...baseLinks, ...(userRole === "SELLER" ? sellerLinks : [])];
  const extras = userRole === "ADMIN" ? adminLinks : undefined;

  return (
    <SidebarNav
      title={t("navigation")}
      links={links}
      extraLinks={extras}
      extraLinksTitle={t("admin")}
    >
      {organizations.length > 1 && (
        <div className="px-3 mb-2">
          <p className="text-xs text-muted-foreground mb-1.5">{t("organization")}</p>
          <OrganizationSwitcher
            organizations={organizations}
            currentOrgId={currentOrgId}
          />
        </div>
      )}
    </SidebarNav>
  );
}
