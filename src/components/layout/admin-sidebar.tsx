"use client";

import { Package, Users, Building2, LayoutDashboard } from "lucide-react";
import { SidebarNav, type SidebarLink } from "./sidebar-nav";

const adminLinks: SidebarLink[] = [
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
];

const quickLinks: SidebarLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function AdminSidebar() {
  return (
    <SidebarNav title="Admin Panel" links={adminLinks} extraLinks={quickLinks} />
  );
}
