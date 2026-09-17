# Category delete requires reassigning products first

Context: `categories` MVP needs a delete endpoint, but `products.category_id → categories.id` has no cascade behavior defined for this case. We considered three options: (A) `ON DELETE CASCADE` — deletes the category's products too, which risks destroying products whose variants already sold in an Order; (B) `ON DELETE SET NULL` — makes `category_id` nullable and introduces an "uncategorized" product state that every listing/filter has to handle; (C) keep the DB FK as `RESTRICT` and have `CategoriesService.remove()` check for existing products first, returning a 409 with the count instead of letting a raw FK violation surface.

Decided: **(C)**. It reuses the FK behavior already implied by the DB summary doc (`orders.user_id` is `RESTRICT` for the same "don't destroy referenced data" reason), avoids inventing an "uncategorized" product concept, and gives the admin a clear, actionable error instead of a 500.

Consequence: deleting a category with products always fails until an admin reassigns those products to another category first — there is no bulk/cascade delete path for categories in this MVP.
