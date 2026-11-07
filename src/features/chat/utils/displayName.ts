import type { UserProfile } from "../db/userProfiles";

/**
 * The name chat shows for a participant: their name, or - for a deleted
 * account - the localized "Deleted account" label the caller passes in
 * (`t("deletedAccount")`). One rule for every place a name appears (inbox
 * row, thread header, quote, reaction line, copied text), so a deleted
 * account never reads as the English placeholder the user row keeps for
 * orders, and never as the name it used to have.
 */
export function chatDisplayName(profile: UserProfile | undefined, deletedLabel: string): string {
  if (!profile) return "";
  if (profile.deleted) return deletedLabel;
  return profile.name ?? "";
}
