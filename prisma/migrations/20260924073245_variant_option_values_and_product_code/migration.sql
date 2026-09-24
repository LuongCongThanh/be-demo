-- ADR 0011: variant chọn Option Value (màu/size) thay cho text tự do; SKU ghép
-- từ Product Code. Chưa có production — dữ liệu dev: product cũ nhận code từ
-- id, variant cũ giữ nguyên sku nhưng mất color/size text (không map được).

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "color",
DROP COLUMN "size",
ADD COLUMN     "color_id" UUID,
ADD COLUMN     "size_id" UUID;

-- AlterTable: thêm nullable → backfill → NOT NULL, để không vỡ khi đã có row.
ALTER TABLE "products" ADD COLUMN     "code" VARCHAR(20);
UPDATE "products" SET "code" = UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 8));
ALTER TABLE "products" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "option_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "option_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
