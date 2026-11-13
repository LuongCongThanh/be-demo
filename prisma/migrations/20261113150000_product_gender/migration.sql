-- Giới tính của Sản phẩm (BR-CAT-14). Sản phẩm đã có mặc định UNISEX.
CREATE TYPE "Gender" AS ENUM ('MEN', 'WOMEN', 'KIDS', 'UNISEX');

ALTER TABLE "products" ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'UNISEX';
