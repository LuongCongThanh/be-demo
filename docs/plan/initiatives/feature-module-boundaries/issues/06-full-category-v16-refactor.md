Type: grilling
Status: resolved

## Question

Should Category be fully refactored to the Category Folder Structure Convention v1.6 and Category Clean Code Quality Convention v1.6, rather than retaining the current mixed layout and only introducing the Core/Admin/Storefront Nest composition? Decide the implementation scope, migration behavior, and whether the full refactor is required before the way to the destination is handed off for execution.

## Answer

Category must be fully refactored to both v1.6 conventions. The earlier Core/Admin/Storefront split is necessary but not sufficient: the convention also governs folder responsibility, data boundaries, application/port/presentation layers, test placement, naming, and the migration-quality gates.

The implementation keeps runtime behavior fixed:

- Preserve Category routes, Swagger contracts, and response shapes.
- Refactor only Category for runtime code, while updating directly related architecture and convention inventory.
- Use one PR/refactor cut after the baseline is prepared.
- Move tests near the component/service they verify; reserve `testing/` for genuinely shared test helpers.
- Do not broaden the implementation into re-splitting Product, Product Option, Pricing, Identity, or Voucher.
- Keep acceptance checks behavioral: build, typecheck, lint, affected Category tests, and Swagger diff for a pure refactor.

Reason the partial refactor was insufficient:

- The existing convention was documented as an experimental Category standard, not a blanket folder template for every module.
- That principle was previously applied correctly to the cross-module decision: it prevented copying the Category abstractions into unrelated capabilities.
- It was then only partially applied to Category itself. Splitting Nest composition modules improved wiring but did not complete the convention's folder, responsibility, and test-placement migration.
