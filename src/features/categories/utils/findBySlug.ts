type SluggedNode<T> = {
  translations: readonly { slug: string }[];
  children: readonly T[];
};

/**
 * The node whose slug - in ANY locale, since department URLs are localized
 * (`/sr/kategorije/moda`) and a listing may link the default-locale slug - is
 * `slug`, together with its parent (null for a department). Depth-first, so a
 * slug is found wherever it sits in the tree.
 */
export function findCategoryBySlug<T extends SluggedNode<T>>(
  tree: readonly T[],
  slug: string,
): { node: T; parent: T | null } | null {
  const walk = (nodes: readonly T[], parent: T | null): { node: T; parent: T | null } | null => {
    for (const node of nodes) {
      if (node.translations.some((tr) => tr.slug === slug)) return { node, parent };
      const found = walk(node.children, node);
      if (found) return found;
    }
    return null;
  };
  return walk(tree, null);
}
