import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '#src/prisma/prisma.service.js';
import { PasswordService } from '#src/modules/identity/services/auth/password.service.js';
import type { Role } from '#src/generated/prisma/enums.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

const CODE_PREFIX = 'E2ESC';
const NAME_PREFIX = 'SizesColorsE2E';
const TEST_EMAIL_DOMAIN = '@sizes-colors.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

describe('Admin — sizes & colors (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let adminToken: string;
  let staffToken: string;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);
    adminToken = await tokenFor('ADMIN');
    staffToken = await tokenFor('STAFF');
  });

  afterAll(async () => {
    const product = { name: { startsWith: NAME_PREFIX } };
    await prisma.inventory.deleteMany({ where: { variant: { product } } });
    await prisma.productVariant.deleteMany({ where: { product } });
    await prisma.product.deleteMany({ where: product });
    await prisma.category.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
    await prisma.size.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
    await prisma.color.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  let seq = 0;
  const code = () => `${CODE_PREFIX}${Date.now().toString(36).toUpperCase()}${seq++}`;

  async function tokenFor(role: Role): Promise<string> {
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

  const createSize = (body: Record<string, unknown>, token = adminToken) =>
    request(server()).post('/api/v1/admin/sizes').set(auth(token)).send(body);
  const createColor = (body: Record<string, unknown>, token = adminToken) =>
    request(server()).post('/api/v1/admin/colors').set(auth(token)).send(body);

  describe('sizes', () => {
    it('ADMIN creates a size; STAFF and ADMIN list it including hidden ones, ordered by sortOrder', async () => {
      const later = await createSize({ code: code(), name: 'L', sortOrder: 30 }).expect(201);
      const earlier = await createSize({ code: code(), name: 'S', sortOrder: 10, isHidden: true }).expect(201);
      expect(earlier.body).toMatchObject({ name: 'S', sortOrder: 10, isHidden: true });

      const res = await request(server()).get('/api/v1/admin/sizes').set(auth(staffToken)).expect(200);
      const ids = res.body.map((s: { id: string }) => s.id);
      expect(ids.indexOf(earlier.body.id)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(earlier.body.id)).toBeLessThan(ids.indexOf(later.body.id));
    });

    it('a duplicate code returns 409', async () => {
      const c = code();
      await createSize({ code: c, name: 'M', sortOrder: 20 }).expect(201);
      await createSize({ code: c, name: 'M again', sortOrder: 21 }).expect(409);
    });

    it('rejects a lowercase or malformed code with 400', async () => {
      await createSize({ code: 'm l', name: 'Bad', sortOrder: 1 }).expect(400);
    });

    it('ADMIN renames, reorders and hides a size', async () => {
      const size = await createSize({ code: code(), name: 'XL', sortOrder: 40 }).expect(201);
      const res = await request(server())
        .patch(`/api/v1/admin/sizes/${size.body.id}`)
        .set(auth(adminToken))
        .send({ name: 'Extra L', sortOrder: 45, isHidden: true })
        .expect(200);
      expect(res.body).toMatchObject({ name: 'Extra L', sortOrder: 45, isHidden: true });
    });

    it('STAFF gets 403 on size writes', async () => {
      await createSize({ code: code(), name: 'X', sortOrder: 1 }, staffToken).expect(403);
    });

    it('sizes cannot be deleted', async () => {
      const size = await createSize({ code: code(), name: 'D', sortOrder: 1 }).expect(201);
      await request(server()).delete(`/api/v1/admin/sizes/${size.body.id}`).set(auth(adminToken)).expect(404);
    });

    it('FREESIZE is seeded', async () => {
      const res = await request(server()).get('/api/v1/admin/sizes').set(auth(adminToken)).expect(200);
      expect(res.body.map((s: { code: string }) => s.code)).toContain('FREESIZE');
    });
  });

  describe('colors', () => {
    it('ADMIN creates a color with a #RRGGBB hex', async () => {
      const res = await createColor({ code: code(), name: 'Trắng', hex: '#FFFFFF' }).expect(201);
      expect(res.body).toMatchObject({ name: 'Trắng', hex: '#FFFFFF', isHidden: false });
    });

    it.each(['FFFFFF', '#FFF', '#GGGGGG', 'red'])('rejects hex %s with 400', async (hex) => {
      await createColor({ code: code(), name: 'Bad', hex }).expect(400);
    });

    it('a duplicate code returns 409', async () => {
      const c = code();
      await createColor({ code: c, name: 'Đen', hex: '#000000' }).expect(201);
      await createColor({ code: c, name: 'Đen 2', hex: '#000001' }).expect(409);
    });

    it('STAFF can list but gets 403 on color writes', async () => {
      await request(server()).get('/api/v1/admin/colors').set(auth(staffToken)).expect(200);
      await createColor({ code: code(), name: 'X', hex: '#123456' }, staffToken).expect(403);
    });
  });

  describe('hiding options', () => {
    it('a size used by a variant can be hidden; the variant keeps working; the option leaves public filters', async () => {
      const size = await createSize({ code: code(), name: 'Used', sortOrder: 5 }).expect(201);
      const color = await createColor({ code: code(), name: 'Used', hex: '#AA0000' }).expect(201);
      const category = await prisma.category.create({
        data: { name: `${NAME_PREFIX} cat ${Date.now()}`, slug: `sizes-colors-e2e-${Date.now()}` },
      });
      const product = await request(server())
        .post('/api/v1/admin/products')
        .set(auth(adminToken))
        .send({ name: `${NAME_PREFIX} product ${Date.now()}`, categoryId: category.id, weightGrams: 300 })
        .expect(201);
      const variant = await request(server())
        .post(`/api/v1/admin/products/${product.body.id}/variants`)
        .set(auth(adminToken))
        .send({ sku: `${code()}-SKU`, price: 100000, sizeId: size.body.id, colorId: color.body.id })
        .expect(201);

      await request(server())
        .patch(`/api/v1/admin/sizes/${size.body.id}`)
        .set(auth(adminToken))
        .send({ isHidden: true })
        .expect(200);

      const detail = await request(server())
        .get(`/api/v1/admin/products/${product.body.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(detail.body.variants).toEqual([
        expect.objectContaining({ id: variant.body.id, size: expect.objectContaining({ code: size.body.code }) }),
      ]);

      const publicSizes = await request(server()).get('/api/v1/sizes').expect(200);
      expect(publicSizes.body.map((s: { code: string }) => s.code)).not.toContain(size.body.code);

      await expect(prisma.size.delete({ where: { id: size.body.id } })).rejects.toMatchObject({ code: 'P2003' });
    });
  });
});
