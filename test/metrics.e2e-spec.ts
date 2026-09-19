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
});
