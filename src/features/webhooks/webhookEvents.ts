import { prisma } from "@/core/db/prisma";

export async function isWebhookProcessed(id: string) {
  const event = await prisma.webhookEvent.findUnique({
    where: { id },
    select: { processedAt: true },
  });

  return !!event?.processedAt;
}

export async function markWebhookProcessed(id: string, type: string) {
  await prisma.webhookEvent.upsert({
    where: { id },
    create: {
      id,
      type,
      processedAt: new Date(),
    },
    update: {
      processedAt: new Date(),
    },
  });
}
