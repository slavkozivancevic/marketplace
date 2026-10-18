/**
 * Keeping dead ends out of the storefront's navigation.
 *
 * A category with nothing to buy in it is a link to an empty page. Amazon's
 * rule, and now ours: browse surfaces offer only what can be bought, while the
 * category's URL stays alive for anyone who already has it. This is the
 * pruning half of that rule - the half that has no database in it, so it can be
 * tested directly.
 *
 * Membership is a SET, never a count. `ProductCategory` can attach the same
 * product to a department and to one of its subcategories, so adding counts up
 * the tree would double some products and mean nothing; "has anything at all"
 * is the only question being asked here, and a set answers it exactly.
 */

type PrunableNode<T> = {
  id: string;
  translations: { slug: string }[];
  children: T[];
};

/**
 * Drops every category that has no products in it or under it.
 *
 * A parent survives on its children: a department whose own products all hang
 * off its subcategories stays in the menu, which is the normal shape of this
 * catalogue.
 *
 * `keepSlug` is the way back in for a buyer who arrives at an empty category
 * from a bookmark or a search result. That page still renders, and its
 * department selector has to agree with the URL rather than claim the buyer is
 * browsing everything, so the named node - and, through the rule above, its
 * ancestors - is kept even while empty. The slug is matched across ALL locales,
 * the same way `findDeptNodeBySlug` resolves one in the catalogue page.
 */
export function pruneEmptyCategories<T extends PrunableNode<T>>(
  tree: T[],
  categoriesWithProducts: ReadonlySet<string>,
  keepSlug?: string,
): T[] {
  const prune = (nodes: T[]): T[] => {
    const kept: T[] = [];
    for (const node of nodes) {
      const children = prune(node.children);
      const isKept =
        children.length > 0 ||
        categoriesWithProducts.has(node.id) ||
        (keepSlug != null &&
          keepSlug !== "" &&
          node.translations.some((tr) => tr.slug === keepSlug));
      if (isKept) kept.push({ ...node, children });
    }
    return kept;
  };
  return prune(tree);
}
