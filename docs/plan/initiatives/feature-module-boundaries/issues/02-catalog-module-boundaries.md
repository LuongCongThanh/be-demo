# Choosing Catalog feature-module boundaries

Type: grilling
Status: resolved
Blocked by: 01

## Question

Should `CatalogModule` remain the single NestJS module for Category, Product, Product Option, and Pricing, or should it compose smaller NestJS feature modules? If it should split, decide which capabilities merit their own module and which should remain together, based on responsibility, dependency direction, and independent change—not folder symmetry.

Reconcile the current goal with the earlier [Catalog consolidation specification](../../../tasks/done/06-catalog-module/spec.md), which intentionally consolidated catalog into one module, and the later [Catalog flat-layout specification](../../../tasks/done/13-catalog-subfolders/spec.md). Preserve the distinction between an organizational folder and a NestJS module boundary.

## Answer

Keep `CatalogModule` as the single NestJS composition root for Catalog. It continues to aggregate Category, Product, Product Option, and Pricing capabilities. This reconciles the earlier consolidation decision and the later flat-layout/feature-folder decision:

- The Catalog consolidation intentionally avoided three top-level Nest modules for Category, Product, and Product Option.
- The later feature-folder work organizes code within `src/modules/catalog/`; that work does not create or imply independent Nest feature modules.
- Split a Nest feature module only for independently owned data, lifecycle, test composition, or a public export/service needed by another module.
- No split is justified here only by responsibility labels or file count.

For the current structure:

- `CategoryModule` is an internal Category feature/composition module imported by `CatalogModule`, because Category explicitly uses the Category v1.6 layering and independent Core/Admin/Storefront wiring.
- `CategoryModule` must not become a public Catalog capability export. Controllers, application services, and internal ports remain inside the Catalog boundary unless a concrete cross-module consumer is defined.
- `product/`, `product-option/`, and `pricing/` remain organizational feature folders under `CatalogModule`; do not create `product.module.ts`, `product-option.module.ts`, or `pricing.module.ts` unless an independent Nest ownership or export seam is demonstrated.
- Preserve route, DTO, response, and Swagger behavior during any folder or module migration.

The target public capability for modules outside Catalog is one `CatalogService`-style service exported by `CatalogModule` only when a downstream module has a real cross-module need. The Catalog flat folders remain implementation structure; they are not module boundaries.
