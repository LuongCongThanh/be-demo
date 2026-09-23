import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { PasswordService } from '@src/auth/services/password.service.js';
import { FakeObjectStorageService } from '@src/products/object-storage/fake-object-storage.service.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

const TEST_NAME_PREFIX = 'ProductImagesE2E';
const TEST_EMAIL_DOMAIN = '@product-images.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

describe('Product Images (e2e)', () => {
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
    await prisma.productImage.deleteMany({ where: { product: { name: { startsWith: TEST_NAME_PREFIX } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
    await prisma.category.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  async function createProduct(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `${TEST_NAME_PREFIX} Product ${Date.now()}-${Math.random()}`, categoryId })
      .expect(201);
    return res.body.id;
  }

  it('POST /api/v1/products/images/presign without a Bearer token returns 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/products/images/presign')
      .send({ files: [{ filename: 'a.jpg', contentType: 'image/jpeg' }] })
      .expect(401);
  });

  it('POST /api/v1/products/images/presign rejects a batch of 11 files', async () => {
    const files = Array.from({ length: 11 }, (_, i) => ({ filename: `p${i}.jpg`, contentType: 'image/jpeg' }));
    await request(app.getHttpServer())
      .post('/api/v1/products/images/presign')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ files })
      .expect(400);
  });

  it('POST /api/v1/products/images/presign returns one presigned target per file', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/products/images/presign')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        files: [
          { filename: 'front.jpg', contentType: 'image/jpeg' },
          { filename: 'back.png', contentType: 'image/png' },
        ],
      })
      .expect(201);

    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ key: expect.any(String), uploadUrl: expect.any(String) });
  });

  it('POST /api/v1/products with images[] persists rows atomically, embedded in the response', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        name: `${TEST_NAME_PREFIX} Product with images ${Date.now()}`,
        categoryId,
        images: [
          { key: 'products/uploads/front.jpg', altText: 'Front' },
          { key: 'products/uploads/back.jpg', altText: 'Back' },
        ],
      })
      .expect(201);

    expect(res.body.images).toHaveLength(2);
    expect(res.body.images.filter((img: { isPrimary: boolean }) => img.isPrimary)).toHaveLength(1);
    expect(res.body.images[0].isPrimary).toBe(true);
  });

  it('POST /api/v1/products with 2 images both marked primary returns 400', async () => {
    const name = `${TEST_NAME_PREFIX} Product dup primary ${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({
        name,
        categoryId,
        images: [
          { key: 'products/uploads/a.jpg', isPrimary: true },
          { key: 'products/uploads/b.jpg', isPrimary: true },
        ],
      })
      .expect(400);

    expect(await prisma.product.findFirst({ where: { name } })).toBeNull();
  });

  it('GET /api/v1/products/:id includes images[]', async () => {
    const productId = await createProduct();
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/images`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ key: 'products/uploads/solo.jpg' })
      .expect(201);

    const res = await request(app.getHttpServer()).get(`/api/v1/products/${productId}`).expect(200);
    expect(res.body.images).toHaveLength(1);
  });

  it('POST /api/v1/products/:id/images attaches a single image, defaulting the first image to primary', async () => {
    const productId = await createProduct();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/images`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ key: 'products/uploads/first.jpg' })
      .expect(201);

    expect(res.body.isPrimary).toBe(true);
  });

  it('GET /api/v1/products/:id/images returns the unpaginated list, public', async () => {
    const productId = await createProduct();
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/images`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ key: 'products/uploads/one.jpg' })
      .expect(201);

    const res = await request(app.getHttpServer()).get(`/api/v1/products/${productId}/images`).expect(200);
    expect(res.body).toHaveLength(1);
  });

  it('PATCH /api/v1/products/:id/images/:imageId/primary atomically swaps primary', async () => {
    const productId = await createProduct();
    const first = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/images`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ key: 'products/uploads/one.jpg' })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/images`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ key: 'products/uploads/two.jpg' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}/images/${second.body.id}/primary`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .expect(200);

    const images = await prisma.productImage.findMany({ where: { productId } });
    expect(images.find((i) => i.id === first.body.id)?.isPrimary).toBe(false);
    expect(images.find((i) => i.id === second.body.id)?.isPrimary).toBe(true);
  });

  it('PATCH .../primary returns 404 when the image does not belong to the product', async () => {
    const productAId = await createProduct();
    const productBId = await createProduct();
    const imageOfA = await request(app.getHttpServer())
      .post(`/api/v1/products/${productAId}/images`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ key: 'products/uploads/one.jpg' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/products/${productBId}/images/${imageOfA.body.id}/primary`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .expect(404);
  });

  it('DELETE /api/v1/products/:id/images/:imageId removes the DB row immediately even when storage delete fails', async () => {
    const productId = await createProduct();
    const image = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/images`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ key: 'products/uploads/to-delete.jpg' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/products/${productId}/images/${image.body.id}`)
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .expect(204);

    expect(await prisma.productImage.findUnique({ where: { id: image.body.id } })).toBeNull();
    expect(objectStorage.deletedKeys).toContain('products/uploads/to-delete.jpg');
  });

  it('POST /api/v1/products/:id/images returns 404 when the product does not exist', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/products/00000000-0000-0000-0000-000000000000/images')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ key: 'products/uploads/x.jpg' })
      .expect(404);
  });

  it('write endpoints as an authenticated CUSTOMER (non-privileged role) return 403', async () => {
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

    await request(app.getHttpServer())
      .post('/api/v1/products/images/presign')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({ files: [{ filename: 'a.jpg', contentType: 'image/jpeg' }] })
      .expect(403);
  });
});
