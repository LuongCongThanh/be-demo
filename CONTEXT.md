# CONTEXT.md — Ecommerce Domain Glossary

## Auth & Authorization

- **User** — an account in the system. Has a unique `email`, a `passwordHash`
  (the raw password is never stored), an **Account status**, and an
  **Email verification** state.
- **Account status** — account state managed by ADMIN: `ACTIVE` (usable
  normally) or `BLOCKED` (locked out, cannot log in).
- **Email verification** — an **independent** axis from Account status,
  tracking whether the user has verified ownership of their email. A User
  can be `ACTIVE` but not yet have verified their email — both conditions
  must hold before login is allowed.
- **Role** — a permission label assigned to a User (e.g. `ADMIN`,
  `CUSTOMER`). Role is **data in the DB**, not a hardcoded enum — new roles
  (e.g. `STAFF`) can be added without a code change.
- **Session** — a logical login session for a User, represented by one
  Refresh Token record. Not equivalent to "one physical device" (the system
  does not do device fingerprinting).
- **Email Verification Token** / **Password Reset Token** — single-use
  tokens sent by email, always stored as a hash in the DB (the raw token is
  never stored).
