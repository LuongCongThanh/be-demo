CREATE TYPE "PaymentGateway" AS ENUM ('VNPAY', 'MOMO');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED');
CREATE TYPE "PaymentConfirmationSource" AS ENUM ('IPN', 'RECONCILIATION');
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'RELEASED', 'EXPIRED');
CREATE TYPE "RefundReason" AS ENUM ('AMOUNT_MISMATCH', 'UNEXPECTED_PAYMENT');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'REFUNDED');
CREATE TYPE "OrderFlagType" AS ENUM ('AMOUNT_MISMATCH', 'UNEXPECTED_PAYMENT');
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'ENQUEUED', 'DONE', 'FAILED');

ALTER TABLE "inventory_movements"
  ALTER COLUMN "actor_user_id" DROP NOT NULL;

ALTER TABLE "voucher_usages"
  ADD COLUMN "released_at" TIMESTAMPTZ(6);

DROP INDEX IF EXISTS "voucher_usages_voucher_id_phone_idx";
DROP INDEX IF EXISTS "voucher_usages_user_id_voucher_id_idx";
CREATE INDEX "voucher_usages_voucher_id_phone_released_at_idx"
  ON "voucher_usages"("voucher_id", "phone", "released_at");
CREATE INDEX "voucher_usages_user_id_voucher_id_released_at_idx"
  ON "voucher_usages"("user_id", "voucher_id", "released_at");

CREATE TABLE "inventory_reservations" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "resolved_at" TIMESTAMPTZ(6),
  CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_reservations_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "inventory_reservations_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_reservations_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "inventory_reservations_order_id_variant_id_key"
  ON "inventory_reservations"("order_id", "variant_id");
CREATE INDEX "inventory_reservations_status_expires_at_idx"
  ON "inventory_reservations"("status", "expires_at");

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "gateway" "PaymentGateway" NOT NULL,
  "gateway_txn_ref" VARCHAR(100) NOT NULL,
  "gateway_txn_id" VARCHAR(255),
  "amount_requested" BIGINT NOT NULL,
  "amount_captured" BIGINT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "payment_url" TEXT,
  "payment_url_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "confirmed_via" "PaymentConfirmationSource",
  "succeeded_at" TIMESTAMPTZ(6),
  "last_reconciled_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_amount_requested_check" CHECK ("amount_requested" > 0),
  CONSTRAINT "payments_amount_captured_check" CHECK ("amount_captured" IS NULL OR "amount_captured" >= 0),
  CONSTRAINT "payments_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "payments_gateway_txn_ref_key" ON "payments"("gateway_txn_ref");
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");
CREATE INDEX "payments_status_last_reconciled_at_created_at_idx"
  ON "payments"("status", "last_reconciled_at", "created_at");

CREATE TABLE "payment_notifications" (
  "id" UUID NOT NULL,
  "payment_id" UUID,
  "gateway" "PaymentGateway" NOT NULL,
  "dedup_key" VARCHAR(255) NOT NULL,
  "signature_valid" BOOLEAN NOT NULL,
  "raw_payload" JSONB NOT NULL,
  "processed_at" TIMESTAMPTZ(6),
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_notifications_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "payment_notifications_gateway_dedup_key_key"
  ON "payment_notifications"("gateway", "dedup_key");
CREATE INDEX "payment_notifications_processed_at_received_at_idx"
  ON "payment_notifications"("processed_at", "received_at");

CREATE TABLE "refunds" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "reason" "RefundReason" NOT NULL,
  "amount" BIGINT NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "gateway_refund_ref" VARCHAR(255),
  "refunded_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refunds_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "refunds_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "refunds_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "refunds_payment_id_reason_key" ON "refunds"("payment_id", "reason");
CREATE INDEX "refunds_order_id_created_at_idx" ON "refunds"("order_id", "created_at");

CREATE TABLE "order_flags" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "type" "OrderFlagType" NOT NULL,
  "details" JSONB,
  "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_flags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_flags_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "order_flags_order_id_type_key" ON "order_flags"("order_id", "type");
CREATE INDEX "order_flags_created_at_idx" ON "order_flags"("created_at");

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL,
  "type" VARCHAR(150) NOT NULL,
  "aggregate_type" VARCHAR(100) NOT NULL,
  "aggregate_id" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6),
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "outbox_events_next_attempt_at_idx" ON "outbox_events"("next_attempt_at");
