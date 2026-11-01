import "server-only";
import { NextResponse } from "next/server";
import axios from "axios";
import { env } from "@/env/server";
import { DemoReadOnlyError } from "@/features/common/errors/domainErrors";
import type { RequestContext } from "@/types/types";

type ChatViewer = Pick<RequestContext, "userId" | "isDemoReadOnly">;

/**
 * Chat belongs to the demo buyer only. The seller and the admin demo accounts
 * are one account shared by every visitor, so whatever lands in their inbox is
 * readable by the next visitor and anything sent from it goes out in a name
 * nobody owns. They get no chat at all - not a read-only one: without a token
 * there is no inbox to read, no socket to send on and nothing to delete.
 *
 * Every `/api/chat/*` handler calls this before it talks to the messaging
 * service; `getChatToken` refuses the same accounts as a backstop.
 */
export function refuseDemoChat(ctx: Pick<RequestContext, "isDemoReadOnly">): NextResponse | null {
  if (!ctx.isDemoReadOnly) return null;
  return NextResponse.json({ error: "demoReadOnly" }, { status: 403 });
}

/** A short-lived chat JWT for the signed-in user, minted by the messaging service. */
export async function getChatToken(ctx: ChatViewer): Promise<string> {
  if (ctx.isDemoReadOnly) throw new DemoReadOnlyError();
  const { data } = await axios.post<{ token: string }>(
    `${env.CHAT_HTTP_API_URL}/auth/token`,
    { userId: ctx.userId },
    { headers: { "x-api-key": env.CHAT_INTERNAL_API_KEY } },
  );
  return data.token;
}
