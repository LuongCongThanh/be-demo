-- Product lifecycle DRAFT -> ACTIVE -> ARCHIVED (BR-CAT-07, BR-CAT-09; task 03).
-- Mapping: ACTIVE stays ACTIVE, INACTIVE -> ARCHIVED. New products default to DRAFT.
-- A new type is swapped in (instead of ALTER TYPE ... ADD VALUE) because a
-- value added in the same transaction cannot be used as the column default.

CREATE TYPE "ProductStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
ALTER TABLE "products" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "status" TYPE "ProductStatus_new"
  USING (CASE "status"::text WHEN 'INACTIVE' THEN 'ARCHIVED' ELSE "status"::text END)::"ProductStatus_new";
DROP TYPE "ProductStatus";
ALTER TYPE "ProductStatus_new" RENAME TO "ProductStatus";
ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TYPE "VariantStatus" RENAME VALUE 'INACTIVE' TO 'ARCHIVED';

ALTER TABLE "products" ADD COLUMN "published_at" TIMESTAMPTZ(6);
UPDATE "products" SET "published_at" = "created_at" WHERE "status" = 'ACTIVE';

-- No more hard delete: a product with variants can never be removed by cascade.
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_product_id_fkey";
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
