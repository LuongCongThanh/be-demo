-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "shipping_fee" DROP DEFAULT;

-- CreateTable
CREATE TABLE "awaiting_dispatch_items" (
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awaiting_dispatch_items_pkey" PRIMARY KEY ("order_id","variant_id")
);

ALTER TABLE "awaiting_dispatch_items"
ADD CONSTRAINT "awaiting_dispatch_items_quantity_ck" CHECK ("quantity" > 0);

-- CreateIndex
CREATE INDEX "awaiting_dispatch_items_variant_id_idx" ON "awaiting_dispatch_items"("variant_id");

-- AddForeignKey
ALTER TABLE "awaiting_dispatch_items" ADD CONSTRAINT "awaiting_dispatch_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awaiting_dispatch_items" ADD CONSTRAINT "awaiting_dispatch_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
