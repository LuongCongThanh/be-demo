-- Giá khuyến mãi (BR-PRC-01, BR-PRC-02). Tối đa một Giá khuyến mãi mỗi Biến thể tại một thời điểm:
-- exclusion constraint trên khoảng [starts_at, ends_at).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "sale_prices" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "price" BIGINT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sale_prices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sale_prices_price_check" CHECK ("price" > 0),
    CONSTRAINT "sale_prices_period_check" CHECK ("ends_at" > "starts_at"),
    CONSTRAINT "sale_prices_no_overlap" EXCLUDE USING gist (
        "variant_id" WITH =,
        tstzrange("starts_at", "ends_at") WITH &&
    )
);

CREATE INDEX "sale_prices_variant_id_ends_at_idx" ON "sale_prices"("variant_id", "ends_at");

ALTER TABLE "sale_prices" ADD CONSTRAINT "sale_prices_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_prices" ADD CONSTRAINT "sale_prices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New Permissions for the Admin role (it always holds every Permission). The strings MUST match
-- src/common/auth/permission.enum.ts.
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", p."permission"
FROM "roles" r
CROSS JOIN (VALUES
  ('PRICING_SALE_PRICE_VIEW'),
  ('PRICING_SALE_PRICE_MANAGE')
) AS p("permission")
WHERE r."name" = 'Admin'
ON CONFLICT DO NOTHING;
