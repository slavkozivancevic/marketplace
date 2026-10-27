/**
 * Creates the three public demo accounts (src/features/demo/demoAccounts.ts)
 * on a real stage: the Clerk user, its database row and personal organization,
 * and the role each one demonstrates.
 *
 *   buyer  - UserRole USER, its own (unverified) personal organization
 *   seller - UserRole SELLER, ADMIN member of the Proton org (the 94-product
 *            catalog, its price rules and orders) and active there
 *   admin  - UserRole ADMIN
 *
 * The seller and the admin are view-only - the app refuses their writes by
 * email - so nothing here grants anything a visitor could abuse.
 *
 * Why the database row is written here and not left to the Clerk webhook: the
 * Clerk dev instance is shared by local and staging, so the webhook is not a
 * reliable source of truth. The script waits briefly for it anyway (it would
 * otherwise race the script and create a second personal organization), then
 * writes whatever is still missing - the same shape `createOrUpdateUserFromClerk`
 * writes, minus its cache invalidation, which throws outside Next.
 *
 * Clerk's publicMetadata carries the role too, and the webhook recomputes the
 * database role from it on every `user.updated`, so both are always set
 * together.
 *
 * Secrets come from `sst secret list` and are never printed. Idempotent.
 *
 * Usage (from the repo root):
 *   npx tsx --conditions=react-server scripts/staging/demo-accounts.ts --stage staging --dump
 *   npx tsx --conditions=react-server scripts/staging/demo-accounts.ts --stage staging --apply
 */
import { execFileSync } from "node:child_process";
import { createClerkClient, type User as ClerkUser } from "@clerk/backend";
import { resolveStageDatabaseUrl } from "../lib/stageDatabaseUrl.mjs";
import { DEMO_ACCOUNTS, DEMO_ROLES, type DemoRole } from "../../src/features/demo/demoAccounts";

const PROTON_ORG_ID = "16e0e989-6988-4117-99e4-9490bfb7e0e2"; // Slavko Zivancevic's Proton Organization
const DB_ROLE: Record<DemoRole, "USER" | "SELLER" | "ADMIN"> = {
  buyer: "USER",
  seller: "SELLER",
  admin: "ADMIN",
};

const stageIdx = process.argv.indexOf("--stage");
const stage = stageIdx >= 0 ? process.argv[stageIdx + 1] : undefined;
const apply = process.argv.includes("--apply");
if (!stage || (!apply && !process.argv.includes("--dump"))) {
  console.error("Usage: demo-accounts.ts --stage <stage> --dump | --apply");
  process.exit(1);
}

function stageSecret(name: string): string {
  const out = execFileSync("npx", ["sst", "secret", "list", "--stage", stage!], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const match = out.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match) throw new Error(`No ${name} secret for stage "${stage}"`);
  return match[1].trim();
}

// Before any app module reads it; dotenv never overrides a set variable.
const url = resolveStageDatabaseUrl(stage);
process.env.DATABASE_URL = url;
await import("dotenv/config");
const { prisma } = await import("@/core/db/prisma");
const { moneyCol } = await import("@/core/db/moneyColumns");
const { zeroMoney } = await import("@/lib/money");

const clerk = createClerkClient({ secretKey: stageSecret("ClerkSecretKey") });

console.log(`database host: ${new URL(url).host}`);
const proton = await prisma.organization.findUnique({ where: { id: PROTON_ORG_ID }, select: { name: true } });
if (!proton) throw new Error(`Organization ${PROTON_ORG_ID} is not in this database - refusing to run`);

async function clerkUserByEmail(email: string): Promise<ClerkUser | null> {
  const { data } = await clerk.users.getUserList({ emailAddress: [email] });
  return data[0] ?? null;
}

async function report() {
  for (const role of DEMO_ROLES) {
    const account = DEMO_ACCOUNTS[role];
    const cu = await clerkUserByEmail(account.email);
    const db = cu
      ? await prisma.user.findUnique({
          where: { clerkUserId: cu.id },
          select: {
            role: true,
            activeOrgId: true,
            memberships: { select: { role: true, organization: { select: { name: true, verified: true } } } },
          },
        })
      : null;
    console.log(`\n${role} <${account.email}>`);
    console.log(`  clerk: ${cu ? `${cu.id} ${cu.firstName} ${cu.lastName} metadata=${JSON.stringify(cu.publicMetadata)}` : "missing"}`);
    console.log(`  db:    ${db ? `role=${db.role} activeOrg=${db.activeOrgId}` : "missing"}`);
    for (const m of db?.memberships ?? []) {
      console.log(`         ${m.role} in "${m.organization.name}"${m.organization.verified ? " (verified)" : ""}`);
    }
  }
}

if (!apply) {
  await report();
  await prisma.$disconnect();
  process.exit(0);
}

for (const role of DEMO_ROLES) {
  const account = DEMO_ACCOUNTS[role];
  const dbRole = DB_ROLE[role];
  const name = `${account.firstName} ${account.lastName}`;

  // 1. The Clerk user. No password: the only way in is a sign-in token.
  let cu = await clerkUserByEmail(account.email);
  if (!cu) {
    cu = await clerk.users.createUser({
      emailAddress: [account.email],
      firstName: account.firstName,
      lastName: account.lastName,
      skipPasswordRequirement: true,
      publicMetadata: { role: dbRole, demo: role },
    });
    console.log(`${role}: Clerk user created`);
  }
  await clerk.users.updateUser(cu.id, {
    firstName: account.firstName,
    lastName: account.lastName,
    deleteSelfEnabled: false,
    createOrganizationEnabled: false,
  });

  // 2. The database row: give the webhook a moment, then write what is missing.
  let user = await prisma.user.findUnique({ where: { clerkUserId: cu.id }, select: { id: true } });
  for (let i = 0; !user && i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    user = await prisma.user.findUnique({ where: { clerkUserId: cu.id }, select: { id: true } });
  }
  const dbUser = await prisma.$transaction(async (tx) => {
    const row = await tx.user.upsert({
      where: { clerkUserId: cu.id },
      update: { email: account.email, name, role: dbRole, deletedAt: null },
      create: { clerkUserId: cu.id, email: account.email, name, imageUrl: cu.imageUrl, role: dbRole },
    });
    const memberships = await tx.membership.count({ where: { userId: row.id } });
    if (memberships === 0) {
      const noShippingFee = moneyCol(zeroMoney());
      const org = await tx.organization.create({
        data: {
          name: `${name}'s Organization`,
          verified: dbRole === "SELLER",
          shippingFlatRate: noShippingFee.mirror,
          shippingFlatRateMoney: noShippingFee.json,
        },
      });
      await tx.membership.create({ data: { userId: row.id, orgId: org.id, role: "OWNER" } });
      await tx.user.update({ where: { id: row.id }, data: { activeOrgId: org.id } });
    }
    // 3. The seller works in the real catalog, as an ADMIN member.
    if (role === "seller") {
      await tx.membership.upsert({
        where: { userId_orgId: { userId: row.id, orgId: PROTON_ORG_ID } },
        update: { role: "ADMIN" },
        create: { userId: row.id, orgId: PROTON_ORG_ID, role: "ADMIN" },
      });
      await tx.user.update({ where: { id: row.id }, data: { activeOrgId: PROTON_ORG_ID } });
    }
    return tx.user.findUniqueOrThrow({ where: { id: row.id }, select: { id: true, activeOrgId: true } });
  });

  // 4. Clerk's copy of the claims the app reads from the session token.
  await clerk.users.updateUserMetadata(cu.id, {
    // activeOrgId is set by the transaction above in every branch.
    publicMetadata: { dbId: dbUser.id, role: dbRole, activeOrgId: dbUser.activeOrgId!, demo: role },
  });
  console.log(`${role}: ready (${dbRole})`);
}

await report();
await prisma.$disconnect();
process.exit(0);
