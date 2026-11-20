import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { PasswordService } from '#src/modules/identity/auth/services/shared/password.service.js';
import type { AccountType } from '#src/generated/prisma/enums.js';
import { createTestUser } from '../../support/create-test-user.js';
import { createTestApp } from '../../support/create-test-app.js';

// Prefix cố định cho mọi product/category tạo trong file này — dùng để
// cleanup ở afterAll (startsWith), tránh dữ liệu test cộng dồn qua các lần chạy.
const TEST_NAME_PREFIX = 'ProductsAdminE2E';
const TEST_EMAIL_DOMAIN = '@products-admin.e2e-test.local';
const CODE_PREFIX = 'E2PA';
const VALID_PASSWORD = 'Abc@1234';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Products — Admin CMS (e2e)', () => {
  let app: INestApplication;

  let prisma: PrismaService;

  let passwordService: PasswordService;

  let adminToken: string;

  let staffToken: string;

  let customerToken: string;

  let categoryId: string;

  let colorId: string;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);

    adminToken = await tokenFor('ADMIN');
    staffToken = await tokenFor('STAFF');
    customerToken = await tokenFor('CUSTOMER');

    const category = await prisma.category.create({
      data: {
        name: `${TEST_NAME_PREFIX} category ${Date.now()}`,
        slug: `${TEST_NAME_PREFIX.toLowerCase()}-category-${Date.now()}`,
      },
    });
    categoryId = category.id;
    colorId = (await createOption('color')).id;
  });

  afterAll(async () => {
    const where = { product: { name: { startsWith: TEST_NAME_PREFIX } } };
    await prisma.inventory.deleteMany({ where: { variant: where } });
    await prisma.productVariant.deleteMany({ where });
    await prisma.product.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
    await prisma.size.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
    await prisma.color.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
    await prisma.category.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  const server = () => app.getHttpServer();

  let seq = 0;

  const unique = (label: string) => `${TEST_NAME_PREFIX} ${label} ${Date.now()}-${seq++}`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

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

  async function createProduct(extra: Record<string, unknown> = {}) {
    const res = await request(server())
      .post('/api/v1/admin/products')
      .set(auth(adminToken))
      .send({ name: unique('Product'), categoryId, weightGrams: 250, gender: 'UNISEX', ...extra })
      .expect(201);
    return res.body as { id: string; status: string; publishedAt: string | null };
  }

  async function createVariant(productId: string, extra: Record<string, unknown> = {}) {
    const res = await request(server())
      .post(`/api/v1/admin/products/${productId}/variants`)
      .set(auth(adminToken))
      .send(await variantBody(extra))
      .expect(201);
    return res.body as { id: string; sku: string; status: string };
  }

  async function variantBody(extra: Record<string, unknown> = {}) {
    const sizeId = extra.sizeId ?? (await createOption('size')).id;
    return { sku: `SKU-${Date.now()}-${seq++}`, price: 150000, sizeId, colorId, ...extra };
  }

  async function createOption(kind: 'size' | 'color', extra: { isHidden?: boolean } = {}) {
    const code = `${CODE_PREFIX}${Date.now().toString(36).toUpperCase()}${seq++}`;
    return kind === 'size'
      ? prisma.size.create({ data: { code, name: code, sortOrder: seq, ...extra } })
      : prisma.color.create({ data: { code, name: code, hex: '#112233', ...extra } });
  }

  const imageKey = (productId: string) => `products/${productId}/${randomUUID()}`;

  const setStatus = (id: string, status: string) =>
    request(server()).patch(`/api/v1/admin/products/${id}`).set(auth(adminToken)).send({ status });

  const archive = (id: string) => request(server()).post(`/api/v1/admin/products/${id}/archive`).set(auth(adminToken));

  const unarchive = (id: string) =>
    request(server()).post(`/api/v1/admin/products/${id}/unarchive`).set(auth(adminToken));

  async function publishedProduct() {
    const product = await createProduct();
    await setStatus(product.id, 'ACTIVE').expect(200);
    return product;
  }

  describe('lifecycle', () => {
    it('a new product starts as DRAFT with no publishedAt', async () => {
      const product = await createProduct();
      expect(product).toMatchObject({ status: 'DRAFT', publishedAt: null });
    });

    it('status cannot be chosen at creation', async () => {
      await request(server())
        .post('/api/v1/admin/products')
        .set(auth(adminToken))
        .send({ name: unique('Status'), categoryId, status: 'ACTIVE' })
        .expect(400);
    });

    it('publishing sets publishedAt once; archive + reactivate keeps the first date', async () => {
      const product = await createProduct();
      const published = await setStatus(product.id, 'ACTIVE').expect(200);
      const firstPublishedAt = published.body.publishedAt;
      expect(firstPublishedAt).toEqual(expect.any(String));

      await archive(product.id).expect(200);
      const reactivated = await unarchive(product.id).expect(200);

      expect(reactivated.body).toMatchObject({ status: 'ACTIVE', publishedAt: firstPublishedAt });
    });

    it('archive and unarchive are idempotent', async () => {
      const product = await publishedProduct();
      expect((await archive(product.id).expect(200)).body.status).toBe('ARCHIVED');
      expect((await archive(product.id).expect(200)).body.status).toBe('ARCHIVED');
      expect((await unarchive(product.id).expect(200)).body.status).toBe('ACTIVE');
      expect((await unarchive(product.id).expect(200)).body.status).toBe('ACTIVE');
    });

    it('a DRAFT can be archived directly', async () => {
      const product = await createProduct();
      expect((await archive(product.id).expect(200)).body.status).toBe('ARCHIVED');
    });

    it('moving back to DRAFT is rejected with 400', async () => {
      const active = await publishedProduct();
      await setStatus(active.id, 'DRAFT').expect(400);

      const archived = await publishedProduct();
      await archive(archived.id).expect(200);
      await setStatus(archived.id, 'DRAFT').expect(400);
    });

    it('variants can be archived and unarchived (idempotent)', async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const path = `/api/v1/admin/products/${product.id}/variants/${variant.id}`;

      for (let i = 0; i < 2; i++) {
        const res = await request(server()).post(`${path}/archive`).set(auth(adminToken)).expect(200);
        expect(res.body.status).toBe('ARCHIVED');
      }
      const res = await request(server()).post(`${path}/unarchive`).set(auth(adminToken)).expect(200);
      expect(res.body.status).toBe('ACTIVE');
    });
  });

  describe('back-office reads', () => {
    it('STAFF and ADMIN can filter the admin list by any status', async () => {
      const draft = await createProduct();
      const archived = await createProduct();
      await archive(archived.id).expect(200);

      for (const token of [staffToken, adminToken]) {
        const res = await request(server())
          .get(`/api/v1/admin/products?categoryId=${categoryId}&status=DRAFT&limit=100`)
          .set(auth(token))
          .expect(200);
        const ids = res.body.data.map((p: { id: string }) => p.id);
        expect(ids).toContain(draft.id);
        expect(ids).not.toContain(archived.id);
      }
    });

    it('admin detail returns DRAFT/ARCHIVED products with every variant', async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await request(server())
        .post(`/api/v1/admin/products/${product.id}/variants/${variant.id}/archive`)
        .set(auth(adminToken))
        .expect(200);

      const res = await request(server()).get(`/api/v1/admin/products/${product.id}`).set(auth(staffToken)).expect(200);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.variants).toEqual([expect.objectContaining({ id: variant.id, status: 'ARCHIVED' })]);
    });

    it('CUSTOMER and anonymous callers cannot read the admin list', async () => {
      await request(server()).get('/api/v1/admin/products').set(auth(customerToken)).expect(403);
      await request(server()).get('/api/v1/admin/products').expect(401);
    });
  });

  describe('authorization on writes', () => {
    it('STAFF gets 403 on product writes, archive and unarchive', async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const base = `/api/v1/admin/products/${product.id}`;

      await request(server()).post('/api/v1/admin/products').set(auth(staffToken)).send({}).expect(403);
      await request(server()).patch(base).set(auth(staffToken)).send({}).expect(403);
      await request(server()).post(`${base}/archive`).set(auth(staffToken)).expect(403);
      await request(server()).post(`${base}/unarchive`).set(auth(staffToken)).expect(403);
      await request(server()).post(`${base}/variants`).set(auth(staffToken)).send({}).expect(403);
      await request(server()).post(`${base}/variants/${variant.id}/archive`).set(auth(staffToken)).expect(403);
    });

    it('write routes are gone from the storefront path', async () => {
      await request(server()).post('/api/v1/products').set(auth(adminToken)).send({}).expect(404);
    });

    it('anonymous write returns 401', async () => {
      await request(server()).post('/api/v1/admin/products').send({}).expect(401);
    });
  });

  describe('product and variant CRUD', () => {
    it('creating with a non-existent categoryId returns 404', async () => {
      await request(server())
        .post('/api/v1/admin/products')
        .set(auth(adminToken))
        .send({ name: unique('NoCat'), categoryId: MISSING_ID, weightGrams: 250, gender: 'UNISEX' })
        .expect(404);
    });

    it('creating with a duplicate name returns 409', async () => {
      const name = unique('Duplicate');
      await createProduct({ name });
      await request(server())
        .post('/api/v1/admin/products')
        .set(auth(adminToken))
        .send({ name, categoryId, weightGrams: 250, gender: 'UNISEX' })
        .expect(409);
    });

    it('PATCH with an explicit null name returns 400, not 500', async () => {
      const product = await createProduct();
      await request(server())
        .patch(`/api/v1/admin/products/${product.id}`)
        .set(auth(adminToken))
        .send({ name: null })
        .expect(400);
    });

    it('creating a variant atomically creates an inventory row (quantity=0)', async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const inventory = await prisma.inventory.findUnique({ where: { variantId: variant.id } });
      expect(inventory).toMatchObject({ variantId: variant.id, quantity: 0, reservedQuantity: 0 });
    });

    it('creating a variant with a duplicate sku returns 409', async () => {
      const product = await createProduct();
      const { sku } = await createVariant(product.id);

      await request(server())
        .post(`/api/v1/admin/products/${product.id}/variants`)
        .set(auth(adminToken))
        .send(await variantBody({ sku }))
        .expect(409);
    });

    it('variant routes return 404 when the variant belongs to a different product', async () => {
      const owner = await createProduct();
      const other = await createProduct();
      const variant = await createVariant(owner.id);

      await request(server())
        .patch(`/api/v1/admin/products/${other.id}/variants/${variant.id}`)
        .set(auth(adminToken))
        .send({ price: 1 })
        .expect(404);
      await request(server())
        .post(`/api/v1/admin/products/${other.id}/variants/${variant.id}/archive`)
        .set(auth(adminToken))
        .expect(404);
    });
  });

  describe('variant rules (BR-CAT-02..06)', () => {
    it.each([0, -1, 100.5])('price %s is rejected with 400', async (price) => {
      const product = await createProduct();
      await request(server())
        .post(`/api/v1/admin/products/${product.id}/variants`)
        .set(auth(adminToken))
        .send(await variantBody({ price }))
        .expect(400);
    });

    it.each(['abc', 'TSHIRT_M', 'TSHIRT M'])('SKU %s is rejected with 400', async (sku) => {
      const product = await createProduct();
      await request(server())
        .post(`/api/v1/admin/products/${product.id}/variants`)
        .set(auth(adminToken))
        .send(await variantBody({ sku }))
        .expect(400);
    });

    it('a SKU already used on another product returns 409', async () => {
      const { sku } = await createVariant((await createProduct()).id);
      const other = await createProduct();
      await request(server())
        .post(`/api/v1/admin/products/${other.id}/variants`)
        .set(auth(adminToken))
        .send(await variantBody({ sku }))
        .expect(409);
    });

    it('a duplicate size × color on the same product returns 409', async () => {
      const product = await createProduct();
      const size = await createOption('size');
      await createVariant(product.id, { sizeId: size.id });
      await request(server())
        .post(`/api/v1/admin/products/${product.id}/variants`)
        .set(auth(adminToken))
        .send(await variantBody({ sizeId: size.id }))
        .expect(409);
    });

    it('an unknown or hidden size/color is rejected for a new variant', async () => {
      const product = await createProduct();
      const hiddenSize = await createOption('size', { isHidden: true });
      const hiddenColor = await createOption('color', { isHidden: true });

      for (const extra of [
        { sizeId: MISSING_ID },
        { colorId: MISSING_ID },
        { sizeId: hiddenSize.id },
        { colorId: hiddenColor.id },
      ]) {
        await request(server())
          .post(`/api/v1/admin/products/${product.id}/variants`)
          .set(auth(adminToken))
          .send(await variantBody(extra))
          .expect(400);
      }
    });

    it('SKU cannot be changed after creation', async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await request(server())
        .patch(`/api/v1/admin/products/${product.id}/variants/${variant.id}`)
        .set(auth(adminToken))
        .send({ sku: 'NEW-SKU-123' })
        .expect(400);
    });

    it('price is returned as an integer number', async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id, { price: 199000 });
      expect(variant).toMatchObject({ price: 199000 });

      const updated = await request(server())
        .patch(`/api/v1/admin/products/${product.id}/variants/${variant.id}`)
        .set(auth(adminToken))
        .send({ price: 249000 })
        .expect(200);
      expect(updated.body.price).toBe(249000);
    });

    it('weightGrams is required and must be > 0', async () => {
      for (const weightGrams of [undefined, 0, 1.5]) {
        await request(server())
          .post('/api/v1/admin/products')
          .set(auth(adminToken))
          .send({ name: unique('Weight'), categoryId, weightGrams, gender: 'UNISEX' })
          .expect(400);
      }
    });
  });

  describe('images per color', () => {
    const addImage = (productId: string, body: Record<string, unknown>) =>
      request(server()).post(`/api/v1/admin/products/${productId}/images`).set(auth(adminToken)).send(body);

    it('keeps at most one primary image per product color', async () => {
      const product = await createProduct();
      const first = await addImage(product.id, { colorId, storageKey: imageKey(product.id), isPrimary: true }).expect(
        201,
      );
      const second = await addImage(product.id, { colorId, storageKey: imageKey(product.id), isPrimary: true }).expect(
        201,
      );

      const res = await request(server()).get(`/api/v1/admin/products/${product.id}`).set(auth(adminToken)).expect(200);
      const primary = res.body.images.filter((i: { isPrimary: boolean }) => i.isPrimary);
      expect(primary.map((i: { id: string }) => i.id)).toEqual([second.body.id]);
      expect(res.body.images.map((i: { id: string }) => i.id)).toContain(first.body.id);
    });

    it('promoting an existing image via PATCH demotes the previous primary', async () => {
      const product = await createProduct();
      const a = await addImage(product.id, { colorId, storageKey: imageKey(product.id), isPrimary: true }).expect(201);
      const b = await addImage(product.id, { colorId, storageKey: imageKey(product.id) }).expect(201);

      await request(server())
        .patch(`/api/v1/admin/products/${product.id}/images/${b.body.id}`)
        .set(auth(adminToken))
        .send({ isPrimary: true })
        .expect(200);

      const images = await prisma.productImage.findMany({ where: { productId: product.id } });
      expect(images.find((i) => i.id === a.body.id)?.isPrimary).toBe(false);
      expect(images.find((i) => i.id === b.body.id)?.isPrimary).toBe(true);
    });

    it('an unknown color is rejected with 400', async () => {
      const product = await createProduct();
      await addImage(product.id, { colorId: MISSING_ID, storageKey: imageKey(product.id) }).expect(400);
    });

    it('STAFF gets 403 on image writes', async () => {
      const product = await createProduct();
      await request(server())
        .post(`/api/v1/admin/products/${product.id}/images`)
        .set(auth(staffToken))
        .send({ colorId, storageKey: imageKey(product.id) })
        .expect(403);
    });
  });
});
