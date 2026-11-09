import { headers } from "next/headers";
import { refresh } from "next/cache";
// Next internal, deliberately: the only signal that tells a Server Action
// running from the page render Next does right after it, in the same request.
// `actionPhaseGuard.test.ts` fails if a Next upgrade changes it.
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
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
 * Only while the action itself runs. `refresh()` below makes Next render the
 * page again in the SAME request, after the action - with the same headers -
 * and that render must go through on the org the user is really in: that is
 * what moves the stale tab over. Refusing it too (as the first version did)
 * crashed the render, the response came back empty and the tab showed
 * "Something went wrong" instead of the toast. Next marks the two halves with
 * the request store's `phase` ('action', then 'render').
 *
 * Page renders, route handlers (the list routes answer their own 409, see
 * `orgChangedResponse`) and a client that sends no org - the storefront, the
 * admin area, a page open from before a deploy - are not checked.
 */
export async function assertActionOrg(
  ctx: Pick<RequestContext, "organizationId">,
): Promise<void> {
  const store = workUnitAsyncStorage.getStore();
  if (store?.phase !== "action") return;
  const h = await headers();
  if (!h.has(ACTION_HEADER)) return;
  const expected = h.get(ACTIVE_ORG_HEADER);
  if (!expected || expected === ctx.organizationId) return;
  refresh();
  throw new OrgChangedActionError();
}
