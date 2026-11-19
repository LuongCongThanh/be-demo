CREATE TYPE "CategoryTranslationStatus" AS ENUM ('PENDING', 'TRANSLATED', 'MANUAL', 'REVIEW', 'FAILED');
ALTER TABLE categories
  ADD COLUMN name_en VARCHAR(150),
  ADD COLUMN translation_status "CategoryTranslationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN translation_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN translation_lease_until TIMESTAMPTZ(6),
  ADD COLUMN thumbnail_storage_key TEXT,
  ADD COLUMN banner_storage_key TEXT;
CREATE INDEX categories_translation_status_translation_lease_until_idx
  ON categories(translation_status, translation_lease_until);
