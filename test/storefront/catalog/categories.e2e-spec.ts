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
const TEST_NAME_PREFIX = 'CategoriesStorefrontE2E';
const TEST_EMAIL_DOMAIN = '@categories-storefront.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

interface TreeNode {
  id: string;
  name: string;
  slug: string;
  children: TreeNode[];
}

describe('Categories — Storefront (e2e)', () => {
  let app: INestApplication;

  let prisma: PrismaService;

  let passwordService: PasswordService;

  let adminToken: string;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);
    adminToken = await tokenFor('ADMIN');
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

  async function storefrontTree(): Promise<TreeNode[]> {
    const res = await request(server()).get('/api/v1/categories').expect(200);
    return res.body;
  }

  function findNode(nodes: TreeNode[], id: string): TreeNode | undefined {
    for (const node of nodes) {
      if (node.id === id) return node;
      const hit = findNode(node.children, id);
      if (hit) return hit;
    }
    return undefined;
  }

  describe('storefront tree', () => {
    it('returns a nested tree with siblings ordered by sortOrder then name', async () => {
      const root = await createCategory({ name: unique('Root') });
      const second = await createCategory({ parentId: root.id, name: `${TEST_NAME_PREFIX} B ${seq++}`, sortOrder: 2 });
      const firstB = await createCategory({ parentId: root.id, name: `${TEST_NAME_PREFIX} B2 ${seq++}`, sortOrder: 1 });
      const firstA = await createCategory({ parentId: root.id, name: `${TEST_NAME_PREFIX} A ${seq++}`, sortOrder: 1 });
      const grandchild = await createCategory({ parentId: firstA.id });

      const node = findNode(await storefrontTree(), root.id)!;
      expect(node.children.map((c) => c.id)).toEqual([firstA.id, firstB.id, second.id]);
      expect(node.children[0].children.map((c) => c.id)).toEqual([grandchild.id]);
      expect(node.children[0]).toMatchObject({ name: firstA.name, slug: expect.any(String) });
    });

    it('hiding a parent removes its whole subtree from the storefront', async () => {
      const root = await createCategory();
      const child = await createCategory({ parentId: root.id });
      const grandchild = await createCategory({ parentId: child.id });

      await patch(child.id, { isVisible: false }).expect(200);

      const tree = await storefrontTree();
      expect(findNode(tree, root.id)?.children).toEqual([]);
      expect(findNode(tree, child.id)).toBeUndefined();
      expect(findNode(tree, grandchild.id)).toBeUndefined();
      await request(server()).get(`/api/v1/categories/${grandchild.id}`).expect(404);
    });
  });
});
