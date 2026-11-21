import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { PasswordService } from '#src/modules/identity/auth/services/shared/password.service.js';
import type { AccountType } from '#src/generated/prisma/enums.js';
import { CategoryTranslationClient } from '#src/modules/catalog/category/clients/category-translation.client.js';
import { CategoryTranslationService } from '#src/modules/catalog/category/services/shared/category-translation.service.js';
import { createTestUser } from '../../support/create-test-user.js';
import { createTestApp } from '../../support/create-test-app.js';

// Prefix cố định cho mọi category tạo trong file này — dùng để cleanup ở
// afterAll (startsWith), tránh category test cộng dồn qua các lần chạy.
const TEST_NAME_PREFIX = 'CategoriesAdminE2E';
const TEST_EMAIL_DOMAIN = '@categories-admin.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';
const TEST_LOCALES = ['fr', 'de', 'es'] as const;
const fakeTranslator = {
  enabled: false,
  translate: vi.fn(async (name: string, locale = 'en') => `${locale}: ${name}`),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Categories — Admin CMS (e2e)', () => {
  let app: INestApplication;

  let prisma: PrismaService;

  let passwordService: PasswordService;

  let adminToken: string;

  let staffToken: string;

  let customerToken: string;

  beforeAll(async () => {
    const created = await createTestApp({ categoryTranslationClient: fakeTranslator });
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);
    adminToken = await tokenFor('ADMIN');
    staffToken = await tokenFor('STAFF');
    customerToken = await tokenFor('CUSTOMER');
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { category: { name: { startsWith: TEST_NAME_PREFIX } } } });
    // FK parent_id RESTRICT: xoá lá trước, lặp tới khi hết.
    for (let i = 0; i < 10; i++) {
      const { count } = await prisma.category.deleteMany({
        where: { name: { startsWith: TEST_NAME_PREFIX }, children: { none: {} } },
      });
      if (count === 0) break;
    }
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  const server = () => app.getHttpServer();

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let seq = 0;

  const unique = (label: string) => `${TEST_NAME_PREFIX} ${label} ${Date.now()}-${seq++}`;

  async function withTestLocales(run: () => Promise<void>) {
    const originalLanguages = await prisma.categoryLanguage.findMany({
      where: { locale: { in: [...TEST_LOCALES] } },
    });
    const originalTranslations = await prisma.categoryTranslation.findMany({
      where: { locale: { in: [...TEST_LOCALES] } },
    });

    try {
      await prisma.categoryTranslation.deleteMany({ where: { locale: { in: [...TEST_LOCALES] } } });
      await prisma.categoryLanguage.deleteMany({ where: { locale: { in: [...TEST_LOCALES] } } });
      await prisma.categoryLanguage.createMany({
        data: TEST_LOCALES.map((locale) => ({ locale, name: locale, enabled: false })),
      });
      await Promise.all(
        TEST_LOCALES.map((locale) =>
          request(server()).patch(`/api/v1/admin/languages/${locale}`).set(auth(adminToken)).send({ enabled: true }),
        ),
      ).then((responses) => {
        for (const response of responses) {
          expect(response.status, JSON.stringify(response.body)).toBe(200);
        }
      });
      await run();
    } finally {
      fakeTranslator.enabled = false;
      fakeTranslator.translate.mockReset();
      fakeTranslator.translate.mockImplementation(async (name: string, locale = 'en') => `${locale}: ${name}`);
      await prisma.categoryTranslation.deleteMany({ where: { locale: { in: [...TEST_LOCALES] } } });
      await prisma.categoryLanguage.deleteMany({ where: { locale: { in: [...TEST_LOCALES] } } });
      if (originalTranslations.length) {
        await prisma.categoryTranslation.createMany({ data: originalTranslations });
      }
      if (originalLanguages.length) {
        await prisma.categoryLanguage.createMany({ data: originalLanguages });
      }
    }
  }

  async function tokenFor(role: AccountType): Promise<string> {
    const user = await createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix: `${role.toLowerCase()}-`,
      passwordHash: await passwordService.hash(VALID_PASSWORD),
      role,
      emailVerifiedAt: new Date(),
    });
    const res = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: VALID_PASSWORD })
      .expect(200);
    return res.body.accessToken;
  }

  async function createCategory(body: Record<string, unknown> = {}) {
    const res = await request(server())
      .post('/api/v1/admin/categories')
      .set(auth(adminToken))
      .send({ name: unique('Cat'), ...body })
      .expect(201);
    return res.body as {
      id: string;
      slug: string;
      name: string;
      parentId: string | null;
      sortOrder: number;
      isVisible: boolean;
    };
  }

  const patch = (id: string, body: Record<string, unknown>) =>
    request(server()).patch(`/api/v1/admin/categories/${id}`).set(auth(adminToken)).send(body);

  const remove = (id: string) => request(server()).delete(`/api/v1/admin/categories/${id}`).set(auth(adminToken));

  describe('tree structure', () => {
    it('creates root and child categories with defaults', async () => {
      const root = await createCategory();
      const child = await createCategory({ parentId: root.id });

      expect(root).toMatchObject({ parentId: null, sortOrder: 0, isVisible: true });
      expect(child.parentId).toBe(root.id);
    });

    it('a non-existent parent returns 404', async () => {
      await request(server())
        .post('/api/v1/admin/categories')
        .set(auth(adminToken))
        .send({ name: unique('Orphan'), parentId: MISSING_ID })
        .expect(404);
    });

    it('moves a category to another parent and back to root', async () => {
      const a = await createCategory();
      const b = await createCategory();
      const c = await createCategory({ parentId: a.id });

      expect((await patch(c.id, { parentId: b.id }).expect(200)).body.parentId).toBe(b.id);
      expect((await patch(c.id, { parentId: null }).expect(200)).body.parentId).toBeNull();
    });

    it('rejects making a category its own parent (400)', async () => {
      const a = await createCategory();
      await patch(a.id, { parentId: a.id }).expect(400);
    });

    it('rejects a cycle A → B → A and a deeper descendant cycle (400)', async () => {
      const a = await createCategory();
      const b = await createCategory({ parentId: a.id });
      const c = await createCategory({ parentId: b.id });

      await patch(a.id, { parentId: b.id }).expect(400);
      await patch(a.id, { parentId: c.id }).expect(400);
    });
  });

  describe('category language lifecycle', () => {
    it('serializes locale enablement with category creation and resumes durable translation work', async () => {
      const originalLanguages = await prisma.categoryLanguage.findMany({
        where: { locale: { in: [...TEST_LOCALES] } },
      });
      const originalTranslations = await prisma.categoryTranslation.findMany({
        where: { locale: { in: [...TEST_LOCALES] } },
      });

      try {
        await prisma.categoryTranslation.deleteMany({ where: { locale: { in: [...TEST_LOCALES] } } });
        await prisma.categoryLanguage.deleteMany({ where: { locale: { in: [...TEST_LOCALES] } } });
        await prisma.categoryLanguage.createMany({
          data: TEST_LOCALES.map((locale) => ({ locale, name: locale, enabled: false })),
        });

        const categoryPromise = createCategory();
        const enablementResponses = await Promise.all(
          TEST_LOCALES.map((locale) =>
            request(server()).patch(`/api/v1/admin/languages/${locale}`).set(auth(adminToken)).send({ enabled: true }),
          ),
        );
        for (const response of enablementResponses) {
          expect(response.status, JSON.stringify(response.body)).toBe(200);
        }
        const category = await categoryPromise;

        const translations = await prisma.categoryTranslation.findMany({
          where: { categoryId: category.id, locale: { in: [...TEST_LOCALES] } },
        });
        expect(translations).toHaveLength(TEST_LOCALES.length);
        expect(translations.every((translation) => translation.status === 'PENDING')).toBe(true);

        const fallback = await request(server()).get(`/api/v1/categories/${category.id}?locale=fr`).expect(200);
        expect(fallback.body).toMatchObject({ id: category.id, slug: category.slug, name: category.name });
        await request(server()).get('/api/v1/categories?locale=invalid').expect(400);

        const adminLanguages = await request(server()).get('/api/v1/admin/languages').set(auth(staffToken)).expect(200);
        const testLocales = new Set<string>(TEST_LOCALES);
        expect(
          adminLanguages.body.filter((language: { locale: string }) => testLocales.has(language.locale)),
        ).toHaveLength(TEST_LOCALES.length);
        const publicLanguages = await request(server()).get('/api/v1/languages').expect(200);
        expect(publicLanguages.body.map((language: { locale: string }) => language.locale)).toEqual(
          expect.arrayContaining([...TEST_LOCALES]),
        );
        await request(server())
          .patch('/api/v1/admin/languages/fr')
          .set(auth(staffToken))
          .send({ enabled: false })
          .expect(403);
        await request(server())
          .patch('/api/v1/admin/languages/invalid')
          .set(auth(adminToken))
          .send({ enabled: true })
          .expect(400);
        await request(server())
          .patch('/api/v1/admin/languages/vi')
          .set(auth(adminToken))
          .send({ enabled: false })
          .expect(400);

        fakeTranslator.enabled = true;
        fakeTranslator.translate.mockClear();
        const worker = new CategoryTranslationService(prisma, app.get(CategoryTranslationClient));
        let translatedRows = translations;
        for (let attempt = 0; attempt < 30; attempt++) {
          await worker.tick();
          translatedRows = await prisma.categoryTranslation.findMany({
            where: { categoryId: category.id, locale: { in: [...TEST_LOCALES] } },
          });
          if (
            translatedRows.length === TEST_LOCALES.length &&
            translatedRows.every((translation) => translation.status === 'TRANSLATED')
          )
            break;
        }
        expect(translatedRows).toHaveLength(TEST_LOCALES.length);
        expect(translatedRows.every((translation) => translation.status === 'TRANSLATED')).toBe(true);
        for (const locale of TEST_LOCALES) {
          expect(fakeTranslator.translate).toHaveBeenCalledWith(category.name, locale);
        }
        const translatedPublic = await request(server()).get(`/api/v1/categories/${category.id}?locale=fr`).expect(200);
        expect(translatedPublic.body.name).toBe(`fr: ${category.name}`);

        const manualFrenchName = 'Boutique française';
        const reviewedGermanName = 'Zu prüfen';
        const translatedSpanishName = translatedRows.find((translation) => translation.locale === 'es')?.name;
        await prisma.categoryTranslation.update({
          where: { categoryId_locale: { categoryId: category.id, locale: 'fr' } },
          data: { name: manualFrenchName, status: 'MANUAL' },
        });
        await prisma.categoryTranslation.update({
          where: { categoryId_locale: { categoryId: category.id, locale: 'de' } },
          data: { name: reviewedGermanName, status: 'REVIEW' },
        });
        await Promise.all(
          TEST_LOCALES.map((locale) =>
            request(server())
              .patch(`/api/v1/admin/languages/${locale}`)
              .set(auth(adminToken))
              .send({ enabled: false })
              .expect(200),
          ),
        );
        const disabledPublicLanguages = await request(server()).get('/api/v1/languages').expect(200);
        expect(disabledPublicLanguages.body.map((language: { locale: string }) => language.locale)).not.toContain('fr');
        await request(server()).get(`/api/v1/categories/${category.id}?locale=fr`).expect(400);
        expect(
          await prisma.categoryTranslation.findUnique({
            where: { categoryId_locale: { categoryId: category.id, locale: 'fr' } },
          }),
        ).toMatchObject({ name: manualFrenchName, status: 'MANUAL' });
        expect(
          await prisma.categoryTranslation.findUnique({
            where: { categoryId_locale: { categoryId: category.id, locale: 'de' } },
          }),
        ).toMatchObject({ name: reviewedGermanName, status: 'REVIEW' });
        expect(
          await prisma.categoryTranslation.findUnique({
            where: { categoryId_locale: { categoryId: category.id, locale: 'es' } },
          }),
        ).toMatchObject({ name: translatedSpanishName, status: 'TRANSLATED' });

        await Promise.all(
          TEST_LOCALES.map((locale) =>
            request(server())
              .patch(`/api/v1/admin/languages/${locale}`)
              .set(auth(adminToken))
              .send({ enabled: true })
              .expect(200),
          ),
        );
        expect(
          await prisma.categoryTranslation.findUnique({
            where: { categoryId_locale: { categoryId: category.id, locale: 'fr' } },
          }),
        ).toMatchObject({ name: manualFrenchName, status: 'MANUAL' });
        expect(
          await prisma.categoryTranslation.findUnique({
            where: { categoryId_locale: { categoryId: category.id, locale: 'de' } },
          }),
        ).toMatchObject({ name: reviewedGermanName, status: 'REVIEW' });
        expect(
          await prisma.categoryTranslation.findUnique({
            where: { categoryId_locale: { categoryId: category.id, locale: 'es' } },
          }),
        ).toMatchObject({ name: translatedSpanishName, status: 'PENDING' });
        const generation = (await prisma.categoryLanguage.findUnique({ where: { locale: 'fr' } }))?.generation;
        await request(server())
          .patch('/api/v1/admin/languages/fr')
          .set(auth(adminToken))
          .send({ enabled: true })
          .expect(200);
        expect((await prisma.categoryLanguage.findUnique({ where: { locale: 'fr' } }))?.generation).toBe(generation);
        expect(
          await prisma.categoryTranslation.count({
            where: { categoryId: category.id, locale: { in: [...TEST_LOCALES] } },
          }),
        ).toBe(TEST_LOCALES.length);

        const renamedName = unique('Renamed');
        const renamedCategory = await patch(category.id, { name: renamedName }).expect(200);
        expect(renamedCategory.body.name).toBe(renamedName);
        expect(
          await prisma.categoryTranslation.findUnique({
            where: { categoryId_locale: { categoryId: category.id, locale: 'fr' } },
          }),
        ).toMatchObject({ name: manualFrenchName, status: 'REVIEW' });
        expect(
          await prisma.categoryTranslation.findUnique({
            where: { categoryId_locale: { categoryId: category.id, locale: 'de' } },
          }),
        ).toMatchObject({ name: reviewedGermanName, status: 'REVIEW' });
        expect(
          await prisma.categoryTranslation.findUnique({
            where: { categoryId_locale: { categoryId: category.id, locale: 'es' } },
          }),
        ).toMatchObject({ name: null, status: 'PENDING' });

        const resumedWorker = new CategoryTranslationService(prisma, app.get(CategoryTranslationClient));
        let resumedTranslation = await prisma.categoryTranslation.findUnique({
          where: { categoryId_locale: { categoryId: category.id, locale: 'es' } },
        });
        for (let attempt = 0; attempt < 30 && resumedTranslation?.status !== 'TRANSLATED'; attempt++) {
          await resumedWorker.tick();
          resumedTranslation = await prisma.categoryTranslation.findUnique({
            where: { categoryId_locale: { categoryId: category.id, locale: 'es' } },
          });
        }
        expect(resumedTranslation).toMatchObject({ status: 'TRANSLATED' });
        expect(fakeTranslator.translate).toHaveBeenCalledWith(renamedName, 'es');
      } finally {
        fakeTranslator.enabled = false;
        await prisma.categoryTranslation.deleteMany({ where: { locale: { in: [...TEST_LOCALES] } } });
        await prisma.categoryLanguage.deleteMany({ where: { locale: { in: [...TEST_LOCALES] } } });
        if (originalTranslations.length) {
          await prisma.categoryTranslation.createMany({ data: originalTranslations });
        }
        if (originalLanguages.length) {
          await prisma.categoryLanguage.createMany({ data: originalLanguages });
        }
      }
    });
  });

  describe('per-locale editorial translations', () => {
    it('reads and edits one locale independently, preserves legacy English, and retries explicitly', async () => {
      await withTestLocales(async () => {
        const category = await createCategory();
        await prisma.categoryTranslation.updateMany({
          where: { categoryId: category.id, locale: { in: [...TEST_LOCALES] } },
          data: { createdAt: new Date(0) },
        });
        fakeTranslator.enabled = true;
        const worker = new CategoryTranslationService(prisma, app.get(CategoryTranslationClient));
        for (let attempt = 0; attempt < 3; attempt++) {
          await worker.tick();
        }

        const translationsPath = `/api/v1/admin/categories/${category.id}/translations`;
        const listed = await request(server()).get(translationsPath).set(auth(staffToken)).expect(200);
        expect(listed.body.map((translation: { locale: string }) => translation.locale)).toEqual([
          'de',
          'en',
          'es',
          'fr',
        ]);
        expect(listed.body[0]).toMatchObject({ locale: 'de', status: 'TRANSLATED' });
        expect(listed.body[0]).not.toHaveProperty('revision');
        expect(listed.body[0]).not.toHaveProperty('leaseUntil');

        await request(server()).get(translationsPath).set(auth(customerToken)).expect(403);
        await request(server())
          .patch(`${translationsPath}/fr`)
          .set(auth(staffToken))
          .send({ name: 'no permission' })
          .expect(403);
        await request(server())
          .get(`/api/v1/admin/categories/${MISSING_ID}/translations`)
          .set(auth(staffToken))
          .expect(404);

        const germanBefore = await prisma.categoryTranslation.findUniqueOrThrow({
          where: { categoryId_locale: { categoryId: category.id, locale: 'de' } },
        });
        const french = await request(server())
          .patch(`${translationsPath}/fr`)
          .set(auth(adminToken))
          .send({ name: '  Collection française  ' })
          .expect(200);
        expect(french.body).toMatchObject({ locale: 'fr', name: 'Collection française', status: 'MANUAL' });
        const germanAfter = await prisma.categoryTranslation.findUniqueOrThrow({
          where: { categoryId_locale: { categoryId: category.id, locale: 'de' } },
        });
        expect(germanAfter).toMatchObject({
          name: germanBefore.name,
          status: germanBefore.status,
          revision: germanBefore.revision,
        });

        await request(server()).patch(`${translationsPath}/fr`).set(auth(adminToken)).send({}).expect(400);
        await request(server()).patch(`${translationsPath}/fr`).set(auth(adminToken)).send({ name: '   ' }).expect(400);
        await request(server())
          .patch(`${translationsPath}/invalid`)
          .set(auth(adminToken))
          .send({ name: 'Invalid locale' })
          .expect(400);
        await request(server())
          .patch(`${translationsPath}/vi`)
          .set(auth(adminToken))
          .send({ name: 'Cannot override source' })
          .expect(400);

        const german = await request(server())
          .patch(`${translationsPath}/de`)
          .set(auth(adminToken))
          .send({ name: null })
          .expect(200);
        expect(german.body).toMatchObject({ locale: 'de', name: null, status: 'PENDING' });
        const frenchRetry = await request(server())
          .post(`${translationsPath}/fr/retry`)
          .set(auth(adminToken))
          .expect(200);
        expect(frenchRetry.body).toMatchObject({
          locale: 'fr',
          name: 'Collection française',
          status: 'PENDING',
        });

        const englishOverride = await request(server())
          .patch(`/api/v1/admin/categories/${category.id}`)
          .set(auth(adminToken))
          .send({ nameEn: 'Legacy English' })
          .expect(200);
        expect(englishOverride.body).toMatchObject({ nameEn: 'Legacy English', translationStatus: 'MANUAL' });
        expect(
          await prisma.categoryTranslation.findUniqueOrThrow({
            where: { categoryId_locale: { categoryId: category.id, locale: 'en' } },
          }),
        ).toMatchObject({ name: 'Legacy English', status: 'MANUAL' });
        await request(server())
          .post(`/api/v1/admin/categories/${category.id}/translation/retry`)
          .set(auth(adminToken))
          .expect(200);
        expect(
          await prisma.categoryTranslation.findUniqueOrThrow({
            where: { categoryId_locale: { categoryId: category.id, locale: 'en' } },
          }),
        ).toMatchObject({ name: 'Legacy English', status: 'PENDING' });

        await request(server())
          .patch(`${translationsPath}/fr`)
          .set(auth(adminToken))
          .send({ name: 'Boutique française' })
          .expect(200);
        const renamedName = unique('Editorial Rename');
        await request(server())
          .patch(`/api/v1/admin/categories/${category.id}`)
          .set(auth(adminToken))
          .send({ name: renamedName })
          .expect(200);
        expect(
          await prisma.categoryTranslation.findUniqueOrThrow({
            where: { categoryId_locale: { categoryId: category.id, locale: 'fr' } },
          }),
        ).toMatchObject({ name: 'Boutique française', status: 'REVIEW' });
        expect(
          await prisma.categoryTranslation.findUniqueOrThrow({
            where: { categoryId_locale: { categoryId: category.id, locale: 'en' } },
          }),
        ).toMatchObject({ name: null, status: 'PENDING' });
        expect(
          await prisma.categoryTranslation.findUniqueOrThrow({
            where: { categoryId_locale: { categoryId: category.id, locale: 'de' } },
          }),
        ).toMatchObject({ name: null, status: 'PENDING' });

        await request(server()).post(`${translationsPath}/fr/retry`).set(auth(adminToken)).expect(200);
        await prisma.categoryTranslation.update({
          where: { categoryId_locale: { categoryId: category.id, locale: 'fr' } },
          data: { createdAt: new Date(0) },
        });
        for (let attempt = 0; attempt < 3; attempt++) {
          await worker.tick();
        }
        expect(
          await prisma.categoryTranslation.findUniqueOrThrow({
            where: { categoryId_locale: { categoryId: category.id, locale: 'fr' } },
          }),
        ).toMatchObject({ name: `fr: ${renamedName}`, status: 'TRANSLATED' });

        await request(server())
          .patch('/api/v1/admin/languages/fr')
          .set(auth(adminToken))
          .send({ enabled: false })
          .expect(200);
        await request(server())
          .patch(`${translationsPath}/fr`)
          .set(auth(adminToken))
          .send({ name: 'Disabled locale' })
          .expect(400);
        await request(server()).post(`${translationsPath}/missing-locale/retry`).set(auth(adminToken)).expect(400);
      });
    });

    it('rejects stale PostgreSQL worker results after manual edit, rename, retry, disable, and delete', async () => {
      await withTestLocales(async () => {
        fakeTranslator.enabled = true;

        async function raceWorkerResult(
          categoryId: string,
          categoryName: string,
          locale: (typeof TEST_LOCALES)[number],
          change: () => Promise<void>,
          assertResult: () => Promise<void>,
          testTwoWorkers = false,
        ) {
          await prisma.categoryTranslation.update({
            where: { categoryId_locale: { categoryId, locale } },
            data: { createdAt: new Date(0) },
          });
          const started = deferred<void>();
          const result = deferred<string>();
          fakeTranslator.translate.mockReset();
          fakeTranslator.translate.mockImplementation(async (name: string, targetLocale = 'en') => {
            if (name === categoryName && targetLocale === locale) {
              started.resolve();
              return result.promise;
            }
            return `${targetLocale}: ${name}`;
          });

          const worker = new CategoryTranslationService(prisma, app.get(CategoryTranslationClient));
          const tick = worker.tick();
          await started.promise;
          try {
            if (testTwoWorkers) {
              await new CategoryTranslationService(prisma, app.get(CategoryTranslationClient)).tick();
              expect(
                fakeTranslator.translate.mock.calls.filter(
                  ([name, targetLocale]) => name === categoryName && targetLocale === locale,
                ),
              ).toHaveLength(1);
            }
            await change();
          } finally {
            result.resolve('Stale provider result');
            await tick;
          }
          await assertResult();
        }

        const manualCategory = await createCategory();
        await raceWorkerResult(
          manualCategory.id,
          manualCategory.name,
          'fr',
          async () => {
            await request(server())
              .patch(`/api/v1/admin/categories/${manualCategory.id}/translations/fr`)
              .set(auth(adminToken))
              .send({ name: 'Manual wins' })
              .expect(200);
          },
          async () => {
            expect(
              await prisma.categoryTranslation.findUniqueOrThrow({
                where: { categoryId_locale: { categoryId: manualCategory.id, locale: 'fr' } },
              }),
            ).toMatchObject({ name: 'Manual wins', status: 'MANUAL' });
          },
          true,
        );

        const renameCategory = await createCategory();
        const renamedName = unique('Race Rename');
        await raceWorkerResult(
          renameCategory.id,
          renameCategory.name,
          'de',
          async () => {
            await patch(renameCategory.id, { name: renamedName }).expect(200);
          },
          async () => {
            expect(
              await prisma.categoryTranslation.findUniqueOrThrow({
                where: { categoryId_locale: { categoryId: renameCategory.id, locale: 'de' } },
              }),
            ).toMatchObject({ name: null, status: 'PENDING' });
          },
        );

        const retryCategory = await createCategory();
        await raceWorkerResult(
          retryCategory.id,
          retryCategory.name,
          'es',
          async () => {
            await request(server())
              .post(`/api/v1/admin/categories/${retryCategory.id}/translations/es/retry`)
              .set(auth(adminToken))
              .expect(200);
          },
          async () => {
            expect(
              await prisma.categoryTranslation.findUniqueOrThrow({
                where: { categoryId_locale: { categoryId: retryCategory.id, locale: 'es' } },
              }),
            ).toMatchObject({ name: null, status: 'PENDING' });
          },
        );

        const disableCategory = await createCategory();
        await raceWorkerResult(
          disableCategory.id,
          disableCategory.name,
          'fr',
          async () => {
            await request(server())
              .patch('/api/v1/admin/languages/fr')
              .set(auth(adminToken))
              .send({ enabled: false })
              .expect(200);
          },
          async () => {
            expect(
              await prisma.categoryTranslation.findUniqueOrThrow({
                where: { categoryId_locale: { categoryId: disableCategory.id, locale: 'fr' } },
              }),
            ).toMatchObject({ name: null, status: 'PENDING' });
            await request(server())
              .patch('/api/v1/admin/languages/fr')
              .set(auth(adminToken))
              .send({ enabled: true })
              .expect(200);
          },
        );

        const deleteCategory = await createCategory();
        await raceWorkerResult(
          deleteCategory.id,
          deleteCategory.name,
          'de',
          async () => {
            await remove(deleteCategory.id).expect(204);
          },
          async () => {
            expect(
              await prisma.categoryTranslation.findUnique({
                where: { categoryId_locale: { categoryId: deleteCategory.id, locale: 'de' } },
              }),
            ).toBeNull();
          },
        );
      });
    }, 30_000);
  });

  describe('back-office listing', () => {
    it('lists every category flat, including hidden ones, with parentId/isVisible/sortOrder', async () => {
      const root = await createCategory();
      const hidden = await createCategory({ parentId: root.id, isVisible: false, sortOrder: 5 });

      for (const token of [staffToken, adminToken]) {
        const res = await request(server()).get('/api/v1/admin/categories?limit=100').set(auth(token)).expect(200);
        expect(res.body).toHaveProperty('meta.total');
        // Có thể đã nằm ở trang sau nếu DB dev có nhiều category; tra trực tiếp theo id.
        const detail = await request(server())
          .get(`/api/v1/admin/categories/${hidden.id}`)
          .set(auth(token))
          .expect(200);
        expect(detail.body).toMatchObject({ parentId: root.id, isVisible: false, sortOrder: 5 });
      }
    });

    it('CUSTOMER gets 403 on the admin listing', async () => {
      await request(server()).get('/api/v1/admin/categories').set(auth(customerToken)).expect(403);
    });
  });

  describe('delete (ADR 0001)', () => {
    it('deleting a category with children returns 409', async () => {
      const parent = await createCategory();
      await createCategory({ parentId: parent.id });
      await remove(parent.id).expect(409);
    });

    it('deleting a category with products returns 409, whatever the product status', async () => {
      const category = await createCategory();
      await prisma.product.create({
        data: {
          categoryId: category.id,
          name: unique('Product'),
          slug: `categories-e2e-product-${Date.now()}-${seq++}`,
          weightGrams: 100,
          gender: 'UNISEX',
          status: 'ARCHIVED',
        },
      });
      await remove(category.id).expect(409);
    });

    it('deleting an empty leaf succeeds', async () => {
      const parent = await createCategory();
      const leaf = await createCategory({ parentId: parent.id });
      await remove(leaf.id).expect(204);
      await remove(parent.id).expect(204);
    });

    it('the DB refuses to delete a parent directly (FK RESTRICT)', async () => {
      const parent = await createCategory();
      await createCategory({ parentId: parent.id });
      await expect(prisma.category.delete({ where: { id: parent.id } })).rejects.toMatchObject({ code: 'P2003' });
    });
  });
});
