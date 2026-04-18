import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import { PublicHeader } from "../../components/layout/public-header";
import { WishlistInitializer } from "@/features/wishlist/components/WishlistInitializer";
import { getUserWishlistProductIds } from "@/features/wishlist/db/wishlist";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  let isAdmin = false;
  let wishlistIds: string[] = [];

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, role: true },
    });
    isAdmin = user?.role === "ADMIN";
    if (user) {
      wishlistIds = await getUserWishlistProductIds(user.id);
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <WishlistInitializer ids={wishlistIds} />
      <PublicHeader showAdminLink={isAdmin} />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
