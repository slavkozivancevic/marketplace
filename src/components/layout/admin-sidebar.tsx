"use client";

import { Package, Users, Building2, LayoutDashboard, Tag, Shield, LayoutGrid, SlidersHorizontal, ScrollText, Ticket, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { SidebarNav, type SidebarLink } from "./sidebar-nav";

export function AdminSidebar() {
  const t = useTranslations("sidebar");

  const adminLinks: SidebarLink[] = [
    { href: "/admin", label: t("overview"), icon: Shield },
    { href: "/admin/products", label: t("products"), icon: Package },
    { href: "/admin/brands", label: t("brands"), icon: Tag },
    { href: "/admin/categories", label: t("categories"), icon: LayoutGrid },
    { href: "/admin/attributes", label: t("attributes"), icon: SlidersHorizontal },
    { href: "/admin/organizations", label: t("organizations"), icon: Building2 },
    { href: "/admin/users", label: t("users"), icon: Users },
    { href: "/admin/coupons", label: t("coupons"), icon: Ticket },
    { href: "/admin/reviews", label: t("reviews"), icon: Star },
    { href: "/admin/audit", label: t("audit"), icon: ScrollText },
  ];

  const quickLinks: SidebarLink[] = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
  ];

  return (
    <SidebarNav title={t("adminPanel")} links={adminLinks} extraLinks={quickLinks} extraLinksTitle={t("quickLinks")} />
  );
}