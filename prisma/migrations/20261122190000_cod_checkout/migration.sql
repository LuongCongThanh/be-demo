BEGIN;

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'ONLINE');

-- AlterEnum
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'PACKING', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'RETURNED_TO_SENDER');
ALTER TABLE "public"."orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new"
USING (
    CASE "status"::text
        WHEN 'PENDING' THEN 'PLACED'
        WHEN 'PAID' THEN 'PLACED'
        ELSE "status"::text
    END
)::"OrderStatus_new";
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PLACED';

-- AlterTable
ALTER TABLE "order_items" RENAME COLUMN "total_price" TO "line_total";
ALTER TABLE "order_items"
ADD COLUMN "color_name" VARCHAR(50) NOT NULL DEFAULT 'Legacy',
ADD COLUMN "list_price" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "size_name" VARCHAR(50) NOT NULL DEFAULT 'Legacy',
ADD COLUMN "voucher_discount" BIGINT NOT NULL DEFAULT 0,
ALTER COLUMN "unit_price" TYPE BIGINT USING ROUND("unit_price")::BIGINT,
ALTER COLUMN "line_total" TYPE BIGINT USING ROUND("line_total")::BIGINT;
UPDATE "order_items" SET "list_price" = "unit_price";
ALTER TABLE "order_items"
ALTER COLUMN "color_name" DROP DEFAULT,
ALTER COLUMN "list_price" DROP DEFAULT,
ALTER COLUMN "size_name" DROP DEFAULT,
ADD CONSTRAINT "order_items_quantity_ck" CHECK ("quantity" > 0),
ADD CONSTRAINT "order_items_prices_ck" CHECK ("list_price" > 0 AND "unit_price" > 0 AND "line_total" > 0),
ADD CONSTRAINT "order_items_voucher_discount_ck" CHECK ("voucher_discount" >= 0 AND "voucher_discount" <= "line_total");

-- AlterTable
ALTER TABLE "orders" RENAME COLUMN "total_amount" TO "total";
ALTER TABLE "orders"
ALTER COLUMN "total" TYPE BIGINT USING ROUND("total")::BIGINT,
ADD COLUMN "contact_email" VARCHAR(255),
ADD COLUMN "contact_name" VARCHAR(255) NOT NULL DEFAULT 'Legacy buyer',
ADD COLUMN "contact_phone" VARCHAR(30) NOT NULL DEFAULT '00000000',
ADD COLUMN "discount_amount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'COD',
ADD COLUMN "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "quote_id" UUID,
ADD COLUMN "shipping_address" VARCHAR(500) NOT NULL DEFAULT 'Legacy address',
ADD COLUMN "shipping_fee" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "shipping_fee_fallback" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "shipping_province_code" VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
ADD COLUMN "shipping_ward_code" VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
ADD COLUMN "subtotal" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "total_weight_grams" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "user_id" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PLACED';
UPDATE "orders" SET "subtotal" = "total", "placed_at" = "created_at";
ALTER TABLE "orders"
ALTER COLUMN "contact_name" DROP DEFAULT,
ALTER COLUMN "contact_phone" DROP DEFAULT,
ALTER COLUMN "shipping_address" DROP DEFAULT,
ALTER COLUMN "shipping_province_code" DROP DEFAULT,
ALTER COLUMN "shipping_ward_code" DROP DEFAULT,
ALTER COLUMN "subtotal" DROP DEFAULT,
ALTER COLUMN "total_weight_grams" DROP DEFAULT,
ADD CONSTRAINT "orders_amounts_ck" CHECK (
    "subtotal" >= 0 AND "discount_amount" >= 0 AND "discount_amount" <= "subtotal"
    AND "shipping_fee" >= 0 AND "total" = "subtotal" - "discount_amount" + "shipping_fee"
);

-- CreateTable
CREATE TABLE "checkout_quotes" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "input" JSONB NOT NULL,
    "lines" JSONB NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "discount" BIGINT NOT NULL DEFAULT 0,
    "shipping_fee" BIGINT NOT NULL,
    "total" BIGINT NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkout_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response_status" INTEGER,
    "response" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_usages" (
    "id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID,
    "phone" VARCHAR(30) NOT NULL,
    "discount" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_usages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "checkout_quotes"
ADD CONSTRAINT "checkout_quotes_amounts_ck" CHECK (
    "subtotal" >= 0 AND "discount" >= 0 AND "discount" <= "subtotal"
    AND "shipping_fee" >= 0 AND "total" > 0
    AND "total" = "subtotal" - "discount" + "shipping_fee"
);
ALTER TABLE "voucher_usages"
ADD CONSTRAINT "voucher_usages_discount_ck" CHECK ("discount" >= 0);

COMMIT;

-- CreateIndex
CREATE INDEX "checkout_quotes_expires_at_idx" ON "checkout_quotes"("expires_at");

-- CreateIndex
CREATE INDEX "checkout_quotes_user_id_created_at_idx" ON "checkout_quotes"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_scope_key_key" ON "idempotency_keys"("scope", "key");

-- CreateIndex
CREATE INDEX "voucher_usages_voucher_id_phone_idx" ON "voucher_usages"("voucher_id", "phone");

-- CreateIndex
CREATE INDEX "voucher_usages_user_id_voucher_id_idx" ON "voucher_usages"("user_id", "voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_variant_id_key" ON "order_items"("order_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_quote_id_key" ON "orders"("quote_id");

-- CreateIndex
CREATE INDEX "orders_contact_phone_idx" ON "orders"("contact_phone");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "checkout_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_quotes" ADD CONSTRAINT "checkout_quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
