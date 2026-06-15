-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReturnItem_returnId_idx" ON "ReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnItem_returnId_orderItemId_key" ON "ReturnItem"("returnId", "orderItemId");

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
