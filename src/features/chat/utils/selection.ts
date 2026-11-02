/**
 * The most items one selection may hold - the messaging service's MAX_BATCH
 * (one DynamoDB transaction), so whatever is picked can be acted on in one
 * all-or-nothing request.
 */
export const MAX_SELECTION = 100;

/**
 * The selection after a tap on `id` in selection mode, as on WhatsApp: a tap
 * on a picked item un-picks it, a tap on any other adds it. `full` when the
 * add would go past MAX_SELECTION (the list is left as it was).
 */
export function toggleId(ids: string[], id: string): { ids: string[]; full: boolean } {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), full: false };
  if (ids.length >= MAX_SELECTION) return { ids, full: true };
  return { ids: [...ids, id], full: false };
}

/**
 * What a tap on a row does: outside selection mode it does what it always
 * did (open the conversation, nothing on a message); inside it the tap picks
 * or un-picks, and never opens anything.
 */
export function tapIntent(selectionActive: boolean): "open" | "toggle" {
  return selectionActive ? "toggle" : "open";
}
