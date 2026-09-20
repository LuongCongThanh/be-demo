import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/create-test-app.js';

describe('Categories (e2e)', () => {
  let app: INestApplication;
  let masterAdminAccessToken: string;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.ADMIN_BOOTSTRAP_EMAIL,
        password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
      })
      .expect(200);

    masterAdminAccessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/categories without a Bearer token returns 401', async () => {
    await request(app.getHttpServer()).post('/api/v1/categories').send({ name: 'Shoes' }).expect(401);
  });

  it('POST /api/v1/categories as MASTER_ADMIN creates a category and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name: `Shoes ${Date.now()}` })
      .expect(201);

    expect(res.body).toMatchObject({ name: expect.stringContaining('Shoes') });
    expect(res.body.slug).toBeDefined();
  });

  it('POST /api/v1/categories with a missing name returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({})
      .expect(400);
  });

  it('POST /api/v1/categories with a duplicate name returns 409', async () => {
    const name = `Duplicate ${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${masterAdminAccessToken}`)
      .send({ name })
      .expect(409);
  });

  it('GET /api/v1/categories returns a paginated envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta.page');
    expect(res.body).toHaveProperty('meta.limit');
    expect(res.body).toHaveProperty('meta.total');
  });

  it('GET /api/v1/categories/:id returns 404 when not found', async () => {
    await request(app.getHttpServer()).get('/api/v1/categories/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('GET /api/v1/categories/:id returns 400 when id is not a UUID', async () => {
    await request(app.getHttpServer()).get('/api/v1/categories/not-a-uuid').expect(400);
  });

  it('DELETE /api/v1/categories/:id without a Bearer token returns 401', async () => {
    await request(app.getHttpServer()).delete('/api/v1/categories/00000000-0000-0000-0000-000000000000').expect(401);
  });
});
