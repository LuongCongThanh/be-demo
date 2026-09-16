import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/auth/services/password.service.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { createTestUser } from './support/create-test-user.js';

const TEST_EMAIL_DOMAIN = '@auth-login.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

describe('Auth — POST /auth/login (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

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

  async function createUser(
    emailSuffix: string,
    overrides: { status?: 'ACTIVE' | 'BLOCKED'; emailVerifiedAt?: Date | null } = {},
  ) {
    const passwordHash = await passwordService.hash(VALID_PASSWORD);

    return createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix,
      passwordHash,
      status: overrides.status,
      // Login cần email đã verify theo mặc định để test happy-path không
      // phải tự truyền overrides mỗi lần — chỉ case cố tình test "chưa
      // verify" mới truyền `emailVerifiedAt: null`.
      emailVerifiedAt: overrides.emailVerifiedAt === undefined ? new Date() : overrides.emailVerifiedAt,
    });
  }

  it('logs in with correct credentials: access token + user in body, refresh token only in cookie', async () => {
    const user = await createUser('valid');

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: VALID_PASSWORD })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: ['CUSTOMER'],
      emailVerified: true,
    });
    expect(res.body).not.toHaveProperty('refreshToken');

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const refreshCookie = (setCookie as unknown as string[]).find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Secure/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);
  });

  it('returns the same 401 for a non-existent email and for a wrong password', async () => {
    const user = await createUser('wrong-pw');

    const nonExistent = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `nobody${Date.now()}${TEST_EMAIL_DOMAIN}`, password: VALID_PASSWORD })
      .expect(401);

    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'wrong-password' })
      .expect(401);

    expect(nonExistent.body.message).toEqual(wrongPassword.body.message);
  });

  it('rejects a BLOCKED account, even with the correct password', async () => {
    const user = await createUser('blocked', { status: 'BLOCKED' });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: VALID_PASSWORD })
      .expect(401);
  });

  it('rejects an account whose email is not yet verified, even with the correct password', async () => {
    const user = await createUser('unverified', { emailVerifiedAt: null });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: VALID_PASSWORD })
      .expect(401);
  });

  it('returns 400 when the request body fails validation', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: VALID_PASSWORD })
      .expect(400);
  });
});
