# Ecommerce Domain

Canonical business language for the ecommerce system. These definitions are independent of implementation and provider details.

## Identity & Authorization

**User**:
An account that can authenticate and act in the system. A User has one Account Status, one Email Verification state, and one or more Roles.
_Avoid_: Account when referring to the person, Customer when the User is acting as staff

**Account Status**:
The MASTER_ADMIN-managed availability of a User: `ACTIVE` or `BLOCKED`. It is independent of Email Verification.
_Avoid_: Email status, login status

**Email Verification**:
Confirmation that a User controls their email address. An active User must also be email-verified before login is allowed.
_Avoid_: Account activation

**Role**:
A permission label assigned to a User. The canonical roles are `CUSTOMER`, `ORDER_STAFF`, `STORE_MANAGER`, and `MASTER_ADMIN`.
_Avoid_: `ADMIN`, implicit role hierarchy

**CUSTOMER**:
A User who manages their own profile, cart, checkout, payments, and Orders.
_Avoid_: Buyer, Client

**ORDER_STAFF**:
A staff User who processes Orders and Fulfillment but cannot manage the catalog, roles, account status, or execute refunds.
_Avoid_: Staff

**STORE_MANAGER**:
A staff User who manages the catalog, Inventory, Promotions, Order operations, and refunds, but cannot assign roles or manage Account Status.
_Avoid_: Admin

**MASTER_ADMIN**:
A privileged User who manages Users, Account Status, Roles, and all store operations. The system must always retain at least one active, verified MASTER_ADMIN.
_Avoid_: `ADMIN`, superuser

**Session**:
A logical login session for a User, represented by one refresh credential. It is not equivalent to a physical device.
_Avoid_: Device

## Catalog & Inventory

**Category**:
A catalog classification assigned to Products. A Category that is referenced by a Product must be reassigned before deletion.
_Avoid_: Tag, collection

**Product**:
A catalog aggregate that describes a sellable concept and contains one or more Product Variants, at least one of which is still `ACTIVE`. A Product itself is not the purchasable SKU; taking a whole Product off sale is done through the Product's own status, not by discontinuing all its variants.
_Avoid_: SKU, Product Variant

**Product Variant**:
A purchasable version of a Product with its own SKU, price, and Inventory, distinguished from its siblings by the Option Values it was created with; those never change afterwards. A Product has at most fifty variants that are not discontinued.
_Avoid_: Product when referring to the purchasable SKU

**Option Value**:
A named, coded choice for either a color (e.g. "Black", code `BLK`) or a size (e.g. "M"), maintained centrally by catalog staff and selected — never typed — when creating Product Variants. Its code is unique across colors and sizes and never changes, and one in use is hidden from selection rather than removed.
_Avoid_: Attribute, SKU (when referring to the pre-created list)

**Product Code**:
The short, unique, staff-chosen code of a Product (e.g. `TSB001`) that begins every SKU of that Product. It never changes once the Product exists.
_Avoid_: Slug, SKU

**SKU**:
The human-readable code of one Product Variant, composed by the system from the Product's code and the variant's Option Value codes. It is never chosen or typed by staff.
_Avoid_: Product code, variant id

**Discontinued Variant**:
A Product Variant permanently taken off sale, which is what happens to any variant removed from its Product, sold or not. It is kept as history, hidden from Customers, and never returns to sale.
_Avoid_: Deleted variant, inactive variant

**Product Image**:
An image displayed for a Product, which has one ordered list of one to five of them; the editor's order is the only ranking among them. Replacing an image means removing it and adding a new Product Image in its place, since an image's file never changes.
_Avoid_: Photo, gallery item

**Cover Image**:
The first Product Image in a Product's ordered list; it represents the Product wherever only one image is shown. It is never marked separately — changing the Cover Image means reordering the list.
_Avoid_: Primary image, thumbnail, featured image

**Pending Upload**:
An image file already uploaded to storage but not yet attached to anything. A Pending Upload that is not attached within one day is discarded automatically.
_Avoid_: Orphan, draft image

**Inventory**:
The quantity held for one Product Variant in the single warehouse supported by the MVP.
_Avoid_: Stock reservation

**Inventory Reservation**:
A time-limited claim on Inventory created for an Order during checkout. It becomes consumed, released, or expired exactly once.
_Avoid_: Cart hold, permanent stock deduction

## Ordering & Payment

**Cart**:
A Customer's current purchase intent. A Cart does not hold Inventory; availability and price are revalidated during checkout.
_Avoid_: Order, Inventory Reservation

**Cart Item**:
A requested quantity of one Product Variant in a Cart.
_Avoid_: Order Item, reserved stock

**Order**:
An immutable commercial snapshot created from a Customer's Cart, including item prices, discounts, shipping charge, tax, currency, and delivery address.
_Avoid_: Cart, Payment, transaction

**Checkout**:
The process that validates a Cart, claims Inventory, and creates an Order snapshot. Checkout is an operation, not a persistent commercial entity.
_Avoid_: Order, Payment

**Payment**:
The overall obligation to collect money for an Order. A Payment can have multiple Payment Attempts but at most one successful outcome for the amount due.
_Avoid_: Order, provider transaction

**Payment Attempt**:
One attempt to create, confirm, query, or recover a provider-side payment transaction.
_Avoid_: Payment

**Refund**:
A request to return captured money through the original Payment provider. A paid Order is not treated as cancelled merely because a refund was requested.
_Avoid_: Cancellation

**Fulfillment**:
The physical handling and delivery lifecycle of a paid Order.
_Avoid_: Payment status, Order status

**Promotion**:
A rule that grants a discount. The MVP accepts at most one coupon-code Promotion per Order and stores the applied discount as an Order snapshot.
_Avoid_: Price override
