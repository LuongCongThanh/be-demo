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
const TEST_NAME_PREFIX = 'ProductsSharedE2E';
const TEST_EMAIL_DOMAIN = '@products-shared.e2e-test.local';
const CODE_PREFIX = 'E2PX';
const VALID_PASSWORD = 'Abc@1234';

describe('Products — cross-audience contract (e2e)', () => {
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

  describe('no hard delete', () => {
    it('DELETE on products and variants no longer exists (404)', async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      for (const path of [
        `/api/v1/products/${product.id}`,
        `/api/v1/admin/products/${product.id}`,
        `/api/v1/products/${product.id}/variants/${variant.id}`,
        `/api/v1/admin/products/${product.id}/variants/${variant.id}`,
      ]) {
        await request(server()).delete(path).set(auth(adminToken)).expect(404);
      }
    });

    it('the database refuses to delete a product that still has variants (FK RESTRICT)', async () => {
      const product = await createProduct();
      await createVariant(product.id);

      await expect(prisma.product.delete({ where: { id: product.id } })).rejects.toMatchObject({ code: 'P2003' });
    });
  });
});
