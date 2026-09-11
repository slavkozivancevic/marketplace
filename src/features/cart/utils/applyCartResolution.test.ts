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

const priceOf = (productId: string, unitPriceUsd: number): CartLinePrice => ({
  productId,
  variantId: null,
  unitPriceUsd,
  unitMoney: usd(unitPriceUsd),
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
