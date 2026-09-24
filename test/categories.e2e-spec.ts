import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { PasswordService } from '@src/auth/services/password.service.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

// Prefix cố định cho mọi category tạo trong file này — dùng để cleanup ở
// afterAll (startsWith), tránh category test cộng dồn vĩnh viễn qua các lần chạy.
const TEST_NAME_PREFIX = 'CategoriesE2E';
const TEST_EMAIL_DOMAIN = '@categories.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

describe('Categories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let masterAdminAccessToken: string;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);

    await prisma.role.upsert({
      where: { name: 'CUSTOMER' },
      update: {},
      create: { name: 'CUSTOMER' },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.ADMIN_BOOTSTRAP_EMAIL,
        password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
      })
      .expect(200);

    masterAdminAccessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    // FK product.categoryId → category.id: xoá product trước category.
    await prisma.product.deleteMany({ where: { category: { name: { startsWith: TEST_NAME_PREFIX } } } });
    await prisma.category.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  async function createCustomerAndLogin(): Promise<string> {
    const passwordHash = await passwordService.hash(VALID_PASSWORD);
    const user = await createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix: 'customer-',
      passwordHash,
      emailVerifiedAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: VALID_PASSWORD })
      .expect(200);

    return res.body.accessToken;
  }

  it('POST /api/v1/categories without a Bearer token returns 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name: `${TEST_NAME_PREFIX} Shoes ${Date.now()}` })
      .expect(401);
  });

  it('POST /api/v1/categories as an authenticated CUSTOMER (non-privileged role) returns 403', async () => {
    const customerAccessToken = await createCustomerAndLogin();

    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Forbidden ${Date.now()}` })
      .expect(403);
  });

  it('POST /api/v1/categories as MASTER_ADMIN creates a category and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Shoes ${Date.now()}` })
      .expect(201);

    expect(res.body).toMatchObject({ name: expect.stringContaining('Shoes') });
    expect(res.body.slug).toBeDefined();
  });

  it('POST /api/v1/categories with a missing name returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({})
      .expect(400);
  });

  it('POST /api/v1/categories with a duplicate name returns 409', async () => {
    const name = `${TEST_NAME_PREFIX} Duplicate ${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name })
      .expect(409);
  });

  it('GET /api/v1/categories returns a paginated envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta.page');
    expect(res.body).toHaveProperty('meta.limit');
    expect(res.body).toHaveProperty('meta.total');
  });

  it('GET /api/v1/categories/:id returns 404 when not found', async () => {
    await request(app.getHttpServer()).get('/api/v1/categories/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('GET /api/v1/categories/:id returns 400 when id is not a UUID', async () => {
    await request(app.getHttpServer()).get('/api/v1/categories/not-a-uuid').expect(400);
  });

  it('DELETE /api/v1/categories/:id without a Bearer token returns 401', async () => {
    await request(app.getHttpServer()).delete('/api/v1/categories/00000000-0000-0000-0000-000000000000').expect(401);
  });

  it('DELETE /api/v1/categories/:id as MASTER_ADMIN returns 404 when the category does not exist', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/categories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .expect(404);
  });

  it('PATCH /api/v1/categories/:id as MASTER_ADMIN regenerates the slug from the new name', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Before ${Date.now()}` })
      .expect(201);

    const originalSlug = createRes.body.slug;
    const newName = `${TEST_NAME_PREFIX} After ${Date.now()}`;

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${createRes.body.id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: newName })
      .expect(200);

    expect(patchRes.body.slug).not.toBe(originalSlug);
    expect(patchRes.body.slug).toContain('after');
  });

  it('PATCH /api/v1/categories/:id with an explicit null name returns 400, not 500', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} NullName ${Date.now()}` })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/categories/${createRes.body.id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: null })
      .expect(400);
  });

  it('DELETE /api/v1/categories/:id as MASTER_ADMIN returns 409 via the service pre-check when a product still references it', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} HasProduct ${Date.now()}` })
      .expect(201);

    const categoryId = createRes.body.id;
    await prisma.product.create({
      data: {
        categoryId,
        name: `${TEST_NAME_PREFIX} Product ${Date.now()}`,
        slug: `${TEST_NAME_PREFIX.toLowerCase()}-product-${Date.now()}`,
        code: `CE${Date.now().toString(36).toUpperCase()}`,
      },
    });

    // Nhánh này chỉ chứng minh service.remove() pre-check (đếm product) hoạt
    // động — CategoriesService.remove() throw ConflictException trước khi
    // gọi prisma.category.delete(), nên FK RESTRICT ở DB (ADR 0001) chưa bao
    // giờ được kích hoạt ở test này. Test dưới mới verify tầng DB thật.
    await request(app.getHttpServer())
      .delete(`/api/v1/categories/${categoryId}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .expect(409);
  });

  it('DB-level FK RESTRICT (ADR 0001) rejects deleting a category with a product, bypassing the service pre-check', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} DbFkRestrict ${Date.now()}` })
      .expect(201);

    const categoryId = createRes.body.id;
    await prisma.product.create({
      data: {
        categoryId,
        name: `${TEST_NAME_PREFIX} Product ${Date.now()}`,
        slug: `${TEST_NAME_PREFIX.toLowerCase()}-product-db-fk-${Date.now()}`,
        code: `CF${Date.now().toString(36).toUpperCase()}`,
      },
    });

    // Gọi thẳng Prisma, bỏ qua CategoriesService.remove() (và pre-check của
    // nó), để buộc request chạm thật vào FK constraint RESTRICT ở Postgres.
    await expect(prisma.category.delete({ where: { id: categoryId } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });
});
