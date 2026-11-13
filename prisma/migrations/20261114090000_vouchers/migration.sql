-- Voucher (BR-VCH-03, BR-VCH-04, BR-VCH-09). Lượt dùng đến ở slice C.
CREATE TYPE "VoucherType" AS ENUM ('PERCENT', 'FIXED');

CREATE TABLE "vouchers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "type" "VoucherType" NOT NULL,
    "value" BIGINT NOT NULL,
    "max_discount" BIGINT,
    "min_subtotal" BIGINT NOT NULL DEFAULT 0,
    "total_limit" INTEGER,
    "per_buyer_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vouchers_code_upper_check" CHECK ("code" = upper("code")),
    CONSTRAINT "vouchers_value_check" CHECK ("value" > 0 AND ("type" = 'FIXED' OR "value" <= 100)),
    CONSTRAINT "vouchers_max_discount_check" CHECK ("max_discount" IS NULL OR ("type" = 'PERCENT' AND "max_discount" > 0)),
    CONSTRAINT "vouchers_min_subtotal_check" CHECK ("min_subtotal" >= 0),
    CONSTRAINT "vouchers_limits_check" CHECK (("total_limit" IS NULL OR "total_limit" > 0) AND ("per_buyer_limit" IS NULL OR "per_buyer_limit" > 0)),
    CONSTRAINT "vouchers_used_count_check" CHECK ("used_count" >= 0),
    CONSTRAINT "vouchers_period_check" CHECK ("ends_at" > "starts_at")
);

CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");
CREATE INDEX "vouchers_created_at_idx" ON "vouchers"("created_at" DESC);

ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New Permissions for the Admin role (strings MUST match src/common/auth/permission.enum.ts).
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", p."permission"
FROM "roles" r
CROSS JOIN (VALUES
  ('PRICING_VOUCHER_VIEW'),
  ('PRICING_VOUCHER_MANAGE')
) AS p("permission")
WHERE r."name" = 'Admin'
ON CONFLICT DO NOTHING;
