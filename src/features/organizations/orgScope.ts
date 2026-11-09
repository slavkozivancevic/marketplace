/**
 * The contract that keeps an org-scoped list from showing another org's rows.
 *
 * The active org is one column on the user (`User.activeOrgId`), not a value of
 * the session, and `resolveRequestContext` trusts the database. So when the org
 * changes somewhere else - another tab of the same account, or another visitor
 * on a shared demo account - a tab left open keeps its old shell (switcher and
 * `ActiveOrgProvider` on the old org) while every API call it makes answers for
 * the NEW org. React Query then stored those rows under the OLD org's key: "No
 * products yet" under one org's name, "Wrong organization context" on a click.
 *
 * The client therefore names the org it is showing (`ACTIVE_ORG_HEADER`), an
 * org-scoped route refuses with 409 `ORG_CHANGED` when that is not the org the
 * request resolves to, and the client re-renders the shell on the right org
 * instead of caching the answer. Shared by the client and the route handlers,
 * so nothing here may import server-only code.
 */

export const ACTIVE_ORG_HEADER = "x-active-org";

export const ORG_CHANGED = "ORG_CHANGED";

export class OrgChangedError extends Error {
  readonly code = ORG_CHANGED;

  constructor() {
    super("The active organization changed");
    this.name = "OrgChangedError";
  }
}

export function isOrgChangedError(error: unknown): error is OrgChangedError {
  return error instanceof OrgChangedError;
}
