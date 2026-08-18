import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AdminHeader } from "@/components/layout/admin-header";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
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

  // `overflow-clip` rather than `overflow-hidden` on the shell and <main>: the
  // shell must never be a scroll container. `hidden` still scrolls
  // programmatically (and to touch, on iOS Safari), so anything overflowing
  // sideways - a full-bleed header decoration, an over-wide child - could park
  // the whole page in a blank void beside the content. Wide content owns its
  // own scroller (tables, carousels); the shell only clips.
  //
  // `min-w-0` on <main> is REQUIRED alongside that: it's a flex item on the
  // horizontal axis here, so `min-width: auto` applies. A scroll container
  // (`overflow: hidden`) has an automatic minimum size of zero, which is what
  // used to let main shrink; `overflow: clip` is not a scroll container, so
  // without this main inherits the min-content width of the widest thing
  // inside it (an admin table is ~1050px) and shoves the whole row past the
  // viewport instead of letting the table scroll inside itself.
  return (
    <div className="flex h-dvh flex-col overflow-clip">
      <AdminHeader />
      <div className="flex flex-1 min-h-0">
        <AdminSidebar />
        <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-clip">
          {children}
        </main>
      </div>
      <UnsavedChangesGuard />
    </div>
  );
}
