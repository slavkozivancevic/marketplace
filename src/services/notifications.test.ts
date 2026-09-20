import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The published event envelope, specifically its `eventId`. Downstream that is
 * the idempotency key: the notifications consumer claims it in DynamoDB and
 * drops anything it has already seen. Two events that ought to be distinct but
 * share an id do not merely duplicate - the second is silently swallowed, and
 * nobody is told.
 */

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

// This is a unit test, so the real server env (a validated schema wanting a
// database URL, Stripe keys and the rest) is not loaded. Only the two values
// this module actually reads are supplied.
vi.mock("@/env/server", () => ({
  env: { AWS_REGION: "eu-central-1", NOTIFICATIONS_TOPIC_ARN_PARAM: "/test/topic-arn" },
}));

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: class {
    send = sendMock;
  },
  PublishCommand: class {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: class {
    send = vi.fn().mockResolvedValue({ Parameter: { Value: "arn:aws:sns:test:topic" } });
  },
  GetParameterCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));

const {
  publishCodOrderCancelled,
  publishCodPaymentReceived,
  publishMemberAccessRevoked,
  publishMemberRemoved,
} = await import("./notifications");

/** The decoded Message of the nth publish. */
function published(call = 0) {
  const command = sendMock.mock.calls[call][0] as { input: { Message: string } };
  return JSON.parse(command.input.Message) as Record<string, unknown>;
}

beforeEach(() => {
  sendMock.mockClear();
  sendMock.mockResolvedValue({});
});

describe("publishCodOrderCancelled", () => {
  it("says which seller withdrew", async () => {
    await publishCodOrderCancelled("order-1", "org-a", "sr");
    expect(published()).toMatchObject({
      type: "order.cod_cancelled",
      orderId: "order-1",
      organizationId: "org-a",
      locale: "sr",
    });
  });

  // Two sellers withdrawing from one order must not collide on the id, or the
  // buyer hears about the first and never about the second.
  it("gives each seller's withdrawal its own event id", async () => {
    await publishCodOrderCancelled("order-1", "org-a");
    await publishCodOrderCancelled("order-1", "org-b");

    const first = published(0).eventId as string;
    const second = published(1).eventId as string;
    expect(first).toBe("order-1:org-a:order.cod_cancelled");
    expect(second).toBe("order-1:org-b:order.cod_cancelled");
    expect(first).not.toBe(second);
  });

  it("still dedupes a genuine redelivery of the same seller's withdrawal", async () => {
    await publishCodOrderCancelled("order-1", "org-a");
    await publishCodOrderCancelled("order-1", "org-a");
    expect(published(0).eventId).toBe(published(1).eventId);
  });

  it("defaults to English when no locale is given", async () => {
    await publishCodOrderCancelled("order-1", "org-a");
    expect(published().locale).toBe("en");
  });
});

describe("publishCodPaymentReceived", () => {
  // The receipt is for the order as a whole and is sent once, when the last
  // seller has collected - so it stays keyed on the order alone.
  it("keeps one event id per order", async () => {
    await publishCodPaymentReceived("order-1", "en");
    expect(published()).toMatchObject({
      type: "order.cod_paid",
      orderId: "order-1",
      eventId: "order-1:order.cod_paid",
    });
  });
});

describe("publishMemberAccessRevoked", () => {
  const removed = {
    userEmail: "marko@example.test",
    userName: "Marko Markovic",
    organizationName: "Dunav Outdoor",
    removedRole: "MEMBER",
    locale: "sr",
  };

  it("addresses the removed member, in their own locale", async () => {
    await publishMemberAccessRevoked(removed);
    expect(published()).toMatchObject({
      type: "member.access_revoked",
      userEmail: "marko@example.test",
      organizationName: "Dunav Outdoor",
      removedRole: "MEMBER",
      // Theirs, not the acting admin's - they are the one reading it.
      locale: "sr",
    });
  });

  it("gives a second removal its own event id", async () => {
    // Invited back and removed again: the second removal is a second thing
    // that happened to them, not a redelivery of the first. Sharing an id
    // would have the consumer drop it and tell them nothing.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-18T10:00:00Z"));
      await publishMemberAccessRevoked(removed);
      vi.setSystemTime(new Date("2026-09-18T11:00:00Z"));
      await publishMemberAccessRevoked(removed);
    } finally {
      vi.useRealTimers();
    }
    expect(published(0).eventId).not.toBe(published(1).eventId);
  });
});

describe("publishMemberRemoved", () => {
  const base = {
    recipientEmail: "owner@example.test",
    recipientName: "Slavko Zivancevic",
    organizationName: "Dunav Outdoor",
    removedUserName: "Marko Markovic",
    removedUserEmail: "marko@example.test",
    removedRole: "MEMBER",
    locale: "en",
  };

  it("carries why the member is gone", async () => {
    await publishMemberRemoved({ ...base, reason: "removed_by_admin" });
    expect(published()).toMatchObject({
      type: "member.removed",
      recipientEmail: "owner@example.test",
      reason: "removed_by_admin",
    });
  });

  it("defaults to an account closure, which is what the only older caller means", async () => {
    await publishMemberRemoved(base);
    expect(published().reason).toBe("account_closed");
  });
});
