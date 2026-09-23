-- Cover Image = ảnh có sort_order nhỏ nhất; không còn đánh dấu primary riêng.
DROP INDEX IF EXISTS "product_images_product_id_primary_unique";

-- AlterTable
ALTER TABLE "product_images" DROP COLUMN "is_primary";
