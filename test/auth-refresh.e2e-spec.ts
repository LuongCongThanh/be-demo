import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { PasswordService } from '@src/auth/services/password.service.js';
import { TokenService } from '@src/auth/services/token.service.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

const TEST_EMAIL_DOMAIN = '@auth-refresh.e2e-test.local';

describe('Auth — POST /auth/refresh (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let tokenService: TokenService;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    const moduleFixture = created.moduleFixture;

    prisma = moduleFixture.get(PrismaService);
    passwordService = moduleFixture.get(PasswordService);
    tokenService = moduleFixture.get(TokenService);

    await prisma.role.upsert({
      where: { name: 'CUSTOMER' },
      update: {},
      create: { name: 'CUSTOMER' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
    });
  });

  async function createUser(emailSuffix: string) {
    const passwordHash = await passwordService.hash('Abc@1234');

    return createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix,
      passwordHash,
      emailVerifiedAt: new Date(),
    });
  }

  async function createRefreshTokenFor(userId: string, overrides: { revokedAt?: Date | null; expiresAt?: Date } = {}) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = tokenService.hashRawToken(rawToken);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: overrides.revokedAt ?? null,
      },
    });

    return rawToken;
  }

  it('rotates: returns a new access token and a new refresh token cookie, revoking the old one', async () => {
    const user = await createUser('valid');
    const rawToken = await createRefreshTokenFor(user.id);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${rawToken}`])
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty('refreshToken');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const refreshCookie = setCookie.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);

    const oldTokenHash = tokenService.hashRawToken(rawToken);
    const oldRecord = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: oldTokenHash } });
    expect(oldRecord.revokedAt).not.toBeNull();
  });

  it('returns 401 when no refresh token cookie is present', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
  });

  it('returns 401 when the refresh token has expired', async () => {
    const user = await createUser('expired');
    const rawToken = await createRefreshTokenFor(user.id, { expiresAt: new Date(Date.now() - 1000) });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${rawToken}`])
      .expect(401);
  });

  it('reusing an already-revoked token is rejected and revokes every other session of that user', async () => {
    const user = await createUser('reuse');
    const revokedToken = await createRefreshTokenFor(user.id, { revokedAt: new Date() });
    const otherValidToken = await createRefreshTokenFor(user.id);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${revokedToken}`])
      .expect(401);

    // The other still-valid session must now be revoked too, as a
    // consequence of the reuse detection above.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${otherValidToken}`])
      .expect(401);
  });

  it('rejects a BLOCKED user with a still-valid refresh token', async () => {
    const user = await createUser('blocked');
    const rawToken = await createRefreshTokenFor(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'BLOCKED' } });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${rawToken}`])
      .expect(401);

    expect(res.body.message).toBe('Account is locked');
  });

  it('a refresh rejected for BLOCKED ends every session, so unblocking does not revive them', async () => {
    const user = await createUser('blocked-unblocked');
    const rejectedToken = await createRefreshTokenFor(user.id);
    const otherSessionToken = await createRefreshTokenFor(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'BLOCKED' } });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${rejectedToken}`])
      .expect(401);
    expect(res.body.message).toBe('Account is locked');

    await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });

    for (const token of [rejectedToken, otherSessionToken]) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${token}`])
        .expect(401);
    }
  });

  it('a BLOCKED user presenting an expired or revoked token is told the account is locked and loses every session', async () => {
    const user = await createUser('blocked-stale-token');
    const expiredToken = await createRefreshTokenFor(user.id, { expiresAt: new Date(Date.now() - 1000) });
    const revokedToken = await createRefreshTokenFor(user.id, { revokedAt: new Date() });
    const otherSessionToken = await createRefreshTokenFor(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'BLOCKED' } });

    for (const token of [expiredToken, revokedToken]) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${token}`])
        .expect(401);
      expect(res.body.message).toBe('Account is locked');
    }

    await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${otherSessionToken}`])
      .expect(401);
  });

  it('only one of two concurrent requests with the same refresh token succeeds', async () => {
    const user = await createUser('race');
    const rawToken = await createRefreshTokenFor(user.id);

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${rawToken}`]),
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${rawToken}`]),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 401]);
  });
});
