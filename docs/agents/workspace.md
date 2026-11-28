# Fashion Store workspace

<!-- Synced from the fashion-store workspace repository (shared/agents/workspace.md). Edit it there, not here. -->

This repository is one of three applications that are developed side by side:

| Application | Repository                | Local port |
| ----------- | ------------------------- | ---------- |
| Backend     | `be-demo`                 | 8080       |
| CMS         | `fashion-store-cms`       | 3001       |
| Storefront  | `fe-ecommerce-nike-style` | 3000       |

The three meet at one point: the **API Contract**, the Backend's OpenAPI document. It is published as numbered **Contract Versions** (git tags `openapi-vX.Y.Z` on the Backend). The CMS and Storefront each pin one Contract Version in a committed file and generate their API types from it.

## Changing the API Contract

- The Backend tags a new Contract Version automatically when `docs/openapi/openapi.json` changes on `dev`. A Breaking Change bumps the minor number; anything else bumps the patch number.
- Do not hand-edit generated API types in the CMS or Storefront. Run `gen:api`.
- The Contract Version is not the URI version (`/api/v1`). A Breaking Change does not create `/v2`.

## A feature that needs both the Backend and the CMS or Storefront

1. Work locally against the unreleased contract: `OPENAPI_URL=../be-demo/docs/openapi/openapi.json` before `gen:api`.
2. Merge the Backend PR into `dev`. CI then tags and releases a new Contract Version.
3. Wait for the `chore/contract-openapi-v*` PR that `contract-bump.yml` opens in the CMS or Storefront (daily, or on the next push to its `dev`), and merge it. A patch bump merges itself on green CI; a minor bump carries the `breaking-contract` label and needs your fixes on that branch first.
4. Rebase the feature PR onto it and merge it only after that. CI regenerates the types from the pinned version and fails if the PR still depends on the local contract.

Never merge a CMS or Storefront PR that only works with a locally generated contract.
