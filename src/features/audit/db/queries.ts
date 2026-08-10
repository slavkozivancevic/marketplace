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
  sortOrder = "desc",
  dateFrom,
  dateTo,
}: {
  take: number;
  cursor?: string;
  search?: string;
  action?: string[];
  entityType?: string[];
  sortOrder?: "asc" | "desc";
  /** YYYY-MM-DD, inclusive. */
  dateFrom?: string;
  /** YYYY-MM-DD, inclusive. */
  dateTo?: string;
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
  if (dateFrom) and.push({ createdAt: { gte: new Date(dateFrom) } });
  if (dateTo) {
    // "to" is inclusive of the whole day - use the next day's midnight as an
    // exclusive upper bound rather than juggling end-of-day milliseconds.
    const exclusiveEnd = new Date(dateTo);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    and.push({ createdAt: { lt: exclusiveEnd } });
  }
  if (and.length > 0) where.AND = and;

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: sortOrder }, { id: "asc" }],
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
  });

  let nextCursor: string | undefined;
  if (rows.length > take) nextCursor = rows.pop()!.id;

  // The diff stores a seller as the org id (stable); swap in the current org
  // name for display. Batched so the page stays one extra query at most.
  const orgIds = new Set<string>();
  for (const r of rows) {
    const seller = (r.diff as Record<string, unknown> | null)?.seller;
    if (typeof seller === "string") orgIds.add(seller);
  }
  if (orgIds.size > 0) {
    const orgs = await prisma.organization.findMany({
      where: { id: { in: [...orgIds] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(orgs.map((o) => [o.id, o.name]));
    for (const r of rows) {
      const d = r.diff as Record<string, unknown> | null;
      if (d && typeof d.seller === "string" && nameById.has(d.seller)) {
        d.seller = nameById.get(d.seller)!;
      }
    }
  }

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
