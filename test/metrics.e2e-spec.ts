import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/create-test-app.js';

describe('Metrics (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /metrics exposes request counters after handling a request', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live');

    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
  });

  it('GET /metrics counts failed (non-2xx) requests with the correct status_code label', async () => {
    const failing = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'irrelevant' });
    expect(failing.status).toBe(400);

    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/http_requests_total\{[^}]*status_code="400"[^}]*\}/);
  });
});
