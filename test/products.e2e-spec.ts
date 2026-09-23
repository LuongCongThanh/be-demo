import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { PasswordService } from '@src/auth/services/password.service.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

// Prefix cố định cho mọi product/category tạo trong file này — dùng để
// cleanup ở afterAll (startsWith), tránh dữ liệu test cộng dồn vĩnh viễn qua
// các lần chạy (theo cùng pattern của categories.e2e-spec.ts).
const TEST_NAME_PREFIX = 'ProductsE2E';
const TEST_EMAIL_DOMAIN = '@products.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

describe('Products + Variants (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let masterAdminAccessToken: string;
  let categoryId: string;

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

    const category = await prisma.category.create({
      data: {
        name: `${TEST_NAME_PREFIX} category ${Date.now()}`,
        slug: `${TEST_NAME_PREFIX.toLowerCase()}-category-${Date.now()}`,
      },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    // FK productVariant.productId → product.id, inventory.variantId →
    // productVariant.id: xoá inventory → variant → product → category theo
    // đúng chiều ngược FK.
    await prisma.inventory.deleteMany({ where: { variant: { product: { name: { startsWith: TEST_NAME_PREFIX } } } } });
    await prisma.productVariant.deleteMany({ where: { product: { name: { startsWith: TEST_NAME_PREFIX } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
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

  it('POST /api/v1/products without a Bearer token returns 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({ name: `${TEST_NAME_PREFIX} x`, categoryId })
      .expect(401);
  });

  it('POST /api/v1/products with a non-existent categoryId returns 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Product ${Date.now()}`, categoryId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  it('POST /api/v1/products creates a product with no variants and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Product ${Date.now()}`, categoryId })
      .expect(201);

    expect(res.body).toMatchObject({ categoryId, slug: expect.stringContaining('product'), variants: [] });
  });

  it('POST /api/v1/products with a duplicate name returns 409', async () => {
    const name = `${TEST_NAME_PREFIX} Duplicate product ${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name, categoryId })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name, categoryId })
      .expect(409);
  });

  it('GET /api/v1/products/:id returns 404 when not found', async () => {
    await request(app.getHttpServer()).get('/api/v1/products/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('POST /api/v1/products with nested variants creates product + variants + inventory atomically, embedded in the response', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        name: `${TEST_NAME_PREFIX} Product with variants ${Date.now()}`,
        categoryId,
        variants: [
          { sku: `SKU-NESTED-A-${Date.now()}`, price: 150000 },
          { sku: `SKU-NESTED-B-${Date.now()}`, price: 180000 },
        ],
      })
      .expect(201);

    expect(res.body.variants).toHaveLength(2);
    const variantId = res.body.variants[0].id;
    const inventory = await prisma.inventory.findUnique({ where: { variantId } });
    expect(inventory).toMatchObject({ variantId, quantity: 0, reservedQuantity: 0 });
  });

  it('POST /api/v1/products with two variants sharing the same sku in the payload returns 400 and persists nothing', async () => {
    const name = `${TEST_NAME_PREFIX} Product dup sku in payload ${Date.now()}`;
    const sku = `SKU-DUP-PAYLOAD-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        name,
        categoryId,
        variants: [
          { sku, price: 100000 },
          { sku, price: 120000 },
        ],
      })
      .expect(400);

    expect(await prisma.product.findFirst({ where: { name } })).toBeNull();
  });

  it('POST /api/v1/products with one invalid variant fails the whole request (no partial product)', async () => {
    const name = `${TEST_NAME_PREFIX} Product invalid variant ${Date.now()}`;

    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name, categoryId, variants: [{ sku: `SKU-BAD-${Date.now()}`, price: -1 }] })
      .expect(400);

    expect(await prisma.product.findFirst({ where: { name } })).toBeNull();
  });

  it('PATCH /api/v1/products/:id without a variants field leaves existing variants untouched', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        name: `${TEST_NAME_PREFIX} Product patch no-op ${Date.now()}`,
        categoryId,
        variants: [{ sku: `SKU-NOOP-${Date.now()}`, price: 100000 }],
      })
      .expect(201);

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/products/${createRes.body.id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Product patch no-op renamed ${Date.now()}` })
      .expect(200);

    expect(patchRes.body.variants).toHaveLength(1);
    expect(patchRes.body.variants[0].id).toBe(createRes.body.variants[0].id);
  });

  it('PATCH /api/v1/products/:id with a full variants array updates known ids, creates new ones, and discontinues missing ones', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        name: `${TEST_NAME_PREFIX} Product patch sync ${Date.now()}`,
        categoryId,
        variants: [
          { sku: `SKU-SYNC-KEEP-${Date.now()}`, price: 100000 },
          { sku: `SKU-SYNC-RETIRE-${Date.now()}`, price: 100000 },
        ],
      })
      .expect(201);
    const keepId = createRes.body.variants[0].id;
    const retireId = createRes.body.variants[1].id;

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/products/${createRes.body.id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        variants: [
          { id: keepId, price: 150000 },
          { sku: `SKU-SYNC-NEW-${Date.now()}`, price: 90000 },
        ],
      })
      .expect(200);

    const bySku = (sku: string) => patchRes.body.variants.find((v: { sku: string }) => v.sku.startsWith(sku));
    expect(patchRes.body.variants).toHaveLength(3);
    expect(patchRes.body.variants.find((v: { id: string }) => v.id === keepId)).toMatchObject({ price: '150000' });
    expect(patchRes.body.variants.find((v: { id: string }) => v.id === retireId)).toMatchObject({
      status: 'DISCONTINUED',
    });
    expect(bySku('SKU-SYNC-NEW')).toBeDefined();

    const inventory = await prisma.inventory.findUnique({ where: { variantId: bySku('SKU-SYNC-NEW').id } });
    expect(inventory).toMatchObject({ quantity: 0 });
    // Inventory của variant vừa discontinue phải giữ nguyên, không bị đụng.
    expect(await prisma.inventory.findUnique({ where: { variantId: retireId } })).not.toBeNull();
  });

  it('PATCH /api/v1/products/:id with a variants entry id from a different product returns 400', async () => {
    const productARes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        name: `${TEST_NAME_PREFIX} Product A foreign id ${Date.now()}`,
        categoryId,
        variants: [{ sku: `SKU-FOREIGN-A-${Date.now()}`, price: 100000 }],
      })
      .expect(201);
    const productBRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Product B foreign id ${Date.now()}`, categoryId })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/products/${productBRes.body.id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ variants: [{ id: productARes.body.variants[0].id, price: 1 }] })
      .expect(400);
  });

  it('GET /api/v1/products/:id/variants/:variantId returns 404 when the variant belongs to a different product', async () => {
    const productARes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        name: `${TEST_NAME_PREFIX} Product A ${Date.now()}`,
        categoryId,
        variants: [{ sku: `SKU-A-${Date.now()}`, price: 100000 }],
      })
      .expect(201);
    const productBRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Product B ${Date.now()}`, categoryId })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/products/${productBRes.body.id}/variants/${productARes.body.variants[0].id}`)
      .expect(404);
  });

  it('the legacy single-variant write endpoints no longer exist', async () => {
    const productRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Product legacy routes ${Date.now()}`, categoryId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/products/${productRes.body.id}/variants`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ sku: `SKU-LEGACY-${Date.now()}`, price: 100000 })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/products/${productRes.body.id}/variants/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ price: 1 })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/products/${productRes.body.id}/variants/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .expect(404);
  });

  it('GET /api/v1/products/:id/variants supports an optional status filter', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        name: `${TEST_NAME_PREFIX} Product status filter ${Date.now()}`,
        categoryId,
        variants: [{ sku: `SKU-FILTER-${Date.now()}`, price: 100000 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/products/${createRes.body.id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ variants: [] })
      .expect(200);

    const activeOnly = await request(app.getHttpServer())
      .get(`/api/v1/products/${createRes.body.id}/variants?status=ACTIVE`)
      .expect(200);
    expect(activeOnly.body.data).toHaveLength(0);

    const discontinuedOnly = await request(app.getHttpServer())
      .get(`/api/v1/products/${createRes.body.id}/variants?status=DISCONTINUED`)
      .expect(200);
    expect(discontinuedOnly.body.data).toHaveLength(1);
  });

  it('POST /api/v1/products as an authenticated CUSTOMER (non-privileged role) returns 403', async () => {
    const customerAccessToken = await createCustomerAndLogin();

    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Forbidden ${Date.now()}`, categoryId })
      .expect(403);
  });

  it('DELETE /api/v1/products/:id cascades to its variants and inventory rows (spec §4.5)', async () => {
    const productRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        name: `${TEST_NAME_PREFIX} Cascade delete ${Date.now()}`,
        categoryId,
        variants: [{ sku: `SKU-CASCADE-${Date.now()}`, price: 120000 }],
      })
      .expect(201);
    const productId = productRes.body.id;
    const variantId = productRes.body.variants[0].id;

    // Xác nhận variant + inventory tồn tại trước khi xoá, để test thật sự
    // chứng minh cascade xảy ra (không phải "vốn đã không có gì").
    expect(await prisma.productVariant.findUnique({ where: { id: variantId } })).not.toBeNull();
    expect(await prisma.inventory.findUnique({ where: { variantId } })).not.toBeNull();

    await request(app.getHttpServer())
      .delete(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .expect(204);

    expect(await prisma.productVariant.findUnique({ where: { id: variantId } })).toBeNull();
    expect(await prisma.inventory.findUnique({ where: { variantId } })).toBeNull();
  });

  it('PATCH /api/v1/products/:id with an explicit null name returns 400, not 500', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} NullName ${Date.now()}`, categoryId })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/products/${createRes.body.id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: null })
      .expect(400);
  });
});
