import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AdminHeader } from "@/components/layout/admin-header";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { requireRole } from "@/lib/auth/requireRole";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("ADMIN");
  } catch {
    const locale = await getLocale();
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AdminHeader />
      <div className="flex flex-1 min-h-0">
        <AdminSidebar />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
