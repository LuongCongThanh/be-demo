ALTER TABLE carts
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN session_id VARCHAR(64),
  ADD COLUMN expires_at TIMESTAMPTZ(6);

CREATE UNIQUE INDEX carts_session_id_key ON carts(session_id);
CREATE INDEX carts_guest_expiry_idx ON carts(status, expires_at);

ALTER TABLE carts
  ADD CONSTRAINT carts_owner_check CHECK ((user_id IS NOT NULL) <> (session_id IS NOT NULL));

ALTER TABLE cart_items
  ADD COLUMN price_snapshot BIGINT;

CREATE UNIQUE INDEX cart_items_cart_variant_key ON cart_items(cart_id, variant_id);

ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_quantity_check CHECK (quantity >= 1 AND quantity <= 10);

ALTER TYPE "CartStatus" ADD VALUE IF NOT EXISTS 'MERGED';
