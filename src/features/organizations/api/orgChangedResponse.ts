import { NextResponse } from "next/server";
import type { RequestContext } from "@/types/types";
import { ACTIVE_ORG_HEADER, ORG_CHANGED } from "../orgScope";

/**
 * 409 `ORG_CHANGED` when the client asked for a different org than the one this
 * request resolves to - see `orgScope.ts`. Called right after
 * `resolveRequestContext()` in every org-scoped list route, before the
 * permission check: a 403 computed from the other org's role would be just as
 * wrong as its rows.
 *
 * No header means a client that predates the contract (a page still open from
 * before a deploy): it is served as before rather than broken. The body does
 * not name the new org; the client learns it from the re-rendered shell.
 */
export function orgChangedResponse(
  req: Request,
  ctx: Pick<RequestContext, "organizationId">,
): NextResponse | null {
  const expected = req.headers.get(ACTIVE_ORG_HEADER);
  if (!expected || expected === ctx.organizationId) return null;
  return NextResponse.json({ code: ORG_CHANGED }, { status: 409 });
}
