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

  // `overflow-clip`, not `overflow-hidden` - see admin/layout.tsx: the shell
  // must never be a scroll container, or a sideways overflow can park the whole
  // page in a blank void beside the content.
  return (
    <div className="flex h-dvh flex-col overflow-clip">
      <PublicHeader showAdminLink={isAdmin} signedIn={!!userId} />
      <main className="flex-1 flex flex-col min-h-0 overflow-clip">
        {children}
      </main>
    </div>
  );
}
