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
const TEST_NAME_PREFIX = 'ProductsStorefrontE2E';
const TEST_EMAIL_DOMAIN = '@products-storefront.e2e-test.local';
const CODE_PREFIX = 'E2PS';
const VALID_PASSWORD = 'Abc@1234';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Products — Storefront (e2e)', () => {
  let app: INestApplication;

  let prisma: PrismaService;

  let passwordService: PasswordService;

  let adminToken: string;

  let categoryId: string;

  let colorId: string;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);

    adminToken = await tokenFor('ADMIN');

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

  async function publishedProduct() {
    const product = await createProduct();
    await setStatus(product.id, 'ACTIVE').expect(200);
    return product;
  }

  describe('storefront visibility', () => {
    it('only ACTIVE products appear in the list and detail', async () => {
      const draft = await createProduct();
      const archived = await createProduct();
      await archive(archived.id).expect(200);
      const active = await publishedProduct();
      // Danh sách storefront chỉ hiện Sản phẩm còn ít nhất một Biến thể ACTIVE.
      await createVariant(active.id);

      const list = await request(server()).get(`/api/v1/products?categoryId=${categoryId}&limit=100`).expect(200);
      const ids = list.body.data.map((p: { id: string }) => p.id);
      expect(ids).toContain(active.id);
      expect(ids).not.toContain(draft.id);
      expect(ids).not.toContain(archived.id);

      await request(server()).get(`/api/v1/products/${active.id}`).expect(200);
      await request(server()).get(`/api/v1/products/${draft.id}`).expect(404);
      await request(server()).get(`/api/v1/products/${archived.id}`).expect(404);
      await request(server()).get(`/api/v1/products/${draft.id}/variants`).expect(404);
    });

    it('rejects a status filter on the storefront list', async () => {
      await request(server()).get('/api/v1/products?status=DRAFT').expect(400);
    });

    it('archived variants are omitted from storefront detail and variant routes', async () => {
      const product = await publishedProduct();
      const kept = await createVariant(product.id);
      const hidden = await createVariant(product.id);
      await request(server())
        .post(`/api/v1/admin/products/${product.id}/variants/${hidden.id}/archive`)
        .set(auth(adminToken))
        .expect(200);

      const detail = await request(server()).get(`/api/v1/products/${product.id}`).expect(200);
      const variantIds = detail.body.variants.map((v: { id: string }) => v.id);
      expect(variantIds).toEqual([kept.id]);

      const list = await request(server()).get(`/api/v1/products/${product.id}/variants`).expect(200);
      expect(list.body.data.map((v: { id: string }) => v.id)).toEqual([kept.id]);
      await request(server()).get(`/api/v1/products/${product.id}/variants/${hidden.id}`).expect(404);
    });
  });

  describe('storefront detail and filters', () => {
    it('detail shows each variant size/color names and images per color', async () => {
      const product = await publishedProduct();
      await createVariant(product.id);
      const key = imageKey(product.id);
      await request(server())
        .post(`/api/v1/admin/products/${product.id}/images`)
        .set(auth(adminToken))
        .send({ colorId, storageKey: key, isPrimary: true })
        .expect(201);

      const res = await request(server()).get(`/api/v1/products/${product.id}`).expect(200);
      expect(res.body.variants[0]).toMatchObject({
        size: { code: expect.any(String), name: expect.any(String) },
        color: { code: expect.any(String), name: expect.any(String), hex: '#112233' },
      });
      expect(res.body.images).toEqual([expect.objectContaining({ colorId, storageKey: key, isPrimary: true })]);
    });

    it('filters by size and color codes; a product matches when one ACTIVE variant satisfies both', async () => {
      const sizeA = await createOption('size');
      const sizeB = await createOption('size');
      const red = await createOption('color');
      const blue = await createOption('color');

      const redA = await publishedProduct();
      await createVariant(redA.id, { sizeId: sizeA.id, colorId: red.id });
      const blueB = await publishedProduct();
      await createVariant(blueB.id, { sizeId: sizeB.id, colorId: blue.id });
      // Có size A và màu xanh nhưng ở hai biến thể khác nhau → không khớp A + xanh.
      const split = await publishedProduct();
      await createVariant(split.id, { sizeId: sizeA.id, colorId: red.id });
      await createVariant(split.id, { sizeId: sizeB.id, colorId: blue.id });
      // Biến thể đã archive không được tính.
      const archivedVariant = await publishedProduct();
      const v = await createVariant(archivedVariant.id, { sizeId: sizeA.id, colorId: blue.id });
      await request(server())
        .post(`/api/v1/admin/products/${archivedVariant.id}/variants/${v.id}/archive`)
        .set(auth(adminToken))
        .expect(200);

      const ids = async (query: string) => {
        const res = await request(server())
          .get(`/api/v1/products?categoryId=${categoryId}&limit=100&${query}`)
          .expect(200);
        return res.body.data.map((p: { id: string }) => p.id).sort();
      };

      expect(await ids(`size=${sizeA.code}`)).toEqual([redA.id, split.id].sort());
      expect(await ids(`size=${sizeA.code}&color=${blue.code}`)).toEqual([]);
      expect(await ids(`color=${blue.code}`)).toEqual([blueB.id, split.id].sort());
      expect(await ids(`size=${sizeA.code}&size=${sizeB.code}&color=${red.code}`)).toEqual([redA.id, split.id].sort());
    });

    it('a hidden size or color code is ignored by the storefront filter', async () => {
      const hiddenSize = await createOption('size');
      const hiddenColor = await createOption('color');
      const product = await publishedProduct();
      await createVariant(product.id, { sizeId: hiddenSize.id, colorId: hiddenColor.id });
      await prisma.size.update({ where: { id: hiddenSize.id }, data: { isHidden: true } });
      await prisma.color.update({ where: { id: hiddenColor.id }, data: { isHidden: true } });

      for (const query of [`size=${hiddenSize.code}`, `color=${hiddenColor.code}`]) {
        const res = await request(server()).get(`/api/v1/products?categoryId=${categoryId}&${query}`).expect(200);
        expect(res.body.data).toEqual([]);
      }
    });

    it('public option lists only contain visible sizes and colors', async () => {
      const visible = await createOption('color');
      const hidden = await createOption('color', { isHidden: true });
      const res = await request(server()).get('/api/v1/colors').expect(200);
      const codes = res.body.map((c: { code: string }) => c.code);
      expect(codes).toContain(visible.code);
      expect(codes).not.toContain(hidden.code);
    });
  });

  it('category filters include visible descendants, reject hidden ancestors, and leave global search independent', async () => {
    const root = await prisma.category.create({
      data: { name: unique('Root'), slug: `e2e-root-${Date.now()}-${seq++}` },
    });
    const visible = await prisma.category.create({
      data: { name: unique('Visible'), slug: `e2e-visible-${Date.now()}-${seq++}`, parentId: root.id },
    });
    const hidden = await prisma.category.create({
      data: { name: unique('Hidden'), slug: `e2e-hidden-${Date.now()}-${seq++}`, parentId: root.id, isVisible: false },
    });
    const grandchild = await prisma.category.create({
      data: { name: unique('Grandchild'), slug: `e2e-grandchild-${Date.now()}-${seq++}`, parentId: hidden.id },
    });
    const shown = await createProduct({ categoryId: visible.id });
    const elsewhere = await createProduct({ categoryId: grandchild.id });
    for (const p of [shown, elsewhere]) {
      await createVariant(p.id);
      await setStatus(p.id, 'ACTIVE').expect(200);
    }
    const list = await request(server()).get(`/api/v1/products?categoryId=${root.id}`).expect(200);
    expect(list.body.data.map((p: { id: string }) => p.id)).toEqual([shown.id]);
    await request(server()).get(`/api/v1/products?categoryId=${grandchild.id}`).expect(404);
    await request(server()).get(`/api/v1/products?categoryId=${MISSING_ID}`).expect(404);
    const name = await prisma.product.findUniqueOrThrow({ where: { id: elsewhere.id } });
    const global = await request(server()).get('/api/v1/products').query({ q: name.name }).expect(200);
    expect(global.body.data.map((p: { id: string }) => p.id)).toContain(elsewhere.id);
    await prisma.category.update({ where: { id: root.id }, data: { isVisible: false } });
    await request(server()).get(`/api/v1/products?categoryId=${visible.id}`).expect(404);
  });
});
