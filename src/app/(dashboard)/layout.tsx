import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r p-6">
        <p className="font-semibold">Dashboard</p>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
