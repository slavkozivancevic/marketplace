import { env } from "@/env/server";
import { logger } from "@/lib/logger";

const TIMEOUT_MS = 5000;

/**
 * Tells the conversation-search service that a user's name changed, or that
 * the account is gone, so its copy of the name (what the inbox search
 * matches) follows. It used to copy a name once, when the conversation
 * started, and never again: a renamed user could not be found by the new
 * name, and a deleted one was still found by the old one.
 *
 * `name: null, deleted: true` erases the name from the index - a deleted
 * account's name is not kept anywhere, search included.
 *
 * Best effort, and never a reason to fail the caller (a Clerk webhook, the
 * account deletion): the search route checks every hit against this database
 * anyway (verifySearchResults), and the service's `resync-names` script
 * repairs any copy a lost call left behind.
 */
export async function syncConversationSearchName(
  userId: string,
  profile: { name: string | null; deleted: boolean },
): Promise<void> {
  try {
    const res = await fetch(`${env.CONVERSATION_SEARCH_API_URL}/users/name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.CONVERSATION_SEARCH_API_KEY,
      },
      body: JSON.stringify({ userId, name: profile.deleted ? null : profile.name, deleted: profile.deleted }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn("[searchIndexSync] update refused", { userId, status: res.status });
    }
  } catch (error) {
    logger.warn("[searchIndexSync] update failed", { userId, error: String(error) });
  }
}
