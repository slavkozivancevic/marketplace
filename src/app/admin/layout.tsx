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
    <div className="min-h-screen flex flex-col">
      <AdminHeader />
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}
