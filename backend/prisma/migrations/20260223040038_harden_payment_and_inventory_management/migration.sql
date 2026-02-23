/*
  Warnings:

  - Added the required column `updated_at` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" TEXT;

-- AlterTable
ALTER TABLE "OrderShipment" ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" TEXT,
ADD COLUMN     "external_reference" TEXT,
ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "gateway_order_id" DROP NOT NULL,
ALTER COLUMN "gateway_payment_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PaymentLog" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT,
    "order_id" TEXT,
    "order_number_snapshot" TEXT,
    "admin_id" TEXT,
    "action" VARCHAR(50) NOT NULL,
    "from_status" "PaymentStatus",
    "to_status" "PaymentStatus",
    "amount" DECIMAL(12,2),
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLog" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "order_number_snapshot" TEXT,
    "admin_id" TEXT,
    "action" VARCHAR(50) NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus",
    "from_payment_status" "PaymentStatus",
    "to_payment_status" "PaymentStatus",
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLog" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "order_number_snapshot" TEXT,
    "shipment_id" TEXT,
    "admin_id" TEXT,
    "action" VARCHAR(50) NOT NULL,
    "from_status" "OrderShipmentStatus",
    "to_status" "OrderShipmentStatus",
    "courier_name" TEXT,
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentLog_payment_id_idx" ON "PaymentLog"("payment_id");

-- CreateIndex
CREATE INDEX "PaymentLog_order_id_idx" ON "PaymentLog"("order_id");

-- CreateIndex
CREATE INDEX "PaymentLog_admin_id_idx" ON "PaymentLog"("admin_id");

-- CreateIndex
CREATE INDEX "PaymentLog_action_idx" ON "PaymentLog"("action");

-- CreateIndex
CREATE INDEX "PaymentLog_created_at_idx" ON "PaymentLog"("created_at");

-- CreateIndex
CREATE INDEX "OrderLog_order_id_idx" ON "OrderLog"("order_id");

-- CreateIndex
CREATE INDEX "OrderLog_admin_id_idx" ON "OrderLog"("admin_id");

-- CreateIndex
CREATE INDEX "OrderLog_action_idx" ON "OrderLog"("action");

-- CreateIndex
CREATE INDEX "OrderLog_created_at_idx" ON "OrderLog"("created_at");

-- CreateIndex
CREATE INDEX "ShipmentLog_order_id_idx" ON "ShipmentLog"("order_id");

-- CreateIndex
CREATE INDEX "ShipmentLog_shipment_id_idx" ON "ShipmentLog"("shipment_id");

-- CreateIndex
CREATE INDEX "ShipmentLog_admin_id_idx" ON "ShipmentLog"("admin_id");

-- CreateIndex
CREATE INDEX "ShipmentLog_action_idx" ON "ShipmentLog"("action");

-- CreateIndex
CREATE INDEX "ShipmentLog_created_at_idx" ON "ShipmentLog"("created_at");

-- CreateIndex
CREATE INDEX "Inventory_updatedAt_idx" ON "Inventory"("updatedAt");

-- CreateIndex
CREATE INDEX "Order_deleted_at_idx" ON "Order"("deleted_at");

-- CreateIndex
CREATE INDEX "OrderShipment_deleted_at_idx" ON "OrderShipment"("deleted_at");

-- CreateIndex
CREATE INDEX "Payment_order_id_idx" ON "Payment"("order_id");

-- CreateIndex
CREATE INDEX "Payment_order_id_idempotency_key_idx" ON "Payment"("order_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_deleted_at_idx" ON "Payment"("deleted_at");

-- CreateIndex
CREATE INDEX "Payment_created_at_idx" ON "Payment"("created_at");

-- AddForeignKey
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLog" ADD CONSTRAINT "OrderLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLog" ADD CONSTRAINT "OrderLog_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLog" ADD CONSTRAINT "ShipmentLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLog" ADD CONSTRAINT "ShipmentLog_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "OrderShipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLog" ADD CONSTRAINT "ShipmentLog_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
