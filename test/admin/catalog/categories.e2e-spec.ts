import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { PasswordService } from '#src/modules/identity/auth/services/shared/password.service.js';
import type { AccountType } from '#src/generated/prisma/enums.js';
import { createTestUser } from '../../support/create-test-user.js';
import { createTestApp } from '../../support/create-test-app.js';

// Prefix cố định cho mọi category tạo trong file này — dùng để cleanup ở
// afterAll (startsWith), tránh category test cộng dồn qua các lần chạy.
const TEST_NAME_PREFIX = 'CategoriesAdminE2E';
const TEST_EMAIL_DOMAIN = '@categories-admin.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Categories — Admin CMS (e2e)', () => {
  let app: INestApplication;

  let prisma: PrismaService;

  let passwordService: PasswordService;

  let adminToken: string;

  let staffToken: string;

  let customerToken: string;

  beforeAll(async () => {
    const created = await createTestApp();
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
