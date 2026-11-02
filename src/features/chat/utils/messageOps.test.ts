import { describe, it, expect } from "vitest";
import type { ChatMessage, Conversation } from "../types";
import {
  DELETE_FOR_EVERYONE_WINDOW_MS,
  EDIT_WINDOW_MS,
  formatCopy,
  messageActions,
  selectionActions,
  withDelete,
  withEdit,
  withLastMessageChange,
} from "./messageOps";

const CREATED = "2026-11-01T10:00:00.000Z";
const T0 = Date.parse(CREATED);

const msg = (extra: Partial<ChatMessage> = {}): ChatMessage => ({
  messageId: "m1",
  conversationId: "c1",
  senderId: "me",
  text: "hello",
  attachments: [],
  readBy: [],
  createdAt: CREATED,
  ...extra,
});

describe("messageActions - what a picked message offers, as on WhatsApp", () => {
  it("own text message, fresh: everything", () => {
    expect(messageActions(msg(), "me", T0 + 60_000)).toEqual({
      copy: true,
      edit: true,
      deleteForEveryone: true,
      deleteForMe: true,
      react: true,
    });
  });

  it("edit ends at 15 minutes, delete for everyone at 60 hours, delete for me never", () => {
    expect(messageActions(msg(), "me", T0 + EDIT_WINDOW_MS).edit).toBe(true);
    expect(messageActions(msg(), "me", T0 + EDIT_WINDOW_MS + 1).edit).toBe(false);
    expect(messageActions(msg(), "me", T0 + DELETE_FOR_EVERYONE_WINDOW_MS).deleteForEveryone).toBe(true);
    const old = messageActions(msg(), "me", T0 + DELETE_FOR_EVERYONE_WINDOW_MS + 1);
    expect(old.deleteForEveryone).toBe(false);
    expect(old.deleteForMe).toBe(true);
    expect(old.copy).toBe(true);
  });

  it("someone else's message: copy, react and delete for me only", () => {
    expect(messageActions(msg({ senderId: "them" }), "me", T0)).toEqual({
      copy: true,
      edit: false,
      deleteForEveryone: false,
      deleteForMe: true,
      react: true,
    });
  });

  it("a photo without text cannot be copied or edited", () => {
    const a = messageActions(msg({ text: "", attachments: [{ key: "chat/me/x", type: "image/png" }] }), "me", T0);
    expect(a.copy).toBe(false);
    expect(a.edit).toBe(false);
    expect(a.deleteForEveryone).toBe(true);
  });

  it("a deleted message only offers clearing its placeholder away", () => {
    expect(messageActions(msg({ text: "", deletedAt: CREATED }), "me", T0)).toEqual({
      copy: false,
      edit: false,
      deleteForEveryone: false,
      deleteForMe: true,
      react: false,
    });
  });

  it("a message still in the outbox offers nothing", () => {
    expect(Object.values(messageActions(msg(), "me", T0, true)).some(Boolean)).toBe(false);
  });
});

describe("cache changes", () => {
  const thread = { messages: [msg(), msg({ messageId: "m0", text: "older" })] };

  it("an edit replaces the text and marks it edited", () => {
    const next = withEdit(thread, "m1", "fixed", "2026-11-01T10:05:00.000Z")!;
    expect(next.messages[0]).toMatchObject({ text: "fixed", editedAt: "2026-11-01T10:05:00.000Z" });
    expect(next.messages[1].text).toBe("older");
  });

  it("delete for everyone leaves a tombstone in place; delete for me removes it", () => {
    const withPhoto = { messages: [msg({ attachments: [{ key: "chat/me/x", type: "image/png" }] })] };
    const tomb = withDelete(withPhoto, "m1", "everyone", "2026-11-01T10:06:00.000Z")!;
    expect(tomb.messages[0]).toMatchObject({ text: "", attachments: [], deletedAt: "2026-11-01T10:06:00.000Z" });
    expect(withDelete(thread, "m1", "me", "x")!.messages.map((m) => m.messageId)).toEqual(["m0"]);
  });

  it("the inbox preview follows only when the changed message is the last one", () => {
    const conv = (lastMessageAt: string): Conversation => ({
      conversationId: "c1",
      participants: ["me", "them"],
      lastMessageAt,
      lastMessagePreview: "hello",
      createdAt: CREATED,
    });
    const last = { conversations: [conv(CREATED)] };
    expect(withLastMessageChange(last, "c1", CREATED, { text: "fixed" })!.conversations[0].lastMessagePreview).toBe("fixed");
    expect(withLastMessageChange(last, "c1", CREATED, { deleted: true })!.conversations[0]).toMatchObject({
      lastMessagePreview: "",
      lastMessageDeleted: true,
    });
    const newer = { conversations: [conv("2026-11-01T11:00:00.000Z")] };
    expect(withLastMessageChange(newer, "c1", CREATED, { text: "fixed" })!.conversations[0].lastMessagePreview).toBe("hello");
  });
});

describe("selectionActions - what a selection offers, as on WhatsApp", () => {
  const now = T0 + 60_000;

  it("one message: reply, copy, edit, delete for everyone, emoji bar", () => {
    expect(selectionActions([msg()], "me", now)).toEqual({
      reply: true,
      copy: true,
      edit: true,
      deleteForEveryone: true,
      deleteForMe: true,
      react: true,
    });
  });

  it("several: copy and delete only - no reply, no edit, no emoji bar", () => {
    const a = selectionActions([msg(), msg({ messageId: "m2" })], "me", now);
    expect(a).toMatchObject({ reply: false, edit: false, react: false, copy: true, deleteForMe: true });
  });

  it("offers delete for everyone only when every picked message allows it", () => {
    expect(selectionActions([msg(), msg({ messageId: "m2" })], "me", now).deleteForEveryone).toBe(true);
    expect(selectionActions([msg(), msg({ messageId: "m2", senderId: "them" })], "me", now).deleteForEveryone).toBe(false);
    const old = msg({ messageId: "m0", createdAt: new Date(T0 - DELETE_FOR_EVERYONE_WINDOW_MS - 1).toISOString() });
    expect(selectionActions([msg(), old], "me", now).deleteForEveryone).toBe(false);
  });

  it("a deleted message cannot be answered", () => {
    expect(selectionActions([msg({ text: "", deletedAt: CREATED })], "me", now).reply).toBe(false);
  });
});

describe("formatCopy", () => {
  const names = (id: string) => (id === "me" ? "Ana" : "Marko");

  it("one message is just its text", () => {
    expect(formatCopy([msg({ text: "Zdravo" })], names, "sr")).toBe("Zdravo");
  });

  it("several are one line each, in thread order, with when and who", () => {
    const later = msg({ messageId: "m2", senderId: "them", text: "Jeste", createdAt: "2026-11-01T10:05:00.000Z" });
    const out = formatCopy([later, msg({ text: "Da li je dostupno?" })], names, "en").split("\n");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/^\[.+\] Ana: Da li je dostupno\?$/);
    expect(out[1]).toMatch(/^\[.+\] Marko: Jeste$/);
  });

  it("leaves out messages with no text", () => {
    const photo = msg({ messageId: "m2", text: "", attachments: [{ key: "k", type: "image/png" }] });
    const deleted = msg({ messageId: "m3", text: "", deletedAt: CREATED });
    expect(formatCopy([msg({ text: "a" }), photo, deleted], names, "en").split("\n")).toHaveLength(1);
  });
});

describe("withDelete - a selection, and the quotes of it", () => {
  const quote = { messageId: "m1", createdAt: CREATED, senderId: "me", excerpt: "hello", attachment: { key: "k", type: "image/png" } };
  const reply = msg({ messageId: "r1", senderId: "them", text: "yes", replyTo: quote });

  it("for everyone: tombstones for all of them, and replies lose the quoted words", () => {
    const data = { messages: [reply, msg({ messageId: "m2" }), msg()] };
    const out = withDelete(data, ["m1", "m2"], "everyone", "2026-11-01T11:00:00.000Z")!.messages;
    expect(out.find((m) => m.messageId === "m2")).toMatchObject({ text: "", deletedAt: "2026-11-01T11:00:00.000Z" });
    expect(out.find((m) => m.messageId === "r1")!.replyTo).toEqual({ messageId: "m1", createdAt: CREATED, senderId: "me", deleted: true });
  });

  it("for me: they leave the thread, and a quote of them can no longer jump", () => {
    const out = withDelete({ messages: [reply, msg()] }, ["m1"], "me", "")!.messages;
    expect(out.map((m) => m.messageId)).toEqual(["r1"]);
    expect(out[0].replyTo).toMatchObject({ excerpt: "hello", unavailable: true });
  });

  it("a deleted reply keeps no quote of its own", () => {
    const out = withDelete({ messages: [reply] }, "r1", "everyone", CREATED)!.messages;
    expect(out[0].replyTo).toBeUndefined();
  });
});