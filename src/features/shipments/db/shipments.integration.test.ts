import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
} from "../../../../test/integration/helpers";

/**
 * What the buyer is told when a seller ships, and - more to the point - when it
 * touches the shipment afterwards.
 *
 * Both tracking fields are optional, so "shipped with an empty tracking box, then
 * filled in an hour later" is an ordinary flow, not an edge case. Each of those
 * saves runs the same code path, and only some of them are news to the buyer.
 * Getting it wrong is invisible in the UI: the emails are published
 * fire-and-forget and deduplicated downstream, so an over-eager publish looks
 * fine right up until the idempotency record ages out (30 days) and a stale
 * "your order has shipped" lands on a long-delivered order.
 */

vi.mock("@/services/stripe", () => ({
  stripe: {
    transfers: { create: vi.fn().mockResolvedValue({ id: "tr_test" }), createReversal: vi.fn() },
    refunds: { create: vi.fn().mockResolvedValue({ id: "re_test" }) },
  },
}));
vi.mock("@/features/orders/db/cache", () => ({ revalidateOrderCache: vi.fn() }));
vi.mock("@/features/products/db/cache", () => ({
  revalidateProductCache: vi.fn(),
  revalidateProductCacheFromRoute: vi.fn(),
}));
vi.mock("@/features/audit/db/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/services/notifications", () => ({
  publishCodOrderCancelled: vi.fn(),
  publishCodPaymentReceived: vi.fn(),
  publishCodOrderFulfilled: vi.fn().mockResolvedValue(undefined),
  publishOrderShipped: vi.fn().mockResolvedValue(undefined),
  publishOrderTrackingUpdated: vi.fn().mockResolvedValue(undefined),
  publishOrderDelivered: vi.fn().mockResolvedValue(undefined),
  publishSellerPayoutReleased: vi.fn(),
}));

const notifications = await import("@/services/notifications");
const { createCodOrder } = await import("@/features/orders/db/orders");
const { createShipment } = await import("./shipments");

const shipped = () => vi.mocked(notifications.publishOrderShipped);
const trackingUpdated = () => vi.mocked(notifications.publishOrderTrackingUpdated);

const SHIPPING = {
  name: "Test Buyer",
  line1: "Zemunska 15",
  line2: null,
  city: "Dobanovci",
  state: null,
  postalCode: "11272",
  country: "RS",
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

async function singleSellerOrder() {
  const user = await createUser();
  const org = await createOrganization();
  const product = await createProduct({ organizationId: org.id, price: 1000, stock: 10 });
  const order = await createCodOrder({
    userId: user.id,
    totalInCurrency: 1300,
    currency: "usd",
    exchangeRate: 1,
    items: [{ productId: product.id, variantId: null, quantity: 1 }],
    shipping: SHIPPING,
    shippingTotal: 300,
    shippingByOrg: { [org.id]: 300 },
  });
  return { user, org, order };
}

describe("createShipment notifications", () => {
  it("announces the shipment once, on the first ship only", async () => {
    const { org, order } = await singleSellerOrder();

    await createShipment({
      orderId: order.id,
      organizationId: org.id,
      trackingNumber: "PE123",
      carrier: "Post Express",
    });
    expect(shipped()).toHaveBeenCalledTimes(1);
    expect(shipped().mock.calls[0][0]).toMatchObject({
      orderId: order.id,
      organizationId: org.id,
      trackingNumber: "PE123",
      carrier: "Post Express",
    });
    // Shipped WITH a number is one piece of news, not two: the shipped email
    // carries the carrier and number itself. A second "here is your tracking
    // number" arriving beside it would be noise about something already said.
    expect(trackingUpdated()).not.toHaveBeenCalled();

    // Same seller saves the form again. The parcel left on the first save; a
    // second "your order has shipped" would be a lie about a new event.
    await createShipment({
      orderId: order.id,
      organizationId: org.id,
      trackingNumber: "PE999",
      carrier: "Post Express",
    });
    expect(shipped()).toHaveBeenCalledTimes(1);
  });

  it("tells the buyer about a tracking number added after shipping", async () => {
    const { org, order } = await singleSellerOrder();

    // Shipped with both boxes empty - allowed, and the email that went out
    // therefore carried no number.
    await createShipment({ orderId: order.id, organizationId: org.id });
    expect(shipped()).toHaveBeenCalledTimes(1);
    expect(trackingUpdated()).not.toHaveBeenCalled();

    await createShipment({
      orderId: order.id,
      organizationId: org.id,
      trackingNumber: "PE123",
      carrier: "Post Express",
    });
    expect(trackingUpdated()).toHaveBeenCalledTimes(1);
    expect(trackingUpdated().mock.calls[0][0]).toMatchObject({
      orderId: order.id,
      organizationId: org.id,
      trackingNumber: "PE123",
      carrier: "Post Express",
    });
    // Nothing to supersede - the buyer had no number before.
    expect(trackingUpdated().mock.calls[0][0].previousTrackingNumber).toBeUndefined();
  });

  it("flags a number that supersedes one the buyer already has", async () => {
    const { org, order } = await singleSellerOrder();

    await createShipment({ orderId: order.id, organizationId: org.id, trackingNumber: "PE111" });
    // Wrong number in the first place, corrected here. The buyer wrote the old one
    // down and it has just stopped working - a different email from "here it is".
    await createShipment({ orderId: order.id, organizationId: org.id, trackingNumber: "PE222" });

    expect(trackingUpdated()).toHaveBeenCalledTimes(1);
    expect(trackingUpdated().mock.calls[0][0]).toMatchObject({
      trackingNumber: "PE222",
      // The dead one travels with it, to be shown beside the new number.
      previousTrackingNumber: "PE111",
    });
  });

  it("stays quiet when the save changed nothing", async () => {
    const { org, order } = await singleSellerOrder();

    const pair = { carrier: "Post Express", trackingNumber: "PE123" };
    await createShipment({ orderId: order.id, organizationId: org.id, ...pair });
    // A stray double submit, or a save after editing something else on the form.
    await createShipment({ orderId: order.id, organizationId: org.id, ...pair });
    expect(trackingUpdated()).not.toHaveBeenCalled();
  });

  it("tells the buyer when the number is withdrawn with nothing to replace it", async () => {
    const { org, order } = await singleSellerOrder();

    await createShipment({ orderId: order.id, organizationId: org.id, trackingNumber: "PE123" });
    // Emptying the box is not silence: the buyer has a number that has just
    // stopped meaning anything, and would otherwise keep refreshing it.
    await createShipment({ orderId: order.id, organizationId: org.id });

    expect(trackingUpdated()).toHaveBeenCalledTimes(1);
    const payload = trackingUpdated().mock.calls[0][0];
    expect(payload.previousTrackingNumber).toBe("PE123");
    expect(payload.trackingNumber).toBeUndefined();

    const part = await prisma.orderSellerPart.findUniqueOrThrow({
      where: { orderId_organizationId: { orderId: order.id, organizationId: org.id } },
    });
    expect(part.trackingNumber).toBeNull();
  });

  it("does not downgrade a replacement to a first number after a clear", async () => {
    const { org, order } = await singleSellerOrder();

    await createShipment({ orderId: order.id, organizationId: org.id, trackingNumber: "PE111" });
    await createShipment({ orderId: order.id, organizationId: org.id }); // withdrawn
    await createShipment({ orderId: order.id, organizationId: org.id, trackingNumber: "PE222" });

    // Three saves, three distinct pieces of news. The middle one is what makes
    // the last honest: without it the buyer would be handed PE222 as though they
    // had never been given a number, and PE111 would quietly stay alive in their
    // notes.
    expect(trackingUpdated()).toHaveBeenCalledTimes(2);
    expect(trackingUpdated().mock.calls[0][0]).toMatchObject({ previousTrackingNumber: "PE111" });
    expect(trackingUpdated().mock.calls[0][0].trackingNumber).toBeUndefined();
    expect(trackingUpdated().mock.calls[1][0]).toMatchObject({ trackingNumber: "PE222" });
  });

  it("keeps the original shipped date across a tracking edit", async () => {
    const { org, order } = await singleSellerOrder();

    await createShipment({ orderId: order.id, organizationId: org.id });
    const first = await prisma.orderSellerPart.findUniqueOrThrow({
      where: { orderId_organizationId: { orderId: order.id, organizationId: org.id } },
    });

    await createShipment({ orderId: order.id, organizationId: org.id, trackingNumber: "PE123" });
    const second = await prisma.orderSellerPart.findUniqueOrThrow({
      where: { orderId_organizationId: { orderId: order.id, organizationId: org.id } },
    });
    expect(second.shippedAt).toEqual(first.shippedAt);
  });
});

/**
 * Every way the (carrier, number) pair can move on an already-shipped part.
 *
 * Five kinds of move per half - stays empty, stays put, appears, disappears,
 * changes - so twenty-five rows, and each one either is news to the buyer or is
 * not. The rule underneath: the buyer holds a number and the carrier to type it
 * into, and we write only when that pair stops being true or finally becomes
 * usable. The two silent carrier moves are the ones worth arguing about, so they
 * are spelled out row by row rather than left to a comment.
 */
describe("createShipment - the full (carrier, number) matrix", () => {
  const C1 = "Post Express";
  const C2 = "BEX";
  const N1 = "PE111";
  const N2 = "PE222";

  type Pair = { carrier?: string; tracking?: string };

  const rows: { move: string; from: Pair; to: Pair; news: boolean }[] = [
    // The number never exists: there is nothing to look up, so who is carrying
    // the parcel is not something the buyer can act on.
    { move: "no number, no carrier, nothing moves", from: {}, to: {}, news: false },
    { move: "no number, carrier stands", from: { carrier: C1 }, to: { carrier: C1 }, news: false },
    { move: "no number, carrier named", from: {}, to: { carrier: C1 }, news: false },
    { move: "no number, carrier cleared", from: { carrier: C1 }, to: {}, news: false },
    { move: "no number, carrier swapped", from: { carrier: C1 }, to: { carrier: C2 }, news: false },

    // The number stands. Now the carrier is the whole story.
    { move: "number stands, never a carrier", from: { tracking: N1 }, to: { tracking: N1 }, news: false },
    { move: "number stands, carrier stands", from: { carrier: C1, tracking: N1 }, to: { carrier: C1, tracking: N1 }, news: false },
    { move: "number stands, carrier named at last", from: { tracking: N1 }, to: { carrier: C1, tracking: N1 }, news: true },
    // Clearing the carrier invalidates nothing: the number still works wherever
    // it worked yesterday, and the buyer was told where that is.
    { move: "number stands, carrier cleared", from: { carrier: C1, tracking: N1 }, to: { tracking: N1 }, news: false },
    { move: "number stands, carrier swapped", from: { carrier: C1, tracking: N1 }, to: { carrier: C2, tracking: N1 }, news: true },

    // A number appears. News whatever the carrier did.
    { move: "number added, no carrier either side", from: {}, to: { tracking: N1 }, news: true },
    { move: "number added, carrier stands", from: { carrier: C1 }, to: { carrier: C1, tracking: N1 }, news: true },
    { move: "number added, carrier named too", from: {}, to: { carrier: C1, tracking: N1 }, news: true },
    { move: "number added, carrier cleared", from: { carrier: C1 }, to: { tracking: N1 }, news: true },
    { move: "number added, carrier swapped", from: { carrier: C1 }, to: { carrier: C2, tracking: N1 }, news: true },

    // A number disappears. Always news - otherwise the buyer keeps refreshing it.
    { move: "number withdrawn, no carrier either side", from: { tracking: N1 }, to: {}, news: true },
    { move: "number withdrawn, carrier stands", from: { carrier: C1, tracking: N1 }, to: { carrier: C1 }, news: true },
    { move: "number withdrawn, carrier named", from: { tracking: N1 }, to: { carrier: C1 }, news: true },
    { move: "number withdrawn, carrier cleared too", from: { carrier: C1, tracking: N1 }, to: {}, news: true },
    { move: "number withdrawn, carrier swapped", from: { carrier: C1, tracking: N1 }, to: { carrier: C2 }, news: true },

    // A number is replaced. Always news - the old one is dead.
    { move: "number replaced, no carrier either side", from: { tracking: N1 }, to: { tracking: N2 }, news: true },
    { move: "number replaced, carrier stands", from: { carrier: C1, tracking: N1 }, to: { carrier: C1, tracking: N2 }, news: true },
    { move: "number replaced, carrier named", from: { tracking: N1 }, to: { carrier: C1, tracking: N2 }, news: true },
    { move: "number replaced, carrier cleared", from: { carrier: C1, tracking: N1 }, to: { tracking: N2 }, news: true },
    { move: "number replaced, carrier swapped too", from: { carrier: C1, tracking: N1 }, to: { carrier: C2, tracking: N2 }, news: true },
  ];

  it.each(rows)("$move -> $news", async ({ from, to, news }) => {
    const { org, order } = await singleSellerOrder();

    // The first save is the one that ships it, and carries `from`.
    await createShipment({
      orderId: order.id,
      organizationId: org.id,
      trackingNumber: from.tracking,
      carrier: from.carrier,
    });
    vi.clearAllMocks();

    await createShipment({
      orderId: order.id,
      organizationId: org.id,
      trackingNumber: to.tracking,
      carrier: to.carrier,
    });

    // The shipped email is a first-ship event and never repeats, whatever is edited.
    expect(shipped()).not.toHaveBeenCalled();

    if (!news) {
      expect(trackingUpdated()).not.toHaveBeenCalled();
      return;
    }

    expect(trackingUpdated()).toHaveBeenCalledTimes(1);
    // The four values are what the email is built from, so the whole pair travels -
    // before and after, both halves, even the ones that did not move.
    expect(trackingUpdated().mock.calls[0][0]).toMatchObject({
      trackingNumber: to.tracking,
      carrier: to.carrier,
      previousTrackingNumber: from.tracking,
      previousCarrier: from.carrier,
    });
  });

  it("announces a repeated round trip, instead of swallowing it as a duplicate", async () => {
    const { org, order } = await singleSellerOrder();

    await createShipment({ orderId: order.id, organizationId: org.id, carrier: C1, trackingNumber: N1 });
    vi.clearAllMocks();

    // A -> B -> A -> B. Keyed on the two values, the last edit looked exactly
    // like the first and the downstream idempotency record dropped it - leaving
    // the buyer holding A while the truth was B. Keyed on the write, each edit is
    // its own piece of news.
    const ids: string[] = [];
    for (const tracking of [N2, N1, N2]) {
      await createShipment({ orderId: order.id, organizationId: org.id, carrier: C1, trackingNumber: tracking });
      ids.push(String(trackingUpdated().mock.calls.at(-1)?.[0].writtenAt?.getTime()));
    }

    expect(trackingUpdated()).toHaveBeenCalledTimes(3);
    // Three writes, three distinct ids - the flip-flop no longer collides.
    expect(new Set(ids).size).toBe(3);
  });

  it("stores the pair exactly as given, however it moved", async () => {
    const { org, order } = await singleSellerOrder();

    await createShipment({ orderId: order.id, organizationId: org.id, carrier: C1, trackingNumber: N1 });
    await createShipment({ orderId: order.id, organizationId: org.id, carrier: C2 });

    const part = await prisma.orderSellerPart.findUniqueOrThrow({
      where: { orderId_organizationId: { orderId: order.id, organizationId: org.id } },
    });
    expect(part.carrier).toBe(C2);
    expect(part.trackingNumber).toBeNull();
  });
});
