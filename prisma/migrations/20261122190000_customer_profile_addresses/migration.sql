ALTER TABLE users
  ADD COLUMN interface_locale VARCHAR(2) NOT NULL DEFAULT 'vi',
  ADD COLUMN email_locale VARCHAR(2) NOT NULL DEFAULT 'vi',
  ADD COLUMN google_subject VARCHAR(255),
  ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN failed_login_started_at TIMESTAMPTZ(6),
  ADD COLUMN locked_until TIMESTAMPTZ(6),
  ADD COLUMN lock_cycles_24h INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN lock_cycles_started_at TIMESTAMPTZ(6);

CREATE UNIQUE INDEX users_google_subject_key ON users(google_subject);

ALTER TABLE users
  ADD CONSTRAINT users_interface_locale_check CHECK (interface_locale IN ('vi', 'en')),
  ADD CONSTRAINT users_email_locale_check CHECK (email_locale IN ('vi', 'en'));

CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  province_code VARCHAR(20) NOT NULL,
  province_name VARCHAR(255) NOT NULL,
  ward_code VARCHAR(20) NOT NULL,
  ward_name VARCHAR(255) NOT NULL,
  address_line VARCHAR(500) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT customer_addresses_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX customer_addresses_user_default_idx ON customer_addresses(user_id, is_default);
