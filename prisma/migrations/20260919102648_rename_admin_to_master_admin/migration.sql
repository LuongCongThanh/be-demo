-- Rename the legacy ADMIN role to the canonical MASTER_ADMIN (ADR 0005).
UPDATE "roles" SET "name" = 'MASTER_ADMIN' WHERE "name" = 'ADMIN';

-- Seed the remaining 3 canonical roles if they don't already exist.
INSERT INTO "roles" ("id", "name", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'CUSTOMER', now(), now()),
  (gen_random_uuid(), 'ORDER_STAFF', now(), now()),
  (gen_random_uuid(), 'STORE_MANAGER', now(), now()),
  (gen_random_uuid(), 'MASTER_ADMIN', now(), now())
ON CONFLICT ("name") DO NOTHING;
