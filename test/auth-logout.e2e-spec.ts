import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/auth/services/password.service.js';
import { TokenService } from '../src/auth/services/token.service.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

const TEST_EMAIL_DOMAIN = '@auth-logout.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

describe('Auth — POST /auth/logout, POST /auth/logout-all (e2e)', () => {
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
    const passwordHash = await passwordService.hash(VALID_PASSWORD);

    return createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix,
      passwordHash,
      emailVerifiedAt: new Date(),
    });
  }

  async function loginAndGetTokens(email: string): Promise<{ accessToken: string; rawRefreshToken: string }> {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password: VALID_PASSWORD });
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const refreshCookie = setCookie.find((c) => c.startsWith('refresh_token='))!;
    const rawRefreshToken = refreshCookie.split(';')[0].split('=')[1];

    return { accessToken: res.body.accessToken, rawRefreshToken };
  }

  async function createRefreshTokenFor(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = tokenService.hashRawToken(rawToken);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return rawToken;
  }

  describe('POST /auth/logout', () => {
    it('returns 401 without a valid access token', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('revokes only the refresh token in the cookie and clears the cookie, leaving other sessions usable', async () => {
      const user = await createUser('single-session');
      const { accessToken, rawRefreshToken } = await loginAndGetTokens(user.email);
      const otherSessionToken = await createRefreshTokenFor(user.id);

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refresh_token=${rawRefreshToken}`])
        .expect(200);

      expect(res.body).toEqual({ message: 'Logged out' });
      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const cleared = setCookie.find((c) => c.startsWith('refresh_token='));
      expect(cleared).toMatch(/refresh_token=;/);

      // The logged-out session's refresh token must be revoked in the DB.
      // (Not re-checked via /auth/refresh here: presenting an
      // already-revoked token there triggers reuse detection, which would
      // revoke the other session too — a different endpoint's behavior,
      // covered by auth-refresh.e2e-spec.ts.)
      const loggedOutTokenHash = tokenService.hashRawToken(rawRefreshToken);
      const loggedOutRecord = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: loggedOutTokenHash } });
      expect(loggedOutRecord.revokedAt).not.toBeNull();

      // The other session must be unaffected and still usable.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [`refresh_token=${otherSessionToken}`])
        .expect(200);
    });
  });

  describe('POST /auth/logout-all', () => {
    it('returns 401 without a valid access token', async () => {
      await request(app.getHttpServer()).post('/auth/logout-all').expect(401);
    });

    it('revokes every session of the current user and does not affect other users', async () => {
      const user = await createUser('multi-session');
      const { accessToken, rawRefreshToken } = await loginAndGetTokens(user.email);
      const secondSessionToken = await createRefreshTokenFor(user.id);
      const thirdSessionToken = await createRefreshTokenFor(user.id);

      const otherUser = await createUser('other-user');
      const otherUserToken = await createRefreshTokenFor(otherUser.id);

      const res = await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual({ message: 'Logged out of all devices' });

      for (const token of [rawRefreshToken, secondSessionToken, thirdSessionToken]) {
        await request(app.getHttpServer())
          .post('/auth/refresh')
          .set('Cookie', [`refresh_token=${token}`])
          .expect(401);
      }

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [`refresh_token=${otherUserToken}`])
        .expect(200);
    });
  });
});
