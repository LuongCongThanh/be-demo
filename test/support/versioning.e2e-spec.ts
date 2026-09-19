import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app.js';

describe('API versioning (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves auth routes under /api/v1/auth, not the unversioned path', async () => {
    const unversioned = await request(app.getHttpServer()).post('/auth/login').send({});
    expect(unversioned.status).toBe(404);

    const versioned = await request(app.getHttpServer()).post('/api/v1/auth/login').send({});
    expect(versioned.status).not.toBe(404);
  });
});
