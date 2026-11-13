"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CategoryTreeItem } from "@/features/categories/db/categories";

const StorefrontCategoryTreeContext = createContext<CategoryTreeItem[] | null>(null);

/**
 * The storefront category tree the public layout already loads for the mega
 * menu, handed to everything under the layout. A route-level `loading.tsx`
 * gets no data of its own; with the tree it can draw a category page's header
 * (breadcrumb, name, description, subcategory chips) exactly as the page will.
 */
export function StorefrontCategoryTreeProvider({
  tree,
  children,
}: {
  tree: CategoryTreeItem[];
  children: ReactNode;
}) {
  return (
    <StorefrontCategoryTreeContext.Provider value={tree}>
      {children}
    </StorefrontCategoryTreeContext.Provider>
  );
}

/** The layout's tree, or null outside the public layout. */
export function useStorefrontCategoryTree(): CategoryTreeItem[] | null {
  return useContext(StorefrontCategoryTreeContext);
}
