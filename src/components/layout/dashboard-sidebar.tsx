"use client";

import {
  ShoppingBag,
  ClipboardList,
  Building2,
  Package,
  Shield,
  LayoutDashboard,
} from "lucide-react";
import { OrganizationSwitcher } from "@/features/organizations/components/OrganizationSwitcher";
import { SidebarNav, type SidebarLink } from "./sidebar-nav";

const baseLinks: SidebarLink[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/products", label: "Browse Products", icon: ShoppingBag },
  { href: "/dashboard/orders", label: "My Orders", icon: ClipboardList },
  { href: "/dashboard/organization", label: "Organization", icon: Building2 },
];

const sellerLinks: SidebarLink[] = [
  { href: "/dashboard/my-products", label: "My Products", icon: Package },
];

const adminLinks: SidebarLink[] = [
  { href: "/admin", label: "Admin Panel", icon: Shield },
];

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
  const links = [...baseLinks, ...(userRole === "SELLER" ? sellerLinks : [])];

  const extras = userRole === "ADMIN" ? adminLinks : undefined;

  return (
    <SidebarNav
      title="Navigation"
      links={links}
      extraLinks={extras}
      extraLinksTitle="Admin"
    >
      {organizations.length > 1 && (
        <div className="px-3 mb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Organization</p>
          <OrganizationSwitcher
            organizations={organizations}
            currentOrgId={currentOrgId}
          />
        </div>
      )}
    </SidebarNav>
  );
}
