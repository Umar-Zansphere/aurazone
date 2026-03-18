-- CreateEnum
CREATE TYPE "EmailDeliveryState" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "OrderStatusEmailLog" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "admin_id" TEXT,
    "recipient_email" TEXT,
    "status_snapshot" "OrderStatus" NOT NULL,
    "template" VARCHAR(100) NOT NULL,
    "subject" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "state" "EmailDeliveryState" NOT NULL DEFAULT 'FAILED',
    "error_message" TEXT,
    "metadata" JSONB,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OrderStatusEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderStatusEmailLog_order_id_created_at_idx" ON "OrderStatusEmailLog"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "OrderStatusEmailLog_state_created_at_idx" ON "OrderStatusEmailLog"("state", "created_at");

-- CreateIndex
CREATE INDEX "OrderStatusEmailLog_admin_id_idx" ON "OrderStatusEmailLog"("admin_id");

-- AddForeignKey
ALTER TABLE "OrderStatusEmailLog" ADD CONSTRAINT "OrderStatusEmailLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusEmailLog" ADD CONSTRAINT "OrderStatusEmailLog_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
