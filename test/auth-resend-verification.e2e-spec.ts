import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

const TEST_EMAIL_DOMAIN = '@auth-resend-verification.e2e-test.local';

describe('Auth — POST /auth/resend-verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    const moduleFixture = created.moduleFixture;

    prisma = moduleFixture.get(PrismaService);

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

  async function createUser(emailSuffix: string, overrides: { emailVerifiedAt?: Date } = {}) {
    return createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix,
      emailVerifiedAt: overrides.emailVerifiedAt,
    });
  }

  it('creates a new verification token when the user exists and is not yet verified', async () => {
    const user = await createUser('valid');

    const res = await request(app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: user.email })
      .expect(200);

    expect(res.body).toEqual({
      message: 'If the email exists and is not yet verified, a new verification email has been sent.',
    });

    const tokenRecord = await prisma.emailVerificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(tokenRecord.verifiedAt).toBeNull();
    expect(tokenRecord.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns 400 when the email is not a valid email address', async () => {
    await request(app.getHttpServer()).post('/auth/resend-verification').send({ email: 'not-an-email' }).expect(400);
  });

  it('returns the same generic message and creates no token when the email does not exist', async () => {
    const email = `nobody${Date.now()}${TEST_EMAIL_DOMAIN}`;

    const res = await request(app.getHttpServer()).post('/auth/resend-verification').send({ email }).expect(200);

    expect(res.body).toEqual({
      message: 'If the email exists and is not yet verified, a new verification email has been sent.',
    });

    const tokenCount = await prisma.emailVerificationToken.count({ where: { user: { email } } });
    expect(tokenCount).toBe(0);
  });

  it('returns the same generic message and creates no token when the email is already verified', async () => {
    const user = await createUser('verified', { emailVerifiedAt: new Date() });

    const res = await request(app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: user.email })
      .expect(200);

    expect(res.body).toEqual({
      message: 'If the email exists and is not yet verified, a new verification email has been sent.',
    });

    const tokenCount = await prisma.emailVerificationToken.count({ where: { userId: user.id } });
    expect(tokenCount).toBe(0);
  });
});
