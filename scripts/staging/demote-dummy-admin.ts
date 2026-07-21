// Demotes the leftover seed admin (admin@marketplace.test) from ADMIN to USER.
// Its fake @marketplace.test domain can never be SES-verified, so every weekly
// review-moderation digest threw on it and never reached the real admins
// (slavko.zivancevic@protonmail.com / @gmail.com). Idempotent: no-op if already fixed.
//
// Run:
//   DATABASE_URL=<direct-neon-url> npx tsx scripts/staging/demote-dummy-admin.ts

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DUMMY_ADMIN_EMAIL = "admin@marketplace.test";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: DUMMY_ADMIN_EMAIL } });
  if (!user) {
    console.log(`No user with email ${DUMMY_ADMIN_EMAIL} - nothing to do.`);
    return;
  }
  if (user.role !== "ADMIN") {
    console.log(`${DUMMY_ADMIN_EMAIL} is already role=${user.role} - nothing to do.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "USER" },
  });
  console.log(`Demoted ${DUMMY_ADMIN_EMAIL} from ADMIN to USER.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
