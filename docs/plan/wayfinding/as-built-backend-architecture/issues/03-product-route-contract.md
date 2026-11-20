Type: grilling
Status: resolved

## Question

Which product-detail route is the intended contract: `GET /products/:slug` or `GET /products/slug/:slug`?

`docs/architecture/modules/catalog.md` describes `GET /products/:slug`, while the current `ProductController` exposes `GET /products/slug/:slug` alongside `GET /products/:id`. Choose whether the target contract should remain as documented, with the implementation discrepancy called out, or whether the target documentation should adopt the route currently implemented. This effort will not change source code.

## Answer

Use `GET /products/slug/:slug` as the intended route as well as the current implementation. The explicit `slug` segment distinguishes lookup by slug from the separate `GET /products/:id` route; update the target documentation to match.
