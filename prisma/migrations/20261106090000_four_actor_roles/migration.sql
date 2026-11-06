-- Four-actor role model (ADR 0005, task 01).
-- Role moves from the roles/user_roles tables into a single enum column.
-- Old names: CUSTOMER -> CUSTOMER, ORDER_STAFF/STORE_MANAGER -> STAFF,
-- MASTER_ADMIN (and legacy ADMIN) -> ADMIN. Several roles -> the highest one.

CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');

ALTER TABLE "users" ADD COLUMN "role" "Role";

UPDATE "users" u
SET "role" = CASE ranked.rank WHEN 3 THEN 'ADMIN' WHEN 2 THEN 'STAFF' ELSE 'CUSTOMER' END::"Role"
FROM (
  SELECT ur."user_id",
         MAX(CASE r."name"
               WHEN 'MASTER_ADMIN' THEN 3
               WHEN 'ADMIN' THEN 3
               WHEN 'STORE_MANAGER' THEN 2
               WHEN 'ORDER_STAFF' THEN 2
               WHEN 'STAFF' THEN 2
               ELSE 1
             END) AS rank
  FROM "user_roles" ur
  JOIN "roles" r ON r."id" = ur."role_id"
  GROUP BY ur."user_id"
) ranked
WHERE ranked."user_id" = u."id";

UPDATE "users" SET "role" = 'CUSTOMER' WHERE "role" IS NULL;

ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;

ALTER TYPE "UserStatus" RENAME VALUE 'BLOCKED' TO 'DISABLED';

ALTER TABLE "users" RENAME COLUMN "authorization_version" TO "session_version";

DROP TABLE "user_roles";
DROP TABLE "roles";

-- Revoke every session: old tokens carry roles[] and must not survive.
UPDATE "refresh_tokens" SET "revoked_at" = now() WHERE "revoked_at" IS NULL;
UPDATE "users" SET "session_version" = "session_version" + 1;
