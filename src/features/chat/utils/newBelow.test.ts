import { describe, it, expect } from "vitest";
import { countNewBelow } from "./newBelow";

const ME = "user_me";
const PEER = "user_peer";

/** Newest first, the order `useMessages` hands the thread. */
function thread(
  ...entries: [senderId: string, createdAt: string][]
): { senderId: string; createdAt: string }[] {
  return entries.map(([senderId, createdAt]) => ({ senderId, createdAt }));
}

const DETACHED_AT = "2026-10-14T10:00:00.000Z";

describe("countNewBelow", () => {
  it("counts only what arrived after the reader left the bottom", () => {
    const messages = thread(
      [PEER, "2026-10-14T10:00:30.000Z"],
      [PEER, "2026-10-14T10:00:10.000Z"],
      [PEER, DETACHED_AT],
      [PEER, "2026-10-14T09:59:00.000Z"],
    );
    expect(countNewBelow(messages, DETACHED_AT, ME)).toBe(2);
  });

  it("does not count the message that was newest at the moment of detaching", () => {
    const messages = thread([PEER, DETACHED_AT]);
    expect(countNewBelow(messages, DETACHED_AT, ME)).toBe(0);
  });

  it("ignores our own messages", () => {
    const messages = thread(
      [ME, "2026-10-14T10:00:20.000Z"],
      [PEER, "2026-10-14T10:00:10.000Z"],
    );
    expect(countNewBelow(messages, DETACHED_AT, ME)).toBe(1);
  });

  // The unconfirmed copy of a message carries the sender's own clock while the
  // persisted one carries the Lambda's, so the two can differ in shape. Compared
  // as instants that is irrelevant; compared as strings it would not be.
  it("compares instants, not strings", () => {
    const messages = thread([PEER, "2026-10-14T10:00:30Z"]);
    expect(countNewBelow(messages, "2026-10-14T10:00:00.000Z", ME)).toBe(1);
    expect(countNewBelow(messages, "2026-10-14T10:00:31.000Z", ME)).toBe(0);
  });

  it("counts nothing for an empty thread or an unusable marker", () => {
    expect(countNewBelow([], DETACHED_AT, ME)).toBe(0);
    expect(countNewBelow(thread([PEER, DETACHED_AT]), "", ME)).toBe(0);
    expect(countNewBelow(thread([PEER, DETACHED_AT]), "not-a-date", ME)).toBe(0);
  });

  it("skips a message whose timestamp will not parse rather than counting it", () => {
    const messages = thread([PEER, "nonsense"], [PEER, "2026-10-14T10:00:10.000Z"]);
    expect(countNewBelow(messages, DETACHED_AT, ME)).toBe(1);
  });
});
