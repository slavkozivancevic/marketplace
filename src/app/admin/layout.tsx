import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/layout/admin-header";
import { requireRole } from "@/lib/auth/requireRole";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("ADMIN");
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AdminHeader />
      <div className="flex-1 p-4 overflow-y-auto min-h-0">{children}</div>
    </div>
  );
}
