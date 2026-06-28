import { prisma } from "@/core/db/prisma";

/** A cart line as the client knows it. Prices are intentionally absent - they
 *  are snapshots on the client and are always re-read from the DB here. */
export type CartItemRef = { productId: string; variantId: string | null; quantity: number };

/** A cart line resolved against live DB state: a real, purchasable product (or
 *  variant) with its authoritative price and owning org. */
export type ResolvedCartLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
  /** Authoritative unit price (USD base cents) - never the client snapshot. */
  unitPriceUsd: number;
  organizationId: string;
};

export type CartResolution = {
  /** Lines backed by a live, purchasable product/variant. */
  lines: ResolvedCartLine[];
  /** Refs that no longer resolve - the product was deleted/unpublished, or the
   *  variant id is stale (e.g. the seller re-saved the product and its variants
   *  were regenerated). The client should prune these and tell the buyer. */
  unavailable: CartItemRef[];
  /** Subtotal of the resolvable lines (USD base cents). */
  subtotalUsd: number;
};

/**
 * The single source of truth for "what is this cart actually worth, and is
 * every line still purchasable". Coupon eligibility, per-seller shipping and the
 * order summary all build on this so they can never disagree with each other -
 * or with checkout - about the cart's value.
 *
 * Prices are always read from the DB (client snapshots are never trusted), and
 * an item that doesn't resolve is reported in `unavailable` rather than silently
 * counted as zero - the bug that let a stale line drag a cart below a coupon's
 * minimum while the UI still showed the old price.
 *
 * "Purchasable" matches checkout: the product must be PUBLISHED and not deleted,
 * and a referenced variant must still exist under it.
 */
export async function resolveCart(items: CartItemRef[]): Promise<CartResolution> {
  if (items.length === 0) return { lines: [], unavailable: [], subtotalUsd: 0 };

  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId!);
  const productIds = items.filter((i) => !i.variantId).map((i) => i.productId);
  const [variants, products] = await Promise.all([
    variantIds.length
      ? prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            price: true,
            product: { select: { id: true, organizationId: true, status: true, deletedAt: true } },
          },
        })
      : [],
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, price: true, organizationId: true, status: true, deletedAt: true },
        })
      : [],
  ]);
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const purchasable = (p: { status: string; deletedAt: Date | null }) =>
    p.status === "PUBLISHED" && p.deletedAt === null;

  const lines: ResolvedCartLine[] = [];
  const unavailable: CartItemRef[] = [];
  let subtotalUsd = 0;

  for (const it of items) {
    if (it.variantId) {
      const v = variantMap.get(it.variantId);
      if (!v || !purchasable(v.product)) {
        unavailable.push(it);
        continue;
      }
      const unit = Number(v.price);
      lines.push({
        productId: v.product.id,
        variantId: it.variantId,
        quantity: it.quantity,
        unitPriceUsd: unit,
        organizationId: v.product.organizationId,
      });
      subtotalUsd += unit * it.quantity;
    } else {
      const p = productMap.get(it.productId);
      if (!p || !purchasable(p)) {
        unavailable.push(it);
        continue;
      }
      const unit = Number(p.price);
      lines.push({
        productId: it.productId,
        variantId: null,
        quantity: it.quantity,
        unitPriceUsd: unit,
        organizationId: p.organizationId,
      });
      subtotalUsd += unit * it.quantity;
    }
  }

  return { lines, unavailable, subtotalUsd };
}
