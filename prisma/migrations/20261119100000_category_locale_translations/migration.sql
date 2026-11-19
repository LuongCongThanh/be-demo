-- Stop all legacy application/worker writers before applying this migration.
-- Legacy columns remain for an eventual consumer cleanup, but are no longer written.
ALTER TABLE categories ADD COLUMN source_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE category_translations (
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE ON UPDATE CASCADE,
  locale VARCHAR(35) NOT NULL,
  name VARCHAR(150),
  status "CategoryTranslationStatus" NOT NULL DEFAULT 'PENDING',
  source_version INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0,
  lease_until TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  PRIMARY KEY (category_id, locale)
);
CREATE INDEX category_translations_queue_idx
  ON category_translations(locale, status, lease_until, created_at, category_id);
-- Copy every category, including untranslated/null and retained failed/manual names.
-- Never reuse an old worker's lease; the new queue can safely reclaim pending work.
INSERT INTO category_translations
  (category_id, locale, name, status, source_version, revision, lease_until, created_at, updated_at)
SELECT id, 'en', name_en, translation_status, 0, translation_version, NULL, created_at, updated_at
FROM categories;
