/**
 * The attributes a category inherits: walk its parent chain and union every
 * ancestor's directly-assigned attributes, nearest ancestor first, each once.
 * One walk for the form's attribute field and for the categories list, which
 * hands the result to the edit page's skeleton - so the two cannot disagree on
 * which inherited chips the form shows.
 */
export function inheritedAttributes<
  C extends { id: string; parentId: string | null },
  A extends { id: string },
>(
  parentId: string | null | undefined,
  categoriesById: ReadonlyMap<string, C>,
  categoryAttributeMap: Readonly<Record<string, string[]>>,
  libraryById: ReadonlyMap<string, A>,
): { attribute: A; from: C }[] {
  const seen = new Set<string>();
  const result: { attribute: A; from: C }[] = [];
  let current = parentId ? categoriesById.get(parentId) : undefined;
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    for (const attrId of categoryAttributeMap[current.id] ?? []) {
      const attribute = libraryById.get(attrId);
      if (attribute && !seen.has(attrId)) {
        seen.add(attrId);
        result.push({ attribute, from: current });
      }
    }
    current = current.parentId ? categoriesById.get(current.parentId) : undefined;
  }
  return result;
}
