# Applying the Category v1.6 conventions across modules

Type: grilling
Status: resolved

## Question

Which rules in the Category v1.6 folder-structure and clean-code conventions should be treated as shared standards for all existing modules under `src/modules`, and which are Category-specific or need adaptation for other capabilities? Decide what principles should govern the refactoring specification without mechanically applying Category's exact folder tree everywhere.

Relevant context: folder-structure convention (`01-category-folder-structure-convention-v1.6.md`, đã xoá; thay bằng `docs/conventions/module-architecture-conventions.md`), clean-code convention (`02-category-clean-code-quality-convention-v1.6.md`, đã xoá; thay bằng `docs/conventions/module-architecture-conventions.md`), [module architecture](../../../../architecture/02-modules.md), and the earlier [Catalog consolidation specification](../../../tasks/done/06-catalog-module/spec.md).

## Answer

Treat the following as shared standards for every existing module under `src/modules`:

- A folder must have a clear responsibility and must not be created merely to reserve future structure.
- Keep boundaries explicit and preserve one-way dependencies; no module or layer may introduce a circular dependency.
- Preserve current behavior by default during structural refactoring.
- Controller, application/use-case, domain, persistence, DTO, and presentation distinctions apply only when the capability actually has those concerns.
- Domain and application code must not depend on HTTP, NestJS, Prisma, storage, or other infrastructure implementations.
- DTOs are API contracts, not Domain Models or Application Results. Persistence records stay in Infrastructure.
- Do not add repositories, ports, adapters, mappers, tokens, services, or helper layers when a real boundary or implementation need does not exist.
- Split or move code only for responsibility, ownership, independent change, lifecycle, testing, or export needs; file count and folder symmetry are not thresholds.
- Add tests by behavior and boundary: success, validation/business failure, and important integration or dependency failures.
- Transactions, concurrency, validation, error handling, security, API compatibility, and quality gates remain shared quality obligations.

Treat the exact `CategoryCoreModule` / `AdminCategoryModule` / `StorefrontCategoryModule` / `CategoryRelationalPersistenceModule` structure and Category-specific Port/adapter examples as conditional. They are mandatory for Category under the Category v1.6 conventions, and they inform shared principles for other modules only when there is a genuine application, infrastructure, or test seam. Do not mechanically copy:

- Category's Domain/Application/Presentation/Infrastructure folder tree;
- Category's repositories or transaction/port abstractions;
- separate Admin and Storefront Nest modules unless those surfaces have independent providers and meaningful change or testing needs;
- test organization or token count as a universal file-layout rule.
