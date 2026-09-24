import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { PasswordService } from '@src/auth/services/password.service.js';
import { FakeObjectStorageService } from '@src/upload-image/object-storage/fake-object-storage.service.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';
import {
  OptionValueFixtures,
  createOptionValueFixtures,
  deleteOptionValueFixtures,
  uniqueProductCode,
  uploadedImageKey,
} from './support/catalog-fixtures.js';

// Prefix cố định cho mọi product/category tạo trong file này — dùng để
// cleanup ở afterAll (startsWith), tránh dữ liệu test cộng dồn vĩnh viễn qua
// các lần chạy (theo cùng pattern của categories.e2e-spec.ts).
const TEST_NAME_PREFIX = 'ProductsE2E';
const TEST_EMAIL_DOMAIN = '@products.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';
const OPTION_CODE_PREFIX = 'PRE';
const PRODUCT_CODE_PREFIX = 'PE';

type Body = Record<string, unknown>;
interface VariantBody {
  id: string;
  sku: string;
  status: string;
  price: string;
  color: { id: string; code: string } | null;
  size: { id: string; code: string } | null;
}

describe('Products + Variants (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let objectStorage: FakeObjectStorageService;
  let masterAdminAccessToken: string;
  let categoryId: string;
  let options: OptionValueFixtures;
  let nameSeq = 0;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);
    objectStorage = created.objectStorage;

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
    options = await createOptionValueFixtures(prisma, OPTION_CODE_PREFIX);
  });

  afterAll(async () => {
    // FK productVariant.productId → product.id, inventory.variantId →
    // productVariant.id: xoá inventory → variant → product → category theo
    // đúng chiều ngược FK. Option Value xoá sau variant (FK restrict).
    await prisma.inventory.deleteMany({ where: { variant: { product: { name: { startsWith: TEST_NAME_PREFIX } } } } });
    await prisma.productVariant.deleteMany({ where: { product: { name: { startsWith: TEST_NAME_PREFIX } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
    await prisma.category.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
    await deleteOptionValueFixtures(prisma, OPTION_CODE_PREFIX);
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  function uniqueName(label: string): string {
    nameSeq += 1;
    return `${TEST_NAME_PREFIX} ${label} ${Date.now()}-${nameSeq}`;
  }

  // Payload hợp lệ tối thiểu — mỗi test chỉ override phần nó đang kiểm tra.
  function productPayload(overrides: Body = {}): Body {
    return {
      name: uniqueName('Product'),
      code: uniqueProductCode(PRODUCT_CODE_PREFIX),
      categoryId,
      variants: [{ colorId: options.black.id, sizeId: options.sizeM.id, price: 100000 }],
      images: [{ key: uploadedImageKey(objectStorage) }],
      ...overrides,
    };
  }

  function postProduct(body: Body, token = masterAdminAccessToken) {
    return request(app.getHttpServer()).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send(body);
  }

  function patchProduct(id: string, body: Body) {
    return request(app.getHttpServer())
      .patch(`/api/v1/products/${id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send(body);
  }

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
    await request(app.getHttpServer()).post('/api/v1/products').send(productPayload()).expect(401);
  });

  it('POST /api/v1/products as an authenticated CUSTOMER (non-privileged role) returns 403', async () => {
    await postProduct(productPayload(), await createCustomerAndLogin()).expect(403);
  });

  it('POST /api/v1/products with a non-existent categoryId returns 404', async () => {
    await postProduct(productPayload({ categoryId: '00000000-0000-0000-0000-000000000000' })).expect(404);
  });

  it('POST /api/v1/products with a duplicate name returns 409', async () => {
    const name = uniqueName('Duplicate');
    await postProduct(productPayload({ name })).expect(201);

    await postProduct(productPayload({ name })).expect(409);
  });

  it('GET /api/v1/products/:id returns 404 when not found', async () => {
    await request(app.getHttpServer()).get('/api/v1/products/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('POST /api/v1/products creates product + variants + inventory atomically, embedded in the response', async () => {
    const res = await postProduct(
      productPayload({
        variants: [
          { colorId: options.black.id, sizeId: options.sizeM.id, price: 150000 },
          { colorId: options.white.id, sizeId: options.sizeM.id, price: 180000 },
        ],
      }),
    ).expect(201);

    expect(res.body.variants).toHaveLength(2);
    const variantId = res.body.variants[0].id;
    const inventory = await prisma.inventory.findUnique({ where: { variantId } });
    expect(inventory).toMatchObject({ variantId, quantity: 0, reservedQuantity: 0 });
  });

  it('POST /api/v1/products with one invalid variant fails the whole request (no partial product)', async () => {
    const name = uniqueName('Invalid variant');

    await postProduct(
      productPayload({ name, variants: [{ colorId: options.black.id, sizeId: options.sizeM.id, price: -1 }] }),
    ).expect(400);

    expect(await prisma.product.findFirst({ where: { name } })).toBeNull();
  });

  it('PATCH /api/v1/products/:id without a variants field leaves existing variants untouched', async () => {
    const created = (await postProduct(productPayload()).expect(201)).body;

    const patchRes = await patchProduct(created.id, { name: uniqueName('Renamed') }).expect(200);

    expect(patchRes.body.variants).toHaveLength(1);
    expect(patchRes.body.variants[0].id).toBe(created.variants[0].id);
  });

  it('PATCH /api/v1/products/:id with a full variants array updates known ids, creates new ones, and discontinues missing ones', async () => {
    const created = (
      await postProduct(
        productPayload({
          variants: [
            { colorId: options.black.id, sizeId: options.sizeM.id, price: 100000 },
            { colorId: options.white.id, sizeId: options.sizeM.id, price: 100000 },
          ],
        }),
      ).expect(201)
    ).body;
    const keepId = created.variants[0].id;
    const retireId = created.variants[1].id;

    const patchRes = await patchProduct(created.id, {
      variants: [
        { id: keepId, price: 150000 },
        { colorId: options.white.id, sizeId: options.sizeL.id, price: 90000 },
      ],
    }).expect(200);

    const variants: VariantBody[] = patchRes.body.variants;
    const added = variants.find((v) => v.sku === `${created.code}-${options.white.code}-${options.sizeL.code}`);
    expect(variants).toHaveLength(3);
    expect(variants.find((v) => v.id === keepId)).toMatchObject({ price: '150000' });
    expect(variants.find((v) => v.id === retireId)).toMatchObject({ status: 'DISCONTINUED' });
    expect(added).toBeDefined();

    const inventory = await prisma.inventory.findUnique({ where: { variantId: added!.id } });
    expect(inventory).toMatchObject({ quantity: 0 });
    // Inventory của variant vừa discontinue phải giữ nguyên, không bị đụng.
    expect(await prisma.inventory.findUnique({ where: { variantId: retireId } })).not.toBeNull();
  });

  it('PATCH /api/v1/products/:id with a variants entry id from a different product returns 400', async () => {
    const productA = (await postProduct(productPayload()).expect(201)).body;
    const productB = (await postProduct(productPayload()).expect(201)).body;

    await patchProduct(productB.id, { variants: [{ id: productA.variants[0].id, price: 1 }] }).expect(400);
  });

  it('variant sub-resource read routes no longer exist — variants are embedded in GET /products/:id', async () => {
    const product = (await postProduct(productPayload()).expect(201)).body;

    await request(app.getHttpServer()).get(`/api/v1/products/${product.id}/variants`).expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/products/${product.id}/variants/${product.variants[0].id}`)
      .expect(404);
  });

  it('the legacy single-variant write endpoints no longer exist', async () => {
    const product = (await postProduct(productPayload()).expect(201)).body;

    await request(app.getHttpServer())
      .post(`/api/v1/products/${product.id}/variants`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ price: 100000 })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/products/${product.id}/variants/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ price: 1 })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/products/${product.id}/variants/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .expect(404);
  });

  it('DELETE /api/v1/products/:id cascades to its variants and inventory rows (spec §4.5)', async () => {
    const product = (await postProduct(productPayload()).expect(201)).body;
    const variantId = product.variants[0].id;

    // Xác nhận variant + inventory tồn tại trước khi xoá, để test thật sự
    // chứng minh cascade xảy ra (không phải "vốn đã không có gì").
    expect(await prisma.productVariant.findUnique({ where: { id: variantId } })).not.toBeNull();
    expect(await prisma.inventory.findUnique({ where: { variantId } })).not.toBeNull();

    await request(app.getHttpServer())
      .delete(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .expect(204);

    expect(await prisma.productVariant.findUnique({ where: { id: variantId } })).toBeNull();
    expect(await prisma.inventory.findUnique({ where: { variantId } })).toBeNull();
  });

  it('PATCH /api/v1/products/:id with an explicit null name returns 400, not 500', async () => {
    const product = (await postProduct(productPayload()).expect(201)).body;

    await patchProduct(product.id, { name: null }).expect(400);
  });

  describe('Product Code and SKU (ADR 0011)', () => {
    it('composes each variant SKU from the Product Code and its Option Value codes, embedding color and size', async () => {
      const code = uniqueProductCode(PRODUCT_CODE_PREFIX);

      const res = await postProduct(
        productPayload({
          code,
          variants: [
            { colorId: options.black.id, sizeId: options.sizeM.id, price: 100000 },
            { colorId: options.white.id, price: 100000 },
          ],
        }),
      ).expect(201);

      expect(res.body.code).toBe(code);
      const variants: VariantBody[] = res.body.variants;
      expect(variants.map((v) => v.sku).sort()).toEqual(
        [`${code}-${options.black.code}-${options.sizeM.code}`, `${code}-${options.white.code}`].sort(),
      );
      const blackM = variants.find((v) => v.color?.id === options.black.id);
      expect(blackM).toMatchObject({
        color: { id: options.black.id, code: options.black.code },
        size: { id: options.sizeM.id, code: options.sizeM.code },
      });
      expect(variants.find((v) => v.color?.id === options.white.id)?.size).toBeNull();
    });

    it('a variant without color or size has the Product Code as its SKU', async () => {
      const code = uniqueProductCode(PRODUCT_CODE_PREFIX);

      const res = await postProduct(productPayload({ code, variants: [{ price: 50000 }] })).expect(201);

      expect(res.body.variants[0]).toMatchObject({ sku: code, color: null, size: null });
    });

    it('rejects a duplicate Product Code with 409', async () => {
      const code = uniqueProductCode(PRODUCT_CODE_PREFIX);
      await postProduct(productPayload({ code })).expect(201);

      const res = await postProduct(productPayload({ code })).expect(409);
      expect(res.body.message).toBe(`Product code "${code}" already exists`);
    });

    it('rejects changing the Product Code with 400', async () => {
      const product = (await postProduct(productPayload()).expect(201)).body;

      await patchProduct(product.id, { code: uniqueProductCode(PRODUCT_CODE_PREFIX) }).expect(400);
    });

    it('rejects free-text sku/color/size on a variant with 400 — staff pick Option Values instead', async () => {
      await postProduct(productPayload({ variants: [{ sku: 'X-1', price: 1 }] })).expect(400);
      await postProduct(productPayload({ variants: [{ color: 'Black', price: 1 }] })).expect(400);
    });
  });
});
