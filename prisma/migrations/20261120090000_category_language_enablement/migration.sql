CREATE TABLE category_languages (
  locale VARCHAR(35) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  generation INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL
);

INSERT INTO category_languages (locale, name, enabled, generation, updated_at)
VALUES
  ('vi', 'Tieng Viet', TRUE, 0, CURRENT_TIMESTAMP),
  ('en', 'English', TRUE, 0, CURRENT_TIMESTAMP),
  ('th', 'Thai', FALSE, 0, CURRENT_TIMESTAMP),
  ('ja', 'Japanese', FALSE, 0, CURRENT_TIMESTAMP),
  ('ko', 'Korean', FALSE, 0, CURRENT_TIMESTAMP),
  ('zh-CN', 'Chinese (Simplified)', FALSE, 0, CURRENT_TIMESTAMP),
  ('fr', 'French', FALSE, 0, CURRENT_TIMESTAMP),
  ('de', 'German', FALSE, 0, CURRENT_TIMESTAMP),
  ('es', 'Spanish', FALSE, 0, CURRENT_TIMESTAMP)
ON CONFLICT (locale) DO UPDATE SET
  name = EXCLUDED.name,
  enabled = CASE WHEN category_languages.locale IN ('vi', 'en') THEN TRUE ELSE category_languages.enabled END;

ALTER TABLE category_translations
  ADD COLUMN enable_generation INTEGER NOT NULL DEFAULT 0;
