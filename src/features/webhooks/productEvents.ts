import { Prisma } from "@/generated/prisma/client";
import { customNanoId } from "@/utils/idGenerator";

export async function emitProductEvent(
  tx: Prisma.TransactionClient,
  type: string,
) {
  await tx.webhookEvent.create({
    data: {
      id: customNanoId(),
      type,
      processedAt: new Date(),
    },
  });
}
