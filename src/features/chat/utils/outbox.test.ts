import { describe, it, expect } from "vitest";
import {
  backoffDelay,
  dueEntries,
  hasExpired,
  hasStalled,
  ACK_TIMEOUT_MS,
  ATTACHMENT_MAX_AGE_MS,
  type OutboxEntry,
} from "./outbox";

const NOW = Date.parse("2026-10-16T12:00:00.000Z");

function entry(over: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    clientMsgId: "cm-1",
    conversationId: "c1",
    text: "zdravo",
    attachments: [],
    createdAt: new Date(NOW).toISOString(),
    attempts: 0,
    status: "queued",
    ...over,
  };
}

describe("backoffDelay", () => {
  it("doubles and then stops growing", () => {
    expect(backoffDelay(1)).toBe(2_000);
    expect(backoffDelay(2)).toBe(4_000);
    expect(backoffDelay(3)).toBe(8_000);
    expect(backoffDelay(99)).toBe(60_000);
  });

  it("never returns a negative wait for a fresh entry", () => {
    expect(backoffDelay(0)).toBeGreaterThan(0);
  });
});

describe("hasExpired", () => {
  it("never expires a message without attachments", () => {
    const old = entry({ createdAt: new Date(NOW - ATTACHMENT_MAX_AGE_MS * 10).toISOString() });
    expect(hasExpired(old, NOW)).toBe(false);
  });

  // The upload tag is only cleared when the message is written, and the bucket
  // sweeps tagged objects after a day. Past that the keys point at nothing.
  it("expires a message whose attachments have outlived the bucket rule", () => {
    const withFile = entry({
      attachments: [{ key: "a/b.jpg", type: "image/jpeg" }],
      createdAt: new Date(NOW - ATTACHMENT_MAX_AGE_MS - 1).toISOString(),
    });
    expect(hasExpired(withFile, NOW)).toBe(true);
  });

  it("keeps one that is still inside the window", () => {
    const withFile = entry({
      attachments: [{ key: "a/b.jpg", type: "image/jpeg" }],
      createdAt: new Date(NOW - ATTACHMENT_MAX_AGE_MS + 60_000).toISOString(),
    });
    expect(hasExpired(withFile, NOW)).toBe(false);
  });
});

describe("hasStalled", () => {
  it("only applies to an attempt that is actually out", () => {
    expect(hasStalled(entry({ status: "queued" }), NOW)).toBe(false);
    expect(hasStalled(entry({ status: "sending" }), NOW)).toBe(false);
  });

  it("stalls once the ack window has passed", () => {
    const sent = entry({ status: "sending", sentAt: NOW - ACK_TIMEOUT_MS - 1 });
    expect(hasStalled(sent, NOW)).toBe(true);
    expect(hasStalled({ ...sent, sentAt: NOW - 1_000 }, NOW)).toBe(false);
  });
});

describe("dueEntries", () => {
  it("takes one head per conversation, not the whole queue", () => {
    const due = dueEntries(
      [
        entry({ clientMsgId: "a1", conversationId: "c1" }),
        entry({ clientMsgId: "a2", conversationId: "c1" }),
        entry({ clientMsgId: "b1", conversationId: "c2" }),
      ],
      NOW,
    );
    expect(due.map((e) => e.clientMsgId)).toEqual(["a1", "b1"]);
  });

  // Order inside a conversation carries meaning, so a message in flight holds
  // the ones behind it rather than letting them overtake it.
  it("blocks a conversation whose head is still awaiting an ack", () => {
    const due = dueEntries(
      [
        entry({ clientMsgId: "a1", status: "sending", sentAt: NOW }),
        entry({ clientMsgId: "a2" }),
      ],
      NOW,
    );
    expect(due).toHaveLength(0);
  });

  it("blocks a conversation whose head has given up", () => {
    const due = dueEntries(
      [
        entry({ clientMsgId: "a1", status: "failed", failedReason: "retries" }),
        entry({ clientMsgId: "a2" }),
      ],
      NOW,
    );
    expect(due).toHaveLength(0);
  });

  it("holds a head back until its backoff has run out", () => {
    const waiting = entry({ nextAttemptAt: NOW + 5_000 });
    expect(dueEntries([waiting], NOW)).toHaveLength(0);
    expect(dueEntries([waiting], NOW + 5_000)).toHaveLength(1);
  });

  // A delivered entry hangs around for a moment so the thread can hand over to
  // the persisted message without a blank frame. It is finished business, and
  // must not hold up the message queued behind it.
  it("sends past an entry that has already been confirmed", () => {
    const due = dueEntries(
      [
        entry({ clientMsgId: "a1", status: "delivered", deliveredAs: "msg-1" }),
        entry({ clientMsgId: "a2" }),
      ],
      NOW,
    );
    expect(due.map((e) => e.clientMsgId)).toEqual(["a2"]);
  });

  it("lets one conversation run while another is stuck", () => {
    const due = dueEntries(
      [
        entry({ clientMsgId: "a1", conversationId: "c1", status: "failed" }),
        entry({ clientMsgId: "b1", conversationId: "c2" }),
      ],
      NOW,
    );
    expect(due.map((e) => e.clientMsgId)).toEqual(["b1"]);
  });
});
