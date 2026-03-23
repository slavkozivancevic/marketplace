import Link from "next/link";
import { HeaderAuth } from "./header-auth";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <Link href="/" className="text-lg font-semibold">
        Marketplace
      </Link>
      <HeaderAuth mode="redirect" showDashboardLink />
    </header>
  );
}
