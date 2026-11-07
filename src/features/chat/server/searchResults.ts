/** One hit from the conversation-search service. */
export interface SearchResult {
  conversationId: string;
  otherUserId: string;
  otherUserNameDisplay: string;
}

/**
 * Checks the search service's hits against the users as they are now.
 *
 * The service matches the query against its own copy of each participant's
 * name, which events keep up to date (see syncConversationSearchName) - but a
 * copy can lag, and before those events existed it never changed at all. A
 * deleted account was still found by the name it no longer has ("buyer"
 * found a row that read "Deleted account"). So here, against this database:
 *
 * - a deleted account is never a hit - its name is gone, it matches nothing;
 * - a hit whose current name no longer contains the query is dropped (the
 *   person was renamed since the copy was taken);
 * - the name sent back is the current one.
 *
 * Matching is the service's: case-insensitive "contains".
 */
export function verifySearchResults(
  results: SearchResult[],
  users: { id: string; name: string | null; deletedAt: Date | null }[],
  q: string,
): SearchResult[] {
  const query = q.trim().toLowerCase();
  const byId = new Map(users.map((u) => [u.id, u]));
  return results.flatMap((r) => {
    const user = byId.get(r.otherUserId);
    if (!user || user.deletedAt) return [];
    const name = user.name ?? "";
    if (!name.toLowerCase().includes(query)) return [];
    return [{ ...r, otherUserNameDisplay: name }];
  });
}
