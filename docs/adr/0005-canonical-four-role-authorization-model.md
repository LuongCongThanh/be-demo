# Use four canonical business roles

Authorization will use `CUSTOMER`, `ORDER_STAFF`, `STORE_MANAGER`, and `MASTER_ADMIN`; the legacy `ADMIN` label will be migrated to `MASTER_ADMIN` before production. Routes list every accepted role explicitly instead of relying on a hidden inheritance hierarchy, preserving least privilege and making the permission matrix reviewable; only MASTER_ADMIN manages users, account status, and role assignments, and the system must prevent removal of the last active verified MASTER_ADMIN.
