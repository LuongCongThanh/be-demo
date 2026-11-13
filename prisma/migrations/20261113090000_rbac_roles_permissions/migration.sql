-- RBAC schema + data migration (task 15, slice A). Hand-written, forward-only.
-- users.role (ADMIN/STAFF/CUSTOMER) stays as the account-type discriminator until slice F;
-- its enum type is renamed Role -> AccountType because "Role" now names the RBAC table.
-- The permission strings below MUST match src/common/auth/permission.enum.ts.

-- 0. Safety gate: the target model allows exactly one active Admin. Abort before touching anything.
DO $$
DECLARE
  active_admins integer;
BEGIN
  SELECT count(*) INTO active_admins FROM "users" WHERE "role" = 'ADMIN' AND "status" = 'ACTIVE';
  IF active_admins > 1 THEN
    RAISE EXCEPTION 'RBAC migration aborted: found % active ADMIN accounts, but exactly one is allowed. Disable or demote the extra ADMIN accounts (keep one), then re-run the migration.', active_admins;
  END IF;
END
$$;

-- 1. Account type enum rename (data-preserving).
ALTER TYPE "Role" RENAME TO "AccountType";

-- 2. Tables.
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission")
);

CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. System roles. Admin = every permission; Staff = read-only catalog (current behaviour).
INSERT INTO "roles" ("id", "name", "description", "is_system", "updated_at") VALUES
  (gen_random_uuid(), 'Admin', 'Quản trị viên: toàn bộ Quyền', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Staff', 'Nhân viên vận hành', true, CURRENT_TIMESTAMP);

INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", p."permission"
FROM "roles" r
CROSS JOIN (VALUES
  ('CATALOG_PRODUCT_VIEW'),
  ('CATALOG_PRODUCT_MANAGE'),
  ('CATALOG_CATEGORY_VIEW'),
  ('CATALOG_CATEGORY_MANAGE'),
  ('CATALOG_PRODUCT_OPTION_VIEW'),
  ('CATALOG_PRODUCT_OPTION_MANAGE'),
  ('ADMINISTRATION_ROLE_VIEW'),
  ('ADMINISTRATION_ROLE_MANAGE'),
  ('ADMINISTRATION_INTERNAL_ACCOUNT_VIEW'),
  ('ADMINISTRATION_INTERNAL_ACCOUNT_MANAGE')
) AS p("permission")
WHERE r."name" = 'Admin';

INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", p."permission"
FROM "roles" r
CROSS JOIN (VALUES
  ('CATALOG_PRODUCT_VIEW'),
  ('CATALOG_CATEGORY_VIEW'),
  ('CATALOG_PRODUCT_OPTION_VIEW')
) AS p("permission")
WHERE r."name" = 'Staff';

-- 4. Map internal accounts: ADMIN -> Admin, STAFF -> Staff. CUSTOMER stays an identity, not a Role.
INSERT INTO "user_roles" ("user_id", "role_id")
SELECT u."id", r."id"
FROM "users" u
JOIN "roles" r ON r."name" = CASE u."role" WHEN 'ADMIN' THEN 'Admin' ELSE 'Staff' END
WHERE u."role" IN ('ADMIN', 'STAFF');

-- 5. Revoke every internal session: tokens issued before RBAC carry no roles/permissions.
UPDATE "refresh_tokens" SET "revoked_at" = now()
WHERE "revoked_at" IS NULL
  AND "user_id" IN (SELECT "id" FROM "users" WHERE "role" IN ('ADMIN', 'STAFF'));
UPDATE "users" SET "session_version" = "session_version" + 1 WHERE "role" IN ('ADMIN', 'STAFF');
