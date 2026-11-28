# Choosing the refactor sequence and acceptance checks

Type: grilling
Status: resolved
Blocked by: 02, 03, 04

## Question

What staged migration order and acceptance checks should the implementation-ready specification require for the selected module boundaries? Decide how to keep existing API behavior stable, verify dependency and export rules, and choose the focused checks needed at each stage.

## Answer

This effort produces the specification only. Runtime refactoring is a separate implementation effort.

Use the following staged migration order, with each stage stopping at a verifiable green baseline:

1. **Baseline and dependency inventory**
   - Capture route/Swagger, test counts, and relevant baseline tests.
   - Record imports that cross module roots and every current provider exported from module files.
   - Do not move files or change behavior in this stage.
   - Acceptance: baseline inventory is committed or recorded, and existing focused checks are green.

2. **Complete the Category internal feature boundary**
   - Finish or preserve the Category Core/Admin/Storefront/Persistence composition under `CategoryModule` and `CatalogModule`.
   - Keep route and API behavior unchanged.
   - Acceptance: no direct database access in Category controllers/use-case HTTP adapters; DI Port-to-adapter wiring follows `CategoryCoreModule`; no cross-Catalog module imports Category internals.

3. **Stabilize Catalog composition**
   - Keep `CatalogModule` as the only Nest module for Category, Product, Product Option, and Pricing.
   - Use organizational feature folders only; do not add Catalog submodule files.
   - Add a public capability export only when a downstream module actually needs one.
   - Acceptance: build/lint/typecheck and Catalog tests pass; route/Swagger response diff is empty; no old import paths remain.

4. **Lock Identity and Voucher composition**
   - Keep `IdentityModule` and `VoucherModule` as independent Nest composition roots.
   - Keep auth/access/internal-account and voucher internals private.
   - Verify only declared public services are injected across module boundaries.
   - Acceptance: no module imports implementation files outside the module public exports; Identity/Voucher tests and auth guards remain green.

5. **Add downstream module dependencies only when implemented**
   - Create public Catalog/Voucher services only for real consumers.
   - Implement cross-module reads as public service calls and cross-module writes under the transaction owner.
   - Acceptance: dependency graph is acyclic; write ownership and transaction tests pass; no direct cross-module Prisma/repository access.

Acceptance checks for every structural stage:

- Existing HTTP route and response behavior remain unchanged unless an explicitly accepted contract change is documented.
- Swagger JSON remains equivalent for a pure refactor; any contract change requires a separate documented/approved migration.
- `npm run lint`, `npm run typecheck`, and the smallest relevant unit/integration suite pass. Run build/tests for the affected module where available.
- No barrel exports hide invalid dependencies; imports use `#src/...` aliases and module-public exports.
- No duplicate or conflicting module composition; no provider/import/visibility regression.
- Search-based checks confirm no internal cross-module imports and no direct cross-module Prisma/repository access.
- Keep test counts and behavior assertions unchanged for pure moves. New tests are required only for behavior or boundaries newly introduced.
