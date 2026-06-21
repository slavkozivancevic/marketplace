import { prisma } from "@/core/db/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * Cursor-paginated audit trail for the admin view, newest first. Filters:
 * free-text (actor email or entity id), action key(s) and entity type(s).
 * Standard keyset paging: fetch take+1, pop the extra into `nextCursor`,
 * stable `[createdAt desc, id asc]` ordering.
 */
export async function getAuditLogsPage({
  take,
  cursor,
  search,
  action,
  entityType,
}: {
  take: number;
  cursor?: string;
  search?: string;
  action?: string[];
  entityType?: string[];
}) {
  const where: Prisma.AuditLogWhereInput = {};
  const and: Prisma.AuditLogWhereInput[] = [];

  if (search) {
    and.push({
      OR: [
        { actorEmail: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (action && action.length > 0) and.push({ action: { in: action } });
  if (entityType && entityType.length > 0) and.push({ entityType: { in: entityType } });
  if (and.length > 0) where.AND = and;

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
  });

  let nextCursor: string | undefined;
  if (rows.length > take) nextCursor = rows.pop()!.id;

  return { items: rows, nextCursor };
}

export type AuditLogItem = Awaited<ReturnType<typeof getAuditLogsPage>>["items"][number];

/** Distinct action keys and entity types present, for the filter dropdowns. */
export async function getAuditFacets(): Promise<{ actions: string[]; entityTypes: string[] }> {
  const [actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  return { actions: actions.map((a) => a.action), entityTypes: entityTypes.map((e) => e.entityType) };
}
