Type: grilling
Status: resolved

## Question

Which module should own Customer profile and address responsibilities in the intended architecture?

The target documents disagree: `docs/architecture/02-modules.md` assigns `customer_addresses` to a `customer` module, while `docs/architecture/modules/identity.md` assigns addresses to `identity` and describes `/me/addresses`. The current implementation has no Customer module or address controller/service; `MeController` currently exposes only `GET /me`.

Choose the intended ownership (`customer` as a separate domain module, or profile/address under `identity`). The as-built inventory will separately state that address management is not implemented yet.

## Answer

The target `customer` module owns Customer profile and address responsibilities, including the planned `/me/addresses` routes. `identity` owns Accounts, authentication, and login. The as-built documentation must state that Customer address management and the Customer module are not implemented yet.
