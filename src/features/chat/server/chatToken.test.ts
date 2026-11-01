import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import axios from "axios";
import { DemoReadOnlyError } from "@/features/common/errors/domainErrors";
import { getChatToken, refuseDemoChat } from "./chatToken";

vi.mock("@/env/server", () => ({
  env: { CHAT_HTTP_API_URL: "https://chat.test", CHAT_INTERNAL_API_KEY: "key" },
}));
vi.mock("axios", () => ({ default: { post: vi.fn() } }));

describe("chat token", () => {
  it("refuses the view-only demo accounts before asking the messaging service", async () => {
    await expect(getChatToken({ userId: "u1", isDemoReadOnly: true })).rejects.toThrow(
      DemoReadOnlyError,
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("mints a token for everyone else", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { token: "jwt" } });
    await expect(getChatToken({ userId: "u1", isDemoReadOnly: false })).resolves.toBe("jwt");
    expect(axios.post).toHaveBeenCalledWith(
      "https://chat.test/auth/token",
      { userId: "u1" },
      { headers: { "x-api-key": "key" } },
    );
  });

  it("answers 403 for the view-only demo accounts and nothing for the rest", async () => {
    const refused = refuseDemoChat({ isDemoReadOnly: true });
    expect(refused?.status).toBe(403);
    await expect(refused?.json()).resolves.toEqual({ error: "demoReadOnly" });
    expect(refuseDemoChat({ isDemoReadOnly: false })).toBeNull();
  });
});

/**
 * The demo seller and admin share one inbox with every visitor, so a chat
 * route that skips the check leaks it. Every handler under /api/chat must
 * refuse them, and none may mint its own token around `getChatToken`.
 */
describe("every /api/chat route refuses the view-only demo accounts", () => {
  const root = path.join(process.cwd(), "src", "app", "api", "chat");
  const routes = fs
    .readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => path.basename(file) === "route.ts");

  it("finds the routes", () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  // Who may write to whom is decided in start-with-seller (buyer -> seller of
  // a product). A proxy that forwards caller-chosen participants would let any
  // signed-in user open a conversation with any user id.
  it("has no route that opens a conversation with caller-chosen participants", () => {
    const conversations = fs.readFileSync(path.join(root, "conversations", "route.ts"), "utf8");
    expect(conversations).not.toMatch(/export async function POST/);
  });

  it.each(routes)("%s", (file) => {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    expect(source).toContain("refuseDemoChat(ctx)");
    expect(source).not.toContain("/auth/token");
  });
});
