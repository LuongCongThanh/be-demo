import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { PasswordService } from '@src/auth/services/password.service.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

const TEST_EMAIL_DOMAIN = '@auth-forgot-password.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

describe('Auth — POST /auth/forgot-password (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    const moduleFixture = created.moduleFixture;

    prisma = moduleFixture.get(PrismaService);
    passwordService = moduleFixture.get(PasswordService);

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

  const GENERIC_MESSAGE = 'If the email exists, a password reset link has been sent.';

  it('returns the generic message and creates a reset token when the email exists', async () => {
    const user = await createUser('exists');

    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);

    expect(res.body).toEqual({ message: GENERIC_MESSAGE });

    const tokens = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].usedAt).toBeNull();
  });

  it('returns the exact same generic message, without creating a token, when the email does not exist', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: `nobody${Date.now()}${TEST_EMAIL_DOMAIN}` })
      .expect(200);

    expect(res.body).toEqual({ message: GENERIC_MESSAGE });
  });

  it('calling it twice for the same email leaves exactly one valid reset token', async () => {
    const user = await createUser('twice');

    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: user.email }).expect(200);
    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: user.email }).expect(200);

    const tokens = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);
  }, 15000); // 2 real SMTP sends against the sandbox provider; default 5s can be too tight.

  it('returns 400 for an invalid email format', async () => {
    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: 'not-an-email' }).expect(400);
  });
});
