import { logger } from "@/lib/logger";
import { prisma } from "@/core/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";

export type AuditActor = {
  actorId: string | null;
  actorEmail: string | null;
  orgId: string | null;
};

/** Resolves the acting user from the request context (cached). System callers
 *  (webhooks) pass an explicit actor instead. Never throws. */
async function resolveAuditActor(): Promise<AuditActor> {
  try {
    const ctx = await resolveRequestContext();
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true },
    });
    return { actorId: ctx.userId, actorEmail: user?.email ?? null, orgId: ctx.organizationId };
  } catch {
    return { actorId: null, actorEmail: null, orgId: null };
  }
}

/**
 * Writes one append-only audit entry. Best-effort: a logging failure must never
 * break the underlying mutation, so everything is wrapped and swallowed. When
 * `actor` is omitted it is resolved from the request context (the signed-in
 * user); pass an explicit `actor` (or the SYSTEM_ACTOR) for webhook/system work.
 */
export async function recordAudit(entry: {
  action: string;
  entityType: string;
  entityId: string;
  diff?: Prisma.InputJsonValue;
  actor?: AuditActor;
}): Promise<void> {
  try {
    const actor = entry.actor ?? (await resolveAuditActor());
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        diff: entry.diff,
        actorId: actor.actorId,
        actorEmail: actor.actorEmail,
        orgId: actor.orgId,
      },
    });
  } catch (err) {
    logger.error("[audit] failed to record", entry.action, err);
  }
}

/** Actor for non-user-initiated work (Stripe webhook, scheduled jobs). */
export const SYSTEM_ACTOR: AuditActor = { actorId: null, actorEmail: null, orgId: null };

export type FieldDiff = Record<string, { from: unknown; to: unknown }>;

/**
 * Builds a { field: { from, to } } map of only the fields that actually changed
 * between `before` and `after` (shallow, strict inequality). Returns undefined
 * when nothing changed - so update audits with no real change are skipped.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  keys: (keyof T)[],
): FieldDiff | undefined {
  const out: FieldDiff = {};
  for (const k of keys) {
    if (before[k] !== after[k]) out[String(k)] = { from: before[k], to: after[k] };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
