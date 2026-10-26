"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "@/components/ui/sonner";
import { getCartShippingAction } from "@/features/shipping/actions/shipping";
import type { OrgShippingLine } from "@/features/shipping/db/shipping";
import { useMoney } from "@/lib/useMoney";
import { useViewerMarket } from "@/providers/MarketProvider";
import { useCartStore, type CartItem, type RepricedLine } from "../store/cartStore";
import { applyCartResolution } from "../utils/applyCartResolution";
import { pickLocalized } from "../utils/variantOptions";

export type CartShipping = {
  lines: OrgShippingLine[];
  total: number;
  totalUsd: number;
  /** False until the first server pass for a non-empty cart has answered.
   *  Before that `lines` is empty because nothing is known yet, not because
   *  no seller charges - a surface that renders the delivery breakdown, the
   *  free-delivery bars or the lead times from it waits on this rather than
   *  drawing them a moment later and pushing everything below down. */
  ready: boolean;
};

/**
 * Re-reads the cart from the server and keeps the client copy honest.
 *
 * Every price in the store is a snapshot taken at add-to-cart time and then
 * persisted to localStorage, so it goes stale the moment the seller edits that
 * product - and nothing on the client can notice. One server pass fixes both
 * halves of that: it returns the live prices (which replace the snapshots) and
 * the per-seller delivery computed from those same prices, so the breakdown can
 * never disagree with the lines above it, or with what checkout charges.
 *
 * `getCartShippingAction` resolves the cart once and returns prices, delivery
 * and the unpurchasable lines together, which is why this is a single round
 * trip rather than a price call plus a shipping call.
 *
 * Keyed on contents AND prices. Keying on contents alone let one surface
 * refresh a price while the delivery beside it stayed computed from the old
 * one. The cost is one extra round trip after a price actually moved; that pass
 * finds nothing to change and settles.
 */
export function useCartShipping(enabled = true): CartShipping {
  const items = useCartStore((s) => s.items);
  const t = useTranslations("cart");
  const locale = useLocale();
  const { formatOf } = useMoney();
  const [shipping, setShipping] = useState<Omit<CartShipping, "ready">>({
    lines: [],
    total: 0,
    totalUsd: 0,
  });
  // Once, not per pass: a quantity change re-resolves too, and flipping back to
  // "not ready" then would swap the whole cart for a skeleton on every click.
  const [resolved, setResolved] = useState(false);

  // The removal notice reads the translator and the active locale, both new on
  // every render. As an effect event it stays out of the dependency list - which
  // must be the cart and nothing else - while still seeing the current locale
  // when it fires.
  const notifyRemoved = useEffectEvent((removed: CartItem) => {
    toast.error(
      t("itemRemoved", {
        item: pickLocalized(removed.productTitleI18n, locale, removed.productTitle),
      }),
    );
  });

  // A price that moved while the item sat in the cart (a promo starting or
  // ending) is shown with an explicit notice before payment - never swapped in
  // silently.
  const notifyRepriced = useEffectEvent(({ item }: RepricedLine) => {
    toast.info(
      t("itemRepriced", {
        item: pickLocalized(item.productTitleI18n, locale, item.productTitle),
        price: formatOf(item.priceMoney),
      }),
    );
  });

  // The pricing country is part of what the cart is worth: switching it
  // re-resolves the cart, and a line its market prices differently comes back
  // through the same repriced notice as a promo that started.
  const { country } = useViewerMarket();
  const cartSig =
    items.map((i) => `${i.productId}:${i.variantId}:${i.quantity}:${i.price}`).join("|") + `@${country ?? ""}`;

  useEffect(() => {
    if (!enabled) return;
    if (items.length === 0) {
      // An empty cart has nothing to resolve, but it must still clear whatever
      // the last non-empty one left behind - otherwise removing the final line
      // leaves a delivery fee sitting under an empty list.
      setShipping({ lines: [], total: 0, totalUsd: 0 });
      return;
    }
    let active = true;
    const refs = items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));
    getCartShippingAction(refs)
      .then((res) => {
        if (!active) return;
        setShipping({ lines: res.lines, total: res.total, totalUsd: res.totalUsd });
        setResolved(true);
        // Self-heal from the same resolution the delivery above was computed
        // from: refresh the persisted price snapshots and prune lines whose
        // product or variant no longer exists. Pruning changes the cart, which
        // re-runs this against the clean one; that pass reports nothing
        // unavailable, so it cannot loop.
        applyCartResolution(
          res,
          (removed) => notifyRemoved(removed),
          (line) => notifyRepriced(line),
        );
      })
      // A failed pass still settles: the cart without its delivery breakdown
      // beats a skeleton that never goes away.
      .catch(() => {
        if (active) setResolved(true);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSig, enabled]);

  return { ...shipping, ready: resolved || items.length === 0 };
}
