-- Shared sizes/colors and variant rules (BR-CAT-02..06, BR-CAT-11; task 04).

-- 1. Fail loudly instead of silently changing data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "product_variants" WHERE "price" <> trunc("price") OR "price" <= 0) THEN
    RAISE EXCEPTION 'product_variants.price has fractional or non-positive values; fix them before migrating (prices are integer VND > 0)';
  END IF;
  IF EXISTS (SELECT 1 FROM "product_variants" WHERE "sku" !~ '^[A-Z0-9-]+$') THEN
    RAISE EXCEPTION 'product_variants.sku has values outside ^[A-Z0-9-]+$; fix them before migrating';
  END IF;
  IF EXISTS (SELECT 1 FROM "product_images") THEN
    RAISE EXCEPTION 'product_images is not empty; images must be re-attached to a color, migrate them by hand';
  END IF;
END $$;

-- 2. Shared option tables.
CREATE TABLE "sizes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sizes_code_check" CHECK ("code" ~ '^[A-Z0-9-]+$')
);
CREATE UNIQUE INDEX "sizes_code_key" ON "sizes"("code");

CREATE TABLE "colors" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "hex" CHAR(7) NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "colors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "colors_code_check" CHECK ("code" ~ '^[A-Z0-9-]+$'),
    CONSTRAINT "colors_hex_check" CHECK ("hex" ~ '^#[0-9A-Fa-f]{6}$')
);
CREATE UNIQUE INDEX "colors_code_key" ON "colors"("code");

-- FREESIZE lets products without sizes still have size + color on every variant.
INSERT INTO "sizes" ("id", "code", "name", "sort_order", "updated_at")
VALUES (gen_random_uuid(), 'FREESIZE', 'Free size', 0, now());

-- 3. Map the old free-text size/color into the new tables.
--    Code = uppercase alphanumerics joined by '-'. Hex is unknown for old
--    colors: '#000000' placeholder, fix it in the back-office afterwards.
CREATE FUNCTION pg_temp.to_option_code(t text) RETURNS text AS $$
  SELECT NULLIF(upper(trim(both '-' from regexp_replace(trim(t), '[^A-Za-z0-9]+', '-', 'g'))), '')
$$ LANGUAGE sql IMMUTABLE;

INSERT INTO "sizes" ("id", "code", "name", "sort_order", "updated_at")
SELECT gen_random_uuid(), c.code, min(trim(v."size")), 100, now()
FROM "product_variants" v
CROSS JOIN LATERAL (SELECT pg_temp.to_option_code(v."size") AS code) c
WHERE c.code IS NOT NULL AND c.code <> 'FREESIZE'
GROUP BY c.code;

INSERT INTO "colors" ("id", "code", "name", "hex", "updated_at")
SELECT gen_random_uuid(), coalesce(c.code, 'DEFAULT'), coalesce(min(trim(v."color")), 'Mặc định'), '#000000', now()
FROM "product_variants" v
CROSS JOIN LATERAL (SELECT pg_temp.to_option_code(v."color") AS code) c
GROUP BY c.code;

ALTER TABLE "product_variants" ADD COLUMN "size_id" UUID, ADD COLUMN "color_id" UUID;

UPDATE "product_variants" v
SET "size_id" = s."id"
FROM "sizes" s
WHERE s."code" = coalesce(pg_temp.to_option_code(v."size"), 'FREESIZE');

UPDATE "product_variants" v
SET "color_id" = c."id"
FROM "colors" c
WHERE c."code" = coalesce(pg_temp.to_option_code(v."color"), 'DEFAULT');

ALTER TABLE "product_variants"
  ALTER COLUMN "size_id" SET NOT NULL,
  ALTER COLUMN "color_id" SET NOT NULL,
  DROP COLUMN "size",
  DROP COLUMN "color",
  ALTER COLUMN "price" SET DATA TYPE BIGINT,
  ADD CONSTRAINT "product_variants_price_check" CHECK ("price" > 0),
  ADD CONSTRAINT "product_variants_sku_check" CHECK ("sku" ~ '^[A-Z0-9-]+$');

CREATE UNIQUE INDEX "product_variants_product_id_size_id_color_id_key" ON "product_variants"("product_id", "size_id", "color_id");
CREATE INDEX "product_variants_size_id_idx" ON "product_variants"("size_id");
CREATE INDEX "product_variants_color_id_idx" ON "product_variants"("color_id");
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Product weight (BR-CAT-06). Dev data gets a 500 g placeholder.
ALTER TABLE "products" ADD COLUMN "weight_grams" INTEGER;
UPDATE "products" SET "weight_grams" = 500;
ALTER TABLE "products"
  ALTER COLUMN "weight_grams" SET NOT NULL,
  ADD CONSTRAINT "products_weight_grams_check" CHECK ("weight_grams" > 0);

-- 5. Images per color (BR-CAT-05); table is empty (checked above).
ALTER TABLE "product_images"
  DROP COLUMN "url",
  ADD COLUMN "color_id" UUID NOT NULL,
  ADD COLUMN "storage_key" TEXT NOT NULL;
CREATE INDEX "product_images_product_id_color_id_sort_order_idx" ON "product_images"("product_id", "color_id", "sort_order");
CREATE INDEX "product_images_color_id_idx" ON "product_images"("color_id");
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Partial unique: at most one primary image per (product, color). Not expressible in the Prisma DSL.
CREATE UNIQUE INDEX "product_images_one_primary_per_color" ON "product_images"("product_id", "color_id") WHERE "is_primary";
