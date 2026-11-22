CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY,
  variant_id UUID NOT NULL,
  actor_user_id UUID NOT NULL,
  reason VARCHAR(500) NOT NULL,
  quantity_delta INTEGER NOT NULL,
  before_quantity INTEGER NOT NULL,
  after_quantity INTEGER NOT NULL,
  before_reserved INTEGER NOT NULL,
  after_reserved INTEGER NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inventory_movements_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT inventory_movements_actor_fk FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT inventory_movements_quantity_check CHECK (before_quantity >= 0 AND after_quantity >= 0)
);

CREATE INDEX inventory_movements_variant_created_idx ON inventory_movements(variant_id, created_at DESC);

CREATE TABLE inventory_stock_counts (
  id UUID PRIMARY KEY,
  variant_id UUID NOT NULL,
  actor_user_id UUID NOT NULL,
  physical_count INTEGER NOT NULL,
  on_shelf_at_count INTEGER NOT NULL,
  awaiting_at_count INTEGER NOT NULL,
  discrepancy INTEGER NOT NULL,
  confirmed_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inventory_stock_counts_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT inventory_stock_counts_actor_fk FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT inventory_stock_counts_physical_check CHECK (physical_count >= 0)
);

CREATE INDEX inventory_stock_counts_variant_created_idx ON inventory_stock_counts(variant_id, created_at DESC);
