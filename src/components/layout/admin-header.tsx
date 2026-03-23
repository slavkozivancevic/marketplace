import Link from "next/link";
import { HeaderAuth } from "./header-auth";

const adminLinks = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/users", label: "Users" },
];

export function AdminHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-6">
        <Link href="/admin/products" className="text-lg font-semibold">
          Marketplace Admin
        </Link>
        <nav className="flex items-center gap-4">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <HeaderAuth mode="redirect" showDashboardLink />
    </header>
  );
}
