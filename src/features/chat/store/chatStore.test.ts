import { beforeEach, describe, expect, it } from "vitest";
import { isConversationOnScreen, useChatStore } from "./chatStore";

const reset = () =>
  useChatStore.setState({
    isOpen: false,
    selectedConvId: null,
    pageMounted: false,
    unreadCount: 0,
    convUnread: {},
    lastSeenAt: {},
  });

describe("isConversationOnScreen", () => {
  it("is true only for the selected conversation of an open surface", () => {
    const base = { isOpen: false, pageMounted: false, selectedConvId: "c1" };
    expect(isConversationOnScreen(base, "c1")).toBe(false);
    expect(isConversationOnScreen({ ...base, isOpen: true }, "c1")).toBe(true);
    expect(isConversationOnScreen({ ...base, pageMounted: true }, "c1")).toBe(true);
    expect(isConversationOnScreen({ ...base, pageMounted: true }, "c2")).toBe(false);
  });
});

describe("chat page vs drawer", () => {
  beforeEach(reset);

  it("entering the page shuts the drawer", () => {
    useChatStore.getState().openInbox();
    useChatStore.getState().enterPage();
    const s = useChatStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.pageMounted).toBe(true);
  });

  it("openInbox on the page neither opens the drawer nor drops the selection", () => {
    useChatStore.getState().enterPage();
    useChatStore.getState().setSelectedConvId("c1");
    useChatStore.getState().openInbox();
    const s = useChatStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.selectedConvId).toBe("c1");
  });

  it("a stray close on the page keeps the page's selection", () => {
    useChatStore.getState().enterPage();
    useChatStore.getState().setSelectedConvId("c1");
    useChatStore.getState().close();
    expect(useChatStore.getState().selectedConvId).toBe("c1");
  });

  it("openConversation on the page selects without opening the drawer", () => {
    useChatStore.setState({ convUnread: { c1: 2 }, unreadCount: 2 });
    useChatStore.getState().enterPage();
    useChatStore.getState().openConversation("c1");
    const s = useChatStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.selectedConvId).toBe("c1");
    expect(s.unreadCount).toBe(0);
  });

  it("leaving the page drops the selection so the drawer starts at the inbox", () => {
    useChatStore.getState().enterPage();
    useChatStore.getState().setSelectedConvId("c1");
    useChatStore.getState().leavePage();
    const s = useChatStore.getState();
    expect(s.pageMounted).toBe(false);
    expect(s.selectedConvId).toBeNull();
    useChatStore.getState().openInbox();
    expect(useChatStore.getState().isOpen).toBe(true);
  });

  it("off the page, close still clears the drawer's selection", () => {
    useChatStore.getState().openConversation("c1");
    useChatStore.getState().close();
    const s = useChatStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.selectedConvId).toBeNull();
  });
});
