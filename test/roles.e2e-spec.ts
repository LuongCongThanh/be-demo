import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { PasswordService } from '#src/modules/identity/services/auth/password.service.js';
import type { Role, UserStatus } from '#src/generated/prisma/enums.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

const TEST_EMAIL_DOMAIN = '@roles.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Four-actor roles (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  async function createUser(role: Role, status: UserStatus = 'ACTIVE') {
    return createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix: `${role.toLowerCase()}-`,
      passwordHash: await passwordService.hash(VALID_PASSWORD),
      role,
      status,
      emailVerifiedAt: new Date(),
    });
  }

  async function login(email: string) {
    return request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: VALID_PASSWORD });
  }

  async function tokenFor(role: Role): Promise<string> {
    const user = await createUser(role);
    const res = await login(user.email);
    expect(res.status).toBe(200);
    return res.body.accessToken;
  }

  it.each(['CUSTOMER', 'STAFF', 'ADMIN'] as const)(
    'login and /auth/me return role "%s" as a single string',
    async (role) => {
      const user = await createUser(role);
      const loginRes = await login(user.email);

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.role).toBe(role);
      expect(loginRes.body.user).not.toHaveProperty('roles');

      const meRes = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);
      expect(meRes.body.role).toBe(role);
    },
  );

  it('refuses login for a DISABLED account', async () => {
    const user = await createUser('CUSTOMER', 'DISABLED');
    expect((await login(user.email)).status).toBe(401);
  });

  describe('catalog writes are ADMIN-only', () => {
    let staffToken: string;
    let adminToken: string;

    beforeAll(async () => {
      staffToken = await tokenFor('STAFF');
      adminToken = await tokenFor('ADMIN');
    });

    const writes: [string, string][] = [
      ['post', '/api/v1/admin/categories'],
      ['patch', `/api/v1/admin/categories/${MISSING_ID}`],
      ['delete', `/api/v1/admin/categories/${MISSING_ID}`],
      ['post', '/api/v1/admin/products'],
      ['patch', `/api/v1/admin/products/${MISSING_ID}`],
      ['post', `/api/v1/admin/products/${MISSING_ID}/archive`],
      ['post', `/api/v1/admin/products/${MISSING_ID}/variants`],
      ['patch', `/api/v1/admin/products/${MISSING_ID}/variants/${MISSING_ID}`],
      ['post', `/api/v1/admin/products/${MISSING_ID}/variants/${MISSING_ID}/archive`],
    ];

    it.each(writes)('STAFF gets 403 on %s %s', async (method, path) => {
      const agent = request(app.getHttpServer()) as unknown as Record<string, (p: string) => request.Test>;
      await agent[method](path).set('Authorization', `Bearer ${staffToken}`).send({}).expect(403);
    });

    it('ADMIN passes the role check (404/400 from the handler, not 403)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/categories/${MISSING_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  it('rejects an access token with the legacy roles[] payload (401)', async () => {
    const user = await createUser('ADMIN');
    const jwt = new JwtService({ secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET') });
    const legacy = jwt.sign({ sub: user.id, email: user.email, roles: ['ADMIN'], legacyVersion: 0 });

    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${legacy}`).expect(401);
  });
});
