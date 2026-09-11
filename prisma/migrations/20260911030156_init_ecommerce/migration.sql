CREATE UNIQUE INDEX "carts_user_id_active_unique"
    ON "carts" ("user_id") WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "product_images_product_id_primary_unique"
    ON "product_images" ("product_id") WHERE "is_primary" = true;
