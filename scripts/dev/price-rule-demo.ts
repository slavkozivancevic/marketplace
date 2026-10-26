/**
 * Dev-only: put a demo price rule on one product, or take it off again, so
 * dynamic pricing can be exercised before the seller UI exists.
 *
 *   npx tsx --conditions=react-server scripts/dev/price-rule-demo.ts <slug-or-id> [startInMin] [durationMin] [percent]
 *   npx tsx --conditions=react-server scripts/dev/price-rule-demo.ts <slug-or-id> --remove
 *
 * Defaults: starts in 2 minutes, lasts 10, 20% off. The rule is a one-off
 * product-level rule named "Demo rule"; `--remove` deletes every rule with that
 * name on the product and rebuilds its windows, so the price returns to base.
 *
 * `--conditions=react-server` lets the app's own db modules load (they import
 * "server-only"), so this runs the SAME window generation the app does rather
 * than a copy of it. It writes to whatever DATABASE_URL points at - your local
 * database. Never point it at staging.
 */
import "dotenv/config";
import { prisma } from "@/core/db/prisma";
import { regenerateProductWindows } from "@/features/pricing/db/windows";
import { ensurePricesCurrent } from "@/features/pricing/db/roll";

const NAME = "Demo rule";

async function main() {
  const [target, ...rest] = process.argv.slice(2);
  if (!target) throw new Error("Usage: price-rule-demo.ts <slug-or-id> [startInMin] [durationMin] [percent] | --remove");

  const product =
    (await prisma.product.findUnique({ where: { id: target }, select: { id: true, organizationId: true } })) ??
    (await prisma.productTranslation
      .findFirst({ where: { slug: target }, select: { product: { select: { id: true, organizationId: true } } } })
      .then((t) => t?.product ?? null));
  if (!product) throw new Error(`No product with id or slug "${target}"`);

  if (rest[0] === "--remove") {
    const { count } = await prisma.priceRule.deleteMany({ where: { productId: product.id, name: NAME } });
    await prisma.$transaction((tx) => regenerateProductWindows(tx, product.id));
    await ensurePricesCurrent();
    console.log(`Removed ${count} demo rule(s); price is back on its base.`);
    return;
  }

  const startIn = Number(rest[0] ?? 2);
  const duration = Number(rest[1] ?? 10);
  const percent = Number(rest[2] ?? 20);
  const startsAt = new Date(Date.now() + startIn * 60_000);
  const endsAt = new Date(startsAt.getTime() + duration * 60_000);

  await prisma.priceRule.create({
    data: {
      organizationId: product.organizationId,
      productId: product.id,
      kind: "SCHEDULE",
      name: NAME,
      adjustment: "PERCENT",
      percentBps: -Math.round(percent * 100),
      startsAt,
      endsAt,
      timezone: "Europe/Belgrade",
      recurrence: "NONE",
      weekdays: [],
    },
  });
  const { windows } = await prisma.$transaction((tx) => regenerateProductWindows(tx, product.id));
  await ensurePricesCurrent();

  const fmt = (d: Date) => d.toLocaleString("sr-RS", { timeZone: "Europe/Belgrade" });
  console.log(
    `Demo rule: -${percent}% from ${fmt(startsAt)} to ${fmt(endsAt)} (Belgrade), ${windows} window(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
