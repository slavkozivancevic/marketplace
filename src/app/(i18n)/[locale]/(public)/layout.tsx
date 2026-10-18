import { cacheLife, cacheTag } from "next/cache";
import { safeAuth } from "@/lib/auth/safeAuth";
import { prisma } from "@/core/db/prisma";
import { PublicHeader } from "@/components/layout/public-header";
import {
  getCategoryImageFallbacks,
  getStorefrontCategoryTree,
} from "@/features/categories/db/categories";
import { CacheTags } from "@/lib/cache/tags";

/**
 * The category tree behind the header menu, on every storefront page.
 *
 * Cached rather than queried per request: it is the same tree for everyone, it
 * changes only when an admin edits a category, and `revalidateCategoryCache`
 * already busts this tag when they do.
 */
async function fetchCategoryMenu() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  // The thumbnails are product photos, so a catalogue change has to drop this
  // too - without it a category keeps showing a picture of something that is no
  // longer published, for as long as `cacheLife("max")` holds (forever).
  cacheTag(CacheTags.products.publicAll());
  cacheLife("max");

  const [tree, categoryImages] = await Promise.all([
    getStorefrontCategoryTree(),
    getCategoryImageFallbacks(),
  ]);
  return { tree, categoryImages };
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await safeAuth();
  const categoryMenu = await fetchCategoryMenu();

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
      <PublicHeader
        showAdminLink={isAdmin}
        categoryTree={categoryMenu.tree}
        categoryImages={categoryMenu.categoryImages}
        signedIn={!!userId}
      />
      <main className="flex-1 flex flex-col min-h-0 overflow-clip">
        {children}
      </main>
    </div>
  );
}
