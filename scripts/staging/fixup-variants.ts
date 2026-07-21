// Post-apply fixup: three products whose seeded color variants were all
// implausible (red/green TVs etc.) - drop the remaining variants and fall
// back to simple product stock.
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EN_SLUGS = ["oled-tv-65", "dslr-kit", "ergonomic-office-chair"];

async function main() {
  for (const slug of EN_SLUGS) {
    const t = await prisma.productTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug } },
      select: { productId: true },
    });
    if (!t) {
      console.log(`✗ ${slug}: not found`);
      continue;
    }
    const variants = await prisma.productVariant.findMany({
      where: { productId: t.productId },
      select: { id: true, stock: true, sku: true, _count: { select: { orderItems: true } } },
    });
    const deletable = variants.filter((v) => v._count.orderItems === 0);
    const kept = variants.length - deletable.length;
    if (deletable.length > 0) {
      await prisma.productVariant.deleteMany({ where: { id: { in: deletable.map((v) => v.id) } } });
    }
    if (kept === 0) {
      const stock = deletable.reduce((s, v) => s + v.stock, 0) || 40;
      await prisma.product.update({ where: { id: t.productId }, data: { stock } });
      console.log(`✓ ${slug}: removed ${deletable.length} variant(s), stock=${stock}`);
    } else {
      console.log(`✓ ${slug}: removed ${deletable.length}, kept ${kept} (order-referenced)`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
