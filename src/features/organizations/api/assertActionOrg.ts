import { headers } from "next/headers";
import { refresh } from "next/cache";
import type { RequestContext } from "@/types/types";
import { OrgChangedActionError } from "@/features/common/errors/domainErrors";
import { ACTIVE_ORG_HEADER } from "../orgScope";

/** Next's own header on every Server Action request. */
const ACTION_HEADER = "next-action";

/**
 * Refuses a Server Action from a tab that still shows another org than the one
 * the request resolves to. The dashboard shell adds `ACTIVE_ORG_HEADER` to its
 * Server Action requests (`ActiveOrgProvider`), so this sees the org the user
 * was looking at when they pressed Save.
 *
 * Only Server Actions are checked: a page render has no such header, and the
 * list route handlers answer with their own 409 (`orgChangedResponse`). No
 * header - the storefront, the admin area, a page open from before a deploy -
 * means no check.
 *
 * `refresh()` before the throw re-renders the calling tab on the org it is
 * really in, next to the toast that says nothing was saved.
 */
export async function assertActionOrg(
  ctx: Pick<RequestContext, "organizationId">,
): Promise<void> {
  const h = await headers();
  if (!h.has(ACTION_HEADER)) return;
  const expected = h.get(ACTIVE_ORG_HEADER);
  if (!expected || expected === ctx.organizationId) return;
  refresh();
  throw new OrgChangedActionError();
}
