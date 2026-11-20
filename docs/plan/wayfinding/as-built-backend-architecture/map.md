## Destination

Update the existing architecture documents to describe the backend as it is implemented today, including the responsibility and public surface of each in-scope module and file. Keep the intended target architecture distinct, and record evidence-based findings about cohesion, dependency direction, module boundaries, and differences between implementation and target.

## Notes

- Read `docs/agents/domain.md` and `docs/agents/issue-tracker.md` before exploring or updating documentation.
- Use `GLOSSARY.md` for domain terms. Treat source code as evidence of current behavior; `docs/architecture/` describes the intended target unless explicitly marked as as-built.
- Cover runtime source, tests, Prisma schema/migrations, scripts, configuration, and the architecture documents relevant to those areas. Exclude dependencies, generated code, and build outputs.
- Describe each file's role, important public symbols, and significant dependencies. Do not write line-by-line explanations or inventory every private helper.
- Distribute updates across existing architecture documents: use `02-modules.md` for shared layers and the existing module documents for domain areas; keep the architecture README as the index.
- Keep recommendations separate from descriptions of the current implementation. Do not change application code or reorganize source folders as part of this effort.

## Decisions so far

- [How should the per-file responsibility inventory stay accurate?](./issues/01-file-inventory-maintenance.md): Maintain file paths and responsibility descriptions by hand alongside related source changes, and verify coverage during architecture-doc updates.
- [Which module should own Customer profile and address responsibilities in the intended architecture?](./issues/02-customer-address-ownership.md): The target `customer` module owns Customer profile and addresses; `identity` owns Accounts and authentication. The current implementation has no Customer module or address management.
- [Which product-detail route is the intended contract?](./issues/03-product-route-contract.md): Use `/products/slug/:slug`; the explicit segment distinguishes slug lookup from the `:id` route.

## Not yet specified

No further decisions are currently known. Add a ticket only if the as-built documentation survey surfaces a specific unresolved architectural choice.

## Out of scope

- Restructuring or changing application source code.
- Describing generated Prisma output, dependencies, build output, or every private helper.
- A standalone security, performance, or general code-quality audit beyond the agreed architecture dimensions.
