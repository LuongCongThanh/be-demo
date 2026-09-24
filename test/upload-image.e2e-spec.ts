import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { PasswordService } from '@src/auth/services/password.service.js';
import { FakeObjectStorageService } from '@src/upload-image/object-storage/fake-object-storage.service.js';
import type { PresignedUploadTarget } from '@src/upload-image/object-storage/object-storage.service.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';
import { deleteOptionValueFixtures, uniqueProductCode } from './support/catalog-fixtures.js';

const TEST_NAME_PREFIX = 'UploadImageE2E';
const TEST_EMAIL_DOMAIN = '@upload-image.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';
const OPTION_CODE_PREFIX = 'UIE';

describe('Upload images + Product images (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let objectStorage: FakeObjectStorageService;
  let masterAdminAccessToken: string;
  let categoryId: string;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);
    objectStorage = created.objectStorage;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: process.env.ADMIN_BOOTSTRAP_EMAIL, password: process.env.ADMIN_BOOTSTRAP_PASSWORD })
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
    await prisma.inventory.deleteMany({ where: { variant: { product: { name: { startsWith: TEST_NAME_PREFIX } } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
    await prisma.category.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
    await deleteOptionValueFixtures(prisma, OPTION_CODE_PREFIX);
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  function presign(count: number, token = masterAdminAccessToken) {
    const files = Array.from({ length: count }, (_, i) => ({ filename: `p${i}.jpg`, contentType: 'image/jpeg' }));
    return request(app.getHttpServer())
      .post('/api/v1/upload-images/presign')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'PRODUCT_IMAGE', files });
  }

  // Presign + "upload" qua fake storage — trả về các key đã tồn tại, sẵn
  // sàng gửi vào images[].
  async function uploadImages(count: number): Promise<string[]> {
    const res = await presign(count).expect(201);
    return res.body.map((target: PresignedUploadTarget) => {
      objectStorage.simulateUpload(target, { sizeBytes: 1024, contentType: 'image/jpeg' });
      return target.key;
    });
  }

  // Phần payload product ngoài ảnh — các test ở đây chỉ quan tâm `images`.
  function productFields(name = `${TEST_NAME_PREFIX} Product ${Date.now()}-${Math.random()}`) {
    return { name, code: uniqueProductCode('UE'), categoryId, variants: [{ price: 100000 }] };
  }

  // Không truyền ảnh → tự upload 1 ảnh (mỗi Product phải có 1–5 ảnh).
  async function createProduct(images?: { key: string; altText?: string }[]) {
    images ??= (await uploadImages(1)).map((key) => ({ key }));
    const res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ ...productFields(), images })
      .expect(201);
    return res.body;
  }

  function patchImages(productId: string, images: unknown[]) {
    return request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ images });
  }

  async function createCustomerAccessToken(): Promise<string> {
    const passwordHash = await passwordService.hash(VALID_PASSWORD);
    const user = await createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix: 'customer-',
      passwordHash,
      emailVerifiedAt: new Date(),
    });
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: VALID_PASSWORD })
      .expect(200);
    return loginRes.body.accessToken;
  }

  describe('POST /api/v1/upload-images/presign', () => {
    it('returns 401 without a Bearer token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/upload-images/presign')
        .send({ purpose: 'PRODUCT_IMAGE', files: [{ filename: 'a.jpg', contentType: 'image/jpeg' }] })
        .expect(401);
    });

    it('returns 403 for a CUSTOMER asking for PRODUCT_IMAGE uploads', async () => {
      await presign(1, await createCustomerAccessToken()).expect(403);
    });

    it('rejects a PRODUCT_IMAGE batch of 6 files and an unknown purpose with 400', async () => {
      await presign(5).expect(201);
      await presign(6).expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/upload-images/presign')
        .set('Authorization', `Bearer ${masterAdminAccessToken}`)
        .send({ purpose: 'USER_AVATAR', files: [{ filename: 'a.jpg', contentType: 'image/jpeg' }] })
        .expect(400);
    });

    it('returns one Pending Upload target per file under tmp/product-image/', async () => {
      const res = await presign(2).expect(201);

      expect(res.body).toHaveLength(2);
      for (const target of res.body) {
        expect(target.key.startsWith('tmp/product-image/')).toBe(true);
        expect(target.uploadUrl).toEqual(expect.any(String));
      }
    });

    it('names the key <uuid>.<ext from contentType> regardless of the client filename', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/upload-images/presign')
        .set('Authorization', `Bearer ${masterAdminAccessToken}`)
        .send({ purpose: 'PRODUCT_IMAGE', files: [{ filename: 'x./a/cover', contentType: 'image/webp' }] })
        .expect(201);

      expect(res.body[0].key).toMatch(/^tmp\/product-image\/[0-9a-f-]{36}\.webp$/);
    });

    it('a presigned target rejects an oversized upload and a wrong-content-type upload (policy enforcement)', async () => {
      const [target] = (await presign(1).expect(201)).body;

      expect(() =>
        objectStorage.simulateUpload(target, { sizeBytes: 6 * 1024 * 1024, contentType: 'image/jpeg' }),
      ).toThrow();
      expect(() => objectStorage.simulateUpload(target, { sizeBytes: 1024, contentType: 'image/gif' })).toThrow();
    });

    it('the old /products/images/presign route no longer exists', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products/images/presign')
        .set('Authorization', `Bearer ${masterAdminAccessToken}`)
        .send({ files: [{ filename: 'a.jpg', contentType: 'image/jpeg' }] })
        .expect(404);
    });
  });

  describe('POST /api/v1/products with images[]', () => {
    it('stores images in array order under products/<id>/, first one is the Cover Image, temp uploads are discarded', async () => {
      const keys = await uploadImages(3);

      const product = await createProduct(keys.map((key, i) => ({ key, altText: `Image ${i}` })));

      expect(product.images.map((img: { altText: string }) => img.altText)).toEqual(['Image 0', 'Image 1', 'Image 2']);
      for (const image of product.images) {
        expect(image.url).toContain(`/products/${product.id}/`);
        expect(image).not.toHaveProperty('isPrimary');
        expect(image).not.toHaveProperty('sortOrder');
      }
      for (const key of keys) {
        expect(objectStorage.deletedKeys).toContain(key);
      }

      const fetched = await request(app.getHttpServer()).get(`/api/v1/products/${product.id}`).expect(200);
      expect(fetched.body.images.map((img: { id: string }) => img.id)).toEqual(
        product.images.map((img: { id: string }) => img.id),
      );
    });

    it('rejects a key that was never uploaded with 400 and persists nothing', async () => {
      const name = `${TEST_NAME_PREFIX} Missing upload ${Date.now()}`;
      const [target] = (await presign(1).expect(201)).body; // presign nhưng không upload

      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${masterAdminAccessToken}`)
        .send({ ...productFields(name), images: [{ key: target.key }] })
        .expect(400);

      expect(res.body.message).toContain(target.key);
      expect(await prisma.product.findFirst({ where: { name } })).toBeNull();
    });

    it('rejects a key outside the tmp/product-image/ prefix with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${masterAdminAccessToken}`)
        .send({ ...productFields(), images: [{ key: 'products/x/a.jpg' }] })
        .expect(400);
    });

    it('rejects a product without images, or with more than 5, with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${masterAdminAccessToken}`)
        .send({ ...productFields(), images: [] })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${masterAdminAccessToken}`)
        .send(productFields())
        .expect(400);
      const images = Array.from({ length: 6 }, (_, i) => ({ key: `tmp/product-image/${i}.jpg` }));
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${masterAdminAccessToken}`)
        .send({ ...productFields(), images })
        .expect(400);
    });

    it('returns 503 and persists nothing when storage is unavailable', async () => {
      const name = `${TEST_NAME_PREFIX} Storage down ${Date.now()}`;
      const [key] = await uploadImages(1);
      objectStorage.unavailable = true;
      try {
        await request(app.getHttpServer())
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${masterAdminAccessToken}`)
          .send({ ...productFields(name), images: [{ key }] })
          .expect(503);
      } finally {
        objectStorage.unavailable = false;
      }
      expect(await prisma.product.findFirst({ where: { name } })).toBeNull();
    });
  });

  describe('PATCH /api/v1/products/:id with images[]', () => {
    it('reorders kept images (changing the Cover Image), attaches new ones and deletes absent ones', async () => {
      const product = await createProduct((await uploadImages(3)).map((key) => ({ key })));
      const [a, b, c] = product.images;
      const [newKey] = await uploadImages(1);

      const res = await patchImages(product.id, [
        { id: c.id },
        { id: a.id, altText: 'A again' },
        { key: newKey },
      ]).expect(200);

      expect(res.body.images).toHaveLength(3);
      expect(res.body.images[0].id).toBe(c.id); // Cover Image mới
      expect(res.body.images[1]).toMatchObject({ id: a.id, altText: 'A again' });
      expect(res.body.images[2].url).toContain(`/products/${product.id}/`);
      expect(await prisma.productImage.findUnique({ where: { id: b.id } })).toBeNull();
      expect(objectStorage.deletedKeys).toContain(objectStorage.keyFromUrl(b.url));
    });

    it('leaves images untouched when the images field is omitted, and rejects removing them all with 400', async () => {
      const product = await createProduct((await uploadImages(2)).map((key) => ({ key })));

      const renamed = await request(app.getHttpServer())
        .patch(`/api/v1/products/${product.id}`)
        .set('Authorization', `Bearer ${masterAdminAccessToken}`)
        .send({ name: `${TEST_NAME_PREFIX} Renamed ${Date.now()}` })
        .expect(200);
      expect(renamed.body.images).toHaveLength(2);

      await patchImages(product.id, []).expect(400);
      const six = await uploadImages(5);
      await patchImages(product.id, [{ id: product.images[0].id }, ...six.map((key) => ({ key }))]).expect(400);
    });

    it('rejects an image id from another product with 400', async () => {
      const productA = await createProduct((await uploadImages(1)).map((key) => ({ key })));
      const productB = await createProduct();

      await patchImages(productB.id, [{ id: productA.images[0].id }]).expect(400);
    });

    it('rejects an entry with both id and key, or with neither, with 400', async () => {
      const product = await createProduct((await uploadImages(1)).map((key) => ({ key })));
      const [key] = await uploadImages(1);

      await patchImages(product.id, [{ id: product.images[0].id, key }]).expect(400);
      await patchImages(product.id, [{ altText: 'nothing' }]).expect(400);
    });

    it('rolls back and discards the promoted copy when the transaction fails after the copy', async () => {
      const product = await createProduct();
      const [key] = await uploadImages(1);

      // SKU mà variant mới sẽ nhận đã bị một variant của product khác chiếm
      // (chỉ dựng được bằng DB — qua API, SKU luôn mở đầu bằng Product Code
      // duy nhất). Mọi pre-check đều qua, P2002 xảy ra BÊN TRONG transaction,
      // tức là sau khi ảnh đã được copy.
      const color = await prisma.optionValue.create({
        data: {
          type: 'COLOR',
          name: 'Rollback',
          code: `${OPTION_CODE_PREFIX}${Date.now().toString(36).slice(-5).toUpperCase()}`,
        },
      });
      const other = await createProduct();
      await prisma.productVariant.create({
        data: { productId: other.id, sku: `${product.code}-${color.code}`, price: 1 },
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/products/${product.id}`)
        .set('Authorization', `Bearer ${masterAdminAccessToken}`)
        .send({ images: [{ key }], variants: [{ id: product.variants[0].id }, { colorId: color.id, price: 1 }] })
        .expect(409);

      // Ảnh cũ còn nguyên, ảnh mới không được gắn.
      expect(
        (await prisma.productImage.findMany({ where: { productId: product.id } })).map((image) => image.id),
      ).toEqual([product.images[0].id]);
      const fileName = key.slice(key.lastIndexOf('/') + 1);
      expect(objectStorage.deletedKeys).toContain(`products/${product.id}/${fileName}`);
      // Pending Upload vẫn còn — client gửi lại được đúng key cũ.
      expect(objectStorage.objects.has(key)).toBe(true);
    });
  });

  it('DELETE /api/v1/products/:id discards the product image objects', async () => {
    const product = await createProduct((await uploadImages(1)).map((key) => ({ key })));

    await request(app.getHttpServer())
      .delete(`/api/v1/products/${product.id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .expect(204);

    expect(objectStorage.deletedKeys).toContain(objectStorage.keyFromUrl(product.images[0].url));
  });

  it('the old image sub-resource routes no longer exist', async () => {
    const product = await createProduct((await uploadImages(1)).map((key) => ({ key })));
    const imageId = product.images[0].id;
    const auth = { Authorization: `Bearer ${masterAdminAccessToken}` };

    await request(app.getHttpServer()).get(`/api/v1/products/${product.id}/images`).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/products/${product.id}/images`).set(auth).send({}).expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/products/${product.id}/images/${imageId}/primary`)
      .set(auth)
      .expect(404);
    await request(app.getHttpServer()).delete(`/api/v1/products/${product.id}/images/${imageId}`).set(auth).expect(404);
  });
});
