# Reviewing Identity and Voucher module boundaries

Type: grilling
Status: resolved
Blocked by: 01

## Question

For the existing `IdentityModule` (auth, access, and internal-account) and `VoucherModule`, which capabilities should remain grouped and which, if any, should become independent NestJS modules? Decide whether the current composition boundaries are appropriate under the agreed convention principles; do not split merely to mirror folders.

## Answer

Keep `IdentityModule` as the composition root for identity/authentication/access/account-management capabilities. Auth, Access, and Internal Account folders remain organizational feature areas inside one Nest module; they are not independent Nest feature modules.

This grouping is appropriate because they share account identity, session state, role/permission data, and authentication infrastructure. Splitting them would add module visibility and export ceremony without demonstrated independent ownership or lifecycle:

- `auth/` owns login/session/password/email-verification flows.
- `access/` owns role and permission policy.
- `internal-account/` owns internal-account administration.
- The shared Account, session, role, permission, and security state stays under `IdentityModule`.

Identity's public module exports are limited to capability services and shared infrastructure actually consumed by other modules. `AccessService` and `InternalAccountService` are public capability services for the current admin flows. `PassportModule` remains a framework/export concern for guard/auth strategy composition, not a business capability. Internal auth services/controllers/DTOs must not be imported across module boundaries.

Keep `VoucherModule` independent as a Nest module. Voucher has its own data ownership and is a separate business capability that future ordering/cart flows can consume. Its internal service and controller remain private while no downstream module exists. When a cross-module consumer is added, export one public Voucher capability service rather than Prisma or repository implementation details.

Do not create nested Auth, Access, Internal Account, or Voucher feature modules solely to mirror folders. Revisit only if independent data ownership, deployment/lifecycle, provider visibility, testing ownership, or a real public API requires a separate module.
