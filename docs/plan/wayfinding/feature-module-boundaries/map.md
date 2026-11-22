# Refactoring boundaries in `src/modules`

## Destination

An agreed, implementation-ready refactoring specification for the existing `be-demo/src/modules`: assess how the two Category v1.6 conventions apply, and define whether and how independent business capabilities should be separate NestJS modules rather than one oversized module. This effort produces the specification, not application-code changes.

## Notes

- Scope: all existing modules under `src/modules`, with deeper attention to `catalog`.
- Consult [Category folder-structure convention v1.6](../../../architecture/refactor/01-category-folder-structure-convention-v1.6.md), [Category clean-code quality convention v1.6](../../../architecture/refactor/02-category-clean-code-quality-convention-v1.6.md), and [module architecture](../../../architecture/02-modules.md).
- Avoid splitting solely for folder symmetry or file count; preserve behavior unless a later implementation decision explicitly changes it.
- The prior [Catalog consolidation decision](../../tasks/06-catalog-module/spec.md) is relevant context and must be reconciled with the current goal.

## Decisions so far

<!-- Decisions are indexed here only after their tickets are resolved. -->

- [01 — Applying Category v1.6 conventions](./issues/01-convention-applicability.md): Category conventions supply shared principles and Category-specific conditional structure; do not copy every Category abstraction or folder mechanically.
- [02 — Catalog feature-module boundaries](./issues/02-catalog-module-boundaries.md): keep `CatalogModule` as the Nest composition root; `CategoryModule` is internal, and other Catalog folders remain organizational.
- [03 — Identity and Voucher boundaries](./issues/03-identity-and-voucher-boundaries.md): keep Identity and Voucher as independent composition roots; auth/access/internal-account remain feature areas in Identity.
- [04 — Module APIs and ownership](./issues/04-module-communication-and-ownership.md): module consumers use exported capability services; one-way dependencies, table ownership, and coordinator-owned transactions prevent cross-module coupling.
- [05 — Refactor sequence and acceptance](./issues/05-refactor-sequence-and-acceptance.md): migrate in dependency-safe stages, preserve API behavior, verify Nest visibility and add focused automated/manual acceptance checks.
- [06 — Full Category v1.6 refactor](./issues/06-full-category-v16-refactor.md): Category will receive a full convention refactor with fixed routes/responses, while runtime changes stay out of unrelated modules.

## Not yet specified

- No additional independent Nest feature seam has been specified beyond Catalog's internal Category boundary. The current source inventory has only `catalog`, `identity`, and `voucher`; future modules remain outside this effort until implemented.

## Out of scope

- Designing modules that do not yet exist under `src/modules` (for example, future cart, inventory, or ordering modules).
