import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@/generated/prisma/client";
import { s3, S3_BUCKET } from "@/services/s3";
import { prisma } from "@/core/db/prisma";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import { getLabel } from "@/features/attributes/utils/translations";
import { getProductTitle } from "@/features/products/utils/translations";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { InvoiceDocument, type InvoiceData, type InvoiceLine } from "./InvoiceDocument";

const INVOICE_PREFIX = "invoices";

export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(6, "0")}`;
}

async function s3GetBuffer(key: string): Promise<Buffer> {
  const obj = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  const bytes = await obj.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Fetches a product image and normalizes it to a small PNG data-URI. @react-pdf
 * only decodes JPG/PNG, so we run every source (incl. WebP) through sharp to PNG.
 * Best-effort: any fetch/decode failure returns null so one bad asset can never
 * block invoice generation (the line just renders without a thumbnail).
 */
async function fetchThumb(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const png = await sharp(input).resize(80, 80, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

const orderInclude = {
  invoice: true,
  items: {
    include: {
      product: {
        select: {
          translations: { select: { locale: true, title: true } },
          organization: { select: { name: true } },
          media: {
            orderBy: { order: "asc" },
            take: 1,
            where: { mediaType: "IMAGE" },
            select: { url: true, thumbUrl: true },
          },
        },
      },
      variant: {
        select: {
          media: {
            orderBy: { order: "asc" },
            take: 1,
            select: { media: { select: { url: true, thumbUrl: true } } },
          },
          attributeValues: {
            select: {
              option: { select: { translations: { select: { locale: true, label: true } } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

type OrderWithInvoice = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/** Builds the localized invoice document data for an order at issue time. */
async function buildInvoiceData(order: OrderWithInvoice, number: number): Promise<InvoiceData> {
  const locale = order.locale;
  const t = await getTranslations({ locale, namespace: "invoice" });
  const dl = dateLocale(locale);
  const cur = order.currency as Currency;
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString(dl, { year: "numeric", month: "long", day: "numeric" });

  const lines: InvoiceLine[] = await Promise.all(
    order.items.map(async (item) => {
      // `getProductTitle` (not a raw `find(locale)?.title ?? ...`) - a locale
      // can HAVE a translation row whose title was left blank, and `??` would
      // then print an empty line item instead of falling back to English.
      const title = getProductTitle(item.product, locale);
      const variantLabel =
        item.variant?.attributeValues
          .map((av) => getLabel(av.option.translations, locale))
          .join(" / ") || null;
      const variantImg = item.variant?.media[0]?.media;
      const productImg = item.product.media[0];
      const imageUrl =
        variantImg?.thumbUrl ?? variantImg?.url ?? productImg?.thumbUrl ?? productImg?.url ?? null;
      return {
        title,
        variantLabel,
        sellerName: item.product.organization.name,
        quantity: item.quantity,
        unitPrice: formatPrice(item.price, cur),
        lineTotal: formatPrice(item.price * item.quantity, cur),
        image: await fetchThumb(imageUrl),
      };
    }),
  );

  return {
    number: formatInvoiceNumber(number),
    issuedAt: fmtDate(new Date()),
    orderShortId: order.id.slice(-8).toUpperCase(),
    orderDate: fmtDate(order.createdAt),
    buyer: { name: null, email: "" }, // filled by caller (needs user)
    shipping: order.shippingLine1 || order.shippingCity
      ? {
          name: order.shippingName,
          line1: order.shippingLine1,
          line2: order.shippingLine2,
          city: order.shippingCity,
          state: order.shippingState,
          postalCode: order.shippingPostalCode,
          country: order.shippingCountry,
        }
      : null,
    lines,
    // Subtotal = items only (total + discount - shipping); shown when there's a
    // discount and/or a shipping charge.
    subtotal:
      order.discountAmount > 0 || order.shippingTotal > 0
        ? formatPrice(order.total + order.discountAmount - order.shippingTotal, cur)
        : null,
    discount: order.discountAmount > 0 ? formatPrice(order.discountAmount, cur) : null,
    shippingCost: order.shippingTotal > 0 ? formatPrice(order.shippingTotal, cur) : null,
    couponCode: order.couponCode,
    total: formatPrice(order.total, cur),
    labels: {
      invoice: t("invoice"),
      invoiceNo: t("invoiceNo"),
      issued: t("issued"),
      orderRef: t("orderRef"),
      orderDate: t("orderDate"),
      billTo: t("billTo"),
      shipTo: t("shipTo"),
      item: t("item"),
      seller: t("seller"),
      qty: t("qty"),
      unitPrice: t("unitPrice"),
      lineTotal: t("lineTotal"),
      subtotal: t("subtotal"),
      discount: t("discount"),
      shipping: t("shipping"),
      total: t("total"),
      footer: t("footer"),
    },
  };
}

/**
 * Returns the buyer's immutable invoice PDF for an order, issuing it on first
 * request: assigns a sequential number, renders the PDF, stores it in S3, and
 * records the Invoice. Concurrent issues are resolved by the unique constraints
 * (retry / fall back to the winner's invoice). Once issued it is never re-rendered.
 */
export async function getOrIssueInvoicePdf(
  orderId: string,
  userId: string,
): Promise<{ buffer: Buffer; number: number }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: orderInclude,
  });
  if (!order) throw new NotFoundError("Order not found");
  // An invoice documents a confirmed sale - only issue once the money was
  // actually collected (card captured, or COD cash confirmed); stays available
  // after a (partial) refund.
  if (order.paymentStatus === "UNPAID") {
    throw new NotFoundError("Order is not invoiceable yet");
  }

  if (order.invoice) {
    return { buffer: await s3GetBuffer(order.invoice.pdfKey), number: order.invoice.number };
  }

  const buyer = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.invoice.findUnique({ where: { orderId } });
    if (existing) {
      return { buffer: await s3GetBuffer(existing.pdfKey), number: existing.number };
    }

    const last = await prisma.invoice.findFirst({
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = (last?.number ?? 0) + 1;

    const data = await buildInvoiceData(order, number);
    data.buyer = { name: buyer?.name ?? null, email: buyer?.email ?? "" };

    const buffer = await renderToBuffer(<InvoiceDocument data={data} />);
    const pdfKey = `${INVOICE_PREFIX}/${orderId}.pdf`;
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: pdfKey,
        Body: buffer,
        ContentType: "application/pdf",
      }),
    );

    try {
      await prisma.invoice.create({ data: { orderId, number, pdfKey } });
      return { buffer, number };
    } catch (e) {
      // Lost a race (orderId or number already taken) - retry: pick up the
      // winner's invoice or recompute the next number.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        continue;
      }
      throw e;
    }
  }

  throw new Error(`Could not issue invoice for order ${orderId}`);
}
