import type { TransactionClient } from "@/core/db/prisma";
import { customNanoId } from "@/utils/idGenerator";

export async function emitProductEvent(
  tx: TransactionClient,
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
