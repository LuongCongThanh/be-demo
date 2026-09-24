import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { PasswordService } from '@src/auth/services/password.service.js';
import { createTestApp } from './support/create-test-app.js';
import { createTestUser } from './support/create-test-user.js';

const TEST_EMAIL_DOMAIN = '@option-values.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

// Mã Option Value chỉ gồm [A-Z0-9], tối đa 10 ký tự — prefix ngắn + bộ đếm để
// không đụng dữ liệu thật và dọn được ở afterAll.
const CODE_PREFIX = 'OVE';
let codeSeq = 0;
function uniqueCode(): string {
  codeSeq += 1;
  return `${CODE_PREFIX}${Date.now().toString(36).slice(-4).toUpperCase()}${codeSeq}`;
}

describe('Option Values (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let staffToken: string;
  let customerToken: string;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: process.env.ADMIN_BOOTSTRAP_EMAIL, password: process.env.ADMIN_BOOTSTRAP_PASSWORD })
      .expect(200);
    staffToken = loginRes.body.accessToken;

    await prisma.role.upsert({ where: { name: 'CUSTOMER' }, update: {}, create: { name: 'CUSTOMER' } });
    const customer = await createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix: 'customer-',
      passwordHash: await created.moduleFixture.get(PasswordService).hash(VALID_PASSWORD),
      emailVerifiedAt: new Date(),
    });
    const customerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: VALID_PASSWORD })
      .expect(200);
    customerToken = customerLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.optionValue.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  function createOptionValue(body: Record<string, unknown>, token = staffToken) {
    return request(app.getHttpServer())
      .post('/api/v1/option-values')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  it('staff creates a color Option Value, which then appears in the public list', async () => {
    const code = uniqueCode();

    const res = await createOptionValue({ type: 'COLOR', name: 'Đen', code }).expect(201);

    expect(res.body).toMatchObject({ type: 'COLOR', name: 'Đen', code, hidden: false });
    const list = await request(app.getHttpServer()).get('/api/v1/option-values?type=COLOR').expect(200);
    expect(list.body.map((v: { code: string }) => v.code)).toContain(code);
  });

  // Mã duy nhất trên cả màu lẫn size: nếu không, "màu X" và "size X" ghép ra
  // cùng một SKU `<Product Code>-X` (docs/adr/0011).
  it('rejects a code already used by any Option Value, of either type, with 409', async () => {
    const code = uniqueCode();
    await createOptionValue({ type: 'SIZE', name: 'S', code }).expect(201);

    for (const type of ['SIZE', 'COLOR']) {
      const conflict = await createOptionValue({ type, name: 'Other', code }).expect(409);
      expect(conflict.body.message).toBe(`Option Value code "${code}" already exists`);
    }
  });

  it('returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/option-values')
      .send({ type: 'COLOR', name: 'x', code: uniqueCode() })
      .expect(401);
  });

  it('returns 403 for a CUSTOMER', async () => {
    await createOptionValue({ type: 'COLOR', name: 'x', code: uniqueCode() }, customerToken).expect(403);
  });

  it('appends a value without position to the end of its type, and lists in position order', async () => {
    const first = (
      await createOptionValue({ type: 'SIZE', name: 'First', code: uniqueCode(), position: 0 }).expect(201)
    ).body;
    const appended = (await createOptionValue({ type: 'SIZE', name: 'Appended', code: uniqueCode() }).expect(201)).body;

    expect(appended.position).toBeGreaterThan(first.position);
    const sizes = (await request(app.getHttpServer()).get('/api/v1/option-values?type=SIZE').expect(200)).body;
    const ids = sizes.map((v: { id: string }) => v.id);
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(appended.id));
  });

  it('PATCH renames a value, but rejects changing its code or type with 400', async () => {
    const value = (await createOptionValue({ type: 'COLOR', name: 'Den', code: uniqueCode() }).expect(201)).body;

    const renamed = await request(app.getHttpServer())
      .patch(`/api/v1/option-values/${value.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Đen tuyền' })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Đen tuyền', code: value.code });

    for (const body of [{ code: uniqueCode() }, { type: 'SIZE' }]) {
      await request(app.getHttpServer())
        .patch(`/api/v1/option-values/${value.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(body)
        .expect(400);
    }
  });

  it('a hidden value leaves the public list; includeHidden=true shows it to staff only', async () => {
    const value = (await createOptionValue({ type: 'COLOR', name: 'Old', code: uniqueCode() }).expect(201)).body;
    await request(app.getHttpServer())
      .patch(`/api/v1/option-values/${value.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ hidden: true })
      .expect(200);

    const publicList = (await request(app.getHttpServer()).get('/api/v1/option-values?type=COLOR').expect(200)).body;
    expect(publicList.map((v: { id: string }) => v.id)).not.toContain(value.id);

    const url = '/api/v1/option-values?type=COLOR&includeHidden=true';
    await request(app.getHttpServer()).get(url).expect(401);
    await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${customerToken}`).expect(403);
    const staffList = (
      await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${staffToken}`).expect(200)
    ).body;
    expect(staffList.find((v: { id: string }) => v.id === value.id)).toMatchObject({ hidden: true });
  });

  describe('DELETE /api/v1/option-values/:id', () => {
    function remove(id: string, token = staffToken) {
      return request(app.getHttpServer()).delete(`/api/v1/option-values/${id}`).set('Authorization', `Bearer ${token}`);
    }

    it('deletes an unused value with 204, and is staff-only', async () => {
      const value = (await createOptionValue({ type: 'SIZE', name: 'Unused', code: uniqueCode() }).expect(201)).body;

      await remove(value.id, customerToken).expect(403);
      await remove(value.id).expect(204);
      expect(await prisma.optionValue.findUnique({ where: { id: value.id } })).toBeNull();
      await remove(value.id).expect(404);
    });

    it('rejects deleting a value that a variant uses with 409 — hide it instead', async () => {
      const value = (await createOptionValue({ type: 'COLOR', name: 'Used', code: uniqueCode() }).expect(201)).body;
      const category = await prisma.category.create({
        data: { name: `${CODE_PREFIX} category ${Date.now()}`, slug: `ove-category-${Date.now()}` },
      });
      const product = await prisma.product.create({
        data: {
          name: `${CODE_PREFIX} product ${Date.now()}`,
          slug: `ove-product-${Date.now()}`,
          code: uniqueCode(),
          categoryId: category.id,
        },
      });
      await prisma.productVariant.create({
        data: { productId: product.id, sku: `${product.code}-${value.code}`, colorId: value.id, price: 1 },
      });

      try {
        const res = await remove(value.id).expect(409);
        expect(res.body.message).toBe(`Option Value #${value.id} is used by variants — hide it instead`);
      } finally {
        await prisma.product.delete({ where: { id: product.id } });
        await prisma.category.delete({ where: { id: category.id } });
      }
    });
  });
});
