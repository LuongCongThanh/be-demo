import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { PasswordService } from '@src/auth/services/password.service.js';
import { TokenService } from '@src/auth/services/token.service.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

const TEST_EMAIL_DOMAIN = '@auth-reset-password.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';
const NEW_PASSWORD = 'NewAbc@1234';

describe('Auth — POST /auth/reset-password (e2e)', () => {
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

  async function createResetTokenFor(userId: string, overrides: { usedAt?: Date | null; expiresAt?: Date } = {}) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = tokenService.hashRawToken(rawToken);

    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
        usedAt: overrides.usedAt ?? null,
      },
    });

    return rawToken;
  }

  async function createRefreshTokenFor(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = tokenService.hashRawToken(rawToken);

    await prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    return rawToken;
  }

  it('resets the password, revokes every refresh token, and the new password can log in', async () => {
    const user = await createUser('valid');
    const rawResetToken = await createResetTokenFor(user.id);
    const oldRefreshToken1 = await createRefreshTokenFor(user.id);
    const oldRefreshToken2 = await createRefreshTokenFor(user.id);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: rawResetToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
      .expect(200);

    expect(res.body).toEqual({ message: 'Password has been reset. Please log in again.' });

    // Old password no longer works, new one does.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: VALID_PASSWORD })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: NEW_PASSWORD })
      .expect(200);

    // Every prior refresh token session must be revoked.
    for (const token of [oldRefreshToken1, oldRefreshToken2]) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${token}`])
        .expect(401);
    }
  });

  it('returns 400 for a token that does not exist', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
      .expect(400);
  });

  it('returns 400 for an already-used token, and does not change the password', async () => {
    const user = await createUser('used');
    const rawResetToken = await createResetTokenFor(user.id, { usedAt: new Date() });

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: rawResetToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: VALID_PASSWORD })
      .expect(200);
  });

  it('returns 400 for an expired token', async () => {
    const user = await createUser('expired');
    const rawResetToken = await createResetTokenFor(user.id, { expiresAt: new Date(Date.now() - 1000) });

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: rawResetToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
      .expect(400);
  });

  it('returns 400 when confirmPassword does not match password', async () => {
    const user = await createUser('mismatch');
    const rawResetToken = await createResetTokenFor(user.id);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: rawResetToken, password: NEW_PASSWORD, confirmPassword: 'Different@1234' })
      .expect(400);
  });

  it('returns 400 when the new password does not meet the strength policy', async () => {
    const user = await createUser('weak');
    const rawResetToken = await createResetTokenFor(user.id);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: rawResetToken, password: 'weak', confirmPassword: 'weak' })
      .expect(400);
  });

  it('only one of two concurrent requests with the same reset token succeeds', async () => {
    const user = await createUser('race');
    const rawResetToken = await createResetTokenFor(user.id);

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: rawResetToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }),
      request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: rawResetToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 400]);
  });
});
