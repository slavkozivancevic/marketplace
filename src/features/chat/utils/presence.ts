import { classifyDay } from "./dateLabels";

export type LastSeen =
  | { kind: "today"; at: Date }
  | { kind: "yesterday"; at: Date }
  | { kind: "older"; at: Date };

/**
 * Turns a stored `lastSeenAt` into which of the three phrasings applies, or
 * `null` when there is nothing to say.
 *
 * Split out of PresenceLine so the branches are unit-testable: the two that
 * are hardest to reach by hand are exactly the two that look worst if wrong -
 * a peer who has never been online (must render nothing, not "Invalid Date")
 * and a date old enough to stop being "yesterday".
 *
 * `now` is a parameter so tests do not depend on the day they run on.
 */
export function describeLastSeen(
  lastSeenAt: string | undefined | null,
  now: Date = new Date()
): LastSeen | null {
  if (!lastSeenAt) return null;

  const at = new Date(lastSeenAt);
  if (Number.isNaN(at.getTime())) return null;

  // Shared with the thread's date divider and the inbox timestamp, so all
  // three agree on where a day starts.
  return { kind: classifyDay(at, now), at };
}
