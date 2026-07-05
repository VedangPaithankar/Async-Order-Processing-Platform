-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI_GPAY', 'UPI_PHONEPE', 'UPI_PAYTM', 'CARD', 'CASH_AT_COUNTER');

-- Create the new order status enum and swap it into the existing Order table.
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PREPARING', 'READY', 'COMPLETED', 'FAILED');

ALTER TABLE "Order"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'PLACED' THEN 'RECEIVED'
      WHEN 'PROCESSING' THEN 'PREPARING'
      WHEN 'SHIPPED' THEN 'READY'
      WHEN 'OUT_FOR_DELIVERY' THEN 'READY'
      WHEN 'DELIVERED' THEN 'COMPLETED'
      ELSE 'FAILED'
    END
  )::"OrderStatus",
  ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

DROP TYPE "OrderStatus_old";

-- Convert generic async orders into cafe checkout orders.
ALTER TABLE "Order"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN "customerName" TEXT NOT NULL DEFAULT 'Guest Customer',
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "customerPhone" TEXT NOT NULL DEFAULT '0000000000',
  ADD COLUMN "fulfillment" "FulfillmentType" NOT NULL DEFAULT 'PICKUP',
  ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'UPI_GPAY',
  ADD COLUMN "subtotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "gst" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tip" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deliveryFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "total" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "etaMinutes" INTEGER NOT NULL DEFAULT 18;

UPDATE "Order"
SET
  "subtotal" = COALESCE(ROUND("amount")::INTEGER, 0),
  "gst" = ROUND(COALESCE("amount", 0) * 0.05)::INTEGER,
  "total" = COALESCE(ROUND("amount")::INTEGER, 0) + ROUND(COALESCE("amount", 0) * 0.05)::INTEGER;

ALTER TABLE "Order" DROP COLUMN "amount";

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "modifiers" JSONB,
    "lineTotal" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
