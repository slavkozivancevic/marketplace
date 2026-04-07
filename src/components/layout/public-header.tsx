import Link from "next/link";
import { HeaderAuth } from "./header-auth";
import { CartButton } from "@/features/cart/components/CartButton";
import { CartDrawer } from "@/features/cart/components/CartDrawer";

export function PublicHeader() {
  return (
    <>
      <header className="flex h-16 items-center justify-between border-b px-6">
        <Link href="/" className="text-lg font-semibold">
          Marketplace
        </Link>
        <div className="flex items-center gap-3">
          <CartButton />
          <HeaderAuth mode="modal" showDashboardLink />
        </div>
      </header>
      <CartDrawer />
    </>
  );
}