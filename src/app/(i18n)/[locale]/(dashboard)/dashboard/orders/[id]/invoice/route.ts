import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import { getOrIssueInvoicePdf, formatInvoiceNumber } from "@/features/invoices/invoice";

// Route handlers run on the Node.js runtime by default, which @react-pdf/renderer
// and the AWS SDK require - no explicit `runtime` segment config (it is also
// incompatible with cacheComponents).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const { buffer, number } = await getOrIssueInvoicePdf(id, user.id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${formatInvoiceNumber(number)}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    logger.error("[invoice route]", err);
    return new Response("Not found", { status: 404 });
  }
}
