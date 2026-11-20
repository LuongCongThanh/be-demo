import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';
import { expect, it } from 'vitest';

it('preserves all legacy English editorial states and category identity during the additive migration', async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const schema = `migration_category_${Date.now()}`;
  try {
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`SET search_path TO ${schema}`);
    const migrations = (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort();
    const target = '20261119100000_category_locale_translations';
    for (const migration of migrations.filter((name) => name < target)) {
      await db.query(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
    }
    const states = ['PENDING', 'TRANSLATED', 'MANUAL', 'REVIEW', 'FAILED'];
    for (const [index, state] of states.entries()) {
      await db.query(
        `INSERT INTO categories
        (id, name, slug, name_en, translation_status, translation_version, translation_lease_until,
         sort_order, is_visible, thumbnail_storage_key, banner_storage_key, updated_at)
        VALUES ($1, $2, $3, $4, $5, 7, now() + interval '1 minute', 4, false, 'thumb', 'banner', now())`,
        [
          `00000000-0000-0000-0000-00000000000${index}`,
          `Tên ${index}`,
          `stable-${index}`,
          state === 'PENDING' ? null : `English ${state}`,
          state,
        ],
      );
    }
    await db.query(`UPDATE categories SET parent_id = '00000000-0000-0000-0000-000000000000' WHERE slug = 'stable-1'`);
    await db.query(await readFile(`prisma/migrations/${target}/migration.sql`, 'utf8'));
    const { rows } = await db.query(`SELECT c.id, c.parent_id, c.name, c.slug, c.sort_order, c.is_visible,
      c.thumbnail_storage_key, c.banner_storage_key, c.source_version,
      t.locale, t.name AS translated_name, t.status, t.source_version AS translated_version, t.revision, t.lease_until
      FROM categories c JOIN category_translations t ON t.category_id = c.id ORDER BY c.id`);
    expect(rows).toHaveLength(5);
    for (const [index, state] of states.entries()) {
      expect(rows[index]).toEqual({
        id: `00000000-0000-0000-0000-00000000000${index}`,
        parent_id: index === 1 ? '00000000-0000-0000-0000-000000000000' : null,
        name: `Tên ${index}`,
        slug: `stable-${index}`,
        sort_order: 4,
        is_visible: false,
        thumbnail_storage_key: 'thumb',
        banner_storage_key: 'banner',
        source_version: 0,
        locale: 'en',
        translated_name: state === 'PENDING' ? null : `English ${state}`,
        status: state,
        translated_version: 0,
        revision: 7,
        lease_until: null,
      });
    }
    await expect(
      db.query(`INSERT INTO category_translations (category_id, locale, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000000', 'en', now())`),
    ).rejects.toMatchObject({ code: '23505' });
  } finally {
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
    await db.end();
  }
});
