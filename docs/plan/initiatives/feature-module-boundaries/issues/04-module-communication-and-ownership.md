# Defining module APIs and ownership

Type: grilling
Status: resolved
Blocked by: 02, 03

## Question

Given the agreed feature boundaries, how should modules communicate and own their data and operations? Decide the public exports/imports, dependency direction, and any persistence or transaction ownership rules needed to prevent circular dependencies and direct cross-module implementation coupling.

## Answer

Use Nest module boundaries as the public API boundary:

- A composition module (`CatalogModule`, `IdentityModule`, `VoucherModule`) imports infrastructure/framework modules and feature implementations it owns.
- Consumers import the composition module and inject only its exported public service.
- Internal feature services, repositories/adapters, controllers, and Prisma access are not public module imports.
- No module imports source files from another module's internal folders.
- `CategoryModule` is private to `CatalogModule`; no outside module imports it or its providers.

Public exports follow real capability need:

- `IdentityModule` exports `AccessService` and `InternalAccountService` for the implemented/current admin capability surfaces and exports `PassportModule` only for Nest authentication composition.
- `CatalogModule` exports one public `CatalogService`-style capability when downstream modules such as cart, inventory, ordering, or pricing actually need it. Until then, export nothing for YAGNI. It must not export Product, Product Option, Pricing, or Category implementation services separately.
- `VoucherModule` exports one public Voucher capability service when cart/ordering consumes it. It must not export Prisma, repository, or controller classes.

Dependency and ownership rules:

- Only the module owning a Prisma table may write it. See `docs/architecture/02-modules.md` for the table ownership matrix.
- Other modules read cross-module data through a public service, not direct Prisma or repository access.
- Cross-module reads should accept a transaction client when the read is part of a caller-owned use case.
- The module coordinating a use case spanning multiple modules opens and owns the transaction. It passes `Prisma.TransactionClient` to public services of participating modules.
- Infrastructure adapters perform no cross-module orchestration and do not bypass module exports.
- Keep module dependency direction one-way. Reverse notification uses domain events/outbox rather than imports back to the dependent module.
- Shared framework concerns remain in `common/`, `http/`, `security/`, or `infrastructure/`; those layers must not import business modules.
- Public interfaces should return application-level contracts, not Prisma persistence records or HTTP DTOs. HTTP DTOs stay at the controller boundary.
