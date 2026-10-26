import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyCartResolution } from "./applyCartResolution";
import { useCartStore, type CartItem } from "../store/cartStore";
import type { CartItemRef, CartLinePrice } from "../db/resolveCart";
import { authorMoney } from "@/lib/money";

/** A price snapshot the way the store holds one: mirror plus its set. */
const usd = (cents: number) => authorMoney(cents, "usd", { usd: 1 });

function line(productId: string, price = 1000): CartItem {
  return {
    productId,
    productTitleI18n: null,
    productTitle: productId,
    productImage: null,
    variantId: null,
    variantSku: null,
    variantOptions: null,
    variantLabel: null,
    price,
    priceMoney: usd(price),
    compareAtPriceMoney: null,
    quantity: 1,
    maxStock: null,
    requiresShipping: true,
  };
}

const ref = (productId: string): CartItemRef => ({
  productId,
  variantId: null,
  quantity: 1,
});

const priceOf = (
  productId: string,
  unitPriceUsd: number,
  unitCompareAtMoney: CartLinePrice["unitCompareAtMoney"] = null,
): CartLinePrice => ({
  productId,
  variantId: null,
  unitPriceUsd,
  unitMoney: usd(unitPriceUsd),
  unitCompareAtMoney,
});

describe("applyCartResolution", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [line("a"), line("b")] });
  });

  it("drops an unavailable line and says which one", () => {
    const onRemoved = vi.fn();
    applyCartResolution({ prices: [], unavailable: [ref("a")] }, onRemoved);

    expect(useCartStore.getState().items.map((i) => i.productId)).toEqual(["b"]);
    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(onRemoved.mock.calls[0][0].productId).toBe("a");
  });

  /**
   * The bug this guards: on the checkout page the drawer and the page each
   * resolve the same cart, so a dead line comes back to both. Both used to
   * announce it - and the second one looked the item up in a snapshot it had
   * already been removed from, so its toast named an empty product.
   */
  it("announces a removal once even when two callers report the same line", () => {
    const fromDrawer = vi.fn();
    const fromCheckout = vi.fn();
    const res = { prices: [], unavailable: [ref("a")] };

    applyCartResolution(res, fromDrawer);
    applyCartResolution(res, fromCheckout);

    expect(fromDrawer).toHaveBeenCalledTimes(1);
    expect(fromCheckout).not.toHaveBeenCalled();
    expect(useCartStore.getState().items.map((i) => i.productId)).toEqual(["b"]);
  });

  it("never hands the caller a line it cannot name", () => {
    const onRemoved = vi.fn();
    // Two refs for the same line, as a parallel pair of resolutions would give.
    applyCartResolution({ prices: [], unavailable: [ref("a"), ref("a")] }, onRemoved);

    for (const [removed] of onRemoved.mock.calls) {
      expect(removed).toBeDefined();
      expect(removed.productId).toBe("a");
    }
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it("still refreshes prices for the lines that survive", () => {
    applyCartResolution(
      { prices: [priceOf("b", 2500)], unavailable: [ref("a")] },
      vi.fn(),
    );
    expect(useCartStore.getState().items.find((i) => i.productId === "b")?.price).toBe(2500);
  });

  /**
   * A sale that has ended must stop being advertised. The "was" price is a
   * snapshot like the price itself, so a cart left to its own devices would
   * keep striking through a discount the seller has already withdrawn.
   */
  it("clears the struck-through price once the sale is over", () => {
    useCartStore.setState({
      items: [{ ...line("a"), compareAtPriceMoney: usd(2000) }],
    });

    applyCartResolution({ prices: [priceOf("a", 1000)], unavailable: [] }, vi.fn());

    expect(useCartStore.getState().items[0].compareAtPriceMoney).toBeNull();
  });

  it("picks up a sale that started after the item was added", () => {
    applyCartResolution(
      { prices: [priceOf("a", 800, usd(1000))], unavailable: [] },
      vi.fn(),
    );

    const a = useCartStore.getState().items.find((i) => i.productId === "a");
    expect(a?.price).toBe(800);
    expect(a?.compareAtPriceMoney).toEqual(usd(1000));
  });

  /**
   * Scheduled pricing: the item went into the cart at 17:59 and the promo
   * started at 18:00. The buyer must be told before paying the new price.
   */
  it("announces a price that moved, with the price it had before", () => {
    const onRepriced = vi.fn();
    applyCartResolution({ prices: [priceOf("a", 800)], unavailable: [] }, vi.fn(), onRepriced);

    expect(onRepriced).toHaveBeenCalledTimes(1);
    const [{ item, before }] = onRepriced.mock.calls[0];
    expect(item.productId).toBe("a");
    expect(item.priceMoney.amounts.usd).toBe(800);
    expect(before.amounts.usd).toBe(1000);
  });

  it("announces a re-price once even when two callers sync the same cart", () => {
    const fromDrawer = vi.fn();
    const fromCheckout = vi.fn();
    const res = { prices: [priceOf("a", 800)], unavailable: [] };

    applyCartResolution(res, vi.fn(), fromDrawer);
    applyCartResolution(res, vi.fn(), fromCheckout);

    expect(fromDrawer).toHaveBeenCalledTimes(1);
    expect(fromCheckout).not.toHaveBeenCalled();
  });

  it("does not call a compare-at change alone a re-price", () => {
    const onRepriced = vi.fn();
    applyCartResolution(
      { prices: [priceOf("a", 1000, usd(1500))], unavailable: [] },
      vi.fn(),
      onRepriced,
    );
    expect(onRepriced).not.toHaveBeenCalled();
  });

  it("leaves a cart with nothing unavailable completely alone", () => {
    const before = useCartStore.getState().items;
    const onRemoved = vi.fn();
    applyCartResolution({ prices: [], unavailable: [] }, onRemoved);

    expect(onRemoved).not.toHaveBeenCalled();
    // Same array identity: an untouched cart must not rewrite localStorage or
    // retrigger the effects that key on the cart.
    expect(useCartStore.getState().items).toBe(before);
  });
});
