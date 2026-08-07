import { safeAuth } from "@/lib/auth/safeAuth";
import { prisma } from "@/core/db/prisma";
import { PublicHeader } from "@/components/layout/public-header";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await safeAuth();

  let isAdmin = false;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });
    isAdmin = user?.role === "ADMIN";
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <PublicHeader showAdminLink={isAdmin} signedIn={!!userId} />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
