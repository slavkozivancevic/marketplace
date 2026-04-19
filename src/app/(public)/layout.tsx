import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import { PublicHeader } from "../../components/layout/public-header";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  let isAdmin = false;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });
    isAdmin = user?.role === "ADMIN";
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PublicHeader showAdminLink={isAdmin} />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
